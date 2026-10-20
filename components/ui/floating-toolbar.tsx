import type { ReactNode } from "react";
import { h } from "@/lib/h";

export interface FloatingToolbarProps {
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
  label: string;
  layout?: "single" | "split";
}

/** Positions workspace controls; child surfaces remain semantically independent. */
export function FloatingToolbar({
  children,
  className = "",
  footer,
  label,
  layout = "single",
}: FloatingToolbarProps) {
  return h(
    "div",
    {
      className: ["ui-floating-toolbar", className].filter(Boolean).join(" "),
      "aria-label": label,
      "data-floating-toolbar": true,
    },
    h("div", { className: "ui-floating-toolbar__layout", "data-layout": layout }, children),
    footer ? h("div", { className: "ui-floating-toolbar__footer" }, footer) : null,
  );
}
