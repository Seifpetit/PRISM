"use client";

import type { ImportedAds, MetaAdsPerformance } from "@/api/api";
import { AdsTable } from "@/components/performance/ads-table";
import { useCurrency } from "@/components/performance/currency-context";
import { MetricCard, Notice, cardClass } from "@/components/performance/metric-card";
import type { Remote } from "@/components/performance/use-remote";
import { h } from "@/lib/h";
import { confirmationRate, deliveryRate } from "@/lib/imported-metrics";
import { formatInteger, formatPercent } from "@/lib/meta-metrics";

const META_BLUE = "#0866FF";
const COD_TEAL = "#0F9D8A";
const shortDate = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "");
const span = (from?: string | null, to?: string | null) => (from && to ? `${shortDate(from)} – ${shortDate(to)}` : "");

const perOrder = (spend: number, orders: number) => (orders > 0 ? spend / orders : null);

/**
 * The imported ads: the Meta export (spend, clicks, hook and hold rate) joined by ad name with the Converty summary
 * (orders, how many were confirmed and delivered, delivered revenue). Orders come from Converty when it is imported,
 * and from the purchases Meta attributes to each ad in the export when it is not, and the section says which. Converty
 * has no days, only each ad's whole life, so this uses every imported day and ignores the 7, 30 or 90 day range.
 * Nothing is shown until something is imported.
 */
export function ImportedAdsSection({ productId, state, meta, onRetry }: { productId: string; state: Remote<ImportedAds>; meta: Remote<MetaAdsPerformance>; onRetry: () => void }) {
  const { money } = useCurrency();
  const data = state.data;
  // A failed read is said out loud: an import that is stored but not shown looks exactly like one that never happened.
  if (state.error && !data) {
    return h(
      "section",
      { "aria-labelledby": "imported-title" },
      h("h2", { id: "imported-title", className: "mb-4 text-lg font-semibold tracking-[-.02em] text-ink" }, "Ads · from your imports"),
      h(Notice, { title: "Couldn't read your imported files", body: `${state.error} Your files are still saved; this is only the reading of them.`, action: h("button", { type: "button", onClick: onRetry, className: "rounded-lg border border-[#DDE0E4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, "Try again") }),
    );
  }
  if (!data || (data.meta.rows === 0 && data.converty.rows === 0)) return null;

  const spendCurrency = data.meta.currency ?? "USD";
  const revenueCurrency = data.converty.currency ?? "USD";
  const hasMeta = data.meta.rows > 0;
  const hasConverty = data.converty.rows > 0;
  const t = data.totals;
  const missingMeta = "Import the Meta ad export";
  const missingConverty = "Import the Converty summary";
  const both = hasMeta && hasConverty;
  // Orders come from the Converty file when there is one, else from the purchases Meta attributes to each ad.
  const ordersFrom: "converty" | "meta" | null = hasConverty ? "converty" : hasMeta && t.purchases > 0 ? "meta" : null;
  const matchedDelivered = data.ads.filter((ad) => ad.hasMeta && ad.hasConverty).reduce((total, ad) => total + ad.delivered, 0);
  // Spend over the days the order file covers, so the cost per delivered order divides spend and orders of the same period.
  const matchedSpend = data.ads.filter((ad) => ad.hasMeta && ad.hasConverty).reduce((total, ad) => total + ad.spendInOrderWindow, 0);
  const reported = "What Meta attributes to its ads, not recorded sales";
  // Only an order file records confirmation and delivery; the Meta export has neither.
  const needsOrderFile = "Only an order file records this (the Meta export does not). Import the Converty summary";
  // Revenue: delivered revenue from the Converty file when there is one, else the purchase value Meta reports for the range.
  const m = meta.data;
  const metaRevenue = m?.connected && m.totals && !m.unassigned && m.totals.revenue > 0 ? { value: m.totals.revenue, currency: m.currency ?? "USD", days: m.range?.days ?? 0 } : null;

  return h(
    "section",
    { "aria-labelledby": "imported-title", className: state.loading ? "opacity-60 transition-opacity" : "transition-opacity" },
    h(
      "div",
      { className: "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2" },
      h("h2", { id: "imported-title", className: "text-lg font-semibold tracking-[-.02em] text-ink" }, "Ads · from your imports"),
      hasMeta ? h("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-[#0866FF]/45 bg-[#0866FF]/10 py-0.5 pl-1.5 pr-2.5 text-[11px] font-semibold text-ink" }, h("span", { className: "h-2 w-2 rounded-full", style: { background: META_BLUE }, "aria-hidden": true }), `Ad export · ${span(data.meta.dateFrom, data.meta.dateTo)} · ${spendCurrency}`) : null,
      hasConverty ? h("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-[#0F9D8A]/45 bg-[#0F9D8A]/10 py-0.5 pl-1.5 pr-2.5 text-[11px] font-semibold text-ink" }, h("span", { className: "h-2 w-2 rounded-full", style: { background: COD_TEAL }, "aria-hidden": true }), `Converty · orders ${span(data.converty.dateFrom, data.converty.dateTo)} · ${revenueCurrency}`) : null,
    ),
    data.meta.mixedCurrency || data.converty.mixedCurrency
      ? h("p", { role: "alert", className: "mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700" }, "These imports are in more than one currency, so money totals add different currencies together. Choose one product to read them properly.")
      : null,
    h(
      "div",
      { className: "grid grid-cols-2 gap-3 lg:grid-cols-3" },
      h(MetricCard, { label: "Ad spend · export", value: hasMeta ? money(t.spend, spendCurrency) : "–", fraction: null, good: "none", note: hasMeta ? `${formatInteger(t.linkClicks)} link clicks` : missingMeta }),
      h(MetricCard, {
        label: "Orders",
        source: ordersFrom === "converty" ? "Converty file" : ordersFrom === "meta" ? "Meta ad export · reported" : undefined,
        value: ordersFrom === "converty" ? formatInteger(t.orders) : ordersFrom === "meta" ? formatInteger(t.purchases) : "–",
        fraction: null,
        good: "none",
        color: COD_TEAL,
        hint: ordersFrom === "meta" ? reported : undefined,
        note: ordersFrom === "converty" ? (data.unattributed ? `${formatInteger(data.unattributed.orders)} not attributed to an ad` : "all attributed to an ad") : ordersFrom === "meta" ? `${reported}. Import the Converty summary for recorded orders` : missingConverty,
      }),
      h(MetricCard, { label: "Confirmed", source: hasConverty ? "Converty file" : undefined, value: hasConverty ? formatPercent(confirmationRate(t), 0) : "–", fraction: null, good: "none", color: COD_TEAL, note: hasConverty ? `${formatInteger(t.confirmed)} of ${formatInteger(t.orders - t.deleted)} orders that stayed alive` : needsOrderFile, hint: "Confirmed orders over orders that were not deleted" }),
      h(MetricCard, { label: "Delivered", source: hasConverty ? "Converty file" : undefined, value: hasConverty ? formatPercent(deliveryRate(t), 0) : "–", fraction: null, good: "none", color: COD_TEAL, note: hasConverty ? `${formatInteger(t.delivered)} delivered · ${formatInteger(t.returned)} returned` : needsOrderFile, hint: "Delivered orders over confirmed orders" }),
      both
        ? h(MetricCard, { label: "Cost per delivered order", source: "Meta ad export ÷ Converty file", value: money(perOrder(matchedSpend, matchedDelivered), spendCurrency), fraction: null, good: "none", note: "Ads that are in both files", hint: "Ad spend divided by delivered orders, for the ads found in both files" })
        : ordersFrom === "meta"
          ? h(MetricCard, { label: "Cost per order", source: "Meta ad export · reported", value: money(perOrder(t.spend, t.purchases), spendCurrency), fraction: null, good: "none", hint: reported, note: "Ad spend over the purchases Meta attributes to its ads" })
          : h(MetricCard, { label: "Cost per delivered order", value: "–", fraction: null, good: "none", note: hasMeta ? missingConverty : missingMeta, hint: "Ad spend divided by delivered orders, for the ads found in both files" }),
      hasConverty
        ? h(MetricCard, { label: "Delivered revenue", source: "Converty file", value: money(t.deliveredRevenue, revenueCurrency), fraction: null, good: "none", color: COD_TEAL, note: `in ${revenueCurrency}${revenueCurrency === spendCurrency ? "" : ", converted only if you chose a currency"}` })
        : metaRevenue
          ? h(MetricCard, { label: "Revenue", source: "Meta Ads · reported", value: money(metaRevenue.value, metaRevenue.currency), fraction: null, good: "none", color: COD_TEAL, hint: reported, note: `Last ${metaRevenue.days} days. ${reported}` })
          : h(MetricCard, { label: "Delivered revenue", value: "–", fraction: null, good: "none", color: COD_TEAL, note: missingConverty }),
    ),
    h(
      "div",
      { className: `${cardClass} mt-4 overflow-hidden` },
      h(AdsTable, { key: productId, productId, ads: data.ads, spendCurrency, revenueCurrency, context: { hasOrderFile: hasConverty, exportCountsPurchases: t.purchases > 0 }, hasMetaFile: hasMeta, hasConvertyFile: hasConverty }),
    ),
    h(
      "p",
      { className: "mt-3 text-[11px] leading-4 text-muted" },
      `The two files are matched by ad name. Meta orders are what Meta attributes to each ad; confirmed, delivered and their costs come from the order file, with spend counted over the days that file covers so both are for the same period. These numbers cover every imported day and do not follow the 7, 30 or 90 day range above. Spend is in ${spendCurrency} and revenue in ${revenueCurrency}; they are converted only if you chose a currency and gave a rate.`,
    ),
  );
}
