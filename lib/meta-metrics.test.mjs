import assert from "node:assert/strict";
import test from "node:test";
import { change, derive, formatChange, formatCompact, formatMoney, formatMultiple, formatPercent, ratio } from "./meta-metrics.ts";

test("ratios are unknown, not zero or infinite, when there is nothing to divide by", () => {
  assert.equal(ratio(5, 0), null);
  assert.equal(ratio(0, 10), 0);
  const empty = derive({ spend: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 });
  assert.deepEqual(empty, { ctr: null, cpc: null, cpm: null, cpa: null, roas: null });
});

test("the derived metrics are Meta's own definitions", () => {
  const d = derive({ spend: 8106.71, impressions: 3_042_175, clicks: 91_000, purchases: 200, revenue: 24_320.13 });
  assert.equal(Number(d.ctr.toFixed(4)), 0.0299);
  assert.equal(Number(d.cpc.toFixed(3)), 0.089);
  assert.equal(Number(d.cpm.toFixed(2)), 2.66, "cost per 1,000 impressions");
  assert.equal(Number(d.cpa.toFixed(2)), 40.53);
  assert.equal(Number(d.roas.toFixed(2)), 3);
});

test("change compares with the previous range and stays quiet without one", () => {
  assert.equal(change(120, 100), 0.2);
  assert.equal(change(50, 100), -0.5);
  assert.equal(change(5, 0), null, "nothing before it: no percentage");
  assert.equal(change(null, 10), null);
  assert.equal(formatChange(0.2), "+20%");
  assert.equal(formatChange(-0.041), "-4%");
  assert.equal(formatChange(0.001), "0%");
  assert.equal(formatChange(null), null);
});

test("formatting", () => {
  assert.equal(formatMoney(8106.71, "USD"), "$8,107");
  assert.equal(formatMoney(0.045, "USD"), "$0.05");
  assert.equal(formatMoney(2.665, "USD", 2), "$2.67");
  assert.equal(formatMoney(null), "–");
  assert.equal(formatCompact(3_042_175), "3M");
  assert.equal(formatCompact(829_378), "829K");
  assert.equal(formatPercent(0.0589), "5.9%");
  assert.equal(formatMultiple(3.004), "3.00x");
});
