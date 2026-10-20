import assert from "node:assert/strict";
import test from "node:test";
import { addDays, combine, convertReading, datesIn, figureFor, figureOf, importedReadings, metaAdsReadings, previousRange, rangeEndingOn, shopifyReadings } from "./business-figures.ts";

// Made-up numbers. Ten-day range ending 2026-09-10: 09-01 .. 09-10, and the ten days before it.
const range = rangeEndingOn("2026-09-10", 10);
const days = (from, values) => values.map((value, index) => ({ date: addDays(from, index), value }));

test("a range is inclusive, and the range before it is the same length right behind it", () => {
  assert.deepEqual(range, { since: "2026-09-01", until: "2026-09-10" });
  assert.equal(datesIn(range).length, 10);
  assert.deepEqual(previousRange(range), { since: "2026-08-22", until: "2026-08-31" });
});

test("a source with days is cut to the range; a file's previous range is worked out from its own days", () => {
  const file = { kpi: "spend", source: "Meta ad export", currency: "USD", daily: days("2026-08-20", Array.from({ length: 22 }, (_, index) => (index < 12 ? 10 : 20))) };
  const figure = figureOf(file, range);
  assert.equal(figure.total, 200, "ten days at 20");
  assert.equal(figure.previous, 10 * 10 + 0, "the ten days before: 08-22..08-31 are 10 each");
  assert.equal(figure.series.length, 10);
  assert.equal(figure.partial, null);
});

test("a file that does not reach back over the range says which days it has, and gives no previous total", () => {
  const file = { kpi: "spend", source: "Meta ad export", daily: days("2026-09-05", [5, 5, 5, 5, 5, 5]) };
  const figure = figureOf(file, range);
  assert.equal(figure.total, 30);
  assert.equal(figure.previous, null);
  assert.deepEqual(figure.partial, { from: "2026-09-05", to: "2026-09-10" });
  assert.equal(figureOf({ ...file, daily: days("2026-09-01", [1, 1, 1, 1, 1, 1, 1, 1, 1]) }, range).partial, null, "stopping one day early is normal for an export");
});

test("a live source gives its own previous total, and the order of readings decides between sources with days", () => {
  const readings = [
    { kpi: "spend", source: "Meta Ads", daily: days("2026-09-01", Array(10).fill(3)), previous: 20 },
    { kpi: "spend", source: "Meta ad export", daily: days("2026-09-01", Array(10).fill(4)) },
  ];
  const figure = figureFor(readings, "spend", range);
  assert.deepEqual([figure.source, figure.total, figure.previous], ["Meta Ads", 30, 20]);
});

test("a source that says zero gives way to one that has something, and a source with days comes before one without", () => {
  const empty = { kpi: "orders", source: "Shopify", daily: days("2026-09-01", Array(10).fill(0)), previous: 0 };
  const file = { kpi: "orders", source: "Converty file", whole: { total: 40, from: "2026-08-04", to: "2026-09-09" } };
  assert.equal(figureFor([empty, file], "orders", range).source, "Converty file");
  const busy = { ...empty, daily: days("2026-09-01", Array(10).fill(2)) };
  assert.equal(figureFor([file, busy], "orders", range).source, "Shopify", "days first, whatever the array order");
  assert.equal(figureFor([empty], "orders", range).source, "Shopify", "zero is still an answer when it is the only one");
  assert.equal(figureFor([], "orders", range), null);
  assert.equal(figureFor([file], "revenue", range), null, "another figure's reading is not used");
});

test("a ratio of two sources with days is over the range; one with a single total is read over its own days", () => {
  const revenue = figureOf({ kpi: "revenue", source: "Shopify", currency: "USD", daily: days("2026-09-01", Array(10).fill(100)), previous: 500 }, range);
  const spend = figureOf({ kpi: "spend", source: "Meta Ads", currency: "USD", daily: days("2026-09-01", Array(10).fill(25)), previous: 250 }, range);
  const both = combine(revenue, spend, []);
  assert.deepEqual([both.value, both.previous, both.span, both.series.length], [4, 2, null, 10]);

  // Orders come as one total over 09-03..09-07; the ad spend is cut to those five days: 5 x 25 = 125.
  const orders = figureOf({ kpi: "orders", source: "Converty file", whole: { total: 25, from: "2026-09-03", to: "2026-09-07" } }, range);
  const costPerOrder = combine(spend, orders, []);
  assert.equal(costPerOrder.value, 125 / 25);
  assert.deepEqual(costPerOrder.span, { from: "2026-09-03", to: "2026-09-07" });
  assert.equal(costPerOrder.previous, null);
});

test("two single totals over different days, or one with no known days, give no ratio", () => {
  const a = figureOf({ kpi: "revenue", source: "A file", whole: { total: 10, from: "2026-09-01", to: "2026-09-05" } }, range);
  const b = figureOf({ kpi: "orders", source: "B file", whole: { total: 5, from: "2026-09-02", to: "2026-09-05" } }, range);
  assert.equal(combine(a, b, []), null);
  const same = figureOf({ kpi: "orders", source: "B file", whole: { total: 5, from: "2026-09-01", to: "2026-09-05" } }, range);
  assert.equal(combine(a, same, []).value, 2);
  const unknown = figureOf({ kpi: "orders", source: "C file", whole: { total: 5, from: null, to: null } }, range);
  assert.equal(combine(unknown, figureOf({ kpi: "spend", source: "Meta Ads", daily: days("2026-09-01", Array(10).fill(1)), previous: 1 }, range), []), null);
  assert.equal(combine(null, a, []), null);
});

test("a ratio with nothing on the bottom is a dash, not zero or infinity", () => {
  const revenue = figureOf({ kpi: "revenue", source: "Shopify", daily: days("2026-09-01", Array(10).fill(100)), previous: 5 }, range);
  const nothing = figureOf({ kpi: "spend", source: "Meta Ads", daily: days("2026-09-01", Array(10).fill(0)), previous: 0 }, range);
  assert.equal(combine(revenue, nothing, []).value, null);
});

test("sources become readings: Shopify and Meta only when they are usable, the Converty file as single totals", () => {
  assert.deepEqual(shopifyReadings({ connected: true, unlinked: true, totals: { orders: 1, revenue: 1 }, daily: [] }), []);
  assert.deepEqual(shopifyReadings({ connected: false }), []);
  assert.deepEqual(metaAdsReadings({ connected: true, unassigned: true, totals: { spend: 1 }, daily: [] }), []);
  const shop = shopifyReadings({ connected: true, currency: "EUR", totals: { orders: 3, revenue: 90 }, previousTotals: { orders: 2, revenue: 60 }, daily: [{ date: "2026-09-01", orders: 3, revenue: 90 }] });
  assert.deepEqual(shop.map((reading) => [reading.kpi, reading.source, reading.currency ?? null, reading.previous]), [["revenue", "Shopify", "EUR", 60], ["orders", "Shopify", null, 2]]);

  const imported = {
    meta: { rows: 4, currency: "USD", mixedCurrency: false },
    converty: { rows: 2, currency: "TND", mixedCurrency: false, dateFrom: "2026-08-04", dateTo: "2026-09-10" },
    totals: { orders: 50, deliveredRevenue: 800 },
    daily: [{ date: "2026-09-01", spend: 10 }],
  };
  const files = importedReadings(imported);
  assert.deepEqual(files.map((reading) => [reading.kpi, reading.source, Boolean(reading.daily), reading.currency ?? null]), [["spend", "Meta ad export", true, "USD"], ["orders", "Converty file", false, null], ["revenue", "Converty file", false, "TND"]]);
  assert.equal(files[2].caveat, "Delivered orders only");
  assert.deepEqual(files[1].whole, { total: 50, from: "2026-08-04", to: "2026-09-10" });

  const mixed = importedReadings({ ...imported, meta: { ...imported.meta, mixedCurrency: true }, converty: { ...imported.converty, mixedCurrency: true } });
  assert.deepEqual(mixed.map((reading) => reading.kpi), ["orders"], "money in several currencies cannot be added up");
  assert.deepEqual(importedReadings(null), []);
});

test("a Converty file, a live store and the ad spend meet in one set of cards without any of them being special", () => {
  const readings = [
    ...shopifyReadings({ connected: true, unlinked: true }),
    ...metaAdsReadings({ connected: false }),
    ...importedReadings({
      meta: { rows: 10, currency: "USD", mixedCurrency: false },
      converty: { rows: 3, currency: "TND", mixedCurrency: false, dateFrom: "2026-09-02", dateTo: "2026-09-06" },
      totals: { orders: 20, deliveredRevenue: 500 },
      daily: days("2026-08-25", Array(17).fill(10)).map(({ date, value }) => ({ date, spend: value })),
    }),
  ];
  const spend = figureFor(readings, "spend", range);
  const orders = figureFor(readings, "orders", range);
  const revenue = figureFor(readings, "revenue", range);
  assert.deepEqual([spend.source, orders.source, revenue.source], ["Meta ad export", "Converty file", "Converty file"]);
  assert.equal(spend.currency, "USD");
  assert.equal(revenue.currency, "TND", "the currencies differ, so the caller refuses a revenue ratio");
  assert.equal(combine(spend, orders, readings).value, (5 * 10) / 20, "cost per order over the five days the orders cover");
});

test("a ratio over a span reads the other side from a source that has all of those days, not one that only has the range", () => {
  // The live source has only the ten days of the range; the file goes back further. Orders cover 08-20..09-05.
  const live = { kpi: "spend", source: "Meta Ads", currency: "USD", daily: days("2026-09-01", Array(10).fill(30)), previous: 300 };
  const file = { kpi: "spend", source: "Meta ad export", currency: "USD", daily: days("2026-08-15", Array(27).fill(10)) };
  const orders = { kpi: "orders", source: "Converty file", whole: { total: 17, from: "2026-08-20", to: "2026-09-05" } };
  const readings = [live, file, orders];
  const spend = figureFor(readings, "spend", range);
  assert.equal(spend.source, "Meta Ads", "the card itself takes the live source");
  const result = combine(spend, figureFor(readings, "orders", range), readings);
  assert.equal(result.value, (17 * 10) / 17, "17 days at 10 from the file, not 6 days at 30 from the live source");
  assert.deepEqual([result.topSource, result.bottomSource], ["Meta ad export", "Converty file"]);

  // With only the live source there are days the orders cover that the spend does not: no ratio rather than a wrong one.
  assert.equal(combine(figureOf(live, range), figureFor([orders], "orders", range), [live, orders]), null);
});

test("what an ad platform reports is used only when nothing recorded exists, and is named as reported", () => {
  const reported = { kpi: "orders", source: "Meta Ads · reported", reported: true, daily: days("2026-09-01", Array(10).fill(9)), previous: 60 };
  const recorded = { kpi: "orders", source: "Converty file", whole: { total: 40, from: "2026-08-04", to: "2026-09-09" } };
  assert.equal(figureFor([reported, recorded], "orders", range).source, "Converty file", "a recorded total beats a platform's claim, even one with days");
  assert.equal(figureFor([reported], "orders", range).source, "Meta Ads · reported", "and the claim fills the card when it is all there is");
  const empty = { kpi: "orders", source: "Shopify", daily: days("2026-09-01", Array(10).fill(0)), previous: 0 };
  assert.equal(figureFor([empty, reported], "orders", range).source, "Meta Ads · reported", "a store with no orders does not hide it");
});

test("Meta's purchases and purchase value become reported orders and revenue, from the API and from the export", () => {
  const api = metaAdsReadings({ connected: true, currency: "USD", totals: { spend: 30, purchases: 3, revenue: 90 }, previousTotals: { spend: 20, purchases: 2, revenue: 50 }, daily: [{ date: "2026-09-01", spend: 30, purchases: 3, revenue: 90 }] });
  assert.deepEqual(api.map((reading) => [reading.kpi, reading.source, Boolean(reading.reported), reading.previous]), [["spend", "Meta Ads", false, 20], ["orders", "Meta Ads · reported", true, 2], ["revenue", "Meta Ads · reported", true, 50]]);
  assert.equal(api[2].currency, "USD");
  assert.deepEqual(metaAdsReadings({ connected: true, totals: { spend: 1 }, daily: [{ date: "2026-09-01", spend: 1 }] }).map((reading) => reading.kpi), ["spend"], "no purchase fields, no reported readings");

  const file = importedReadings({ meta: { rows: 4, currency: "USD", mixedCurrency: false }, converty: { rows: 0, mixedCurrency: false }, totals: { orders: 0, deliveredRevenue: 0 }, daily: [{ date: "2026-09-01", spend: 10, purchases: 4 }] });
  assert.deepEqual(file.map((reading) => [reading.kpi, reading.source, Boolean(reading.reported)]), [["spend", "Meta ad export", false], ["orders", "Meta ad export · reported", true]]);
  const noPurchases = importedReadings({ meta: { rows: 4, currency: "USD", mixedCurrency: false }, converty: { rows: 0, mixedCurrency: false }, totals: { orders: 0, deliveredRevenue: 0 }, daily: [{ date: "2026-09-01", spend: 10, purchases: 0 }] });
  assert.deepEqual(noPurchases.map((reading) => reading.kpi), ["spend"], "an export that optimised for something else has no orders in it");
});

test("a reading in another currency is scaled everywhere it holds money, and revenue over spend then works across currencies", () => {
  const tnd = { kpi: "revenue", source: "Converty file", currency: "TND", whole: { total: 300, from: "2026-09-03", to: "2026-09-07" } };
  const usd = convertReading(tnd, 1 / 3, "USD");
  assert.deepEqual([usd.currency, usd.whole.total], ["USD", 100]);
  assert.equal(tnd.whole.total, 300, "the original is not touched");

  const dailyTnd = { kpi: "revenue", source: "Shopify", currency: "TND", daily: days("2026-09-01", [30, 60]), previous: 90 };
  const scaled = convertReading(dailyTnd, 0.5, "USD");
  assert.deepEqual([scaled.daily.map((day) => day.value), scaled.previous], [[15, 30], 45]);
  assert.equal(convertReading({ ...dailyTnd, previous: undefined }, 0.5, "USD").previous, undefined, "unknown stays unknown");
  assert.equal(convertReading({ ...dailyTnd, previous: null }, 0.5, "USD").previous, null);

  const orders = { kpi: "orders", source: "Converty file", whole: { total: 7, from: null, to: null } };
  assert.equal(convertReading(orders, 3, "TND"), orders, "counts have no currency");

  const spend = { kpi: "spend", source: "Meta Ads", currency: "USD", daily: days("2026-09-01", Array(10).fill(10)), previous: 90 };
  const roas = combine(figureOf(convertReading(tnd, 1 / 3, "USD"), range), figureOf(spend, range), [spend]);
  assert.equal(roas.value, 100 / 50, "300 TND at 3 TND to the dollar is 100 USD, over the 5 days of spend it covers");
});
