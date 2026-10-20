"use client";

import { Fragment, useEffect, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, TriangleAlert, X } from "lucide-react";
import { api, type CsvAnalysis, type CsvCommitResult, type CsvDecisions, type CsvImportRecord } from "@/api/api";
import { Select } from "@/components/ui/select";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

const buttonClass =
  "shrink-0 rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink " +
  "hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
const selectClass =
  "h-8 w-full rounded-md border border-[#D8DCE1] bg-white pl-2.5 pr-7 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

const CURRENCIES = ["TND", "EUR", "USD", "GBP", "MAD", "DZD"];
const OTHER = "OTHER";

interface FileItem {
  id: string;
  fileName: string;
  status: "analyzing" | "ready" | "importing" | "done" | "error";
  analysis?: CsvAnalysis;
  error?: string;
  result?: CsvCommitResult;
  // The answers to what the analysis could not settle.
  currency: string;
  otherCurrency: string;
  unresolvedMode: "assign" | "skip";
  assignTo: string;
  overrideProduct: string;
}

const emptyDecisions = { currency: "", otherCurrency: "", unresolvedMode: "assign" as const, assignTo: "", overrideProduct: "" };

const plural = (count: number, noun: string) => `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;

const shortDate = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");

/** What to send with the commit, or why the file can't be imported yet. */
function decisionsFor(item: FileItem): { ok: true; decisions: CsvDecisions } | { ok: false; reason: string } {
  const analysis = item.analysis;
  if (!analysis) return { ok: false, reason: "" };
  const decisions: CsvDecisions = {};
  if (!analysis.currencyKnown) {
    const code = (item.currency === OTHER ? item.otherCurrency : item.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) return { ok: false, reason: "Choose the currency" };
    decisions.currency = code;
  }
  if (item.overrideProduct) {
    decisions.forceProductId = item.overrideProduct;
  } else if (analysis.unresolved.ads > 0) {
    if (item.unresolvedMode === "skip") decisions.skipUnresolved = true;
    else if (item.assignTo) decisions.assignUnresolvedTo = item.assignTo;
    else return { ok: false, reason: "Choose a product for the unmatched ads" };
  }
  return { ok: true, decisions };
}

function FileCard({
  item,
  products,
  onChange,
  onImport,
  onDismiss,
}: {
  item: FileItem;
  products: Array<{ id: string; name: string }>;
  onChange: (patch: Partial<FileItem>) => void;
  onImport: () => void;
  onDismiss: () => void;
}) {
  const analysis = item.analysis;
  const productOptions = products.map((product) => ({ value: product.id, label: product.name }));
  const check = decisionsFor(item);

  let body: React.ReactNode = null;
  if (item.status === "analyzing") {
    body = h("p", { className: "flex items-center gap-2 text-xs text-muted", role: "status" }, h(Loader2, { size: 13, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }), "Reading the file…");
  } else if (item.status === "error") {
    body = h("p", { role: "alert", className: "text-xs leading-5 text-red-600" }, item.error);
  } else if (item.status === "done" && item.result) {
    const result = item.result;
    const unit = result.kind === "meta-ads-export" ? "ad-days" : "ads";
    const where = result.products.map((product) => product.productName).join(", ") || "no product";
    body = h(
      "div",
      { className: "flex items-start gap-2 text-xs leading-5 text-ink", role: "status" },
      h(CheckCircle2, { size: 15, className: "mt-0.5 shrink-0 text-emerald-600", "aria-hidden": true }),
      h(
        "p",
        null,
        result.importId === null
          ? `Already imported: all ${result.unchanged.toLocaleString("en-US")} ${unit} for ${where} were already in PRISM with the same numbers, so nothing changed.`
          : [
              `Imported ${result.imported.toLocaleString("en-US")} ${unit} for ${where}`,
              result.updated ? ` (${result.updated.toLocaleString("en-US")} replaced rows from an earlier import)` : "",
              result.unchanged ? `, ${result.unchanged.toLocaleString("en-US")} were already there unchanged` : "",
              result.skipped ? `, ${result.skipped.toLocaleString("en-US")} skipped` : "",
              ".",
            ].join(""),
      ),
    );
  } else if (analysis) {
    const covered = analysis.products.length;
    body = h(
      "div",
      { className: "space-y-3" },
      h(
        "p",
        { className: "text-[11px] leading-4 text-muted" },
        [
          plural(analysis.rows, "row"),
          plural(analysis.adCount, "ad"),
          analysis.dateFrom && analysis.dateTo ? `${shortDate(analysis.dateFrom)} – ${shortDate(analysis.dateTo)}` : null,
          analysis.currency ? analysis.currency : "currency not stated",
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      // Which product(s) the file belongs to, and why.
      covered === 0
        ? h("p", { className: "text-xs leading-5 text-ink" }, "PRISM couldn't tell which product this file is about.")
        : covered === 1
          ? h(
              "div",
              { className: "text-xs leading-5 text-ink" },
              h("p", null, "This file belongs to ", h("strong", null, analysis.products[0].productName), analysis.unresolved.ads ? ` (${plural(analysis.products[0].ads, "ad")} matched)` : ""),
              h("p", { className: "text-[11px] text-muted" }, `Because ${analysis.products[0].reason}.`),
            )
          : h(
              "div",
              { className: "text-xs leading-5 text-ink" },
              h("p", null, `This file covers ${covered} products:`),
              h(
                "ul",
                { className: "mt-1 space-y-1" },
                ...analysis.products.map((product) =>
                  h("li", { key: product.productId, className: "rounded-md border border-[#ECEEF1] px-2.5 py-1.5" }, h("span", { className: "font-semibold" }, product.productName), ` · ${plural(product.ads, "ad")}`, h("span", { className: "block text-[11px] text-muted" }, `Because ${product.reason}.`)),
                ),
              ),
            ),
      analysis.unresolved.ads > 0 && !item.overrideProduct
        ? h(
            "div",
            { className: "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3", role: "group", "aria-label": "Ads without a product" },
            h(
              "p",
              { className: "flex items-start gap-2 text-xs font-semibold leading-5 text-ink" },
              h(TriangleAlert, { size: 14, className: "mt-0.5 shrink-0 text-amber-600", "aria-hidden": true }),
              `${plural(analysis.unresolved.ads, "ad")} couldn't be matched to a product`,
            ),
            h("p", { className: "mt-1 text-[11px] leading-4 text-muted" }, `For example: ${analysis.unresolved.samples.join(", ")}${analysis.unresolved.ads > analysis.unresolved.samples.length ? ", …" : ""}`),
            h(
              "div",
              { className: "mt-2 space-y-2" },
              h(
                "label",
                { className: "flex items-center gap-2 text-xs text-ink" },
                h("input", { type: "radio", name: `unresolved-${item.id}`, checked: item.unresolvedMode === "assign", onChange: () => onChange({ unresolvedMode: "assign" }), className: "accent-[#0866FF]" }),
                "Put them in",
                h("span", { className: "w-44" }, h(Select, { ariaLabel: "Product for the unmatched ads", value: item.assignTo, onChange: (value: string) => onChange({ assignTo: value, unresolvedMode: "assign" }), options: [{ value: "", label: "Choose a product…" }, ...productOptions], className: selectClass, wrapperClassName: "w-full" })),
              ),
              h(
                "label",
                { className: "flex items-center gap-2 text-xs text-ink" },
                h("input", { type: "radio", name: `unresolved-${item.id}`, checked: item.unresolvedMode === "skip", onChange: () => onChange({ unresolvedMode: "skip" }), className: "accent-[#0866FF]" }),
                "Skip them for now",
              ),
            ),
          )
        : null,
      !analysis.currencyKnown
        ? h(
            "div",
            { className: "rounded-lg border border-[#DDE0E4] p-3", role: "group", "aria-label": "Currency" },
            h("p", { className: "text-xs font-semibold text-ink" }, "Which currency are this file's amounts in?"),
            h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, "The file doesn't say."),
            h(
              "div",
              { className: "mt-2 flex items-center gap-2" },
              h("span", { className: "w-32" }, h(Select, { ariaLabel: "Currency", value: item.currency, onChange: (value: string) => onChange({ currency: value }), options: [{ value: "", label: "Choose…" }, ...CURRENCIES.map((code) => ({ value: code, label: code })), { value: OTHER, label: "Other…" }], className: selectClass, wrapperClassName: "w-full" })),
              item.currency === OTHER
                ? h("input", { value: item.otherCurrency, maxLength: 3, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({ otherCurrency: event.target.value.toUpperCase() }), placeholder: "3 letters", "aria-label": "Currency code", className: "h-8 w-24 rounded-md border border-[#D8DCE1] bg-white px-2.5 text-xs uppercase text-ink outline-none focus:border-lineage" })
                : null,
            ),
          )
        : null,
      h(
        "div",
        { className: "flex flex-wrap items-center gap-2 text-[11px] text-muted" },
        h("span", null, "Not right? Put the whole file in"),
        h("span", { className: "w-40" }, h(Select, { ariaLabel: "Put the whole file in one product", value: item.overrideProduct, onChange: (value: string) => onChange({ overrideProduct: value }), options: [{ value: "", label: "What PRISM found" }, ...productOptions], className: selectClass, wrapperClassName: "w-full" })),
      ),
      analysis.warnings.length ? h("ul", { className: "space-y-0.5 text-[11px] leading-4 text-muted" }, ...analysis.warnings.map((warning) => h("li", { key: warning }, `• ${warning}`))) : null,
      item.error ? h("p", { role: "alert", className: "text-xs text-red-600" }, item.error) : null,
      h(
        "div",
        { className: "flex items-center gap-3" },
        h("button", { type: "button", onClick: onImport, disabled: !check.ok || item.status === "importing", className: "rounded-md bg-ink px-3.5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35" }, item.status === "importing" ? "Importing…" : "Import"),
        !check.ok && check.reason ? h("span", { className: "text-[11px] text-muted" }, check.reason) : null,
      ),
    );
  }

  return h(
    "li",
    { className: "rounded-lg border border-[#ECEEF1] bg-[#FAFAFB] p-4" },
    h(
      "div",
      { className: "mb-2 flex items-start gap-2" },
      h(FileSpreadsheet, { size: 15, className: "mt-0.5 shrink-0 text-muted", "aria-hidden": true }),
      h("div", { className: "min-w-0 flex-1" }, h("p", { className: "truncate text-xs font-semibold text-ink", title: item.fileName }, item.fileName), analysis ? h("p", { className: "text-[11px] text-muted" }, analysis.kindLabel) : null),
      h("button", { type: "button", onClick: onDismiss, "aria-label": `Dismiss ${item.fileName}`, className: "rounded p-1 text-muted hover:bg-canvas hover:text-ink" }, h(X, { size: 13 })),
    ),
    body,
  );
}

function RecentImports({ records }: { records: CsvImportRecord[] }) {
  if (!records.length) return null;
  return h(
    "div",
    { className: "mt-4" },
    h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Recent imports"),
    h(
      "ul",
      { className: "mt-1.5 divide-y divide-[#F1F3F5] rounded-lg border border-[#ECEEF1]" },
      ...records.map((record) =>
        h(
          "li",
          { key: record.id, className: "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-[11px]" },
          h("span", { className: "min-w-0 truncate font-semibold text-ink", title: record.fileName }, record.fileName),
          h("span", { className: "text-muted" }, `${record.products.join(", ") || "no product"} · ${record.rowsImported.toLocaleString("en-US")} rows · ${new Date(record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`),
        ),
      ),
    ),
  );
}

/**
 * CSV import. Choose one or more files; each is read first (which template it is, which product its ads belong to),
 * and only the questions PRISM can't answer itself are asked (a product for ads it couldn't place, a currency the
 * file doesn't state). Nothing is saved until Import.
 */
export function CsvImportControl({ onImported, showRecent = true, inputId }: { onImported?: () => void; showRecent?: boolean; inputId?: string }) {
  const products = useAppStore((state) => state.products);
  const [items, setItems] = useState<FileItem[]>([]);
  const [recent, setRecent] = useState<CsvImportRecord[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    api.csvImports({ limit: 5 }).then((records) => active && setRecent(records)).catch(() => {});
    return () => {
      active = false;
    };
  }, [reload]);

  const update = (id: string, patch: Partial<FileItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ""; // allow choosing the same file again
    for (const file of files) {
      const id = crypto.randomUUID();
      setItems((current) => [...current, { id, fileName: file.name, status: "analyzing", ...emptyDecisions }]);
      if (file.size > MAX_CSV_BYTES) {
        update(id, { status: "error", error: "That file is over 5 MB." });
        continue;
      }
      try {
        const analysis = await api.analyzeCsvImport({ fileName: file.name, csv: await file.text() });
        // The default for unmatched ads is the product the rest of the file went to; the person still presses Import.
        update(id, { status: "ready", analysis, assignTo: analysis.suggestedProductId ?? "" });
      } catch (failure) {
        update(id, { status: "error", error: failure instanceof Error ? failure.message : "Could not read that file." });
      }
    }
  }

  async function runImport(item: FileItem) {
    const check = decisionsFor(item);
    if (!check.ok || !item.analysis) return;
    update(item.id, { status: "importing", error: undefined });
    try {
      const result = await api.commitCsvImport({ analysisId: item.analysis.analysisId, decisions: check.decisions });
      update(item.id, { status: "done", result });
      setReload((n) => n + 1);
      onImported?.();
    } catch (failure) {
      update(item.id, { status: "ready", error: failure instanceof Error ? failure.message : "Could not import that file." });
    }
  }

  const productList = products.map((product) => ({ id: product.id, name: product.name }));
  return h(
    Fragment,
    null,
    h(
      "label",
      { className: `${buttonClass} cursor-pointer focus-within:ring-2 focus-within:ring-lineage` },
      "Import",
      h("input", { id: inputId, type: "file", accept: ".csv,text/csv", multiple: true, className: "sr-only", onChange: handleFiles, "aria-label": "Import CSV files" }),
    ),
    items.length || (showRecent && recent.length)
      ? h(
          "div",
          { className: "w-full" },
          items.length
            ? h(
                "ul",
                { className: "space-y-3" },
                ...items.map((item) => h(FileCard, { key: item.id, item, products: productList, onChange: (patch: Partial<FileItem>) => update(item.id, patch), onImport: () => void runImport(item), onDismiss: () => setItems((current) => current.filter((entry) => entry.id !== item.id)) })),
              )
            : null,
          showRecent ? h(RecentImports, { records: recent }) : null,
        )
      : null,
  );
}
