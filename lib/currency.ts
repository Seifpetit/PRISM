// Display currency for Performance. Rates are the person's own: nothing is fetched, so a figure is only converted when
// a rate was given, and otherwise stays in its own currency. Pure, no imports.

/** "USD>TND": 3.1 means 1 USD = 3.1 TND. */
export type Rates = Record<string, number>;

export const rateKey = (from: string, to: string) => `${from}>${to}`;

/** Live rates: how many of each currency one US dollar buys ({ USD: 1, TND: 2.9, EUR: 0.87 }). */
export type Market = Record<string, number>;

/**
 * How many `to` one `from` is worth. A rate the person gave (either way round) wins; otherwise the live market rates
 * are crossed through the dollar; 1 for the same currency; null when neither knows.
 */
export function conversionFactor(rates: Rates, from: string, to: string, market?: Market | null): number | null {
  if (from === to) return 1;
  const direct = rates[rateKey(from, to)];
  if (direct > 0) return direct;
  const inverse = rates[rateKey(to, from)];
  if (inverse > 0) return 1 / inverse;
  if (market && market[from] > 0 && market[to] > 0) return market[to] / market[from];
  return null;
}

/** What to multiply an amount in `currency` by, and the currency it is then in. Unconvertible amounts are left as they are. */
export function viewIn(rates: Rates, display: string | null, currency: string, market?: Market | null): { factor: number; currency: string } {
  if (!display) return { factor: 1, currency };
  const factor = conversionFactor(rates, currency, display, market);
  return factor === null ? { factor: 1, currency } : { factor, currency: display };
}

const COMMON = ["USD", "EUR", "GBP", "TND", "MAD", "DZD", "AED", "SAR", "CAD"];

/** Currencies to offer: the ones in the person's data first, then the usual ones. */
export const currencyChoices = (present: string[]): string[] => [...new Set([...present, ...COMMON])];
