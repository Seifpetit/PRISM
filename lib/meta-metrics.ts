// Pure helpers for the Meta Ads section of Performance: the ratios Meta does not send, change against the previous
// range, and number formatting. No imports, so they can be tested on their own.

export interface Totals {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
}

/** a / b, or null when b is zero: an unknown ratio is shown as a dash, never as 0 or Infinity. */
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export interface Derived {
  /** Link click-through rate, as a fraction (0.021 = 2.1%). */
  ctr: number | null;
  /** Cost per link click. */
  cpc: number | null;
  /** Cost per 1,000 impressions. */
  cpm: number | null;
  /** Cost per purchase. */
  cpa: number | null;
  /** Purchase value per unit spent, as Meta reports it. */
  roas: number | null;
}

export function derive(totals: Totals): Derived {
  const cpm = ratio(totals.spend, totals.impressions);
  return {
    ctr: ratio(totals.clicks, totals.impressions),
    cpc: ratio(totals.spend, totals.clicks),
    cpm: cpm === null ? null : cpm * 1000,
    cpa: ratio(totals.spend, totals.purchases),
    roas: ratio(totals.revenue, totals.spend),
  };
}

/** Relative change from `previous` to `current` (0.12 = up 12%), or null when there is nothing to compare with. */
export function change(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

export function formatMoney(value: number | null, currency = "USD", digits?: number): string {
  if (value === null) return "–";
  const fractionDigits = digits ?? (Math.abs(value) >= 1000 ? 0 : 2);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(value);
  } catch {
    return `${value.toFixed(fractionDigits)} ${currency}`;
  }
}

export function formatCompact(value: number | null): string {
  if (value === null) return "–";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: value >= 100_000 ? 0 : 1 }).format(value);
}

export function formatInteger(value: number | null): string {
  return value === null ? "–" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(fraction: number | null, digits = 1): string {
  return fraction === null ? "–" : `${(fraction * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null): string {
  return value === null ? "–" : `${value.toFixed(2)}x`;
}

/** "+12%" / "-4%" for a change; "new" is not needed because a null change is simply not shown. */
export function formatChange(fraction: number | null): string | null {
  if (fraction === null) return null;
  const percent = Math.abs(fraction) < 0.005 ? 0 : Math.round(fraction * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
}
