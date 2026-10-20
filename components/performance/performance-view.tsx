"use client";

import { useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import { api } from "@/api/api";
import { BusinessSection } from "@/components/performance/business-section";
import { CurrencyContext } from "@/components/performance/currency-context";
import { CurrencyControl, type RatesStatus } from "@/components/performance/currency-control";
import { ImportedAdsSection } from "@/components/performance/imported-ads-section";
import { IntegrationsZone } from "@/components/performance/integrations-zone";
import { MetaAdsSection } from "@/components/performance/meta-ads-section";
import type { ChartMarker } from "@/components/performance/meta-charts";
import { ShopifySalesSection } from "@/components/performance/shopify-sales-section";
import { SyncChip } from "@/components/performance/sync-chip";
import { useRemote } from "@/components/performance/use-remote";
import { importedReadings, metaAdsReadings, rangeEndingOn, shopifyReadings, type Range } from "@/lib/business-figures";
import { trackLooks } from "@/lib/creative-tracks";
import type { Market } from "@/lib/currency";
import { readCurrencyPrefs, saveCurrencyPrefs, type CurrencyPrefs } from "@/lib/currency-prefs";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { Campaign } from "@/types/campaign";

const RANGES = [7, 30, 90] as const;
const NO_CAMPAIGNS: Campaign[] = [];

/** What you did in PRISM, by day: a campaign created, an ad set added. They are marked on the charts. */
function prismMarkers(campaigns: Campaign[]): ChartMarker[] {
  const looks = trackLooks(campaigns);
  return campaigns.flatMap((campaign) => [
    { date: campaign.createdAt.slice(0, 10), label: `${campaign.name} created` },
    ...campaign.concepts.map((concept) => ({ date: concept.createdAt.slice(0, 10), label: `${looks.get(concept.id)?.ref ?? "Ad set"} added` })),
  ]);
}

/**
 * Performance: what the connected platforms report for one product. The range and scope are chosen once, at the top,
 * and apply to everything below, so the platforms are always read over the same days and the same product: the
 * combined picture first, then Meta Ads, then Shopify.
 */
export function PerformanceView({ productId, productName }: { productId: string; productName: string }) {
  // The display currency and the person's rates: read once (the page only renders in the browser) and kept on change.
  const [prefs, setPrefs] = useState<CurrencyPrefs>(() => readCurrencyPrefs());
  const changePrefs = (next: CurrencyPrefs) => {
    setPrefs(next);
    saveCurrencyPrefs(next);
  };
  // Live rates are read once (the server caches them for the day) so a ratio across two currencies (Blended ROAS,
  // for instance) can resolve itself even before a display currency is chosen; typed rates still win over them.
  const fx = useRemote("fx", () => api.exchangeRates());
  const market = fx.data ? Object.fromEntries(fx.data.rates.map((entry) => [entry.currency, entry.rate])) : null;
  const status: RatesStatus = { loading: Boolean(prefs.display) && fx.loading, error: fx.error, source: fx.data?.source ?? null, updatedAt: fx.data?.updatedAt ?? null, stale: fx.data?.stale ?? false };
  return h(CurrencyContext.Provider, { value: { ...prefs, market } }, h(PerformanceContent, { productId, productName, prefs, market, status, onPrefs: changePrefs }));
}

function PerformanceContent({ productId, productName, prefs, market, status, onPrefs }: { productId: string; productName: string; prefs: CurrencyPrefs; market: Market | null; status: RatesStatus; onPrefs: (next: CurrencyPrefs) => void }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [scope, setScope] = useState<"product" | "account">("product");
  const [nonce, setNonce] = useState(0);
  // Bumped when a CSV import finishes, so everything that reads imported data reads it again.
  const [importNonce, setImportNonce] = useState(0);
  // Today, read once: the range the figures are cut to when no platform has served one.
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const campaigns = useAppStore((state) => state.campaignsByProduct[productId] ?? NO_CAMPAIGNS);
  const markers = useMemo(() => prismMarkers(campaigns), [campaigns]);

  const refresh = nonce > 0;
  const meta = useRemote(`meta:${days}:${scope}:${productId}:${nonce}`, () => api.metaAdsPerformance({ days, refresh, productId, scope }));
  const shopify = useRemote(`shop:${days}:${scope}:${productId}:${nonce}`, () =>
    api.shopifySales({ days, refresh, productId, scope: scope === "account" ? "store" : "product" }),
  );
  const imported = useRemote(`imported:${scope}:${productId}:${importNonce}`, () => api.importedAds({ productId, scope }));
  const busy = meta.loading || shopify.loading;
  // Is the data up to date for this period? Every source is read the same way the figures are, so the chip and the cards agree.
  const served = shopify.data?.range ?? meta.data?.range;
  const period: Range = served ? { since: served.since, until: served.until } : rangeEndingOn(today, days);
  const readings = [...shopifyReadings(shopify.data), ...metaAdsReadings(meta.data), ...importedReadings(imported.data)];
  const checking = (!meta.data && !meta.error) || (!shopify.data && !shopify.error) || (!imported.data && !imported.error);
  // The currencies in play, so the currency control can ask for a rate for each.
  const present = [...new Set([meta.data?.currency, shopify.data?.currency, imported.data?.meta.currency, imported.data?.converty.currency].filter((currency): currency is string => Boolean(currency)))];
  const updated = [meta.data?.fetchedAt, shopify.data?.fetchedAt].filter(Boolean).sort().at(-1);
  const reload = () => setNonce((n) => n + 1);

  return h(
    "section",
    { className: "px-5 py-10 sm:px-10 lg:px-16", "aria-labelledby": "performance-title" },
    h(
      "div",
      { className: "mx-auto w-full max-w-[1600px]" },
      h(
        "div",
        { className: "flex items-baseline gap-2.5 border-b border-[#DDE0E4] pb-4" },
        h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.16em] text-muted" }, "Performance"),
        h("h1", { id: "performance-title", className: "text-xl font-semibold tracking-[-.025em] text-ink" }, productName),
      ),
      h(
        "div",
        { className: "sticky top-0 z-20 -mx-2 mt-4 flex flex-wrap items-center gap-2 bg-canvas/90 px-2 py-2 backdrop-blur" },
        h(
          "div",
          { role: "group", "aria-label": "Date range", className: "flex rounded-lg border border-[#DDE0E4] p-0.5" },
          ...RANGES.map((range) =>
            h(
              "button",
              {
                key: range,
                type: "button",
                "aria-pressed": range === days,
                onClick: () => setDays(range),
                className: `rounded-md px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${range === days ? "bg-ink text-white" : "text-muted hover:text-ink"}`,
              },
              `${range}D`,
            ),
          ),
        ),
        h(
          "div",
          { role: "group", "aria-label": "Scope", className: "flex rounded-lg border border-[#DDE0E4] p-0.5" },
          ...(["product", "account"] as const).map((option) =>
            h(
              "button",
              {
                key: option,
                type: "button",
                "aria-pressed": option === scope,
                onClick: () => setScope(option),
                className: `rounded-md px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${option === scope ? "bg-ink text-white" : "text-muted hover:text-ink"}`,
              },
              option === "product" ? "This product" : "Whole account",
            ),
          ),
        ),
        h(
          "button",
          {
            type: "button",
            onClick: reload,
            disabled: busy,
            "aria-label": "Refresh the numbers",
            title: "Read the numbers from Meta and Shopify again",
            className:
              "grid h-8 w-8 place-items-center rounded-md border border-[#DDE0E4] text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage disabled:cursor-not-allowed disabled:opacity-40",
          },
          h(RotateCw, { size: 13, className: busy ? "animate-spin motion-reduce:animate-none" : "", "aria-hidden": true }),
        ),
        h(CurrencyControl, { prefs, present, market, status, onChange: onPrefs }),
        h(SyncChip, { readings, range: period, today, loading: checking }),
        updated ? h("span", { className: "hidden text-[11px] text-muted sm:inline" }, `Updated ${new Date(updated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`) : null,
      ),
      h("div", { className: "mt-6" }, h(BusinessSection, { productName, meta, shopify, imported, days, today, markers })),
      imported.error || (imported.data && (imported.data.meta.rows > 0 || imported.data.converty.rows > 0))
        ? h("div", { className: "mt-12 border-t border-[#DDE0E4] pt-8" }, h(ImportedAdsSection, { productId, state: imported, meta, onRetry: () => setImportNonce((n) => n + 1) }))
        : null,
      h(
        "div",
        { className: "mt-12 border-t border-[#DDE0E4] pt-8" },
        h(MetaAdsSection, { key: productId, productId, productName, onScope: setScope, state: meta, markers, onAssigned: reload }),
      ),
      h(
        "div",
        { className: "mt-12 border-t border-[#DDE0E4] pt-8" },
        h(ShopifySalesSection, { key: productId, productId, productName, onScope: setScope, state: shopify, onLinkChange: reload }),
      ),
      h(
        "div",
        { className: "mt-12 border-t border-[#DDE0E4] pt-8" },
        h(IntegrationsZone, { key: productId, productId, meta, shopify, importNonce, onImported: () => setImportNonce((n) => n + 1) }),
      ),
    ),
  );
}
