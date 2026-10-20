import { randomUUID } from "node:crypto";
import { saveIntegrationConnection } from "../database/integration-connections-repository.mjs";

// Google Drive OAuth ("Sign in with Google" + Drive access). Same shape as the Shopify/Meta flows: the
// install starts from an authenticated GraphQL mutation so the pending state is bound to the caller's
// workspace, and the redirect back to /google-drive/callback (a bare browser request with no session)
// recovers the workspace from `state`. Needs GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET from a
// Google Cloud OAuth client, and INTEGRATION_ENCRYPTION_KEY.
//
// Scope is the narrow "drive.file": the app only ever gets access to files it creates itself, or that
// the person explicitly selects through the Google Picker widget. Unlike Shopify/Meta, Google access
// tokens expire in about an hour, so this flow asks for offline access (a refresh token) up front.

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const STATE_TTL_MS = 10 * 60 * 1000;
const pendingInstalls = new Map();

function oauthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectBase = process.env.GOOGLE_OAUTH_REDIRECT_BASE ?? process.env.SHOPIFY_OAUTH_REDIRECT_BASE;
  if (!clientId || !clientSecret || !redirectBase) return null;
  return { clientId, clientSecret, redirectUri: `${redirectBase}/google-drive/callback` };
}

/** Registers a pending install for `workspaceId` and returns Google's consent-screen URL. */
export function startGoogleDriveInstall({ workspaceId }) {
  const config = oauthConfig();
  if (!config) {
    throw new Error(
      "Google Drive isn't set up on this server (GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_BASE are missing).",
    );
  }

  const now = Date.now();
  for (const [key, pending] of pendingInstalls) if (pending.expiresAt < now) pendingInstalls.delete(key);
  const state = randomUUID();
  pendingInstalls.set(state, { workspaceId, expiresAt: now + STATE_TTL_MS });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // forces a refresh_token even on a returning user
  url.searchParams.set("state", state);
  return { url: url.toString() };
}

async function exchangeCode(config, code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error_description ?? payload.error ?? `HTTP ${response.status}`);
  return payload;
}

async function fetchGoogleIdentity(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return { email: payload.email, name: payload.name };
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

export async function handleGoogleDriveCallback(req, res) {
  const config = oauthConfig();
  const params = new URL(req.url, "http://localhost").searchParams;
  const state = params.get("state");
  const pending = state ? pendingInstalls.get(state) : null;
  if (state) pendingInstalls.delete(state); // single use, valid or not

  if (!config) return page(res, 400, "Google Drive isn't set up", "The server is missing its Google OAuth credentials.", false);
  if (!pending || pending.expiresAt < Date.now()) {
    return page(res, 400, "That link has expired", "Start the connection again from PRISM.");
  }
  if (params.get("error")) {
    return page(res, 400, "Google Drive wasn't connected", escapeHtml(params.get("error") ?? "The request was cancelled."));
  }
  const code = params.get("code");
  if (!code) return page(res, 400, "Google Drive wasn't connected", "Google didn't return an authorisation code.");

  try {
    const tokens = await exchangeCode(config, code);
    if (!tokens.refresh_token) {
      // Happens if the person had already granted consent and Google skipped the offline-access prompt
      // despite prompt=consent (rare, but possible for a previously-revoked-then-fast-reconnected app).
      throw new Error("Google didn't grant offline access. Try disconnecting in your Google Account's third-party access settings, then connect again.");
    }
    const identity = await fetchGoogleIdentity(tokens.access_token);
    const seconds = Number(tokens.expires_in);
    saveIntegrationConnection(pending.workspaceId, {
      provider: "google-drive",
      externalAccountId: identity.email,
      label: identity.email,
      accessToken: JSON.stringify({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }),
      scopes: SCOPE,
      expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
    });
    return page(res, 200, `Connected ${escapeHtml(identity.email)} to PRISM`, "You can return to PRISM. Open your profile menu, then Integrations, to see the connection.");
  } catch (error) {
    console.error("Google Drive OAuth callback failed:", error.message);
    return page(res, 500, "Google Drive wasn't connected", "Google refused the connection. See the backend logs for the reason.");
  }
}
