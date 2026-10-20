"use client";

import { Banknote, BarChart3, Gauge, Megaphone, Receipt, ShoppingCart, type LucideIcon } from "lucide-react";
import type { ImportedAds, MetaAdsPerformance, ShopifySales } from "@/api/api";
import { DailyChart, type ChartMarker } from "@/components/performance/meta-charts";
import { MetricCard, Notice, SectionSkeleton, cardClass } from "@/components/performance/metric-card";
import { useCurrency } from "@/components/performance/currency-context";
import type { Remote } from "@/components/performance/use-remote";
import { combine, convertReading, datesIn, figureFor, importedReadings, metaAdsReadings, rangeEndingOn, shopifyReadings, type Combined, type Figure, type Range, type Span } from "@/lib/business-figures";
import { conversionFactor } from "@/lib/currency";
import { h } from "@/lib/h";
import { change, formatCompact, formatInteger, formatMoney, formatMultiple, ratio } from "@/lib/meta-metrics";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const spanText = (span: Span) => (span.from && span.to ? (span.from === span.to ? shortDate(span.from) : `${shortDate(span.from)} – ${shortDate(span.to)}`) : "");

/** The same figure with its money scaled by `factor` and renamed `currency` — for one ratio's own math only; the
    figure's own card still shows its true native currency and value untouched. */
function scaleFigure(figure: Figure, factor: number, currency: string): Figure {
  return {
    ...figure,
    currency,
    total: figure.total * factor,
    previous: figure.previous === null ? null : figure.previous * factor,
    series: figure.series ? figure.series.map((value) => value * factor) : null,
  };
}

const NEEDS_REVENUE = "Needs revenue: connect Shopify or import your store orders";
const NEEDS_ORDERS = "Needs orders: connect Shopify or import your store orders";
const NEEDS_SPEND = "Needs ad spend: connect Meta Ads or import the ad export";

/** A card for one figure, whatever supplied it: the source is named on the card, and what a source cannot do is said. */
function figureCard({ label, figure, format, good, missing, compare, color, icon }: { label: string; figure: Figure | null; format: (value: number, figure: Figure) => string; good: "up" | "down" | "none"; missing: string; compare: string; color?: string; icon?: LucideIcon }) {
  if (!figure) return h(MetricCard, { label, value: "–", fraction: null, good, note: missing, icon });
  // A source with one total for its own days cannot follow the range or be compared with the range before.
  const note = figure.span ? [figure.caveat, spanText(figure.span)].filter(Boolean).join(" · ") : figure.partial ? `Only ${spanText(figure.partial)} is in ${figure.source}` : undefined;
  return h(MetricCard, {
    label,
    source: figure.source,
    value: format(figure.total, figure),
    fraction: figure.previous !== null ? change(figure.total, figure.previous) : null,
    good,
    compareLabel: compare,
    series: figure.series ?? undefined,
    color,
    icon,
    hint: figure.caveat ?? undefined,
    note,
  });
}

/** A card for a ratio of two figures over the same days. */
function ratioCard({ label, top, bottom, combined, issue, missing, format, good, compare, hint, color, icon, extraNote }: { label: string; top: Figure | null; bottom: Figure | null; combined: Combined | null; issue: string | null; missing: string | null; format: (value: number | null) => string; good: "up" | "down" | "none"; compare: string; hint: string; color?: string; icon?: LucideIcon; extraNote?: string }) {
  if (!top || !bottom) return h(MetricCard, { label, value: "–", fraction: null, good, hint, note: missing ?? undefined, icon });
  const source = `${combined?.topSource ?? top.source} ÷ ${combined?.bottomSource ?? bottom.source}`;
  if (issue) return h(MetricCard, { label, source, value: "–", fraction: null, good, hint, note: issue, icon });
  if (!combined) return h(MetricCard, { label, source, value: "–", fraction: null, good, hint, note: `${top.source} and ${bottom.source} cover different days`, icon });
  return h(MetricCard, {
    label,
    source,
    value: format(combined.value),
    fraction: change(combined.value, combined.previous),
    good,
    compareLabel: compare,
    series: combined.series ?? undefined,
    color,
    icon,
    hint,
    note: [combined.span ? `${spanText(combined.span)} · both over the same days` : null, extraNote].filter(Boolean).join(" · ") || undefined,
  });
}

/**
 * The business in a few figures (revenue, orders, ad spend and the ratios between them) for the range and scope the
 * page has chosen. It does not care where a figure comes from: every source that can supply one (Shopify, the Meta
 * API, an imported CSV, anything added later) is turned into readings, and each card takes the best reading there is
 * and names it. A source that has days follows the range; one with a single total says which days it covers, and the
 * ratios are then worked out over those same days. The chart lines up the days, with what you did in PRISM marked on it.
 */
export function BusinessSection({
  productName,
  meta,
  shopify,
  imported,
  days,
  today,
  markers,
}: {
  productName: string;
  meta: Remote<MetaAdsPerformance>;
  shopify: Remote<ShopifySales>;
  imported: Remote<ImportedAds>;
  days: number;
  /** ISO date of today, for the range when no platform has served one. */
  today: string;
  markers: ChartMarker[];
}) {
  const { view, rates, market } = useCurrency();
  const m = meta.data;
  const s = shopify.data;
  const loading = (!m && !meta.error) || (!s && !shopify.error) || (!imported.data && !imported.error);
  if (loading) return h("section", { "aria-labelledby": "business-title" }, heading(), h(SectionSkeleton, { cards: 6, label: "Loading the figures" }));

  // Live connections come before files, so they win when both can say the same thing.
  // Amounts are shown in the chosen currency, at the person's rates, before anything is compared or divided.
  const readings = [...shopifyReadings(s), ...metaAdsReadings(m), ...importedReadings(imported.data)].map((reading) => {
    if (!reading.currency) return reading;
    const shown = view(reading.currency);
    return convertReading(reading, shown.factor, shown.currency);
  });
  if (readings.length === 0) {
    return h(
      "section",
      { "aria-labelledby": "business-title" },
      heading(),
      h(Notice, { title: "Nothing to combine yet", body: `Connect Shopify or Meta Ads (and link or assign ${productName} in each), or import your store CSV files, and revenue, orders, ad spend and the ratios between them show up here.` }),
    );
  }

  const served = s?.range ?? m?.range;
  const range: Range = served ? { since: served.since, until: served.until } : rangeEndingOn(today, days);
  const compare = `vs previous ${datesIn(range).length}d`;

  const revenue = figureFor(readings, "revenue", range);
  const orders = figureFor(readings, "orders", range);
  const spend = figureFor(readings, "spend", range);

  const currencyOf = (figure: Figure) => figure.currency ?? "USD";
  // A ratio is worked out first, because reading it over other days can bring in another source, and its currency counts.
  // Revenue and spend can be in different currencies (a Converty file in TND against Meta spend in USD) even when no
  // display currency was ever chosen; a real, current market rate resolves that on its own rather than leaving a
  // real ratio blank. A rate the person actually typed in still wins over the live one. Only a genuinely missing rate
  // (the daily fetch failed, or it's a currency the service doesn't carry) is a real reason to show nothing.
  const revenueCurrencyRaw = revenue?.currency ?? null;
  const spendCurrencyRaw = spend?.currency ?? null;
  const crossCurrency = Boolean(revenueCurrencyRaw && spendCurrencyRaw && revenueCurrencyRaw !== spendCurrencyRaw);
  const crossFactor = crossCurrency ? conversionFactor(rates, spendCurrencyRaw!, revenueCurrencyRaw!, market) : null;
  const spendForRoas = crossCurrency && crossFactor !== null && spend ? scaleFigure(spend, crossFactor, revenueCurrencyRaw!) : spend;
  const blendedRaw = combine(revenue, spendForRoas, readings);
  const roasIssue = crossCurrency && crossFactor === null ? `Revenue is in ${revenueCurrencyRaw} and ad spend in ${spendCurrencyRaw}, and today's exchange rate for that pair isn't available, so this can't be worked out right now.` : null;
  const blended = roasIssue ? null : blendedRaw;
  const blendedNote = crossCurrency && crossFactor !== null ? `Ad spend converted from ${spendCurrencyRaw} to ${revenueCurrencyRaw} at today's rate` : undefined;
  const costPerOrder = combine(spend, orders, readings);

  // What the ad platform itself claims, next to the real figure. Only a platform that reports purchase value has this.
  const platformReady = Boolean(m?.connected && m.totals && m.daily && !m.unassigned && m.previousTotals);
  const platformRoas = platformReady ? ratio(m!.totals!.revenue, m!.totals!.spend) : null;
  const platformPrevious = platformReady ? ratio(m!.previousTotals!.revenue, m!.previousTotals!.spend) : null;
  const gap = platformRoas !== null && blended?.value != null && !blended.span && blended.value > 0 ? (platformRoas - blended.value) / blended.value : null;
  const gapNote = gap === null || !revenue || revenue.reading.reported ? undefined : Math.abs(gap) < 0.05 ? `Meta and ${revenue.source} roughly agree` : gap > 0 ? `Meta claims ${Math.round(gap * 100)}% more than ${revenue.source} shows` : `Meta claims ${Math.round(-gap * 100)}% less than ${revenue.source} shows`;

  const money = (value: number, figure: Figure) => formatMoney(value, currencyOf(figure));

  return h(
    "section",
    { "aria-labelledby": "business-title", className: shopify.loading || meta.loading || imported.loading ? "opacity-60 transition-opacity" : "transition-opacity" },
    heading(),
    h(
      "div",
      { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" },
      figureCard({ label: "Revenue", figure: revenue, format: money, good: "up", missing: NEEDS_REVENUE, compare, color: "#5E8E3E", icon: Banknote }),
      figureCard({ label: "Orders", figure: orders, format: (value) => formatInteger(value), good: "up", missing: NEEDS_ORDERS, compare, color: "#5E8E3E", icon: ShoppingCart }),
      figureCard({ label: "Ad spend", figure: spend, format: money, good: "none", missing: NEEDS_SPEND, compare, icon: Megaphone }),
      ratioCard({
        label: "Blended ROAS",
        top: revenue,
        bottom: spendForRoas,
        combined: blended,
        issue: roasIssue,
        missing: !revenue && !spend ? "Needs revenue and ad spend" : !revenue ? NEEDS_REVENUE : NEEDS_SPEND,
        format: formatMultiple,
        good: "up",
        compare,
        hint: "Revenue divided by ad spend, over the same days",
        icon: Gauge,
        extraNote: blendedNote,
      }),
      ratioCard({
        label: "Cost per order",
        top: spend,
        bottom: orders,
        combined: costPerOrder,
        issue: null,
        missing: !spend && !orders ? "Needs ad spend and orders" : !spend ? NEEDS_SPEND : NEEDS_ORDERS,
        format: (value) => formatMoney(value, costPerOrder?.topCurrency ?? (spend ? currencyOf(spend) : "USD")),
        good: "down",
        compare,
        hint: "Ad spend divided by orders, over the same days",
        icon: Receipt,
      }),
      platformReady
        ? h(MetricCard, { label: "ROAS · as the platform reports", source: "Meta Ads", value: formatMultiple(platformRoas), fraction: change(platformRoas, platformPrevious), good: "up", compareLabel: compare, series: m!.daily!.map((day) => ratio(day.revenue, day.spend)), hint: "Purchase value the ad platform attributes to its ads, divided by spend", note: gapNote, icon: BarChart3 })
        : h(MetricCard, { label: "ROAS · as the platform reports", value: "–", fraction: null, good: "up", hint: "Purchase value the ad platform attributes to its ads, divided by spend", note: "Needs an ad platform that reports purchase value", icon: BarChart3 }),
    ),
    revenue?.series && spend?.series
      ? h(
          "div",
          { className: `${cardClass} mt-4 px-4 pb-3 pt-4` },
          h("h3", { className: "text-sm font-semibold text-ink" }, "Ad spend and revenue, day by day"),
          h("p", { className: "mt-0.5 text-[11px] text-muted" }, `Bars are ad spend from ${spend.source} (${currencyOf(spend)}). The line is revenue from ${revenue.source} (${currencyOf(revenue)}), on the right axis. ▲ marks something you did in PRISM.`),
          h(
            "div",
            { className: "mt-3" },
            h(DailyChart, {
              days: datesIn(range).map((date, index) => ({ date, spend: spend.series![index], line: revenue.series![index] })),
              lineLabel: "Revenue",
              markers,
              formatSpend: (value: number) => formatMoney(value, currencyOf(spend), value >= 100 || Number.isInteger(value) ? 0 : 2),
              formatLine: (value: number) => (value >= 1000 ? formatCompact(value) : formatMoney(value, currencyOf(revenue), Number.isInteger(value) ? 0 : 2)),
            }),
          ),
        )
      : null,
    h(
      "p",
      { className: "mt-3 text-[11px] leading-4 text-muted" },
      "Each figure comes from the best source there is for it, named on its card: live connections first, then imported files. An order is not traced to a single ad, so read the figures side by side over the same days. A file without days shows one total for the days it covers.",
    ),
  );

  function heading() {
    return h(
      "div",
      { className: "mb-4" },
      h("h2", { id: "business-title", className: "text-lg font-semibold tracking-[-.02em] text-ink" }, "The whole picture"),
      h("p", { className: "mt-0.5 text-[11px] text-muted" }, "Revenue, orders and ad spend for the days you chose, from whichever sources you have connected or imported."),
    );
  }
}
