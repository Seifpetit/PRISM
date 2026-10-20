import assert from "node:assert/strict";
import test from "node:test";
import { clearExchangeRateCache, getExchangeRates, parseFallback, parsePrimary } from "./exchange-rates.mjs";

// Made-up rates in the shape each provider really answers with.
const primary = { result: "success", time_last_update_unix: 1789948951, rates: { USD: 1, TND: 3, EUR: 0.5, BAD: -1, XX: 2, NAN: "x" } };
const fallback = { date: "2026-09-20", usd: { usd: 1, tnd: 3.1, eur: 0.6 } };
const answer = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 503, json: async () => body });

test("each provider's answer becomes rates per US dollar, keeping only usable currency codes", () => {
  const one = parsePrimary(primary);
  assert.deepEqual(one.rates, { USD: 1, TND: 3, EUR: 0.5 });
  assert.equal(one.updatedAt, new Date(1789948951 * 1000).toISOString());
  assert.deepEqual(parseFallback(fallback).rates, { USD: 1, TND: 3.1, EUR: 0.6 }, "lower-case codes are read too");
  assert.throws(() => parsePrimary({ result: "error" }));
  assert.throws(() => parseFallback({}));
});

test("rates are fetched once and then served from the cache", async () => {
  clearExchangeRateCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => primary };
  };
  let clock = 1_000;
  const now = () => clock;
  assert.equal((await getExchangeRates({ fetchImpl, now })).source, "Exchange Rate API");
  await getExchangeRates({ fetchImpl, now });
  assert.equal(calls, 1);
  clock += 7 * 60 * 60 * 1000;
  await getExchangeRates({ fetchImpl, now });
  assert.equal(calls, 2, "read again after the cache has aged out");
});

test("a failing primary falls back, and with both down the last rates come back marked stale", async () => {
  clearExchangeRateCache();
  const urls = [];
  const viaFallback = async (url) => {
    urls.push(new URL(url).host);
    return url.includes("open.er-api") ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => fallback };
  };
  const result = await getExchangeRates({ fetchImpl: viaFallback, now: () => 0 });
  assert.deepEqual([result.source, result.rates.TND, result.stale], ["fawazahmed0 currency dataset", 3.1, false]);
  assert.deepEqual(urls, ["open.er-api.com", "cdn.jsdelivr.net"]);

  const down = async () => {
    throw new Error("network down");
  };
  const stale = await getExchangeRates({ fetchImpl: down, now: () => 10 * 60 * 60 * 1000 });
  assert.deepEqual([stale.stale, stale.rates.TND], [true, 3.1]);

  clearExchangeRateCache();
  await assert.rejects(() => getExchangeRates({ fetchImpl: down, now: () => 0 }), /unavailable right now/);
  await assert.rejects(() => getExchangeRates({ fetchImpl: answer({}, false), now: () => 0 }), /unavailable right now/);
});
