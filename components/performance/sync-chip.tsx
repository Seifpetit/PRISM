"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import type { Range, Reading } from "@/lib/business-figures";
import { h } from "@/lib/h";
import { checkSync, type Gap, type StreamCheck } from "@/lib/sync-check";

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const span = (from: string, to: string) => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);
/** A gap that reaches the required window's last day is still open today, so "since" says how long that has been true; a
    gap bounded on both sides is a past hole in the data, and stays a plain range. */
const gapText = (gap: Gap, windowUntil?: string) => (windowUntil && gap.to === windowUntil ? `since ${shortDate(gap.from)}` : span(gap.from, gap.to));

const ADVICE: Record<string, string> = {
  spend: "Connect Meta Ads, or import a newer ad export.",
  orders: "Connect Shopify, or import a newer Converty summary.",
};

function StreamRow({ stream, windowUntil }: { stream: StreamCheck; windowUntil?: string }) {
  const good = stream.coverage.length > 0 && stream.gaps.length === 0;
  return h(
    "li",
    { className: "py-2.5" },
    h(
      "div",
      { className: "flex items-center gap-2" },
      good ? h(Check, { size: 13, className: "shrink-0 text-emerald-600", "aria-hidden": true }) : h(TriangleAlert, { size: 13, className: "shrink-0 text-amber-600", "aria-hidden": true }),
      h("p", { className: "text-xs font-semibold text-ink" }, stream.label),
      h("span", { className: "text-[11px] text-muted" }, good ? "covered" : stream.coverage.length ? "has gaps" : "no source"),
    ),
    stream.coverage.length
      ? h("ul", { className: "mt-1 space-y-0.5 pl-5" }, ...stream.coverage.map((coverage) => h("li", { key: coverage.source, className: "text-[11px] leading-4 text-muted" }, `${coverage.source} · ${span(coverage.from, coverage.to)}${coverage.whole ? " (one total)" : ""}`)))
      : null,
    ...stream.gaps.map((gap) => h("p", { key: gap.from, className: "mt-1 pl-5 text-[11px] font-semibold leading-4 text-amber-700" }, `Missing ${gapText(gap, windowUntil)}`)),
    good ? null : h("p", { className: "mt-1 pl-5 text-[11px] leading-4 text-muted" }, ADVICE[stream.id]),
  );
}

/**
 * A chip in the Performance toolbar that says whether the data is up to date for the period chosen: green when ad
 * spend and orders are both covered through yesterday, amber with the days still missing, and from which source, when
 * they are not. Pressing it lists each stream and what covers it.
 */
export function SyncChip({ readings, range, today, loading }: { readings: Reading[]; range: Range; today: string; loading: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as Element | null)?.closest?.("[data-sync-check]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const check = checkSync(readings, range, today);
  const firstGap = check.streams.flatMap((stream) => stream.gaps.map((gap) => ({ stream, gap })))[0];
  const gapCount = check.streams.reduce((total, stream) => total + stream.gaps.length, 0) + check.streams.filter((stream) => stream.coverage.length === 0).length;

  let tone: "ok" | "gap" | "wait";
  let text: string;
  let detail: string | null = null;
  if (loading) {
    tone = "wait";
    text = "Checking…";
  } else if (!check.hasAnything) {
    tone = "wait";
    text = "No data to check";
  } else if (check.ok) {
    tone = "ok";
    text = "Up to date";
    detail = check.window ? `through ${shortDate(check.window.until)}` : null;
  } else {
    tone = "gap";
    const missing = check.streams.find((stream) => stream.coverage.length === 0);
    text = "Gaps";
    detail = firstGap ? `${firstGap.stream.label} ${gapText(firstGap.gap, check.window?.until)}${gapCount > 1 ? ` +${gapCount - 1}` : ""}` : missing ? `${missing.label}: no source` : null;
  }

  const isGap = tone === "gap";
  const dot = tone === "ok" ? "bg-emerald-500" : isGap ? "bg-amber-500" : "bg-[#8A93A0]";
  // A gap is the one state on this page that means "act now": a solid, saturated chip instead of the quiet tinted
  // border everything else on the toolbar uses, so it reads before anything else in the row.
  const border = isGap ? "border-amber-500 bg-amber-500/15 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]" : "border-[#DDE0E4]";

  return h(
    "div",
    { "data-sync-check": true, className: "relative" },
    h(
      "button",
      {
        type: "button",
        onClick: () => setOpen((value) => !value),
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        title: tone === "ok" ? "Ad spend and orders both cover the period" : isGap ? "Some of the period has no data. Press to see where" : "Checking the data",
        className: `flex max-w-[340px] items-center gap-1.5 rounded-md border px-2.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${isGap ? "h-9 font-semibold" : "h-8"} ${border}`,
      },
      isGap
        ? h(TriangleAlert, { size: 14, className: "shrink-0 text-amber-600", "aria-hidden": true })
        : h("span", { className: `h-2 w-2 shrink-0 rounded-full ${dot}`, "aria-hidden": true }),
      h("span", { className: `shrink-0 font-semibold ${isGap ? "text-amber-800" : "text-ink"}` }, text),
      detail ? h("span", { className: `min-w-0 truncate ${isGap ? "text-amber-700" : "text-muted"}` }, detail) : null,
      h(ChevronDown, { size: 12, className: `shrink-0 transition-transform motion-reduce:transition-none ${isGap ? "text-amber-600" : "text-muted"} ${open ? "rotate-180" : ""}`, "aria-hidden": true }),
    ),
    open
      ? h(
          "div",
          { role: "dialog", "aria-label": "Data check", className: "absolute left-0 top-full z-30 mt-2 w-[340px] rounded-xl border border-[#DDE0E4] bg-white p-4 shadow-lg" },
          h("p", { className: "text-xs font-semibold text-ink" }, "Data check"),
          h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, check.window ? `${span(range.since, range.until)}. Needs data through ${shortDate(check.window.until)}, the last full day.` : "The chosen period has no full day yet."),
          h("ul", { className: "mt-2 divide-y divide-[#ECEEF1]" }, ...check.streams.map((stream) => h(StreamRow, { key: stream.id, stream, windowUntil: check.window?.until }))),
        )
      : null,
  );
}
