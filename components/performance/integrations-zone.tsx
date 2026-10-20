"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { api, type CsvCoverage, type CsvImportRecord, type MetaAdsPerformance, type ShopifySales } from "@/api/api";
import { useRemote, type Remote } from "@/components/performance/use-remote";
import { CsvImportControl } from "@/components/settings/csv-import";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

type Tone = "ok" | "warn" | "bad" | "wait";

interface Link {
  key: string;
  name: string;
  /** What is true about it now: an account name, a date, or what is missing. */
  detail: string;
  tone: Tone;
  /** What pressing it does when it needs attention. */
  action?: { label: string; run: () => void };
}

const DOT: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", wait: "bg-[#8A93A0]" };
const CHIP: Record<Tone, string> = {
  ok: "border-[#DDE0E4]",
  warn: "border-amber-500/55 bg-amber-500/10",
  bad: "border-red-500/50 bg-red-500/10",
  wait: "border-[#DDE0E4]",
};

const DAY_MS = 86_400_000;
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function metaLink(meta: Remote<MetaAdsPerformance>, openIntegrations: () => void): Link {
  const data = meta.data;
  const base = { key: "meta", name: "Meta Ads" };
  if (!data && !meta.error) return { ...base, detail: "checking…", tone: "wait" };
  if (meta.error || !data?.connected) {
    const expired = /expired|invalid|session/i.test(data?.error ?? "");
    return { ...base, detail: expired ? "token expired" : data?.error ? "unreachable" : "not connected", tone: expired || data?.error ? "bad" : "warn", action: { label: expired ? "Reconnect" : "Connect", run: openIntegrations } };
  }
  if (data.unassigned) return { ...base, detail: "no campaigns assigned", tone: "warn", action: { label: "Assign", run: () => scrollTo("meta-ads-title") } };
  return { ...base, detail: data.accountName ?? "connected", tone: "ok" };
}

function shopifyLink(shopify: Remote<ShopifySales>, openIntegrations: () => void): Link {
  const data = shopify.data;
  const base = { key: "shopify", name: "Shopify" };
  if (!data && !shopify.error) return { ...base, detail: "checking…", tone: "wait" };
  if (shopify.error || !data?.connected) {
    // Not connected is a normal, expected state for an optional integration — an off switch, not a red alarm.
    return { ...base, detail: "not connected", tone: "wait", action: { label: "Connect", run: openIntegrations } };
  }
  if (data.unlinked) return { ...base, detail: "product not linked", tone: "warn", action: { label: "Link", run: () => scrollTo("shopify-title") } };
  return { ...base, detail: data.shopName ?? "connected", tone: "ok" };
}

/** One chip for the store CSV files: the Meta ad export and the Converty summary. */
function csvLink(coverage: Remote<CsvCoverage>, pickFile: () => void, now: number): Link {
  const base = { key: "csv", name: "Store CSV" };
  const data = coverage.data;
  if (!data) return { ...base, detail: "checking…", tone: "wait" };
  const adExport = data.meta;
  const converty = data.converty;
  if (!adExport.rows && !converty.rows) return { ...base, detail: "not imported", tone: "warn", action: { label: "Import", run: pickFile } };
  const parts = [
    adExport.rows && adExport.dateTo ? `ad export to ${shortDate(adExport.dateTo)}` : null,
    converty.rows ? `${converty.rows.toLocaleString("en-US")} Converty ads` : null,
  ].filter(Boolean);
  // Every day of the ad export is a row, so one that stops days ago is out of date, not just old.
  const age = adExport.rows && adExport.dateTo ? Math.floor((now - new Date(`${adExport.dateTo}T00:00:00Z`).getTime()) / DAY_MS) : 0;
  return age > 7 ? { ...base, detail: parts.join(" · "), tone: "warn", action: { label: "Update", run: pickFile } } : { ...base, detail: parts.join(" · "), tone: "ok" };
}

function Chip({ link }: { link: Link }) {
  const body = [
    h("span", { key: "dot", className: `h-2 w-2 shrink-0 rounded-full ${DOT[link.tone]}`, "aria-hidden": true }),
    h("span", { key: "name", className: "font-semibold text-ink" }, link.name),
    h("span", { key: "detail", className: "min-w-0 truncate text-muted" }, link.detail),
    link.action ? h("span", { key: "action", className: "shrink-0 font-semibold text-ink" }, `${link.action.label} →`) : null,
  ];
  const className = `flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${CHIP[link.tone]}`;
  return link.action
    ? h("button", { type: "button", onClick: link.action.run, title: `${link.name}: ${link.detail}`, className: `${className} hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage` }, ...body)
    : h("div", { className, title: `${link.name}: ${link.detail}` }, ...body);
}

const FILE_KIND: Record<string, string> = { "meta-ads-export": "Meta ad export", "converty-ad-summary": "Converty ad summary" };

/** A small reference to one imported file. Pressing it opens the Data section, where the file can be seen or removed. */
function FileChip({ record, open }: { record: CsvImportRecord; open: () => void }) {
  // A file with no rows in use is still listed, but it is not feeding anything: say so.
  const idle = record.rowsHeld === 0;
  const unit = record.kind === "meta-ads-export" ? "ad-days" : "ads";
  const span = record.dateFrom && record.dateTo ? ` · ${shortDate(record.dateFrom)} – ${shortDate(record.dateTo)}` : "";
  const title = `${record.fileName}\n${FILE_KIND[record.kind] ?? record.kind} · ${record.rowsHeld.toLocaleString("en-US")} ${unit} in use${span}${idle ? "\nNone of its rows are in use." : ""}`;
  return h(
    "button",
    { type: "button", onClick: open, title, className: `flex max-w-[240px] items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${idle ? "border-amber-500/55 bg-amber-500/10" : "border-[#DDE0E4]"}` },
    h(FileSpreadsheet, { size: 11, className: "shrink-0", "aria-hidden": true }),
    h("span", { className: "min-w-0 truncate" }, record.fileName),
    idle ? h("span", { className: "shrink-0 font-semibold text-amber-700" }, "not in use") : null,
  );
}

/**
 * A slim strip at the top of Performance: which parts of the chain feed this page (Meta Ads, Shopify, and the store CSV
 * files) are in place, and which are not. A missing part is amber and says what to do; pressing it does it. The
 * Import button is here too, so bringing a file in never needs a trip to Settings.
 */
export function IntegrationsZone({ productId, meta, shopify, importNonce, onImported }: { productId: string; meta: Remote<MetaAdsPerformance>; shopify: Remote<ShopifySales>; importNonce: number; onImported: () => void }) {
  const openSettings = useAppStore((state) => state.openSettings);
  const [now] = useState(() => Date.now());
  const coverage = useRemote(`coverage:${productId}:${importNonce}`, () => api.csvCoverage({ productId }));
  const imports = useRemote(`files:${importNonce}`, () => api.csvImports({ limit: 50 }));
  // Every file imported for this product (a file from before products were recorded is shown too), newest first.
  const files = (imports.data ?? []).filter((record) => record.productIds.length === 0 || record.productIds.includes(productId));
  const pickFile = () => document.getElementById("performance-csv-input")?.click();
  const openIntegrations = () => openSettings("integrations");

  const links = [metaLink(meta, openIntegrations), shopifyLink(shopify, openIntegrations), csvLink(coverage, pickFile, now)];
  const missing = links.filter((link) => link.tone === "warn" || link.tone === "bad").length;

  return h(
    "section",
    { "aria-label": "Data sources", className: `rounded-xl border px-3 py-2.5 ${missing ? "border-amber-500/40" : "border-[#DDE0E4]"}` },
    h(
      "div",
      { className: "flex flex-wrap items-center gap-x-2 gap-y-2" },
      h("span", { className: "mono mr-1 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Data sources"),
      ...links.flatMap((link, index) => [
        index > 0 ? h("span", { key: `arrow-${link.key}`, className: "text-[11px] text-muted", "aria-hidden": true }, index === 2 ? "+" : "→") : null,
        h(Chip, { key: link.key, link }),
      ]),
      h(
        "div",
        { className: "ml-auto flex items-center gap-3" },
        missing ? h("span", { className: "text-[11px] font-semibold text-amber-700" }, `${missing} of ${links.length} to set up`) : null,
        h(CsvImportControl, { onImported, showRecent: false, inputId: "performance-csv-input" }),
      ),
    ),
    files.length
      ? h(
          "div",
          { className: "mt-2 flex flex-wrap items-center gap-1.5 border-t border-[#ECEEF1] pt-2" },
          h("span", { className: "mono mr-1 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, `Imported files · ${files.length}`),
          ...files.map((record) => h(FileChip, { key: record.id, record, open: () => openSettings("data") })),
        )
      : null,
  );
}
