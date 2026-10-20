import assert from "node:assert/strict";
import test from "node:test";
import { COLUMNS, DEFAULT_VIEW, PRESETS, cellFor, columnsFor, sortAds, toggleColumn } from "./ad-columns.ts";

// Made-up ads.
const ad = (over = {}) => ({
  name: "A", hasMeta: true, hasConverty: true, spend: 1000, spendInOrderWindow: 800, impressions: 50000, linkClicks: 1500, purchases: 100,
  hookRate: 0.4, holdRate: 0.2, orders: 120, deleted: 20, confirmed: 60, delivered: 40, returned: 10, deliveredRevenue: 2000, ...over,
});
const withFile = { hasOrderFile: true, exportCountsPurchases: true };
const noFile = { hasOrderFile: false, exportCountsPurchases: true };

test("the default view is the nine-column overview, in the table's own order", () => {
  assert.deepEqual(columnsFor(DEFAULT_VIEW, withFile), ["spend", "hook", "hold", "ctr", "metaOrders", "confirmedRate", "confirmed", "costPerConfirmed"]);
  // "Ad" is always the ninth, first column: the eight here plus it are the nine.
  assert.equal(columnsFor(DEFAULT_VIEW, withFile).length + 1, 9);
});

test("without an order file the overview keeps Meta's cost per order in place of the cost per confirmed order", () => {
  const columns = columnsFor(DEFAULT_VIEW, noFile);
  assert.ok(columns.includes("metaCostPerOrder") && !columns.includes("costPerConfirmed"));
});

test("every preset only names columns that exist, and shows them in the table's order", () => {
  const order = COLUMNS.map((column) => column.key);
  for (const preset of PRESETS) {
    const shown = columnsFor({ preset: preset.id, custom: [] }, withFile);
    assert.ok(shown.length > 0 && new Set(shown).size === shown.length, preset.id);
    assert.deepEqual(shown, order.filter((key) => shown.includes(key)), `${preset.id} follows the table order`);
  }
});

test("ticking a column turns the view into a custom one that starts from what was shown", () => {
  const view = toggleColumn(DEFAULT_VIEW, withFile, "impressions");
  assert.equal(view.preset, "custom");
  assert.ok(columnsFor(view, withFile).includes("impressions") && columnsFor(view, withFile).includes("spend"));
  const without = toggleColumn(view, withFile, "spend");
  assert.ok(!columnsFor(without, withFile).includes("spend"));
});

test("confirmed figures come from the order file and use its own definitions", () => {
  const row = ad();
  assert.equal(cellFor("confirmedRate", row, withFile).value, 60 / 100, "confirmed over the orders that were not cancelled");
  assert.equal(cellFor("eligible", row, withFile).value, 100);
  assert.equal(cellFor("notYetConfirmed", row, withFile).value, 40);
  assert.equal(cellFor("deliveredRate", row, withFile).value, 40 / 60);
});

test("cost per confirmed order divides spend over the order file's days by that ad's own confirmed orders", () => {
  const row = ad({ spend: 1000, spendInOrderWindow: 800, confirmed: 40 });
  assert.equal(cellFor("costPerConfirmed", row, withFile).value, 800 / 40, "not the whole-history spend, and not an account-wide rate");
  assert.equal(cellFor("costPerDelivered", ad({ spendInOrderWindow: 800, delivered: 20 }), withFile).value, 40);
});

test("an empty cell always says why, and the reasons differ", () => {
  assert.equal(cellFor("confirmed", ad(), noFile).reason, "Converty file not imported");
  assert.equal(cellFor("costPerConfirmed", ad({ confirmed: 0 }), withFile).reason, "No confirmed orders yet");
  assert.equal(cellFor("confirmedRate", ad({ orders: 5, deleted: 5, confirmed: 0 }), withFile).reason, "No eligible orders yet");
  assert.equal(cellFor("spend", ad({ hasMeta: false }), withFile).reason, "Not in the ad export");
  assert.equal(cellFor("hook", ad({ hookRate: null }), withFile).reason, "Meta reports this for video ads only");
  assert.equal(cellFor("metaOrders", ad(), { hasOrderFile: true, exportCountsPurchases: false }).reason, "The ad export does not count purchases");
  assert.equal(cellFor("confirmedRate", ad({ hasConverty: false, orders: 0, deleted: 0, confirmed: 0 }), withFile).value, null, "never a 0% for missing data");
});

test("with an order file, an ad it does not list has zero orders, and only the ratios over nothing stay empty", () => {
  const absent = ad({ hasConverty: false, orders: 0, deleted: 0, confirmed: 0, delivered: 0, returned: 0, deliveredRevenue: 0 });
  for (const key of ["orders", "eligible", "confirmed", "notYetConfirmed", "cancelled", "delivered", "returned", "deliveredRevenue"]) {
    assert.equal(cellFor(key, absent, withFile).value, 0, `${key} is 0`);
  }
  const rate = cellFor("confirmedRate", absent, withFile);
  assert.deepEqual([rate.value, rate.reason], [null, "No orders recorded for this ad in the Converty file"]);
  assert.equal(cellFor("costPerConfirmed", absent, withFile).reason, "No orders recorded for this ad in the Converty file");
  assert.equal(cellFor("confirmed", absent, noFile).reason, "Converty file not imported", "without the file it is still unknown");
});

test("Meta orders may be zero when the export counts purchases, and cost per order is then unknown", () => {
  const row = ad({ purchases: 0 });
  assert.equal(cellFor("metaOrders", row, withFile).value, 0);
  assert.equal(cellFor("metaCostPerOrder", row, withFile).reason, "No purchases reported");
});

test("sorting puts empty cells last in both directions and breaks ties by name", () => {
  // C is not in the order file, so its confirmed rate is empty (a ratio over no orders); the others have one.
  const absent = { hasConverty: false, orders: 0, deleted: 0, confirmed: 0, delivered: 0, returned: 0, deliveredRevenue: 0 };
  const ads = [ad({ name: "B", confirmed: 10 }), ad({ name: "C", ...absent }), ad({ name: "A", confirmed: 30 }), ad({ name: "D", confirmed: 10 })];
  assert.deepEqual(sortAds(ads, "confirmedRate", "desc", withFile).map((row) => row.name), ["A", "B", "D", "C"]);
  assert.deepEqual(sortAds(ads, "confirmedRate", "asc", withFile).map((row) => row.name), ["B", "D", "A", "C"]);
});
