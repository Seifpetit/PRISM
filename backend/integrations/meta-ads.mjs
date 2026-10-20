import {
  getIntegrationConnection,
  getIntegrationCredentials,
  saveIntegrationConnection,
} from "../database/integration-connections-repository.mjs";

export const GRAPH_VERSION = "v26.0";
const PROVIDER = "meta-ads";

/**
 * A workspace's own stored connection wins. The META_ADS_ACCESS_TOKEN env token
 * is a dev-only fallback, ignored in production (same rule as Shopify).
 */
export function resolveMetaAdsToken(workspaceId) {
  const stored = workspaceId ? getIntegrationCredentials(workspaceId, PROVIDER) : null;
  if (stored) return stored.accessToken;
  if (process.env.NODE_ENV === "production") return null;
  return process.env.META_ADS_ACCESS_TOKEN || null;
}

/** Asks the Graph API who the token belongs to. Throws Meta's own message when it is rejected. */
async function fetchMetaIdentity(token) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "id,name");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
  }
  return { id: payload.id, name: payload.name };
}

/**
 * The ad accounts this token can reach, by name. Best effort: a token without ads_read, or one that reaches no ad
 * account, gives an empty list, and the connection is then named after the token's owner instead.
 */
async function fetchMetaAdAccounts(token) {
  try {
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts`);
    url.searchParams.set("fields", "name,account_id");
    url.searchParams.set("limit", "25");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
    const payload = await response.json();
    if (!response.ok || payload.error || !Array.isArray(payload.data)) return [];
    return payload.data
      .filter((account) => account?.account_id && typeof account.name === "string" && account.name.trim())
      .map((account) => ({ id: `act_${account.account_id}`, name: account.name.trim() }));
  } catch {
    return [];
  }
}

/** Live status check — calls the Graph API rather than just checking that a token exists. */
export async function getMetaAdsStatus(workspaceId) {
  const token = resolveMetaAdsToken(workspaceId);
  if (!token) return { id: PROVIDER, connected: false };
  const stored = workspaceId ? getIntegrationConnection(workspaceId, PROVIDER) : null;
  const expiresAt = stored?.expiresAt ?? null;
  try {
    const identity = await fetchMetaIdentity(token);
    // The name saved when the token was connected (the ad account) wins; the token owner is the fallback.
    return { id: PROVIDER, connected: true, label: stored?.label ?? identity.name, expiresAt };
  } catch (error) {
    return { id: PROVIDER, connected: false, error: error.message, expiresAt };
  }
}

/**
 * Validates the Marketing API token a person pasted (their own) with Meta and stores it, encrypted, for the
 * workspace. Nothing is saved if Meta rejects the token. Reconnecting replaces the token. The connection is named
 * after the ad account the token reaches ("Acme Ads", or "Acme Ads +2 more" when it reaches several); a token that
 * reaches none is named after its owner.
 */
export async function connectMetaAds(workspaceId, accessToken) {
  const token = typeof accessToken === "string" ? accessToken.trim() : "";
  if (!token) throw new Error("Paste a Meta access token.");
  if (token.length > 1_000) throw new Error("That doesn't look like a Meta access token.");
  const identity = await fetchMetaIdentity(token);
  const accounts = await fetchMetaAdAccounts(token);
  const first = accounts[0];
  const label = first ? `${first.name}${accounts.length > 1 ? ` +${accounts.length - 1} more` : ""}` : identity.name;
  saveIntegrationConnection(workspaceId, {
    provider: PROVIDER,
    externalAccountId: first ? first.id : identity.id,
    label,
    accessToken: token,
  });
  return { id: PROVIDER, connected: true, label };
}
