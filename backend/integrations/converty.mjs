import { getIntegrationCredentials, saveIntegrationConnection } from "../database/integration-connections-repository.mjs";

export const CONVERTY_PROVIDER = "converty";
// Converty's partner API. Access tokens last ~15 days, refresh tokens ~1 year, and a refresh may rotate the
// refresh token, so the latest one from every response is stored. The token endpoint wants form encoding.
// The OAuth pages live on partner.converty.shop, but the docs' base URL doesn't serve /api/v1 (every route
// there is a 404); the JSON API answers on api.converty.shop, so the two hosts are configured separately.
const DEFAULT_BASE_URL = "https://partner.converty.shop";
const DEFAULT_API_BASE_URL = "https://api.converty.shop";
const DEFAULT_SCOPES = "read-orders read-products read-stores read-hooks create-hooks";
// Refresh a little before the token actually expires so a request never races the clock.
const EXPIRY_SKEW_MS = 5 * 60_000;
const PAGE_LIMIT = 200; // the API's maximum
const MAX_ATTEMPTS = 4; // rate limit is 60 requests a minute; 429 backs off and retries

export function convertyOAuthConfig() {
  const clientId = process.env.CONVERTY_CLIENT_ID;
  const clientSecret = process.env.CONVERTY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectBase =
    process.env.CONVERTY_OAUTH_REDIRECT_BASE ?? process.env.SHOPIFY_OAUTH_REDIRECT_BASE ?? "http://localhost:4000";
  return {
    clientId,
    clientSecret,
    redirectUri: `${redirectBase}/converty/callback`,
    scopes: process.env.CONVERTY_OAUTH_SCOPES ?? DEFAULT_SCOPES,
    baseUrl: (process.env.CONVERTY_OAUTH_BASE ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiBaseUrl: (process.env.CONVERTY_API_BASE ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ""),
  };
}

async function tokenRequest(config, fields) {
  const response = await fetch(`${config.baseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.message ?? `HTTP ${response.status}`);
  return payload;
}

export function exchangeConvertyCode(config, code) {
  return tokenRequest(config, { grant_type: "authorization_code", code });
}

const inFlightRefreshes = new Map();

/** Swaps the stored refresh token for a new pair and saves it. One refresh per workspace at a time, because a rotated refresh token invalidates the old one. */
function refreshConvertyTokens(workspaceId, stored, tokens) {
  const running = inFlightRefreshes.get(workspaceId);
  if (running) return running;
  const config = convertyOAuthConfig();
  const promise = (async () => {
    if (!config) throw new Error("Converty isn't set up on this server.");
    let refreshed;
    try {
      refreshed = await tokenRequest(config, { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
    } catch (error) {
      throw new Error(`Converty rejected the saved connection (${error.message}). Reconnect Converty from Integrations.`);
    }
    const seconds = Number(refreshed.expires_in);
    saveIntegrationConnection(workspaceId, {
      provider: CONVERTY_PROVIDER,
      externalAccountId: stored.externalAccountId,
      label: stored.label,
      accessToken: JSON.stringify({
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? tokens.refreshToken,
      }),
      scopes: stored.scopes,
      expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null,
    });
    return refreshed.access_token;
  })().finally(() => inFlightRefreshes.delete(workspaceId));
  inFlightRefreshes.set(workspaceId, promise);
  return promise;
}

function parseStoredTokens(column) {
  try {
    const parsed = JSON.parse(column);
    if (parsed?.accessToken && parsed?.refreshToken) return parsed;
  } catch {
    // fall through
  }
  return null;
}

/**
 * The workspace's live Converty access token, refreshed first when it is about to expire. Null when there
 * is no connection. Throws when a connection exists but Converty rejects the refresh (the scopes changed or
 * the seller revoked access): callers surface that as "reconnect Converty".
 */
export async function resolveConvertyToken(workspaceId, { forceRefresh = false } = {}) {
  if (!workspaceId) return null;
  const stored = getIntegrationCredentials(workspaceId, CONVERTY_PROVIDER);
  const tokens = stored ? parseStoredTokens(stored.accessToken) : null;
  if (!stored || !tokens) return null;
  const expiring = stored.expiresAt && new Date(stored.expiresAt).getTime() - EXPIRY_SKEW_MS < Date.now();
  if (forceRefresh || expiring) return refreshConvertyTokens(workspaceId, stored, tokens);
  return tokens.accessToken;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiFetch(token, path, { baseUrl = convertyOAuthConfig()?.apiBaseUrl ?? DEFAULT_API_BASE_URL } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
      continue;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const error = new Error(payload.message ?? `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }
}

/** GET against the Converty API for one workspace. A 401 means the token was invalidated: refresh once and retry. */
export async function convertyGet(workspaceId, path) {
  const token = await resolveConvertyToken(workspaceId);
  if (!token) throw new Error("Connect Converty first, from Integrations.");
  try {
    return await apiFetch(token, path);
  } catch (error) {
    if (error.status !== 401) throw error;
    return apiFetch(await resolveConvertyToken(workspaceId, { forceRefresh: true }), path);
  }
}

export async function fetchConvertyStore(accessToken) {
  const payload = await apiFetch(accessToken, "/stores/me");
  const store = payload.data ?? {};
  if (!store._id) throw new Error("Converty didn't return the store.");
  return { id: String(store._id), name: store.name ?? store.slug ?? "Converty store", currency: store.currency ?? null };
}

/** Live status check: calls the API rather than only checking that a token exists. */
export async function getConvertyStatus(workspaceId) {
  const stored = getIntegrationCredentials(workspaceId, CONVERTY_PROVIDER);
  if (!stored) return { id: CONVERTY_PROVIDER, connected: false };
  try {
    const token = await resolveConvertyToken(workspaceId);
    if (!token) throw new Error("The saved connection is unreadable. Reconnect Converty.");
    await fetchConvertyStore(token);
    return { id: CONVERTY_PROVIDER, connected: true, label: stored.label, expiresAt: stored.expiresAt ?? null };
  } catch (error) {
    return { id: CONVERTY_PROVIDER, connected: false, error: error.message, expiresAt: stored.expiresAt ?? null };
  }
}

/**
 * One Converty order in PRISM's shape. `history` keeps every status change with its time (pending, confirmed,
 * in transit, delivered, returned…), which is what turns "placed" orders into delivered/returned outcomes.
 * `attribution` stays null: today's order payload names no ad, campaign or UTM. When Converty exposes one,
 * read it here so the rest of PRISM gets it without changing shape.
 */
export function normalizeConvertyOrder(order) {
  const history = (order.history ?? [])
    .map((entry) => ({ status: entry.status, at: Number.isFinite(entry.timestamp) ? new Date(entry.timestamp).toISOString() : null }))
    .filter((entry) => entry.status);
  return {
    id: String(order._id),
    reference: order.reference ?? null,
    status: order.status ?? null,
    paymentStatus: order.paymentStatus ?? null,
    createdAt: order.createdAt ?? null,
    updatedAt: order.updatedAt ?? null,
    deliveryCompany: order.deliveryCompany ?? null,
    totalPrice: Number(order.total?.totalPrice ?? 0),
    deliveryPrice: Number(order.total?.deliveryPrice ?? 0),
    history,
    items: (order.cart ?? []).map((line) => ({
      productId: line.product?._id ? String(line.product._id) : null,
      name: line.product?.name ?? null,
      quantity: Number(line.quantity ?? 0),
      unitPrice: Number(line.pricePerUnit ?? 0),
    })),
    attribution: null,
  };
}

/** Every order of the connected store, newest page first as Converty returns them, up to `maxPages` pages of 200. */
export async function fetchConvertyOrders(workspaceId, { maxPages = 25 } = {}) {
  const orders = [];
  let total = null;
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await convertyGet(workspaceId, `/orders?page=${page}&limit=${PAGE_LIMIT}`);
    const rows = payload.data ?? [];
    orders.push(...rows.map(normalizeConvertyOrder));
    total = Number.isFinite(payload.count) ? payload.count : total;
    if (rows.length < PAGE_LIMIT || (total !== null && orders.length >= total)) break;
  }
  return { orders, total: total ?? orders.length, truncated: total !== null && orders.length < total };
}

/** Order outcomes by status, with delivered and returned rates over orders that reached a decision. */
export function summarizeConvertyOrders(orders) {
  const byStatus = {};
  for (const order of orders) byStatus[order.status ?? "unknown"] = (byStatus[order.status ?? "unknown"] ?? 0) + 1;
  const delivered = byStatus.delivered ?? 0;
  const returned = byStatus.returned ?? 0;
  const settled = delivered + returned;
  return {
    total: orders.length,
    byStatus,
    delivered,
    returned,
    deliveryRate: settled ? delivered / settled : null,
    deliveredRevenue: orders.filter((order) => order.status === "delivered").reduce((sum, order) => sum + order.totalPrice, 0),
  };
}
