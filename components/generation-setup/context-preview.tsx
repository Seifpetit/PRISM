"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import { api, type ContextPreviewSource, type GenerationContextRequest } from "@/api/api";
import { useRemote } from "@/components/performance/use-remote";
import { h } from "@/lib/h";
import { KIND_LABEL, type GeneratorId } from "@/lib/generation-setup";

const n = (value: number) => value.toLocaleString("en-US");

function PreviewSource({ source, open }: { source: ContextPreviewSource; open: boolean }) {
  return h(
    "details",
    { open, className: "rounded-lg border border-[#DDE0E4] bg-white" },
    h(
      "summary",
      { className: "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs" },
      h("span", { className: "min-w-0 flex-1 truncate font-semibold text-ink" }, source.name),
      h("span", { className: "mono shrink-0 text-[9px] uppercase tracking-[.1em] text-muted" }, `${KIND_LABEL[source.kind]} · v${source.version}${source.market ? ` · ${source.market}` : ""}`),
      source.truncated ? h("span", { className: "mono shrink-0 rounded bg-[#FFF4D6] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-[#9A6700]" }, "Partial") : h("span", { className: "mono shrink-0 text-[9px] font-semibold uppercase tracking-[.1em] text-lineage" }, "Whole"),
    ),
    h(
      "div",
      { className: "border-t border-[#E7E9EC] px-3 py-2" },
      h("p", { className: "text-[11px] leading-4 text-muted" }, `Covers ${source.coverage}. ${source.truncated ? `${n(source.includedChars)} of ${n(source.availableChars)} stored characters are sent.` : `All ${n(source.availableChars)} stored characters are sent.`}`),
      ...source.warnings.map((warning, index) => h("p", { key: index, className: "mt-1 text-[11px] leading-4 text-[#9A6700]" }, warning)),
      h("pre", { tabIndex: 0, "aria-label": `Text sent from ${source.name}`, className: "mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-[#E4E7EB] bg-[#FAFBFC] p-2 font-mono text-[11px] leading-4 text-ink" }, source.text),
    ),
  );
}

/**
 * Exactly what the next generation will be given, built by the server the way a real run builds it: the confirmed
 * Product Context, each selected source as it will be cut to the budget, and the run instructions. Nothing shown here is
 * assembled by the browser.
 */
export function ContextPreview({ productId, generator, generatorLabel, context, notIncluded, onBack }: {
  productId: string;
  generator: GeneratorId;
  generatorLabel: string;
  context: GenerationContextRequest | undefined;
  notIncluded: string[];
  onBack: () => void;
}) {
  const key = `${productId}:${generator}:${(context?.sourceIds ?? []).join(",")}:${context?.instructions ?? ""}`;
  const preview = useRemote(key, () => api.generationContextPreview({ productId, generator, context }));
  const data = preview.data;
  const stale = preview.loading;

  return h(
    "div",
    { className: "min-h-0 flex-1 overflow-y-auto px-4 py-4" },
    h(
      "div",
      { className: "flex items-center gap-2" },
      h("button", { type: "button", onClick: onBack, "aria-label": "Back to setup", className: "grid h-7 w-7 place-items-center rounded-md border border-border-default bg-panel text-ink hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, h(ArrowLeft, { size: 14 })),
      h("h3", { className: "text-sm font-semibold text-ink" }, `What ${generatorLabel} generation will receive`),
    ),
    preview.error ? h("p", { role: "alert", className: "mt-3 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700" }, h(AlertTriangle, { size: 13, className: "mt-1 shrink-0" }), preview.error) : null,
    stale && !data && !preview.error ? h("p", { className: "mt-3 text-xs text-muted" }, "Building the preview…") : null,
    data && !preview.error
      ? h(
          "div",
          { className: `mt-3 space-y-2.5 ${stale ? "opacity-60" : ""}` },
          h("p", { className: "text-[11px] leading-4 text-muted" }, `Source text: ${n(data.totalChars)} of ${n(data.budgetChars)} characters allowed per generation. Long sources are cut to whole pages or sections that share the most words with this run — Prism doesn't search by meaning — and every cut is marked.`),
          h(
            "details",
            { className: "rounded-lg border border-[#DDE0E4] bg-[#FAFBFC]" },
            h("summary", { className: "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs" }, h("span", { className: "flex-1 font-semibold text-ink" }, "Confirmed Product Context"), h("span", { className: "mono text-[9px] font-semibold uppercase tracking-[.1em] text-lineage" }, "Always sent in full")),
            h("pre", { tabIndex: 0, className: "max-h-56 overflow-auto whitespace-pre-wrap border-t border-[#E7E9EC] p-2 font-mono text-[11px] leading-4 text-ink" }, data.productContext),
          ),
          data.instructions
            ? h("div", { className: "rounded-lg border border-[#DDE0E4] bg-white px-3 py-2" }, h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Run instructions · this run only"), h("p", { className: "mt-1 whitespace-pre-wrap text-xs leading-5 text-ink" }, data.instructions))
            : null,
          data.sources.length
            ? h("div", { className: "space-y-2" }, ...data.sources.map((source, index) => h(PreviewSource, { key: source.id, source, open: index === 0 && data.sources.length <= 2 })))
            : h("p", { className: "rounded-lg border border-dashed border-[#DDE0E4] px-3 py-3 text-xs text-muted" }, "No extra sources are selected: the model receives the confirmed Product Context and your saved template, as before."),
          notIncluded.length
            ? h("p", { className: "text-[11px] leading-4 text-muted" }, `Not selected, so not sent: ${notIncluded.join(", ")}.`)
            : null,
          data.rules.length
            ? h(
                "details",
                { className: "rounded-lg border border-[#DDE0E4] bg-white" },
                h("summary", { className: "cursor-pointer px-3 py-2 text-xs font-semibold text-ink" }, "Rules that always come with this context"),
                h("ul", { className: "space-y-1.5 border-t border-[#E7E9EC] px-3 py-2" }, ...data.rules.map((rule, index) => h("li", { key: index, className: "text-[11px] leading-4 text-muted" }, rule))),
              )
            : null,
          h("p", { className: "text-[10px] text-muted" }, `Template: ${data.templateVersion === 0 ? "the default" : `your saved version ${data.templateVersion}`}. Output format and validation are set by Prism and can't be edited.`),
        )
      : null,
  );
}
