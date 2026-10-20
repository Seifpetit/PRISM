import assert from "node:assert/strict";
import test from "node:test";
import { performanceRanges } from "../integrations/meta-performance.mjs";
import { aggregateOrders, clearShopifySalesCache, getShopifySales } from "../integrations/shopify-performance.mjs";

const NOW = new Date("2026-09-21T12:00:00Z");
const ranges = performanceRanges(7, NOW);
const ACME = "gid://shopify/Product/1";
const SOCKS = "gid://shopify/Product/2";

const item = (productId, title, quantity, amount) => ({ title, quantity, product: { id: productId, title }, discountedTotalSet: { shopMoney: { amount: String(amount) } } });
const order = (name, createdAt, total, lineItems, extra = {}) => ({
  id: `gid://shopify/Order/${name}`,
  name,
  createdAt,
  cancelledAt: null,
  test: false,
  displayFinancialStatus: "PAID",
  currentTotalPriceSet: { shopMoney: { amount: String(total) } },
  lineItems: { nodes: lineItems },
  ...extra,
});

const orders = [
  order("#1005", "2026-09-21T09:00:00Z", 55, [item(ACME, "Acme", 1, 40), item(SOCKS, "Socks", 1, 10)]),
  order("#1004", "2026-09-20T22:19:54Z", 40, [item(ACME, "Acme", 2, 40)], { test: true }),
  order("#1003", "2026-09-19T10:00:00Z", 30, [item(SOCKS, "Socks", 3, 30)]),
  order("#1002", "2026-09-18T10:00:00Z", 99, [item(ACME, "Acme", 1, 99)], { cancelledAt: "2026-09-18T11:00:00Z" }),
  order("#1001", "2026-09-10T10:00:00Z", 20, [item(ACME, "Acme", 1, 20)]), // the range before
  order("#0999", "2026-08-01T10:00:00Z", 500, [item(ACME, "Acme", 9, 500)]), // before both ranges
];

test("store totals count each order once, skip cancelled ones, and split into this range and the one before", () => {
  const result = aggregateOrders(orders, ranges);
  assert.deepEqual(result.totals, { orders: 3, units: 7, revenue: 125 }, "cancelled #1002 is not counted; totals use the order totals");
  assert.deepEqual(result.previousTotals, { orders: 1, units: 1, revenue: 20 });
  assert.equal(result.testOrders, 1, "test orders count, and are reported");
  assert.equal(result.daily.length, 7);
  assert.deepEqual(result.daily.at(-1), { date: "2026-09-21", orders: 1, revenue: 55 });
  assert.deepEqual(result.daily.at(0), { date: "2026-09-15", orders: 0, revenue: 0 }, "a day without orders is a zero");
  assert.deepEqual(result.recentOrders.map((o) => o.name), ["#1005", "#1004", "#1003"], "newest first");
  assert.equal(result.recentOrders[0].items, "Acme ×1, Socks ×1");
  assert.deepEqual(result.topProducts.map((p) => [p.title, p.units, p.revenue]), [["Acme", 3, 80], ["Socks", 4, 40]], "by revenue");
});

test("one product counts only the orders that contain it, and its own line-item revenue", () => {
  const result = aggregateOrders(orders, ranges, { productGid: ACME });
  assert.deepEqual(result.totals, { orders: 2, units: 3, revenue: 80 }, "#1003 has no Acme; the Socks line of #1005 is not Acme revenue");
  assert.deepEqual(result.previousTotals, { orders: 1, units: 1, revenue: 20 });
  assert.equal(result.recentOrders[0].items, "Acme ×1", "only the product's lines are listed");
  assert.equal(result.recentOrders[0].total, 40);
  assert.deepEqual(result.topProducts.map((p) => p.title), ["Acme"]);
});

function shopifyStub(pages, calls) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body.variables);
    const index = body.variables.after ? Number(body.variables.after) : 0;
    const nodes = pages[index] ?? [];
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          shop: { name: "My Store", currencyCode: "EUR" },
          orders: { pageInfo: { hasNextPage: index + 1 < pages.length, endCursor: String(index + 1) }, nodes },
        },
      }),
    };
  };
}

async function withShopify(pages, run) {
  const calls = [];
  const realFetch = globalThis.fetch;
  const saved = { domain: process.env.SHOPIFY_SHOP_DOMAIN, token: process.env.SHOPIFY_ACCESS_TOKEN };
  globalThis.fetch = shopifyStub(pages, calls);
  process.env.SHOPIFY_SHOP_DOMAIN = "test.myshopify.com";
  process.env.SHOPIFY_ACCESS_TOKEN = "test-token";
  clearShopifySalesCache();
  try {
    await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, name] of [["domain", "SHOPIFY_SHOP_DOMAIN"], ["token", "SHOPIFY_ACCESS_TOKEN"]]) {
      if (saved[key] === undefined) delete process.env[name];
      else process.env[name] = saved[key];
    }
    clearShopifySalesCache();
  }
}

const today = new Date().toISOString().slice(0, 10);

test("sales are read page by page, in the shop's currency, and kept for a minute", async () => {
  const fresh = (name, total) => order(name, `${today}T08:00:00Z`, total, [item(ACME, "Acme", 1, total)]);
  await withShopify([[fresh("#1", 10), fresh("#2", 20)], [fresh("#3", 30)]], async (calls) => {
    const result = await getShopifySales(null, { days: 7 });
    assert.equal(result.connected, true);
    assert.equal(result.shopName, "My Store");
    assert.equal(result.currency, "EUR");
    assert.equal(result.scope, "store");
    assert.equal(result.totals.orders, 3);
    assert.equal(result.totals.revenue, 60);
    assert.equal(result.truncated, false);
    assert.equal(calls.length, 2, "followed the second page");
    assert.match(calls[0].query, /^created_at:>=\d{4}-\d{2}-\d{2}$/);

    await getShopifySales(null, { days: 7 });
    assert.equal(calls.length, 2, "the second read came from the cache");
    await getShopifySales(null, { days: 7, refresh: true });
    assert.ok(calls.length > 2, "refresh asks Shopify again");
    const scoped = await getShopifySales(null, { days: 7, productGid: ACME });
    assert.equal(scoped.scope, "product");
  });
});

test("Shopify's 60-day window is reported: a longer range is cut, and there is no earlier range to compare", async () => {
  await withShopify([[]], async (calls) => {
    const ninety = await getShopifySales(null, { days: 90 });
    assert.equal(ninety.historyLimited, true);
    assert.equal(ninety.previousTotals, null);
    const oldestAsked = calls[0].query.replace("created_at:>=", "");
    const sixtyDaysAgo = new Date(Date.now() - 59 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(oldestAsked, sixtyDaysAgo, "never asks further back than Shopify answers");

    const thirty = await getShopifySales(null, { days: 30 });
    assert.equal(thirty.historyLimited, false);
    assert.deepEqual(thirty.previousTotals, { orders: 0, units: 0, revenue: 0 }, "30 days plus the 30 before fits exactly");
  });
});

test("sales: not connected is an answer, a bad range is an error, and Shopify rejecting is an answer", async () => {
  clearShopifySalesCache();
  const saved = { domain: process.env.SHOPIFY_SHOP_DOMAIN, token: process.env.SHOPIFY_ACCESS_TOKEN };
  delete process.env.SHOPIFY_SHOP_DOMAIN;
  delete process.env.SHOPIFY_ACCESS_TOKEN;
  try {
    assert.deepEqual(await getShopifySales(null, { days: 30 }), { connected: false, error: null });
    await assert.rejects(() => getShopifySales(null, { days: 45 }), /Choose a range/);
  } finally {
    if (saved.domain !== undefined) process.env.SHOPIFY_SHOP_DOMAIN = saved.domain;
    if (saved.token !== undefined) process.env.SHOPIFY_ACCESS_TOKEN = saved.token;
  }
  const realFetch = globalThis.fetch;
  process.env.SHOPIFY_SHOP_DOMAIN = "test.myshopify.com";
  process.env.SHOPIFY_ACCESS_TOKEN = "test-token";
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ errors: "[API] Invalid API key or access token" }) });
  try {
    assert.deepEqual(await getShopifySales(null, { days: 30 }), { connected: false, error: "[API] Invalid API key or access token" });
  } finally {
    globalThis.fetch = realFetch;
    if (saved.domain === undefined) delete process.env.SHOPIFY_SHOP_DOMAIN;
    else process.env.SHOPIFY_SHOP_DOMAIN = saved.domain;
    if (saved.token === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN;
    else process.env.SHOPIFY_ACCESS_TOKEN = saved.token;
    clearShopifySalesCache();
  }
});
