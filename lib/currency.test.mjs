import assert from "node:assert/strict";
import test from "node:test";
import { conversionFactor, currencyChoices, viewIn } from "./currency.ts";

// Made-up rates.
test("a rate works both ways round, and only a given rate converts", () => {
  const rates = { "USD>TND": 3 };
  assert.equal(conversionFactor(rates, "USD", "TND"), 3);
  assert.equal(conversionFactor(rates, "TND", "USD"), 1 / 3);
  assert.equal(conversionFactor(rates, "USD", "USD"), 1);
  assert.equal(conversionFactor(rates, "EUR", "TND"), null, "no rate given, no guess");
  assert.equal(conversionFactor({ "USD>TND": 0 }, "USD", "TND"), null, "zero is not a rate");
});

test("an amount is left in its own currency when it cannot be converted", () => {
  const rates = { "USD>TND": 3 };
  assert.deepEqual(viewIn(rates, null, "USD"), { factor: 1, currency: "USD" });
  assert.deepEqual(viewIn(rates, "TND", "USD"), { factor: 3, currency: "TND" });
  assert.deepEqual(viewIn(rates, "TND", "EUR"), { factor: 1, currency: "EUR" });
  assert.deepEqual(viewIn(rates, "TND", "TND"), { factor: 1, currency: "TND" });
});

test("the currencies in the data come first, without repeats", () => {
  const choices = currencyChoices(["TND", "USD"]);
  assert.deepEqual(choices.slice(0, 2), ["TND", "USD"]);
  assert.equal(new Set(choices).size, choices.length);
  assert.ok(choices.includes("EUR"));
});

test("live market rates are crossed through the dollar, and a rate the person typed wins over them", () => {
  const market = { USD: 1, TND: 3, EUR: 0.5 };
  assert.equal(conversionFactor({}, "USD", "TND", market), 3);
  assert.equal(conversionFactor({}, "TND", "USD", market), 1 / 3);
  assert.equal(conversionFactor({}, "TND", "EUR", market), 0.5 / 3, "two currencies neither of which is the dollar");
  assert.equal(conversionFactor({ "USD>TND": 4 }, "USD", "TND", market), 4, "the typed rate wins");
  assert.equal(conversionFactor({}, "USD", "XYZ", market), null, "a currency the market does not list is left alone");
  assert.equal(conversionFactor({}, "USD", "TND", null), null);
  assert.deepEqual(viewIn({}, "TND", "USD", market), { factor: 3, currency: "TND" });
  assert.deepEqual(viewIn({}, "TND", "XYZ", market), { factor: 1, currency: "XYZ" });
});
