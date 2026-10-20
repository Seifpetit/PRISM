"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ImportedAd } from "@/api/api";
import { AdColumnsMenu } from "@/components/performance/ad-columns-menu";
import { AdDetailModal } from "@/components/performance/ad-detail-modal";
import { useCurrency } from "@/components/performance/currency-context";
import { ImportedAdThumb } from "@/components/performance/imported-ad-thumb";
import { StatusPill } from "@/components/performance/status-pill";
import { cellFor, columnDef, columnsFor, readView, saveView, sortAds, type ColumnKey, type Context, type SortDir, type View } from "@/lib/ad-columns";
import { h } from "@/lib/h";
import { formatInteger, formatPercent } from "@/lib/meta-metrics";

const head = "mono px-3 py-2 text-[9px] font-semibold uppercase tracking-[.12em] text-muted";
const stickyCell = "sticky left-0 z-10 bg-white";

/** How one cell reads: a dash with why when there is nothing, else the value in the column's own format. */
export function formatCell(key: ColumnKey, ad: ImportedAd, context: Context, money: ReturnType<typeof useCurrency>["money"], spendCurrency: string, revenueCurrency: string) {
  const def = columnDef(key);
  const cell = cellFor(key, ad, context);
  if (cell.value === null) return h("span", { className: "text-muted", title: cell.reason ?? undefined }, "—");
  switch (def.format) {
    case "spendMoney":
      return money(cell.value, spendCurrency, key === "cpc" ? 3 : undefined);
    case "revenueMoney":
      return money(cell.value, revenueCurrency);
    case "percent":
      return formatPercent(cell.value, 0);
    case "percent2":
      return formatPercent(cell.value, 2);
    default:
      return formatInteger(cell.value);
  }
}

/**
 * The By ad table: the ad on the left (pinned while the metrics scroll), then the columns of the chosen view. Every
 * header sorts and says on hover what the number is; an empty cell shows a dash and says why on hover. The view is
 * kept per product. Pressing a row opens its full metadata.
 */
export function AdsTable({ productId, ads, spendCurrency, revenueCurrency, context, hasMetaFile, hasConvertyFile }: { productId: string; ads: ImportedAd[]; spendCurrency: string; revenueCurrency: string; context: Context; hasMetaFile: boolean; hasConvertyFile: boolean }) {
  const { money } = useCurrency();
  const [view, setView] = useState<View>(() => readView(productId));
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir }>({ key: "spend", dir: "desc" });
  const [showAll, setShowAll] = useState(false);
  const [inspecting, setInspecting] = useState<ImportedAd | null>(null);

  const changeView = (next: View) => {
    setView(next);
    saveView(productId, next);
  };
  const columns = columnsFor(view, context);
  const sorted = sortAds(ads, sort.key, sort.dir, context);
  const shown = showAll ? sorted : sorted.slice(0, 10);

  const sortBy = (key: ColumnKey) => setSort((current) => (current.key === key ? { key, dir: current.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const render = (key: ColumnKey, ad: ImportedAd) => formatCell(key, ad, context, money, spendCurrency, revenueCurrency);

  return h(
    "div",
    null,
    h(
      "div",
      { className: "flex items-baseline justify-between gap-3 px-4 pb-2 pt-4" },
      h("div", { className: "flex items-baseline gap-3" }, h("h3", { className: "text-sm font-semibold text-ink" }, "By ad"), h("p", { className: "text-[11px] text-muted" }, `${ads.length} ads`)),
      h(AdColumnsMenu, { view, context, onChange: changeView }),
    ),
    h(
      "div",
      { className: "overflow-x-auto" },
      h(
        "table",
        { className: "w-full border-collapse text-left text-xs", style: { minWidth: 230 + columns.length * 104 } },
        h(
          "thead",
          null,
          h(
            "tr",
            { className: "border-b border-[#ECEEF1]" },
            h("th", { className: `${head} ${stickyCell} pl-4` }, "Ad"),
            ...columns.map((key, index) => {
              const def = columnDef(key);
              const active = sort.key === key;
              return h(
                "th",
                { key, "aria-sort": active ? (sort.dir === "desc" ? "descending" : "ascending") : "none", className: `${head} text-right ${index === columns.length - 1 ? "pr-4" : ""}` },
                h(
                  "button",
                  { type: "button", onClick: () => sortBy(key), title: `${def.definition} Click to sort.`, className: `inline-flex items-center gap-1 uppercase tracking-[.12em] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${active ? "text-ink" : ""}` },
                  def.label,
                  active ? h(sort.dir === "desc" ? ArrowDown : ArrowUp, { size: 10, "aria-hidden": true }) : null,
                ),
              );
            }),
          ),
        ),
        h(
          "tbody",
          null,
          ...shown.map((ad) =>
            h(
              "tr",
              {
                key: ad.name,
                onClick: () => setInspecting(ad),
                tabIndex: 0,
                role: "button",
                "aria-label": `${ad.name} details`,
                onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setInspecting(ad); } },
                className: "group cursor-pointer border-b border-[#F1F3F5] last:border-0 hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:bg-[#F6F7F9]",
              },
              h(
                "td",
                { className: `${stickyCell} max-w-[230px] py-2.5 pl-4 pr-3 group-hover:bg-[#F6F7F9]` },
                h(
                  "div",
                  { className: "flex items-start gap-2" },
                  h(ImportedAdThumb, { ad, large: true }),
                  h(
                    "div",
                    { className: "min-w-0 flex-1" },
                    h("p", { className: "truncate font-semibold text-ink", title: ad.name }, ad.name),
                    h(
                      "div",
                      { className: "mt-1 flex items-center gap-1.5" },
                      ad.delivery ? h(StatusPill, { status: ad.delivery.toUpperCase() }) : null,
                      hasConvertyFile && !ad.hasConverty && ad.hasMeta ? h("span", { className: "text-[10px] text-muted" }, "no orders in Converty") : null,
                      hasMetaFile && ad.hasConverty && !ad.hasMeta ? h("span", { className: "text-[10px] text-muted" }, "not in the ad export") : null,
                    ),
                  ),
                ),
              ),
              ...columns.map((key, index) => h("td", { key, className: `px-3 py-2.5 text-right tabular-nums text-ink ${index === columns.length - 1 ? "pr-4" : ""}` }, render(key, ad))),
            ),
          ),
        ),
      ),
    ),
    ads.length > 10
      ? h("div", { className: "border-t border-[#ECEEF1] px-4 py-2" }, h("button", { type: "button", onClick: () => setShowAll((open) => !open), className: "text-[11px] font-semibold text-lineage hover:underline" }, showAll ? "Show fewer" : `Show all ${ads.length} ads`))
      : null,
    h(AdDetailModal, { ad: inspecting, context, spendCurrency, revenueCurrency, onClose: () => setInspecting(null) }),
  );
}
