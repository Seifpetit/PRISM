import assert from "node:assert/strict";
import test from "node:test";
import { checkSync } from "./sync-check.ts";

// Made-up days. Today is 2026-09-21; the range is the 30 days 08-23 .. 09-21, so 08-23 .. 09-20 must be covered.
const today = "2026-09-21";
const range = { since: "2026-08-23", until: "2026-09-21" };
const dates = (from, to) => {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const days = (from, to) => dates(from, to).map((date) => ({ date, value: 1 }));
const spend = (source, from, to, extra = {}) => ({ kpi: "spend", source, currency: "USD", daily: days(from, to), ...extra });
const ordersFile = (from, to) => ({ kpi: "orders", source: "Converty file", whole: { total: 50, from, to } });

test("everything covered through yesterday is up to date, however each source gets there", () => {
  const check = checkSync([spend("Meta ad export", "2026-07-27", "2026-09-20"), ordersFile("2026-08-04", "2026-09-20")], range, today);
  assert.deepEqual(check.window, { since: "2026-08-23", until: "2026-09-20" });
  assert.equal(check.ok, true);
  assert.deepEqual(check.streams.map((stream) => stream.gaps), [[], []]);
});

test("an order file that stops early leaves a gap from the day after it ends to yesterday, and the spend is still fine", () => {
  const check = checkSync([spend("Meta ad export", "2026-07-27", "2026-09-20"), ordersFile("2026-08-04", "2026-09-11")], range, today);
  assert.equal(check.ok, false);
  const [spendStream, ordersStream] = check.streams;
  assert.deepEqual(spendStream.gaps, []);
  assert.deepEqual(ordersStream.gaps, [{ from: "2026-09-12", to: "2026-09-20" }]);
  assert.deepEqual(ordersStream.coverage, [{ source: "Converty file", from: "2026-08-04", to: "2026-09-11", whole: true }]);
});

test("today is not required: ending yesterday is current, ending the day before is a one-day gap", () => {
  assert.equal(checkSync([spend("A", "2026-08-01", "2026-09-20"), ordersFile("2026-08-04", "2026-09-20")], range, today).ok, true);
  const check = checkSync([spend("A", "2026-08-01", "2026-09-19"), ordersFile("2026-08-04", "2026-09-20")], range, today);
  assert.deepEqual(check.streams[0].gaps, [{ from: "2026-09-20", to: "2026-09-20" }]);
});

test("a live source that covers the whole range makes a stale export irrelevant", () => {
  const live = spend("Meta Ads", "2026-08-23", "2026-09-21");
  const staleExport = spend("Meta ad export", "2026-07-27", "2026-09-01");
  const check = checkSync([staleExport, live, ordersFile("2026-08-04", "2026-09-20")], range, today);
  assert.equal(check.ok, true);
  assert.equal(check.streams[0].coverage.length, 2, "both are listed");
});

test("a source with days is missing where it does not reach; a single-total file is not blamed for the days before its first order", () => {
  const long = { since: "2026-06-24", until: "2026-09-21" };
  const check = checkSync([spend("Meta ad export", "2026-07-27", "2026-09-20"), ordersFile("2026-08-04", "2026-09-20")], long, today);
  assert.deepEqual(check.streams[0].gaps, [{ from: "2026-06-24", to: "2026-07-26" }], "the export starts on 07-27");
  assert.deepEqual(check.streams[1].gaps, [], "orders before the first order are not a gap");
});

test("gaps in the middle between two sources are found and reported as ranges", () => {
  const check = checkSync([spend("A", "2026-08-23", "2026-08-31"), spend("B", "2026-09-05", "2026-09-20"), ordersFile("2026-08-04", "2026-09-20")], range, today);
  assert.deepEqual(check.streams[0].gaps, [{ from: "2026-09-01", to: "2026-09-04" }]);
});

test("a stream with no source at all is one whole gap, and the check fails", () => {
  const check = checkSync([spend("Meta Ads", "2026-08-23", "2026-09-21")], range, today);
  assert.equal(check.ok, false);
  assert.deepEqual(check.streams[1].gaps, [{ from: "2026-08-23", to: "2026-09-20" }]);
  assert.equal(check.streams[1].coverage.length, 0);
  assert.equal(check.hasAnything, true);
  assert.equal(checkSync([], range, today).hasAnything, false);
});

test("what an ad platform only reports is not fulfilment: it does not count as orders", () => {
  const claim = { kpi: "orders", source: "Meta Ads · reported", reported: true, daily: days("2026-08-23", "2026-09-21") };
  const check = checkSync([spend("Meta Ads", "2026-08-23", "2026-09-21"), claim], range, today);
  assert.equal(check.streams[1].coverage.length, 0);
  assert.equal(check.ok, false);
});

test("Shopify's live orders cover the range whatever the order file says", () => {
  const shopify = { kpi: "orders", source: "Shopify", daily: days("2026-08-23", "2026-09-21"), previous: 0 };
  const check = checkSync([spend("Meta Ads", "2026-08-23", "2026-09-21"), shopify, ordersFile("2026-08-04", "2026-09-01")], range, today);
  assert.equal(check.ok, true);
});
