import type { HTMLAttributes } from "react";
import { h } from "@/lib/h";

type SurfaceElement = "aside" | "div" | "nav" | "section";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  variant?: "plain" | "floating";
}

/** Shared structural surface. Feature content owns spacing; the surface owns chrome. */
export function Surface({
  as = "div",
  className = "",
  variant = "plain",
  ...props
}: SurfaceProps) {
  return h(as, {
    ...props,
    className: ["ui-surface", variant === "floating" ? "ui-surface--floating" : "", className]
      .filter(Boolean)
      .join(" "),
  });
}
