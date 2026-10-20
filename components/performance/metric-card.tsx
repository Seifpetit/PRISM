"use client";

import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/performance/meta-charts";
import { h } from "@/lib/h";
import { formatChange } from "@/lib/meta-metrics";

export type Direction = "up" | "down" | "none";

export const cardClass = "rounded-xl border border-[#DDE0E4] bg-white";

/** The change against the previous range, coloured by whether that direction is good for this metric. */
export function ChangeChip({ fraction, good, label }: { fraction: number | null; good: Direction; label: string }) {
  const text = formatChange(fraction);
  if (text === null || fraction === null) return h("span", { className: "text-[10.5px] text-muted" }, "no earlier data");
  const flat = text === "0%";
  const better = good === "none" || flat ? null : good === "up" ? fraction > 0 : fraction < 0;
  const tone = better === null ? "bg-[#8A93A0]/15 text-muted" : better ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600";
  return h(
    "span",
    { className: "flex items-center gap-1.5" },
    h("span", { className: `rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ${tone}`, title: label }, `${fraction > 0 && !flat ? "▲" : fraction < 0 && !flat ? "▼" : "▬"} ${text}`),
  );
}

/** One number with its change and a trend line. `note` replaces the change when there is nothing to compare or explain. */
export function MetricCard({
  label,
  value,
  fraction,
  good,
  series,
  hint,
  compareLabel,
  color = "#0866FF",
  note,
  source,
  icon,
}: {
  label: string;
  value: string;
  fraction: number | null;
  good: Direction;
  series?: Array<number | null>;
  hint?: string;
  /** "vs previous 30d" */
  compareLabel?: string;
  color?: string;
  note?: string;
  /** Where the number comes from, when more than one source could have supplied it. */
  source?: string;
  /** A small tinted badge naming the metric at a glance, in the card's own trend color. */
  icon?: LucideIcon;
}) {
  return h(
    "div",
    { className: `${cardClass} px-4 pb-2 pt-3.5`, title: hint },
    h(
      "div",
      { className: "flex items-center justify-between gap-2" },
      h(
        "div",
        { className: "flex min-w-0 items-center gap-2" },
        icon
          ? h(
              "span",
              {
                className: "grid h-6 w-6 shrink-0 place-items-center rounded-md",
                style: { background: `color-mix(in srgb, ${color} 15%, transparent)`, color },
                "aria-hidden": true,
              },
              h(icon, { size: 13, strokeWidth: 2.2 }),
            )
          : null,
        h("p", { className: "mono min-w-0 truncate text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, label),
      ),
      source ? h("span", { className: "min-w-0 shrink-0 truncate text-[10px] text-muted", title: `From ${source}` }, source) : null,
    ),
    h("p", { className: "mt-1.5 text-[22px] font-semibold leading-7 tracking-[-.02em] text-ink tabular-nums" }, value),
    note
      ? h("p", { className: "mt-1 text-[10.5px] leading-4 text-muted" }, note)
      : h("div", { className: "mt-1 flex items-center gap-1.5 text-[10.5px] text-muted" }, h(ChangeChip, { fraction, good, label: compareLabel ?? "Compared with the range before" }), compareLabel && fraction !== null ? h("span", null, compareLabel) : null),
    h("div", { className: "mt-2" }, series ? h(Sparkline, { values: series, color }) : h("div", { className: "h-8", "aria-hidden": true })),
  );
}

/** A quiet placeholder for a section that is still loading: `cards` card shapes and one wide chart. */
export function SectionSkeleton({ cards = 8, label }: { cards?: number; label: string }) {
  return h(
    "div",
    { className: "animate-pulse motion-reduce:animate-none", "aria-busy": true, "aria-label": label },
    h("div", { className: "grid grid-cols-2 gap-3 lg:grid-cols-4" }, ...Array.from({ length: cards }, (_, index) => h("div", { key: index, className: `${cardClass} h-[132px] opacity-60` }))),
    h("div", { className: `${cardClass} mt-4 h-[300px] opacity-60` }),
  );
}

/** A card that says why there is nothing to show, with what to do about it. */
export function Notice({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return h(
    "div",
    { className: `${cardClass} flex flex-wrap items-center justify-between gap-4 px-5 py-5`, role: "status" },
    h("div", { className: "min-w-0" }, h("p", { className: "text-sm font-semibold text-ink" }, title), h("p", { className: "mt-1 max-w-xl text-xs leading-5 text-muted" }, body)),
    action ?? null,
  );
}
