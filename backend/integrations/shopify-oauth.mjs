import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { saveIntegrationConnection } from "../database/integration-connections-repository.mjs";

// Shopify Admin API OAuth. The install starts from an authenticated GraphQL
// mutation (startShopifyConnection) so the pending state is bound to the
// caller's workspace; Shopify's redirect back to /shopify/callback is a bare
// browser request with no session, so the workspace is recovered from `state`.
// Needs SHOPIFY_APP_CLIENT_ID / SHOPIFY_APP_CLIENT_SECRET / SHOPIFY_OAUTH_REDIRECT_BASE
// and INTEGRATION_ENCRYPTION_KEY (the token is encrypted before it is stored).

const SCOPES = "read_orders,read_products";
const STATE_TTL_MS = 10 * 60 * 1000;
const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const pendingInstalls = new Map();

function oauthConfig() {
  const clientId = process.env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_APP_CLIENT_SECRET;
  const redirectBase = process.env.SHOPIFY_OAUTH_REDIRECT_BASE;
  if (!clientId || !clientSecret || !redirectBase) return null;
  return { clientId, clientSecret, redirectBase };
}

export function normalizeShopDomain(value) {
  const shop = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SHOP_DOMAIN_PATTERN.test(shop) ? shop : null;
}

/** Shopify signs the callback query string: HMAC-SHA256 (client secret) over the sorted params minus `hmac`. */
export function verifyShopifyHmac(searchParams, clientSecret) {
  const provided = searchParams.get("hmac");
  if (!provided) return false;
  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = Buffer.from(createHmac("sha256", clientSecret).update(message).digest("hex"));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * True for requests that arrived through the public tunnel (Host = SHOPIFY_OAUTH_REDIRECT_BASE's host)
 * for anything other than the OAuth callback. The tunnel exists only so Shopify can redirect back;
 * exposing /graphql through it would let anyone on the internet use the passwordless sign-in.
 */
export function isBlockedTunnelRequest(req) {
  const base = process.env.SHOPIFY_OAUTH_REDIRECT_BASE;
  if (!base) return false;
  let tunnelHost;
  try {
    tunnelHost = new URL(base).hostname.toLowerCase();
  } catch {
    return false;
  }
  // A localhost redirect base means no tunnel is in use; never block the app's own local traffic.
  if (["localhost", "127.0.0.1", "[::1]", "::1"].includes(tunnelHost)) return false;
  const requestHost = String(req.headers?.host ?? "").split(":")[0].toLowerCase();
  const path = String(req.url ?? "").split("?")[0];
  const allowedPaths = new Set(["/shopify/callback", "/meta/callback", "/google-drive/callback", "/converty/callback"]);
  return requestHost === tunnelHost && !allowedPaths.has(path);
}

/** Registers a pending install for `workspaceId` and returns the Shopify authorize URL. */
export function startShopifyInstall({ workspaceId, shop: requestedShop }) {
  const config = oauthConfig();
  if (!config) {
    throw new Error(
      "Missing SHOPIFY_APP_CLIENT_ID / SHOPIFY_APP_CLIENT_SECRET / SHOPIFY_OAUTH_REDIRECT_BASE in .env",
    );
  }
  const shop = normalizeShopDomain(requestedShop ?? process.env.SHOPIFY_SHOP_DOMAIN);
  if (!shop) throw new Error("Enter a valid store domain, e.g. your-store.myshopify.com.");

  const now = Date.now();
  for (const [key, pending] of pendingInstalls) if (pending.expiresAt < now) pendingInstalls.delete(key);
  const state = randomUUID();
  pendingInstalls.set(state, { workspaceId, shop, expiresAt: now + STATE_TTL_MS });

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", `${config.redirectBase}/shopify/callback`);
  url.searchParams.set("state", state);
  return { url: url.toString(), shop };
}

function respond(res, status, message) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(message);
}

/** Success page for the browser tab Shopify redirected. `shop` is already validated against SHOP_DOMAIN_PATTERN. */
function respondConnected(res, shop) {
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>Shopify connected</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem">` +
      `<h1 style="font-size:1.25rem">Connected ${shop} to PRISM</h1>` +
      `<p>You can return to PRISM. Open your profile menu, then Integrations, to see the connection.</p>` +
      `<p><a href="${appUrl}">Return to PRISM</a></p></body>`,
  );
}

export async function handleShopifyCallback(req, res) {
  const config = oauthConfig();
  const params = new URL(req.url, "http://localhost").searchParams;
  const code = params.get("code");
  const shop = normalizeShopDomain(params.get("shop"));
  const state = params.get("state");

  if (!config || !code || !shop) return respond(res, 400, "Missing code/shop, or OAuth env vars not configured.");
  if (!verifyShopifyHmac(params, config.clientSecret)) return respond(res, 400, "Invalid request signature.");

  const pending = state ? pendingInstalls.get(state) : null;
  if (state) pendingInstalls.delete(state); // single use, valid or not
  if (!pending || pending.expiresAt < Date.now()) {
    return respond(res, 400, "State mismatch or expired — start the connection again from PRISM.");
  }
  // `shop` is covered by Shopify's signature (checked above), so it is authoritative. It is the store's
  // canonical *.myshopify.com domain, which can differ from the alias or old domain that was requested.

  try {
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code }),
    });
    const payload = await tokenResponse.json();
    if (!tokenResponse.ok || !payload.access_token) {
      console.error("Shopify OAuth token exchange failed:", tokenResponse.status, payload.error ?? "");
      return respond(res, 500, "Token exchange failed — see backend logs.");
    }
    saveIntegrationConnection(pending.workspaceId, {
      provider: "shopify",
      externalAccountId: shop,
      label: shop,
      accessToken: payload.access_token,
      scopes: payload.scope ?? SCOPES,
    });
  } catch (error) {
    console.error("Shopify OAuth callback failed:", error.message);
    return respond(res, 500, "Could not complete the connection — see backend logs.");
  }
  respondConnected(res, shop);
}
