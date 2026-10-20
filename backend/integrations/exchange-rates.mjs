// Live exchange rates for the Performance currency button. Public data, no key and no account: only a currency code is
// ever sent. The rates come from open.er-api.com (about 160 currencies, refreshed daily, attribution required; the
// person's screen names it), with the jsDelivr copy of the fawazahmed0 currency dataset as a fallback. Read on the
// server and cached, so the browser never calls a third party and one day's rates are fetched once, not per page view.

const PRIMARY = "https://open.er-api.com/v6/latest/USD";
const FALLBACK = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const TTL_MS = 6 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cache = null;

/** Only currency codes with a usable rate, as { USD: 1, TND: 2.92, ... }: units of that currency per one US dollar. */
function cleanRates(raw) {
  const rates = {};
  for (const [code, value] of Object.entries(raw ?? {})) {
    const upper = code.toUpperCase();
    if (/^[A-Z]{3}$/.test(upper) && typeof value === "number" && Number.isFinite(value) && value > 0) rates[upper] = value;
  }
  rates.USD = 1;
  return rates;
}

export function parsePrimary(json) {
  if (json?.result !== "success" || !json.rates) throw new Error("open.er-api.com did not return rates");
  const updated = typeof json.time_last_update_unix === "number" ? new Date(json.time_last_update_unix * 1000).toISOString() : null;
  return { rates: cleanRates(json.rates), updatedAt: updated, source: "Exchange Rate API" };
}

export function parseFallback(json) {
  if (!json?.usd) throw new Error("the currency dataset did not return rates");
  return { rates: cleanRates(json.usd), updatedAt: typeof json.date === "string" ? `${json.date}T00:00:00.000Z` : null, source: "fawazahmed0 currency dataset" };
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/**
 * The current rates, per one US dollar. Cached for a few hours. If both providers fail, the last rates are returned
 * marked stale; with nothing cached at all, it throws and the screen says the person can enter rates themselves.
 */
export async function getExchangeRates({ fetchImpl = fetch, now = Date.now } = {}) {
  if (cache && now() - cache.fetchedAt < TTL_MS) return { ...cache.value, stale: false };
  const failures = [];
  for (const [url, parse] of [[PRIMARY, parsePrimary], [FALLBACK, parseFallback]]) {
    try {
      const value = parse(await fetchJson(fetchImpl, url));
      cache = { value, fetchedAt: now() };
      return { ...value, stale: false };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (cache) return { ...cache.value, stale: true };
  throw new Error(`Live rates are unavailable right now (${failures.join("; ")}).`);
}

export function clearExchangeRateCache() {
  cache = null;
}
