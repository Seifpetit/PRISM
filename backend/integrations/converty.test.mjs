import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConvertyOrder, summarizeConvertyOrders } from "./converty.mjs";
import { startConvertyInstall } from "./converty-oauth.mjs";

const raw = {
  _id: "o1", reference: 1042, status: "delivered", paymentStatus: "unpaid", createdAt: "2026-03-20T08:00:00.000Z",
  total: { totalPrice: 5500, deliveryPrice: 500 },
  cart: [{ quantity: 2, pricePerUnit: 2500, product: { _id: "p1", name: "Classic T-Shirt" } }],
  history: [{ status: "pending", timestamp: 1710900000000 }, { status: "confirmed", timestamp: 1710950000000 }, { timestamp: 1 }],
};

test("an order keeps its status history and never invents attribution", () => {
  const order = normalizeConvertyOrder(raw);
  assert.equal(order.history.length, 2);
  assert.equal(order.history[0].at, new Date(1710900000000).toISOString());
  assert.deepEqual(order.items, [{ productId: "p1", name: "Classic T-Shirt", quantity: 2, unitPrice: 2500 }]);
  assert.equal(order.attribution, null);
});

test("delivery rate counts only settled orders, and revenue only delivered ones", () => {
  const orders = [raw, { ...raw, _id: "o2", status: "returned" }, { ...raw, _id: "o3", status: "pending" }].map(normalizeConvertyOrder);
  const summary = summarizeConvertyOrders(orders);
  assert.equal(summary.deliveryRate, 0.5);
  assert.equal(summary.deliveredRevenue, 5500);
  assert.equal(summary.byStatus.pending, 1);
  assert.equal(summarizeConvertyOrders([]).deliveryRate, null);
});

test("the authorize URL carries state, scope and the callback", () => {
  const saved = { ...process.env };
  process.env.CONVERTY_CLIENT_ID = "cid";
  process.env.CONVERTY_CLIENT_SECRET = "secret";
  process.env.CONVERTY_OAUTH_REDIRECT_BASE = "http://localhost:4000";
  try {
    const url = new URL(startConvertyInstall({ workspaceId: "w" }).url);
    assert.equal(url.origin + url.pathname, "https://partner.converty.shop/oauth2/authorize");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:4000/converty/callback");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.ok(url.searchParams.get("state"));
    assert.match(url.searchParams.get("scope"), /read-orders/);
    delete process.env.CONVERTY_CLIENT_ID;
    assert.throws(() => startConvertyInstall({ workspaceId: "w" }), /isn't set up/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
