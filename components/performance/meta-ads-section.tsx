"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { MetaAdsPerformance, MetaCampaignRow, MetaDay } from "@/api/api";
import { CampaignAssignment } from "@/components/performance/meta-campaign-assignment";
import { DailyChart, type ChartMarker } from "@/components/performance/meta-charts";
import { useCurrency, type MoneyFormat } from "@/components/performance/currency-context";
import { MetricCard, Notice, SectionSkeleton, cardClass, type Direction } from "@/components/performance/metric-card";
import type { Remote } from "@/components/performance/use-remote";
import { StatusPill } from "@/components/performance/status-pill";
import { h } from "@/lib/h";
import {
  change,
  derive,
  formatCompact,
  formatInteger,
  formatMoney,
  formatMultiple,
  formatPercent,
  type Totals,
} from "@/lib/meta-metrics";
import { useAppStore } from "@/store/use-app-store";

const META_BLUE = "#0866FF";

const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink " +
  "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40";

interface Kpi {
  key: string;
  label: string;
  /** The value for a set of totals, so the same rule gives the number, the previous number and each day of the trend. */
  value: (totals: Totals) => number | null;
  format: (value: number | null, currency: string, money: MoneyFormat) => string;
  /** Which way is good: more purchases is good, a higher cost per purchase is not, more spend is neither. */
  good: Direction;
  hint?: string;
}

const KPIS: Kpi[] = [
  { key: "spend", label: "Spend", value: (t) => t.spend, format: (v, c, money) => money(v, c), good: "none" },
  { key: "purchases", label: "Purchases", value: (t) => t.purchases, format: (v) => formatInteger(v), good: "up" },
  { key: "roas", label: "ROAS", value: (t) => derive(t).roas, format: (v) => formatMultiple(v), good: "up", hint: "Purchase value per unit of spend, as Meta reports it" },
  { key: "cpa", label: "Cost per purchase", value: (t) => derive(t).cpa, format: (v, c, money) => money(v, c), good: "down" },
  { key: "impressions", label: "Impressions", value: (t) => t.impressions, format: (v) => formatCompact(v), good: "none" },
  { key: "ctr", label: "Link CTR", value: (t) => derive(t).ctr, format: (v) => formatPercent(v, 2), good: "up", hint: "Link clicks divided by impressions" },
  { key: "cpc", label: "Cost per link click", value: (t) => derive(t).cpc, format: (v, c, money) => money(v, c, 3), good: "down" },
  { key: "cpm", label: "CPM", value: (t) => derive(t).cpm, format: (v, c, money) => money(v, c), good: "down", hint: "Cost per 1,000 impressions" },
];

const LINE_METRICS = [
  { key: "purchases", label: "Purchases", pick: (day: MetaDay) => day.purchases, format: (v: number) => formatInteger(v) },
  { key: "revenue", label: "Purchase value", pick: (day: MetaDay) => day.revenue, format: (v: number) => formatCompact(v) },
  { key: "clicks", label: "Link clicks", pick: (day: MetaDay) => day.clicks, format: (v: number) => formatCompact(v) },
  { key: "impressions", label: "Impressions", pick: (day: MetaDay) => day.impressions, format: (v: number) => formatCompact(v) },
] as const;

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function KpiCard({ kpi, data }: { kpi: Kpi; data: MetaAdsPerformance }) {
  const { money } = useCurrency();
  const currency = data.currency ?? "USD";
  const current = kpi.value(data.totals!);
  const previous = kpi.value(data.previousTotals!);
  const days = data.range?.days ?? 0;
  return h(MetricCard, {
    label: kpi.label,
    value: kpi.format(current, currency, money),
    fraction: change(current, previous),
    good: kpi.good,
    hint: kpi.hint,
    compareLabel: `vs previous ${days}d`,
    series: (data.daily ?? []).map((day) => kpi.value(day)),
  });
}

function CampaignTable({ campaigns, currency }: { campaigns: MetaCampaignRow[]; currency: string }) {
  const { money } = useCurrency();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? campaigns : campaigns.slice(0, 8);
  const top = Math.max(1, ...campaigns.map((campaign) => campaign.spend));
  const head = "mono px-3 py-2 text-[9px] font-semibold uppercase tracking-[.12em] text-muted";
  if (!campaigns.length) return h("p", { className: "px-4 py-6 text-center text-xs text-muted" }, "No campaign had delivery in this range.");
  return h(
    "div",
    null,
    h(
      "div",
      { className: "overflow-x-auto" },
      h(
        "table",
        { className: "w-full min-w-[640px] border-collapse text-left text-xs" },
        h(
          "thead",
          null,
          h(
            "tr",
            { className: "border-b border-[#ECEEF1]" },
            h("th", { className: `${head} pl-4` }, "Campaign"),
            h("th", { className: `${head} w-[190px]` }, "Spend"),
            h("th", { className: `${head} text-right` }, "Purchases"),
            h("th", { className: `${head} text-right` }, "ROAS"),
            h("th", { className: `${head} text-right` }, "Cost / purchase"),
            h("th", { className: `${head} pr-4 text-right` }, "Link CTR"),
          ),
        ),
        h(
          "tbody",
          null,
          ...shown.map((campaign) => {
            const d = derive(campaign);
            return h(
              "tr",
              { key: campaign.id, className: "border-b border-[#F1F3F5] last:border-0 hover:bg-[#F6F7F9]" },
              h(
                "td",
                { className: "max-w-[280px] py-2.5 pl-4 pr-3" },
                h("p", { className: "truncate font-semibold text-ink", title: campaign.name }, campaign.name),
                h("div", { className: "mt-1" }, h(StatusPill, { status: campaign.status })),
              ),
              h(
                "td",
                { className: "px-3 py-2.5" },
                h("p", { className: "font-semibold tabular-nums text-ink" }, money(campaign.spend, currency)),
                h("div", { className: "mt-1 h-1 rounded-full bg-[#ECEEF1]", "aria-hidden": true }, h("div", { className: "h-1 rounded-full", style: { width: `${(campaign.spend / top) * 100}%`, background: META_BLUE } })),
              ),
              h("td", { className: "px-3 py-2.5 text-right tabular-nums text-ink" }, formatInteger(campaign.purchases)),
              h("td", { className: "px-3 py-2.5 text-right tabular-nums text-ink" }, formatMultiple(d.roas)),
              h("td", { className: "px-3 py-2.5 text-right tabular-nums text-ink" }, money(d.cpa, currency)),
              h("td", { className: "px-3 py-2.5 pr-4 text-right tabular-nums text-ink" }, formatPercent(d.ctr, 2)),
            );
          }),
        ),
      ),
    ),
    campaigns.length > 8
      ? h("div", { className: "border-t border-[#ECEEF1] px-4 py-2" }, h("button", { type: "button", onClick: () => setShowAll((open) => !open), className: "text-[11px] font-semibold text-lineage hover:underline" }, showAll ? "Show fewer" : `Show all ${campaigns.length} campaigns`))
      : null,
  );
}

/**
 * The Meta Ads section of Performance: spend, results and cost per result for the range and scope the page has
 * chosen, each against the same length of time before it, a daily chart with what you did marked on it, and the
 * campaigns. Read live from Meta; "This product" counts only the campaigns assigned to the open product.
 */
export function MetaAdsSection({
  productId,
  productName,
  onScope,
  state,
  markers,
  onAssigned,
}: {
  productId: string;
  productName: string;
  onScope: (scope: "product" | "account") => void;
  state: Remote<MetaAdsPerformance>;
  markers: ChartMarker[];
  /** The assignment changed: read the numbers again for this product. */
  onAssigned: () => void;
}) {
  const openSettings = useAppStore((state) => state.openSettings);
  const { view } = useCurrency();
  const [assigning, setAssigning] = useState(false);
  const [lineKey, setLineKey] = useState<(typeof LINE_METRICS)[number]["key"]>("purchases");
  const { data, error, loading } = state;
  const line = LINE_METRICS.find((metric) => metric.key === lineKey) ?? LINE_METRICS[0];
  const currency = data?.currency ?? "USD";
  // What the chart plots is converted, so its bars and its axis say the same thing.
  const shown = view(currency);

  let body: React.ReactNode;
  if (!data && !error) {
    body = h(SectionSkeleton, { label: "Loading Meta Ads numbers" });
  } else if (error) {
    body = h(Notice, { title: "Couldn't load Meta Ads", body: error });
  } else if (data?.connected && data.unassigned) {
    body = h(Notice, {
      title: `No Meta campaigns are assigned to ${productName} yet`,
      body: "An ad account can run several products. Choose which campaigns launch this one and Performance will count only those.",
      action: h(
        "div",
        { className: "flex gap-2" },
        h("button", { type: "button", onClick: () => setAssigning(true), className: "shrink-0 rounded-md bg-ink px-3.5 py-1.5 text-[11px] font-semibold text-white" }, "Assign campaigns"),
        h("button", { type: "button", onClick: () => onScope("account"), className: buttonClass }, "View whole account"),
      ),
    });
  } else if (!data?.connected || !data.totals || !data.previousTotals || !data.daily) {
    const expired = /expired|invalid|session/i.test(data?.error ?? "");
    body = h(Notice, {
      title: data?.error ? (expired ? "Your Meta token stopped working" : "Meta Ads isn't reachable") : "Connect Meta Ads",
      body: data?.error ? `Meta said: ${data.error}` : "Connect your ad account with your own access token to see spend, purchases and cost per purchase here.",
      action: h("button", { type: "button", onClick: () => openSettings("integrations"), className: buttonClass }, "Open Integrations"),
    });
  } else {
    body = h(
      "div",
      { className: loading ? "opacity-60 transition-opacity" : "transition-opacity" },
      data.accountStatus && data.accountStatus !== "ACTIVE"
        ? h(
            "div",
            { role: "alert", className: "mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-700" },
            h(AlertTriangle, { size: 14, className: "mt-0.5 shrink-0", "aria-hidden": true }),
            `Meta reports this ad account as ${data.accountStatus.replace(/_/g, " ").toLowerCase()}. Ads may not be delivering, and the numbers below can be incomplete.`,
          )
        : null,
      h("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4" }, ...KPIS.map((kpi) => h(KpiCard, { key: kpi.key, kpi, data }))),
      h(
        "div",
        { className: `${cardClass} mt-4 px-4 pb-3 pt-4` },
        h(
          "div",
          { className: "flex flex-wrap items-center justify-between gap-3" },
          h(
            "div",
            null,
            h("h3", { className: "text-sm font-semibold text-ink" }, "Spend by day"),
            h("p", { className: "mt-0.5 text-[11px] text-muted" }, `Bars are spend. The line is ${line.label.toLowerCase()}, on the right axis.`),
          ),
          h(
            "div",
            { role: "group", "aria-label": "Line metric", className: "flex flex-wrap gap-1" },
            ...LINE_METRICS.map((metric) =>
              h(
                "button",
                {
                  key: metric.key,
                  type: "button",
                  "aria-pressed": metric.key === lineKey,
                  onClick: () => setLineKey(metric.key),
                  className: `rounded-full border px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
                    metric.key === lineKey ? "border-[#E89400] bg-[#E89400]/12 text-ink" : "border-[#DDE0E4] text-muted hover:text-ink"
                  }`,
                },
                metric.label,
              ),
            ),
          ),
        ),
        h(
          "div",
          { className: "mt-3" },
          h(DailyChart, {
            days: data.daily.map((day) => ({ date: day.date, spend: day.spend * shown.factor, line: line.key === "revenue" ? line.pick(day) * shown.factor : line.pick(day) })),
            lineLabel: line.label,
            markers,
            formatSpend: (value: number) => formatMoney(value, shown.currency, value >= 100 || Number.isInteger(value) ? 0 : 2),
            formatLine: line.format,
          }),
        ),
      ),
      h(
        "div",
        { className: `${cardClass} mt-4 overflow-hidden` },
        h("div", { className: "flex items-baseline justify-between gap-3 px-4 pb-2 pt-4" }, h("h3", { className: "text-sm font-semibold text-ink" }, "Campaigns"), h("p", { className: "text-[11px] text-muted" }, `${data.campaigns?.length ?? 0} in this range, by spend`)),
        h(CampaignTable, { campaigns: data.campaigns ?? [], currency }),
      ),
      h(
        "p",
        { className: "mt-3 text-[11px] leading-4 text-muted" },
        `${shortDate(data.range!.since)} – ${shortDate(data.range!.until)}, compared with the ${data.range!.days} days before. ${
          data.scope === "product"
            ? `Only the ${data.campaignCount} campaign${data.campaignCount === 1 ? "" : "s"} assigned to ${productName}.`
            : "The whole ad account, including campaigns of other products."
        } As Meta reports them (purchases and value use Meta's attribution window).`,
      ),
    );
  }

  return h(
    "section",
    { "aria-labelledby": "meta-ads-title" },
    h(
      "div",
      { className: "mb-4 flex flex-wrap items-center gap-x-3 gap-y-2" },
      h("span", { className: "grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold text-white", style: { background: META_BLUE }, "aria-hidden": true }, "∞"),
      h("h2", { id: "meta-ads-title", className: "text-lg font-semibold tracking-[-.02em] text-ink" }, "Meta Ads"),
      data?.accountName
        ? h(
            "span",
            { className: "inline-flex max-w-[260px] items-center gap-1.5 rounded-full border border-[#0866FF]/45 bg-[#0866FF]/10 py-0.5 pl-1.5 pr-2.5 text-[11px] font-semibold text-ink", title: `Linked account: ${data.accountName}` },
            h("span", { className: "h-2 w-2 shrink-0 rounded-full bg-[#0866FF]", "aria-hidden": true }),
            h("span", { className: "truncate" }, data.accountName),
          )
        : null,
      h(
        "div",
        { className: "ml-auto flex items-center gap-2" },
        h("button", { type: "button", onClick: () => setAssigning((open) => !open), "aria-expanded": assigning, className: buttonClass }, "Assign campaigns"),
      ),
    ),
    assigning
      ? h(CampaignAssignment, {
          key: productId,
          productId,
          productName,
          onCancel: () => setAssigning(false),
          onSaved: () => {
            setAssigning(false);
            onScope("product");
            onAssigned();
          },
        })
      : null,
    body,
  );
}
