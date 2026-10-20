import { performanceRanges } from "./meta-performance.mjs";
import { resolveShopifyConfig, shopifyGraphQL } from "./shopify.mjs";

// Read-only sales numbers for the Performance tab, from the connected Shopify store: orders, units and revenue per
// day for the last 7, 30 or 90 days and for the range before, the latest orders, and the top products. Nothing is
// saved; each answer is kept for a minute. With the read_orders permission Shopify returns only the last 60 days of
// orders, so a longer range is cut there and says so.

const CACHE_MS = 60_000;
const HISTORY_DAYS = 60;
const PAGE_SIZE = 40;
const MAX_PAGES = 15;
const cache = new Map();

const DAY_MS = 86_400_000;
const ymd = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value) => Math.round(value * 100) / 100;

const ORDERS_QUERY = `query SalesOrders($first: Int!, $after: String, $query: String) {
  shop { name currencyCode }
  orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      name
      createdAt
      cancelledAt
      test
      displayFinancialStatus
      currentTotalPriceSet { shopMoney { amount } }
      lineItems(first: 10) { nodes { title quantity product { id title } discountedTotalSet { shopMoney { amount } } } }
    }
  }
}`;

/**
 * Turns raw Shopify orders into the numbers PRISM shows. Cancelled orders are left out. For one product
 * (`productGid`), an order counts when it contains that product, and its revenue is that product's line items after
 * discounts; for the whole store it is the order total. Pure, so it can be tested with plain objects.
 */
export function aggregateOrders(orders, ranges, { productGid = null } = {}) {
  const inRange = (iso, range) => iso >= range.since && iso <= range.until;
  const empty = () => ({ orders: 0, units: 0, revenue: 0 });
  const totals = empty();
  const previousTotals = empty();
  const byDay = new Map();
  const products = new Map();
  const recent = [];
  let testOrders = 0;

  for (const order of orders) {
    if (order.cancelledAt) continue;
    const date = String(order.createdAt).slice(0, 10);
    const current = inRange(date, ranges.current);
    if (!current && !inRange(date, ranges.previous)) continue;

    const items = order.lineItems?.nodes ?? [];
    const matching = productGid ? items.filter((item) => item.product?.id === productGid) : items;
    if (productGid && matching.length === 0) continue;
    const units = matching.reduce((sum, item) => sum + number(item.quantity), 0);
    const revenue = productGid
      ? matching.reduce((sum, item) => sum + number(item.discountedTotalSet?.shopMoney?.amount), 0)
      : number(order.currentTotalPriceSet?.shopMoney?.amount);

    const bucket = current ? totals : previousTotals;
    bucket.orders += 1;
    bucket.units += units;
    bucket.revenue += revenue;
    if (!current) continue;

    if (order.test) testOrders += 1;
    const day = byDay.get(date) ?? { orders: 0, revenue: 0 };
    day.orders += 1;
    day.revenue += revenue;
    byDay.set(date, day);
    for (const item of matching) {
      const key = item.product?.id ?? item.title;
      const row = products.get(key) ?? { id: item.product?.id ?? null, title: item.product?.title ?? item.title, units: 0, revenue: 0 };
      row.units += number(item.quantity);
      row.revenue += number(item.discountedTotalSet?.shopMoney?.amount);
      products.set(key, row);
    }
    recent.push({
      id: order.id,
      name: order.name,
      createdAt: order.createdAt,
      status: order.displayFinancialStatus ?? "UNKNOWN",
      total: round(revenue),
      items: matching.map((item) => `${item.title} ×${number(item.quantity)}`).join(", "),
      test: Boolean(order.test),
    });
  }

  const daily = [];
  for (let day = new Date(`${ranges.current.since}T00:00:00Z`); ymd(day) <= ranges.current.until; day = addDays(day, 1)) {
    const date = ymd(day);
    const row = byDay.get(date) ?? { orders: 0, revenue: 0 };
    daily.push({ date, orders: row.orders, revenue: round(row.revenue) });
  }
  const finish = (bucket) => ({ orders: bucket.orders, units: bucket.units, revenue: round(bucket.revenue) });
  return {
    totals: finish(totals),
    previousTotals: finish(previousTotals),
    daily,
    recentOrders: recent.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8),
    topProducts: [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((row) => ({ ...row, revenue: round(row.revenue) })),
    testOrders,
  };
}

async function fetchOrders(workspaceId, sinceDate) {
  const orders = [];
  let shop = null;
  let after = null;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await shopifyGraphQL(workspaceId, ORDERS_QUERY, { first: PAGE_SIZE, after, query: `created_at:>=${sinceDate}` });
    shop = data.shop;
    orders.push(...data.orders.nodes);
    if (!data.orders.pageInfo.hasNextPage) return { shop, orders, truncated };
    after = data.orders.pageInfo.endCursor;
  }
  truncated = true;
  return { shop, orders, truncated };
}

/**
 * The Shopify sales for the workspace's store over the last 7, 30 or 90 days. `productGid` limits it to one product.
 * A store that is not connected, or that Shopify rejects, is an answer rather than an error.
 */
export async function getShopifySales(workspaceId, { days = 30, refresh = false, productGid = null } = {}) {
  if (![7, 30, 90].includes(days)) throw new Error("Choose a range of 7, 30 or 90 days.");
  if (!resolveShopifyConfig(workspaceId)) return { connected: false, error: null };
  const key = `${workspaceId}|${days}|${productGid ?? "store"}`;
  const cached = cache.get(key);
  if (!refresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const ranges = performanceRanges(days);
    const oldest = ymd(addDays(new Date(`${ranges.current.until}T00:00:00Z`), -(HISTORY_DAYS - 1)));
    // Ask for the previous range too, but never further back than Shopify will answer.
    const since = ranges.previous.since < oldest ? oldest : ranges.previous.since;
    const { shop, orders, truncated } = await fetchOrders(workspaceId, since);
    const aggregated = aggregateOrders(orders, ranges, { productGid });
    const limited = ranges.current.since < oldest;
    const comparable = ranges.previous.since >= oldest;
    const value = {
      connected: true,
      shopName: shop?.name ?? null,
      currency: shop?.currencyCode ?? "USD",
      scope: productGid ? "product" : "store",
      range: ranges.current,
      ...aggregated,
      previousTotals: comparable ? aggregated.previousTotals : null,
      historyLimited: limited,
      truncated,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (error) {
    cache.delete(key);
    return { connected: false, error: error.message };
  }
}

export function clearShopifySalesCache() {
  cache.clear();
}
