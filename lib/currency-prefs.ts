// The display currency and the person's exchange rates, kept in this browser. Storage can be empty, blocked or throw,
// so every read and write is guarded and Performance works (in each source's own currency) without it.

import type { Rates } from "@/lib/currency";

const KEY = "prism-display-currency";

export interface CurrencyPrefs {
  /** The currency amounts are shown in, or null for each source's own. */
  display: string | null;
  rates: Rates;
}

export const NO_CURRENCY_PREFS: CurrencyPrefs = { display: null, rates: {} };

export function readCurrencyPrefs(): CurrencyPrefs {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return NO_CURRENCY_PREFS;
    const value = JSON.parse(raw) as Partial<CurrencyPrefs>;
    const rates: Rates = {};
    for (const [key, rate] of Object.entries(value.rates ?? {})) if (/^[A-Z]{3}>[A-Z]{3}$/.test(key) && typeof rate === "number" && rate > 0) rates[key] = rate;
    return { display: typeof value.display === "string" && /^[A-Z]{3}$/.test(value.display) ? value.display : null, rates };
  } catch {
    return NO_CURRENCY_PREFS;
  }
}

export function saveCurrencyPrefs(prefs: CurrencyPrefs) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Nothing to do: the next visit starts in each source's own currency.
  }
}
