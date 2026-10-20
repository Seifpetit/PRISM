import assert from "node:assert/strict";
import test from "node:test";
import {
  clearMetaPerformanceCache,
  getMetaAdsPerformance,
  metricsFromRow,
  performanceRanges,
} from "../integrations/meta-performance.mjs";

test("the range is the last N days ending today, and the N days before it", () => {
  const { current, previous } = performanceRanges(7, new Date("2026-09-21T15:00:00Z"));
  assert.deepEqual(current, { since: "2026-09-15", until: "2026-09-21", days: 7 });
  assert.deepEqual(previous, { since: "2026-09-08", until: "2026-09-14", days: 7 });
  assert.equal(performanceRanges(90, new Date("2026-09-21T00:00:00Z")).current.since, "2026-06-24");
});

test("a purchase is counted once even when Meta reports it under several action types", () => {
  const row = {
    spend: "12.50",
    impressions: "1000",
    reach: "800",
    inline_link_clicks: "40",
    actions: [
      { action_type: "link_click", value: "40" },
      { action_type: "purchase", value: "2" },
      { action_type: "omni_purchase", value: "3" },
    ],
    action_values: [
      { action_type: "purchase", value: "60" },
      { action_type: "omni_purchase", value: "90.5" },
    ],
  };
  assert.deepEqual(metricsFromRow(row), { spend: 12.5, impressions: 1000, reach: 800, clicks: 40, purchases: 3, revenue: 90.5 });
  assert.deepEqual(metricsFromRow({}), { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, revenue: 0 });
  assert.equal(metricsFromRow({ actions: [{ action_type: "purchase", value: "2" }] }).purchases, 2, "falls back to the plain purchase type");
});

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function metaStub(overrides = {}) {
  const calls = [];
  const fake = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const respond = (body, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
    if (overrides.reject) return respond({ error: { message: overrides.reject } }, false);
    if (url.pathname.endsWith("/me/adaccounts")) return respond({ data: [{ name: "Acme Ads", account_id: "42" }] });
    if (url.pathname.endsWith("/act_42")) return respond({ name: "Acme Ads", account_status: 1, currency: "USD" });
    if (url.pathname.endsWith("/act_42/campaigns")) {
      return respond({ data: [{ id: "c1", name: "Main", effective_status: "ACTIVE" }, { id: "c2", name: "Paused test", effective_status: "PAUSED" }, { id: "c3", name: "Idle but active", effective_status: "ACTIVE" }] });
    }
    if (url.pathname.endsWith("/act_42/insights")) {
      if (url.searchParams.get("level") === "campaign") {
        return respond({
          data: [
            { campaign_id: "c2", campaign_name: "Paused test", spend: "5", impressions: "100", inline_link_clicks: "3" },
            { campaign_id: "c1", campaign_name: "Main", spend: "40", impressions: "900", inline_link_clicks: "30", actions: [{ action_type: "omni_purchase", value: "4" }], action_values: [{ action_type: "omni_purchase", value: "200" }] },
          ],
        });
      }
      const range = JSON.parse(url.searchParams.get("time_range"));
      if (url.searchParams.get("time_increment") === "1") {
        return respond({ data: [{ date_start: yesterday, spend: "20", impressions: "500", inline_link_clicks: "15" }, { date_start: today, spend: "25", impressions: "500", inline_link_clicks: "18" }] });
      }
      const isCurrent = range.until === today;
      return respond({ data: [isCurrent ? { spend: "45", impressions: "1000", reach: "700", inline_link_clicks: "33" } : { spend: "30", impressions: "800", reach: "600", inline_link_clicks: "20" }] });
    }
    return respond({ error: { message: `unexpected ${url.pathname}` } }, false);
  };
  return { fake, calls };
}

async function withMeta(stub, run) {
  const realFetch = globalThis.fetch;
  const realToken = process.env.META_ADS_ACCESS_TOKEN;
  globalThis.fetch = stub.fake;
  process.env.META_ADS_ACCESS_TOKEN = "test-token";
  clearMetaPerformanceCache();
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
    if (realToken === undefined) delete process.env.META_ADS_ACCESS_TOKEN;
    else process.env.META_ADS_ACCESS_TOKEN = realToken;
    clearMetaPerformanceCache();
  }
}

test("performance: totals, the range before, a gap-free daily series and campaigns with their status", async () => {
  const stub = metaStub();
  await withMeta(stub, async () => {
    const result = await getMetaAdsPerformance(null, { days: 7 });
    assert.equal(result.connected, true);
    assert.equal(result.accountName, "Acme Ads");
    assert.equal(result.accountId, "act_42");
    assert.equal(result.accountStatus, "ACTIVE");
    assert.equal(result.currency, "USD");
    assert.equal(result.totals.spend, 45);
    assert.equal(result.previousTotals.spend, 30);
    assert.equal(result.daily.length, 7, "every day of the range is present");
    assert.equal(result.daily.at(-1).date, today);
    assert.equal(result.daily.at(-1).spend, 25);
    assert.equal(result.daily.at(0).spend, 0, "a day with no delivery is a zero, not a gap");
    assert.deepEqual(result.campaigns.map((c) => [c.name, c.status]), [["Main", "ACTIVE"], ["Paused test", "PAUSED"], ["Idle but active", "ACTIVE"]], "by spend, then running campaigns with no delivery");
    assert.equal(result.campaigns[0].purchases, 4);
    assert.equal(result.campaigns[0].revenue, 200);
    assert.ok(stub.calls.every((url) => url.searchParams.get("access_token") === null), "the token is sent in a header, never the URL");
    assert.ok(stub.calls.filter((url) => url.pathname.endsWith("/insights")).length >= 4);
  });
});

test("performance is kept for a minute, and refresh asks Meta again", async () => {
  const stub = metaStub();
  await withMeta(stub, async () => {
    await getMetaAdsPerformance(null, { days: 30 });
    const after = stub.calls.length;
    await getMetaAdsPerformance(null, { days: 30 });
    assert.equal(stub.calls.length, after, "the second read came from the cache");
    await getMetaAdsPerformance(null, { days: 7 });
    assert.ok(stub.calls.length > after, "another range is another read");
    const before = stub.calls.length;
    await getMetaAdsPerformance(null, { days: 30, refresh: true });
    assert.ok(stub.calls.length > before, "refresh bypasses the cache");
  });
});

test("performance: Meta rejecting the token is an answer, and only 7, 30 or 90 days are allowed", async () => {
  await withMeta(metaStub({ reject: "Session has expired" }), async () => {
    assert.deepEqual(await getMetaAdsPerformance(null, { days: 30 }), { connected: false, error: "Session has expired" });
  });
  await withMeta(metaStub(), async () => {
    await assert.rejects(() => getMetaAdsPerformance(null, { days: 45 }), /Choose a range/);
    delete process.env.META_ADS_ACCESS_TOKEN;
    assert.deepEqual(await getMetaAdsPerformance(null, { days: 30 }), { connected: false, error: null }, "no token: not connected, nothing asked");
  });
});

test("performance for a product asks Meta for only its campaigns, and is cached apart from the whole account", async () => {
  const stub = metaStub();
  await withMeta(stub, async () => {
    const scoped = await getMetaAdsPerformance(null, { days: 30, campaignIds: ["c2", "c1"] });
    assert.equal(scoped.scope, "product");
    assert.equal(scoped.campaignCount, 2);
    const insights = stub.calls.filter((url) => url.pathname.endsWith("/insights"));
    assert.ok(insights.length >= 4);
    for (const url of insights) {
      assert.deepEqual(JSON.parse(url.searchParams.get("filtering")), [{ field: "campaign.id", operator: "IN", value: ["c1", "c2"] }], "every insights call carries Meta's campaign filter");
    }
    assert.deepEqual(scoped.campaigns.map((c) => c.id), ["c1", "c2"], "the running campaign that is not assigned is left out");

    const before = stub.calls.length;
    const account = await getMetaAdsPerformance(null, { days: 30 });
    assert.equal(account.scope, "account");
    assert.equal(account.campaignCount, null);
    assert.ok(stub.calls.length > before, "the whole account is a different read");
    assert.equal(stub.calls.slice(before).filter((url) => url.searchParams.has("filtering")).length, 0, "no filter without a scope");

    const cached = stub.calls.length;
    await getMetaAdsPerformance(null, { days: 30, campaignIds: ["c1", "c2"] });
    assert.equal(stub.calls.length, cached, "the same set in another order is the same cached read");
    await assert.rejects(() => getMetaAdsPerformance(null, { days: 30, campaignIds: [] }), /Choose at least one campaign/);
  });
});
