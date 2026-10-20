import { getIntegrationCredentials } from "../database/integration-connections-repository.mjs";

const API_VERSION = "2026-07";

/**
 * A workspace's own stored connection wins. The SHOPIFY_SHOP_DOMAIN /
 * SHOPIFY_ACCESS_TOKEN env pair is a dev-only fallback: outside production it
 * lets an unconnected workspace use the developer's store, and in production
 * it is ignored so no workspace can ever read another party's store.
 */
export function resolveShopifyConfig(workspaceId) {
  const stored = workspaceId ? getIntegrationCredentials(workspaceId, "shopify") : null;
  if (stored) return { domain: stored.externalAccountId, token: stored.accessToken, source: "workspace" };
  if (process.env.NODE_ENV === "production") return null;
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  return domain && token ? { domain, token, source: "env" } : null;
}

export async function shopifyGraphQL(workspaceId, query, variables) {
  const config = resolveShopifyConfig(workspaceId);
  if (!config) throw new Error("Shopify is not configured.");
  const response = await fetch(`https://${config.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": config.token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const message = Array.isArray(payload.errors)
      ? payload.errors.map((error) => error.message ?? error).join(", ")
      : typeof payload.errors === "string"
        ? payload.errors
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload.data;
}

/**
 * Uninstalls this app from the store, which also invalidates the access token. Best effort: never throws,
 * so a disconnect can still remove the local token when Shopify is unreachable or already uninstalled.
 */
export async function uninstallShopifyApp({ domain, token }) {
  try {
    const response = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "mutation { appUninstall { app { id } userErrors { field message } } }",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();
    if (!response.ok || payload.errors) {
      const reason = Array.isArray(payload.errors)
        ? payload.errors.map((error) => error.message ?? error).join(", ")
        : (payload.errors ?? `HTTP ${response.status}`);
      return { ok: false, message: String(reason) };
    }
    const userErrors = payload.data?.appUninstall?.userErrors ?? [];
    if (userErrors.length) return { ok: false, message: userErrors.map((error) => error.message).join(", ") };
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

/** Live status check — actually calls Shopify rather than just checking env presence. */
export async function getShopifyStatus(workspaceId) {
  if (!resolveShopifyConfig(workspaceId)) return { id: "shopify", connected: false };
  try {
    const data = await shopifyGraphQL(workspaceId, "{ shop { name } }");
    return { id: "shopify", connected: true, label: data.shop.name };
  } catch (error) {
    return { id: "shopify", connected: false, error: error.message };
  }
}

const PRODUCT_FIELDS = `id title handle status featuredMedia { preview { image { url } } }`;

function productView(node) {
  return {
    id: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
  };
}

/** Turns free text into a safe Shopify product search ("title:*word*" per word), or null for no filter. */
function titleSearch(text) {
  const words = String(text ?? "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return words.length ? words.map((word) => `title:*${word}*`).join(" ") : null;
}

/** First page of the store's products, alphabetical, optionally filtered by title. */
export async function fetchShopifyProducts(workspaceId, { search, limit = 25 } = {}) {
  const data = await shopifyGraphQL(
    workspaceId,
    `query Products($first: Int!, $query: String) {
      products(first: $first, sortKey: TITLE, query: $query) { nodes { ${PRODUCT_FIELDS} } }
    }`,
    { first: Math.min(Math.max(Number(limit) || 25, 1), 50), query: titleSearch(search) },
  );
  return data.products.nodes.map(productView);
}

/** One product by id, or null when the store has no such product. */
export async function fetchShopifyProduct(workspaceId, id) {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(String(id))) throw new Error("That isn't a Shopify product id.");
  const data = await shopifyGraphQL(
    workspaceId,
    `query Product($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`,
    { id },
  );
  return data.product ? productView(data.product) : null;
}

export async function fetchShopifyOrders(workspaceId, { limit = 10 } = {}) {
  const data = await shopifyGraphQL(
    workspaceId,
    `query Orders($first: Int!) {
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }`,
    { first: limit },
  );
  return data.orders.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    totalAmount: node.totalPriceSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
  }));
}
