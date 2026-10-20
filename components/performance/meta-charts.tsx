"use client";

import { useId, useState } from "react";
import { h } from "@/lib/h";

/** A tiny trend line under a number. Nothing to compare (fewer than two points) draws nothing. */
export function Sparkline({ values, color = "#0866FF" }: { values: Array<number | null>; color?: string }) {
  const gradientId = `spark${useId().replace(/:/g, "")}`;
  const points = values.flatMap((value, index) => (value === null ? [] : [{ index, value }]));
  if (points.length < 2) return h("div", { className: "h-8", "aria-hidden": true });
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = max - min || 1;
  const x = (index: number) => (index / Math.max(values.length - 1, 1)) * 100;
  const y = (value: number) => 26 - ((value - min) / span) * 22;
  const line = points.map((point, i) => `${i === 0 ? "M" : "L"}${x(point.index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
  const area = `${line} L${x(points.at(-1)!.index).toFixed(2)} 30 L${x(points[0].index).toFixed(2)} 30 Z`;
  return h(
    "svg",
    { viewBox: "0 0 100 30", preserveAspectRatio: "none", className: "block h-8 w-full overflow-visible", "aria-hidden": true },
    h("defs", null, h("linearGradient", { id: gradientId, x1: 0, x2: 0, y1: 0, y2: 1 }, h("stop", { offset: "0%", stopColor: color, stopOpacity: 0.28 }), h("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }))),
    h("path", { d: area, fill: `url(#${gradientId})` }),
    h("path", { d: line, fill: "none", stroke: color, strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round", vectorEffect: "non-scaling-stroke" }),
  );
}

export interface ChartDay {
  date: string;
  spend: number;
  line: number;
}

/** Something that happened on a day (an ad set was added), drawn as a dashed line and named in that day's tooltip. */
export interface ChartMarker {
  date: string;
  label: string;
}

const W = 800;
const H = 250;
const PAD = { left: 52, right: 52, top: 14, bottom: 30 };

/** Round a maximum up to a tidy axis end (1, 2, 2.5, 5 x 10^n) and split it into equal steps. */
function niceScale(max: number, steps = 4) {
  if (max <= 0) return { top: steps, step: 1 };
  const rough = max / steps;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude;
  return { top: step * steps, step };
}

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Daily spend as bars with one other metric as a line on its own axis. Hovering a day shows its numbers. The two
 * axes are drawn in the series colours so it is clear which axis belongs to what.
 */
export function DailyChart({
  days,
  lineLabel,
  barLabel = "Spend",
  markers = [],
  formatSpend,
  formatLine,
  spendColor = "#0866FF",
  lineColor = "#E89400",
}: {
  days: ChartDay[];
  lineLabel: string;
  barLabel?: string;
  markers?: ChartMarker[];
  formatSpend: (value: number) => string;
  formatLine: (value: number) => string;
  spendColor?: string;
  lineColor?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const count = days.length;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const spendScale = niceScale(Math.max(0, ...days.map((day) => day.spend)));
  const lineScale = niceScale(Math.max(0, ...days.map((day) => day.line)));
  const slot = plotW / Math.max(count, 1);
  const barW = Math.max(2, slot * 0.62);
  const cx = (index: number) => PAD.left + slot * index + slot / 2;
  const ySpend = (value: number) => PAD.top + plotH - (value / spendScale.top) * plotH;
  const yLine = (value: number) => PAD.top + plotH - (value / lineScale.top) * plotH;
  const path = days.map((day, index) => `${index === 0 ? "M" : "L"}${cx(index).toFixed(1)} ${yLine(day.line).toFixed(1)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(count / 7));
  const ticks = [0, 1, 2, 3, 4];
  const active = hover === null ? null : days[hover];
  const markerAt = (date: string) => markers.filter((marker) => marker.date === date);
  const markerIndexes = days.flatMap((day, index) => (markerAt(day.date).length ? [index] : []));
  const tooltipLeft = hover === null ? 0 : (cx(hover) / W) * 100;

  return h(
    "div",
    { className: "relative" },
    h(
      "svg",
      { viewBox: `0 0 ${W} ${H}`, className: "block h-auto w-full", role: "img", "aria-label": `Daily ${barLabel.toLowerCase()} and ${lineLabel.toLowerCase()}` },
      ...ticks.map((tick) =>
        h(
          "g",
          { key: tick },
          h("line", { x1: PAD.left, x2: W - PAD.right, y1: PAD.top + (plotH / 4) * tick, y2: PAD.top + (plotH / 4) * tick, stroke: "currentColor", strokeOpacity: tick === 4 ? 0.28 : 0.1, className: "text-muted" }),
          h("text", { x: PAD.left - 8, y: PAD.top + (plotH / 4) * tick + 3.5, textAnchor: "end", fontSize: 10.5, fill: spendColor, className: "mono" }, formatSpend(spendScale.top - spendScale.step * tick)),
          h("text", { x: W - PAD.right + 8, y: PAD.top + (plotH / 4) * tick + 3.5, textAnchor: "start", fontSize: 10.5, fill: lineColor, className: "mono" }, formatLine(lineScale.top - lineScale.step * tick)),
        ),
      ),
      ...days.map((day, index) =>
        h("rect", {
          key: day.date,
          x: cx(index) - barW / 2,
          y: ySpend(day.spend),
          width: barW,
          height: Math.max(0, PAD.top + plotH - ySpend(day.spend)),
          rx: Math.min(2.5, barW / 2),
          fill: spendColor,
          fillOpacity: hover === null || hover === index ? 0.88 : 0.35,
        }),
      ),
      ...markerIndexes.map((index) =>
        h(
          "g",
          { key: `m-${days[index].date}`, "aria-hidden": true },
          h("line", { x1: cx(index), x2: cx(index), y1: PAD.top, y2: PAD.top + plotH, stroke: "currentColor", strokeDasharray: "3 3", strokeOpacity: 0.55, className: "text-ink" }),
          h("path", { d: `M${cx(index) - 4} ${PAD.top + plotH + 1} L${cx(index) + 4} ${PAD.top + plotH + 1} L${cx(index)} ${PAD.top + plotH - 6} Z`, fill: "currentColor", className: "text-ink" }),
        ),
      ),
      h("path", { d: path, fill: "none", stroke: lineColor, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      active && hover !== null ? h("circle", { cx: cx(hover), cy: yLine(active.line), r: 3.8, fill: lineColor, stroke: "var(--bg-panel)", strokeWidth: 1.5 }) : null,
      ...days.map((day, index) =>
        index % labelEvery === 0
          ? h("text", { key: `l-${day.date}`, x: cx(index), y: H - 9, textAnchor: "middle", fontSize: 10.5, fill: "currentColor", className: "mono text-muted" }, dayLabel(day.date))
          : null,
      ),
      // One invisible column per day, so the whole column is the hover target, not just the thin bar.
      ...days.map((day, index) =>
        h("rect", {
          key: `hit-${day.date}`,
          x: PAD.left + slot * index,
          y: PAD.top,
          width: slot,
          height: plotH,
          fill: "transparent",
          onMouseEnter: () => setHover(index),
          onMouseLeave: () => setHover((current) => (current === index ? null : current)),
        }),
      ),
    ),
    active
      ? h(
          "div",
          {
            role: "status",
            className: "pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-[#DDE0E4] bg-white px-2.5 py-1.5 text-[11px] shadow-md",
            style: { left: `${Math.min(88, Math.max(12, tooltipLeft))}%` },
          },
          h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.1em] text-muted" }, dayLabel(active.date)),
          h("p", { className: "mt-0.5 flex items-center gap-1.5 text-ink" }, h("span", { className: "h-2 w-2 rounded-sm", style: { background: spendColor } }), `${barLabel} ${formatSpend(active.spend)}`),
          h("p", { className: "flex items-center gap-1.5 text-ink" }, h("span", { className: "h-0.5 w-2.5 rounded", style: { background: lineColor } }), `${lineLabel} ${formatLine(active.line)}`),
          ...markerAt(active.date).map((marker) => h("p", { key: marker.label, className: "mt-0.5 flex items-center gap-1.5 text-ink" }, h("span", { className: "text-[9px]", "aria-hidden": true }, "▲"), marker.label)),
        )
      : null,
  );
}
