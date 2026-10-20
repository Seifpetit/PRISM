import assert from "node:assert/strict";
import test from "node:test";
import { confirmationRate, costPerDelivered, deliveryRate, linkCtr, returnRate } from "./imported-metrics.ts";

// Made-up counts. Converty states its own rates in its file, and these definitions reproduce them: deleted orders are
// left out of the confirmation rate, delivery and returns are measured against confirmed orders.
const row = { spend: 120, impressions: 40000, linkClicks: 1600, orders: 200, deleted: 20, confirmed: 90, delivered: 60, returned: 30 };

test("the rates follow Converty's definitions and reproduce the ones its file states", () => {
  assert.equal(((confirmationRate(row) ?? 0) * 100).toFixed(1), "50.0", "confirmed over orders that were not deleted");
  assert.equal(((deliveryRate(row) ?? 0) * 100).toFixed(1), "66.7", "delivered over confirmed");
  assert.equal(((returnRate(row) ?? 0) * 100).toFixed(1), "33.3");
});

test("cost per delivered order and click-through are plain divisions, and unknown when there is nothing to divide by", () => {
  assert.equal(costPerDelivered(row)?.toFixed(2), "2.00");
  assert.equal(linkCtr(row)?.toFixed(3), "0.040");
  assert.equal(costPerDelivered({ spend: 50, delivered: 0 }), null, "spend with no delivered order has no cost per order");
  assert.equal(confirmationRate({ orders: 3, deleted: 3, confirmed: 0 }), null);
  assert.equal(deliveryRate({ confirmed: 0, delivered: 0 }), null);
  assert.equal(linkCtr({ linkClicks: 0, impressions: 0 }), null);
});
