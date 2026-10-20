// The business figures on Performance (revenue, orders, ad spend and the ratios between them), independent of where
// they come from. A source (Shopify, the Meta API, an imported CSV, whatever comes next) is turned into "readings" of
// one figure each; the cards ask for a figure and get the best reading there is. Pure, no imports, so it is tested on
// its own. Money is never converted: a ratio of two currencies is refused by the caller, not guessed here.

export type Kpi = "revenue" | "orders" | "spend";

export interface DayValue {
  date: string;
  value: number;
}

/** What one source can say about one figure. */
export interface Reading {
  kpi: Kpi;
  /** How the person would name it: "Shopify", "Meta Ads", "Meta ad export", "Converty file". */
  source: string;
  currency?: string | null;
  /** One value per day the source knows. A reading with days follows whatever range is chosen. */
  daily?: DayValue[];
  /** The total over the range before, when the source gives it (a live API does; a file works it out from its days). */
  previous?: number | null;
  /** For a source with no days: one total, and the days that total covers. It cannot follow the range. */
  whole?: { total: number; from: string | null; to: string | null };
  /** Something that changes what the number means, such as "Delivered orders only". */
  caveat?: string;
  /** The ad platform's own claim (purchases and purchase value it attributes to its ads), not a recorded sale. It is used when nothing recorded exists. */
  reported?: boolean;
}

/** Inclusive ISO dates. */
export interface Range {
  since: string;
  until: string;
}

export interface Span {
  from: string | null;
  to: string | null;
}

const DAY_MS = 86_400_000;
const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export const addDays = (iso: string, count: number) => new Date(time(iso) + count * DAY_MS).toISOString().slice(0, 10);
export const rangeEndingOn = (today: string, days: number): Range => ({ since: addDays(today, -(days - 1)), until: today });

export function datesIn(range: Range): string[] {
  const dates: string[] = [];
  for (let day = range.since; day <= range.until; day = addDays(day, 1)) dates.push(day);
  return dates;
}

export const previousRange = (range: Range): Range => {
  const length = datesIn(range).length;
  return { since: addDays(range.since, -length), until: addDays(range.since, -1) };
};

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const sumIn = (daily: DayValue[], range: Range) => daily.reduce((total, day) => (day.date >= range.since && day.date <= range.until ? total + day.value : total), 0);

/** The same reading with its money multiplied by `factor` and named `currency`. Counts (no currency) are left alone. */
export function convertReading(reading: Reading, factor: number, currency: string): Reading {
  if (!reading.currency || (factor === 1 && reading.currency === currency)) return reading;
  const scale = (value: number) => value * factor;
  return {
    ...reading,
    currency,
    daily: reading.daily?.map((day) => ({ date: day.date, value: scale(day.value) })),
    previous: reading.previous == null ? reading.previous : scale(reading.previous),
    whole: reading.whole ? { ...reading.whole, total: scale(reading.whole.total) } : undefined,
  };
}

/** A reading, cut to the chosen range. */
export interface Figure {
  reading: Reading;
  kpi: Kpi;
  source: string;
  currency: string | null;
  caveat: string | null;
  total: number;
  /** The same figure over the range before; null when the source cannot say. */
  previous: number | null;
  /** One value per day of the range, when the source has days. */
  series: number[] | null;
  /** Set when the source has one total for its own days instead of days. */
  span: Span | null;
  /** The days the source actually has, when they do not reach the whole range. */
  partial: Span | null;
}

// A file that stops a day or two before the range does is normal (an export is of yesterday); more than that is a gap.
const END_TOLERANCE_DAYS = 2;

export function figureOf(reading: Reading, range: Range): Figure {
  const base = { reading, kpi: reading.kpi, source: reading.source, currency: reading.currency ?? null, caveat: reading.caveat ?? null };
  if (!reading.daily) {
    const whole = reading.whole ?? { total: 0, from: null, to: null };
    return { ...base, total: whole.total, previous: null, series: null, span: { from: whole.from, to: whole.to }, partial: null };
  }
  const byDate = new Map(reading.daily.map((day) => [day.date, day.value] as const));
  const series = datesIn(range).map((date) => byDate.get(date) ?? 0);
  const total = series.reduce((sum, value) => sum + value, 0);

  const dates = reading.daily.map((day) => day.date).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const before = previousRange(range);
  let previous: number | null = null;
  if (reading.previous !== undefined) previous = reading.previous;
  else if (first && last && first <= before.since && last >= before.until) previous = sumIn(reading.daily, before);

  const partial = first && last && (first > range.since || last < addDays(range.until, -END_TOLERANCE_DAYS)) ? { from: first, to: last } : null;
  return { ...base, total, previous, series, span: null, partial };
}

/**
 * The best reading of one figure. Recorded sales (a store, an order file) come before what an ad platform reports;
 * within each, a source with days comes before one without (it follows the range), and the order of `readings` says
 * which wins among equals: put live connections before files. A source that says zero gives way to one that has
 * something, so a store with no orders does not hide an order file.
 */
export function figureFor(readings: Reading[], kpi: Kpi, range: Range): Figure | null {
  const mine = readings.filter((reading) => reading.kpi === kpi);
  const tiers = [false, true].flatMap((reported) => {
    const tier = mine.filter((reading) => Boolean(reading.reported) === reported);
    return [...tier.filter((reading) => reading.daily), ...tier.filter((reading) => !reading.daily && reading.whole)];
  });
  const figures = tiers.map((reading) => figureOf(reading, range));
  return figures.find((figure) => figure.total > 0) ?? figures[0] ?? null;
}

export interface Combined {
  value: number | null;
  previous: number | null;
  series: Array<number | null> | null;
  /** Set when the ratio is over the days one of its parts covers, not the chosen range. */
  span: Span | null;
  /** The sources and currencies actually used, which can differ from the cards' when a ratio is read over other days. */
  topSource: string;
  bottomSource: string;
  topCurrency: string | null;
  bottomCurrency: string | null;
}

/** Whether a reading with days has every day of `span` (an export that stops a day or two early still counts). */
function covers(reading: Reading, span: { from: string; to: string }): boolean {
  if (!reading.daily?.length) return false;
  const dates = reading.daily.map((day) => day.date).sort();
  return dates[0] <= span.from && dates[dates.length - 1] >= addDays(span.to, -END_TOLERANCE_DAYS);
}

/** One figure over `span`: its own total if it is a single total, else the first reading of that figure with days that covers the span. */
function readOver(figure: Figure, readings: Reading[], span: { from: string; to: string }): { value: number; source: string; currency: string | null } | null {
  if (figure.span) return { value: figure.total, source: figure.source, currency: figure.currency };
  const window = { since: span.from, until: span.to };
  for (const reading of [figure.reading, ...readings.filter((other) => other.kpi === figure.kpi && other !== figure.reading)]) {
    if (covers(reading, span)) return { value: sumIn(reading.daily!, window), source: reading.source, currency: reading.currency ?? null };
  }
  return null;
}

/**
 * top / bottom, over the same days. When both have days that is the range. When one is a single total over its own
 * days, the other is read over those days instead (from whichever source has all of them), so the ratio never divides
 * two different periods; if no source can be cut to those days there is no honest ratio, and the answer is null.
 */
export function combine(top: Figure | null, bottom: Figure | null, readings: Reading[]): Combined | null {
  if (!top || !bottom) return null;
  const used = { topSource: top.source, bottomSource: bottom.source, topCurrency: top.currency, bottomCurrency: bottom.currency };
  if (!top.span && !bottom.span) {
    const series = top.series!.map((value, index) => ratio(value, bottom.series![index] ?? 0));
    const previous = top.previous !== null && bottom.previous !== null ? ratio(top.previous, bottom.previous) : null;
    return { value: ratio(top.total, bottom.total), previous, series, span: null, ...used };
  }
  const span = top.span ?? bottom.span!;
  if (top.span && bottom.span && (top.span.from !== bottom.span.from || top.span.to !== bottom.span.to)) return null;
  if (!span.from || !span.to) return null;
  const window = { from: span.from, to: span.to };
  const a = readOver(top, readings, window);
  const b = readOver(bottom, readings, window);
  if (!a || !b) return null;
  return { value: ratio(a.value, b.value), previous: null, series: null, span, topSource: a.source, bottomSource: b.source, topCurrency: a.currency, bottomCurrency: b.currency };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sources. Each turns what a platform or a file returned into readings. Structural types on purpose: nothing here needs
// to know the API's own types, and a new source is one more function.

interface ShopifyLike {
  connected: boolean;
  unlinked?: boolean | null;
  currency?: string | null;
  totals?: { orders: number; revenue: number } | null;
  previousTotals?: { orders: number; revenue: number } | null;
  daily?: Array<{ date: string; orders: number; revenue: number }> | null;
}

export function shopifyReadings(shopify: ShopifyLike | null | undefined): Reading[] {
  if (!shopify?.connected || shopify.unlinked || !shopify.totals || !shopify.daily) return [];
  const source = "Shopify";
  return [
    { kpi: "revenue", source, currency: shopify.currency ?? null, daily: shopify.daily.map((day) => ({ date: day.date, value: day.revenue })), previous: shopify.previousTotals ? shopify.previousTotals.revenue : null },
    { kpi: "orders", source, daily: shopify.daily.map((day) => ({ date: day.date, value: day.orders })), previous: shopify.previousTotals ? shopify.previousTotals.orders : null },
  ];
}

interface MetaLike {
  connected: boolean;
  unassigned?: boolean | null;
  currency?: string | null;
  totals?: { spend: number; purchases?: number; revenue?: number } | null;
  previousTotals?: { spend: number; purchases?: number; revenue?: number } | null;
  daily?: Array<{ date: string; spend: number; purchases?: number; revenue?: number }> | null;
}

/** Meta's spend, and, as reported figures, the purchases and purchase value it attributes to its ads. */
export function metaAdsReadings(meta: MetaLike | null | undefined): Reading[] {
  if (!meta?.connected || meta.unassigned || !meta.totals || !meta.daily) return [];
  const currency = meta.currency ?? null;
  const readings: Reading[] = [{ kpi: "spend", source: "Meta Ads", currency, daily: meta.daily.map((day) => ({ date: day.date, value: day.spend })), previous: meta.previousTotals ? meta.previousTotals.spend : null }];
  const claim = "What Meta attributes to its ads, not recorded sales";
  if (meta.daily.every((day) => typeof day.purchases === "number")) {
    readings.push({ kpi: "orders", source: "Meta Ads · reported", reported: true, caveat: claim, daily: meta.daily.map((day) => ({ date: day.date, value: day.purchases! })), previous: meta.previousTotals?.purchases ?? null });
  }
  if (meta.daily.every((day) => typeof day.revenue === "number")) {
    readings.push({ kpi: "revenue", source: "Meta Ads · reported", reported: true, caveat: claim, currency, daily: meta.daily.map((day) => ({ date: day.date, value: day.revenue! })), previous: meta.previousTotals?.revenue ?? null });
  }
  return readings;
}

interface ImportedLike {
  meta: { rows: number; currency?: string | null; mixedCurrency: boolean };
  converty: { rows: number; currency?: string | null; mixedCurrency: boolean; dateFrom?: string | null; dateTo?: string | null };
  totals: { orders: number; deliveredRevenue: number };
  daily?: Array<{ date: string; spend: number; purchases?: number }> | null;
}

/** The imported CSV files: the Meta ad export has days; the Converty summary is one total over the days it covers. */
export function importedReadings(imported: ImportedLike | null | undefined): Reading[] {
  if (!imported) return [];
  const readings: Reading[] = [];
  if (imported.meta.rows > 0 && !imported.meta.mixedCurrency && imported.daily) {
    readings.push({ kpi: "spend", source: "Meta ad export", currency: imported.meta.currency ?? null, daily: imported.daily.map((day) => ({ date: day.date, value: day.spend })) });
    // The export also counts the purchases Meta attributes to each ad, which stands in for orders when nothing recorded exists.
    if (imported.daily.some((day) => (day.purchases ?? 0) > 0)) {
      readings.push({ kpi: "orders", source: "Meta ad export · reported", reported: true, caveat: "What Meta attributes to its ads, not recorded sales", daily: imported.daily.map((day) => ({ date: day.date, value: day.purchases ?? 0 })) });
    }
  }
  if (imported.converty.rows > 0) {
    const whole = { from: imported.converty.dateFrom ?? null, to: imported.converty.dateTo ?? null };
    readings.push({ kpi: "orders", source: "Converty file", whole: { total: imported.totals.orders, ...whole } });
    if (!imported.converty.mixedCurrency) {
      readings.push({ kpi: "revenue", source: "Converty file", currency: imported.converty.currency ?? null, whole: { total: imported.totals.deliveredRevenue, ...whole }, caveat: "Delivered orders only" });
    }
  }
  return readings;
}
