import { randomUUID } from "node:crypto";
import { saveIntegrationConnection } from "../database/integration-connections-repository.mjs";
import { CONVERTY_PROVIDER, convertyOAuthConfig, exchangeConvertyCode, fetchConvertyStore } from "./converty.mjs";

// Converty OAuth 2.0 (Authorization Code). Same shape as the Shopify/Meta/Google flows: the install starts
// from an authenticated GraphQL mutation so the pending state is bound to the caller's workspace, and the
// redirect back to /converty/callback (a bare browser request with no session) recovers the workspace from
// `state`. Needs CONVERTY_CLIENT_ID / CONVERTY_CLIENT_SECRET (from the app created in Converty's
// Integrations > Apps) and INTEGRATION_ENCRYPTION_KEY. Register <backend>/converty/callback as a redirect URL.

const STATE_TTL_MS = 10 * 60 * 1000;
const pendingInstalls = new Map();

/** Registers a pending install for `workspaceId` and returns Converty's consent-screen URL. */
export function startConvertyInstall({ workspaceId }) {
  const config = convertyOAuthConfig();
  if (!config) {
    throw new Error("Converty isn't set up on this server (CONVERTY_CLIENT_ID / CONVERTY_CLIENT_SECRET are missing).");
  }

  const now = Date.now();
  for (const [key, pending] of pendingInstalls) if (pending.expiresAt < now) pendingInstalls.delete(key);
  const state = randomUUID();
  pendingInstalls.set(state, { workspaceId, expiresAt: now + STATE_TTL_MS });

  const url = new URL(`${config.baseUrl}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  return { url: url.toString() };
}

function page(res, status, heading, body, linkBack = true) {
  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>${heading}</title>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem">` +
      `<h1 style="font-size:1.25rem">${heading}</h1><p>${body}</p>` +
      (linkBack ? `<p><a href="${appUrl}">Return to PRISM</a></p>` : "") +
      `</body>`,
  );
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export async function handleConvertyCallback(req, res) {
  const config = convertyOAuthConfig();
  const params = new URL(req.url, "http://localhost").searchParams;
  const state = params.get("state");
  const pending = state ? pendingInstalls.get(state) : null;
  if (state) pendingInstalls.delete(state); // single use, valid or not

  if (!config) return page(res, 400, "Converty isn't set up", "The server is missing its Converty OAuth credentials.", false);
  if (!pending || pending.expiresAt < Date.now()) {
    return page(res, 400, "That link has expired", "Start the connection again from PRISM.");
  }
  if (params.get("error")) {
    return page(res, 400, "Converty wasn't connected", escapeHtml(params.get("error_description") ?? params.get("error")));
  }
  const code = params.get("code");
  if (!code) return page(res, 400, "Converty wasn't connected", "Converty didn't return an authorisation code.");

  try {
    let tokens;
    try {
      tokens = await exchangeConvertyCode(config, code);
    } catch (error) {
      throw new Error(`token exchange failed: ${error.message}`);
    }
    let store;
    try {
      store = await fetchConvertyStore(tokens.access_token);
    } catch (error) {
      throw new Error(`token accepted, but GET /api/v1/stores/me failed: ${error.message}`);
    }
    const seconds = Number(tokens.expires_in);
    saveIntegrationConnection(pending.workspaceId, {
      provider: CONVERTY_PROVIDER,
      externalAccountId: store.id,
      label: store.name,
      accessToken: JSON.stringify({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }),
      scopes: config.scopes,
      expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
    });
    return page(res, 200, `Connected ${escapeHtml(store.name)} to PRISM`, "You can return to PRISM. Open your profile menu, then Integrations, to see the connection.");
  } catch (error) {
    console.error("Converty OAuth callback failed:", error.message);
    return page(res, 500, "Converty wasn't connected", "Converty refused the connection. See the backend logs for the reason.");
  }
}
