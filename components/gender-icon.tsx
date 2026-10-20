"use client";

import { h } from "@/lib/h";

function classify(gender?: string): "female" | "male" | "neutral" {
  const value = (gender ?? "").trim().toLowerCase();
  if (!value) return "neutral";
  if (value.startsWith("f")) return "female";
  if (value.startsWith("m")) return "male";
  return "neutral";
}

/** Renders the Venus/Mars symbol so an avatar's sex reads instantly from the glyph alone. */
export function GenderIcon({
  gender,
  size = 14,
  strokeWidth = 2,
  className,
}: {
  gender?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const kind = classify(gender);
  const svgProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (kind === "female")
    return h(
      "svg",
      svgProps,
      h("circle", { cx: 12, cy: 9, r: 6 }),
      h("line", { x1: 12, y1: 15, x2: 12, y2: 21 }),
      h("line", { x1: 9, y1: 18, x2: 15, y2: 18 }),
    );

  if (kind === "male")
    return h(
      "svg",
      svgProps,
      h("circle", { cx: 10, cy: 14, r: 6 }),
      h("line", { x1: 14.3, y1: 9.7, x2: 20, y2: 4 }),
      h("polyline", { points: "14,4 20,4 20,10" }),
    );

  return h(
    "svg",
    svgProps,
    h("circle", { cx: 12, cy: 8, r: 4 }),
    h("path", { d: "M5 21c0-4 3-7 7-7s7 3 7 7" }),
  );
}
