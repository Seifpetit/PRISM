"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { COLUMNS, DEFAULT_VIEW, GROUPS, PRESETS, columnsFor, toggleColumn, type Context, type View } from "@/lib/ad-columns";
import { h } from "@/lib/h";

const radioRow = (selected: boolean) =>
  `flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${selected ? "bg-[#F6F7F9]" : ""}`;

/**
 * The "Columns" button of the By ad table. It offers four views, each answering one question, and, below them, every
 * column grouped by what it is about. Ticking a column turns the view into a custom one; the choice is applied as it is
 * made and kept for the product, so there is nothing to confirm.
 */
export function AdColumnsMenu({ view, context, onChange }: { view: View; context: Context; onChange: (next: View) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as Element | null)?.closest?.("[data-ad-columns]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const shown = new Set(columnsFor(view, context));
  return h(
    "div",
    { "data-ad-columns": true, className: "relative" },
    h(
      "button",
      {
        type: "button",
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        className: "flex h-7 items-center gap-1.5 rounded-md border border-[#DDE0E4] px-2.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
      },
      h(SlidersHorizontal, { size: 12, "aria-hidden": true }),
      "Columns",
    ),
    open
      ? h(
          "div",
          { role: "dialog", "aria-label": "Columns", className: "absolute right-0 top-full z-30 mt-2 max-h-[70vh] w-[340px] overflow-y-auto rounded-xl border border-[#DDE0E4] bg-white p-3 shadow-lg" },
          h("p", { id: "ad-view-label", className: "mono px-2 pb-1 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "View"),
          h(
            "div",
            { role: "radiogroup", "aria-labelledby": "ad-view-label" },
            ...PRESETS.map((preset) =>
              h(
                "button",
                { key: preset.id, type: "button", role: "radio", "aria-checked": view.preset === preset.id, onClick: () => onChange({ preset: preset.id, custom: [] }), className: radioRow(view.preset === preset.id) },
                h("span", { className: `mt-1 h-2 w-2 shrink-0 rounded-full border ${view.preset === preset.id ? "border-ink bg-ink" : "border-[#8A93A0]"}`, "aria-hidden": true }),
                h("span", null, h("span", { className: "block text-xs font-semibold text-ink" }, preset.label), h("span", { className: "block text-[11px] leading-4 text-muted" }, preset.question)),
              ),
            ),
            view.preset === "custom"
              ? h("div", { role: "radio", "aria-checked": true, className: radioRow(true) }, h("span", { className: "mt-1 h-2 w-2 shrink-0 rounded-full border border-ink bg-ink", "aria-hidden": true }), h("span", { className: "text-xs font-semibold text-ink" }, "Custom"))
              : null,
          ),
          ...GROUPS.map((group) =>
            h(
              "fieldset",
              { key: group.id, className: "mt-3 border-t border-[#ECEEF1] px-2 pt-3" },
              h("legend", { className: "mono pr-2 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, group.label),
              group.id === "quality" && !context.hasOrderFile ? h("p", { className: "mb-1 text-[11px] leading-4 text-muted" }, "Needs an imported order file (Converty). Until then these show a dash.") : null,
              ...COLUMNS.filter((column) => column.group === group.id).map((column) =>
                h(
                  "label",
                  { key: column.key, title: column.definition, className: "flex cursor-pointer items-center gap-2 py-1 text-xs text-ink" },
                  h("input", { type: "checkbox", checked: shown.has(column.key), onChange: () => onChange(toggleColumn(view, context, column.key)), className: "h-3.5 w-3.5 accent-[#0866FF]" }),
                  column.label,
                ),
              ),
            ),
          ),
          h(
            "div",
            { className: "mt-3 flex items-center justify-between border-t border-[#ECEEF1] px-2 pt-3" },
            h("p", { className: "text-[11px] text-muted" }, "Saved for this product."),
            h("button", { type: "button", onClick: () => onChange(DEFAULT_VIEW), className: "rounded-md border border-[#DDE0E4] px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, "Reset"),
          ),
        )
      : null,
  );
}
