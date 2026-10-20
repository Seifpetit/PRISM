import { randomUUID } from "node:crypto";
import { saveIntegrationConnection } from "../database/integration-connections-repository.mjs";
import { GRAPH_VERSION } from "./meta-ads.mjs";

// Meta ("Log in with Facebook") OAuth. Same shape as the Shopify flow: the install starts from an
// authenticated GraphQL mutation so the pending state is bound to the caller's workspace, and the
// redirect back to /meta/callback (a bare browser request with no session) recovers the workspace
// from `state`. Needs META_APP_ID / META_APP_SECRET from a Meta app, and INTEGRATION_ENCRYPTION_KEY.
//
// Two login styles:
//  - Facebook Login for Business (META_LOGIN_CONFIG_ID set): permissions and token type live in a
//    "Configuration" made in the Meta dashboard, and the login link carries its id instead of `scope`.
//  - Classic Facebook Login (no config id): the link carries `scope` (default ads_read).
// A user token from the code exchange is upgraded to a long-lived one (about 60 days). System-user style
// tokens cannot be upgraded and don't need to be. Meta has no silent refresh: before an expiring token runs
// out the user connects again, so the expiry is stored.

const DEFAULT_SCOPES = "ads_read";
const STATE_TTL_MS = 10 * 60 * 1000;
const pendingInstalls = new Map();

function oauthConfig() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  const redirectBase =
    process.env.META_OAUTH_REDIRECT_BASE ?? process.env.SHOPIFY_OAUTH_REDIRECT_BASE ?? "http://localhost:4000";
  return {
    appId,
    appSecret,
    redirectUri: `${redirectBase}/meta/callback`,
    scopes: process.env.META_OAUTH_SCOPES ?? DEFAULT_SCOPES,
    configId: process.env.META_LOGIN_CONFIG_ID || null,
  };
}

/** Registers a pending install for `workspaceId` and returns Facebook's authorize URL. */
export function startMetaInstall({ workspaceId }) {
  const config = oauthConfig();
  if (!config) throw new Error("Meta login isn't set up on this server (META_APP_ID / META_APP_SECRET are missing).");

  const now = Date.now();
  for (const [key, pending] of pendingInstalls) if (pending.expiresAt < now) pendingInstalls.delete(key);
  const state = randomUUID();
  pendingInstalls.set(state, { workspaceId, expiresAt: now + STATE_TTL_MS });

  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (config.configId) {
    url.searchParams.set("config_id", config.configId);
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", config.scopes);
  }
  return { url: url.toString() };
}

async function graphPost(path, fields) {
  // POST so the app secret and codes stay out of URLs and logs.
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  }
  return payload;
}

async function fetchIdentity(token) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return { id: payload.id, name: payload.name };
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

export async function handleMetaCallback(req, res) {
  const config = oauthConfig();
  const params = new URL(req.url, "http://localhost").searchParams;
  const state = params.get("state");
  const pending = state ? pendingInstalls.get(state) : null;
  if (state) pendingInstalls.delete(state); // single use, valid or not

  if (!config) return page(res, 400, "Meta login isn't set up", "META_APP_ID / META_APP_SECRET are missing on the server.", false);
  if (!pending || pending.expiresAt < Date.now()) {
    return page(res, 400, "That link has expired", "Start the connection again from PRISM.");
  }
  if (params.get("error")) {
    // The user pressed Cancel on Facebook's dialog, or Meta refused the request.
    return page(res, 400, "Meta wasn't connected", escapeHtml(params.get("error_description") ?? "The request was cancelled."));
  }
  const code = params.get("code");
  if (!code) return page(res, 400, "Meta wasn't connected", "Facebook didn't return an authorisation code.");

  try {
    const short = await graphPost("oauth/access_token", {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
    });
    let long;
    try {
      long = await graphPost("oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: config.appId,
        client_secret: config.appSecret,
        fb_exchange_token: short.access_token,
      });
    } catch (error) {
      // System-user style tokens can't be exchanged and are already long-lived (no expires_in). A user token
      // that expires within days must not be saved as if it were fine, so that is a real failure.
      const seconds = Number(short.expires_in);
      const expiresSoon = Number.isFinite(seconds) && seconds < 7 * 86_400;
      if (expiresSoon) throw error;
      long = short;
    }
    const identity = await fetchIdentity(long.access_token);
    const seconds = Number(long.expires_in);
    saveIntegrationConnection(pending.workspaceId, {
      provider: "meta-ads",
      externalAccountId: identity.id,
      label: identity.name,
      accessToken: long.access_token,
      scopes: config.configId ? `config:${config.configId}` : config.scopes,
      expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
    });
    return page(res, 200, `Connected ${escapeHtml(identity.name)} to PRISM`, "You can return to PRISM. Open your profile menu, then Integrations, to see the connection.");
  } catch (error) {
    console.error("Meta OAuth callback failed:", error.message);
    return page(res, 500, "Meta wasn't connected", "Meta refused the connection. See the backend logs for the reason.");
  }
}
