import {
  getIntegrationCredentials,
  saveIntegrationConnection,
} from "../database/integration-connections-repository.mjs";

const PROVIDER = "google-drive";
// Refresh a little before the token actually expires so a request never races the clock.
const EXPIRY_SKEW_MS = 60_000;

function oauthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function parseStoredTokens(accessTokenColumn) {
  try {
    const parsed = JSON.parse(accessTokenColumn);
    if (parsed?.accessToken && parsed?.refreshToken) return parsed;
  } catch {
    // fall through
  }
  return null;
}

async function refreshAccessToken(refreshToken) {
  const config = oauthConfig();
  if (!config) throw new Error("Google Drive isn't set up on this server.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description ?? payload.error ?? `HTTP ${response.status}`);
  }
  return payload;
}

/**
 * The workspace's live Drive access token, refreshing it first if it has expired. Returns null when
 * there is no connection. Throws when a connection exists but Google rejects the refresh (e.g. the
 * person revoked access on Google's side) — callers surface that as "reconnect Google Drive".
 */
export async function resolveGoogleDriveToken(workspaceId) {
  if (!workspaceId) return null;
  const stored = getIntegrationCredentials(workspaceId, PROVIDER);
  if (!stored) return null;
  const tokens = parseStoredTokens(stored.accessToken);
  if (!tokens) return null;

  const expired = stored.expiresAt && new Date(stored.expiresAt).getTime() - EXPIRY_SKEW_MS < Date.now();
  if (!expired) return tokens.accessToken;

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const seconds = Number(refreshed.expires_in);
  saveIntegrationConnection(workspaceId, {
    provider: PROVIDER,
    externalAccountId: stored.externalAccountId,
    label: stored.label,
    accessToken: JSON.stringify({ accessToken: refreshed.access_token, refreshToken: tokens.refreshToken }),
    scopes: stored.scopes,
    expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
  });
  return refreshed.access_token;
}

/** Live status check — calls the Drive API rather than just checking that a token exists. */
export async function getGoogleDriveStatus(workspaceId) {
  const stored = getIntegrationCredentials(workspaceId, PROVIDER);
  if (!stored) return { id: PROVIDER, connected: false };
  try {
    const token = await resolveGoogleDriveToken(workspaceId);
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
    return { id: PROVIDER, connected: true, label: stored.label, expiresAt: stored.expiresAt ?? null };
  } catch (error) {
    return { id: PROVIDER, connected: false, error: error.message, expiresAt: stored.expiresAt ?? null };
  }
}

/** Downloads a Drive file's bytes and metadata using the workspace's own connection, not the Picker's transient token. */
export async function downloadGoogleDriveFile(workspaceId, fileId) {
  const token = await resolveGoogleDriveToken(workspaceId);
  if (!token) throw new Error("Connect Google Drive first, from Integrations.");

  const metaResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
  );
  const meta = await metaResponse.json();
  if (!metaResponse.ok || meta.error) throw new Error(meta.error?.message ?? `HTTP ${metaResponse.status}`);

  const contentResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) },
  );
  if (!contentResponse.ok) throw new Error(`Could not download the file from Drive (HTTP ${contentResponse.status}).`);
  const bytes = Buffer.from(await contentResponse.arrayBuffer());
  return { name: meta.name, mimeType: meta.mimeType, bytesBase64: bytes.toString("base64") };
}

/**
 * Creates a new file, or overwrites `fileId` when given (a file the person picked through the Picker's
 * overwrite mode, which is what grants this app access to it under the narrow drive.file scope).
 */
export async function uploadGoogleDriveFile(workspaceId, { fileId, name, mimeType, bytesBase64 }) {
  const token = await resolveGoogleDriveToken(workspaceId);
  if (!token) throw new Error("Connect Google Drive first, from Integrations.");

  const bytes = Buffer.from(bytesBase64, "base64");
  const boundary = `prism-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = fileId ? {} : { name };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n` +
    bytes.toString("binary") +
    `\r\n--${boundary}--`;

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`;

  const response = await fetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: Buffer.from(body, "binary"),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  return { fileId: payload.id, webViewLink: payload.webViewLink ?? null };
}

/** Best effort: never throws, so a disconnect can still remove the local token when Google is unreachable. */
export async function revokeGoogleDriveToken(workspaceId) {
  const stored = getIntegrationCredentials(workspaceId, PROVIDER);
  if (!stored) return { ok: true };
  const tokens = parseStoredTokens(stored.accessToken);
  if (!tokens) return { ok: true };
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: tokens.refreshToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, message: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}
