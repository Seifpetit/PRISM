"use client";

import type {
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { h } from "@/lib/h";

const KEYBOARD_SCROLL_STEP = 88;

export interface HorizontalTrayProps extends HTMLAttributes<HTMLDivElement> {
  accessibleLabel: string;
}

/** Native horizontal scrolling with mouse-wheel and keyboard affordances. */
export function HorizontalTray({
  accessibleLabel,
  className = "",
  onKeyDown,
  onWheel,
  ...props
}: HorizontalTrayProps) {
  function translateVerticalWheel(event: ReactWheelEvent<HTMLDivElement>) {
    onWheel?.(event);
    if (event.defaultPrevented) return;
    const tray = event.currentTarget;
    const hasHorizontalOverflow = tray.scrollWidth > tray.clientWidth;
    if (!hasHorizontalOverflow || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    tray.scrollBy({ left: event.deltaY, behavior: "smooth" });
  }

  function handleKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const tray = event.currentTarget;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      tray.scrollBy({
        left: event.key === "ArrowRight" ? KEYBOARD_SCROLL_STEP : -KEYBOARD_SCROLL_STEP,
        behavior: "smooth",
      });
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      tray.scrollTo({ left: event.key === "Home" ? 0 : tray.scrollWidth, behavior: "smooth" });
    }
  }

  return h("div", {
    ...props,
    className: ["ui-horizontal-tray", className].filter(Boolean).join(" "),
    onKeyDown: handleKeyboard,
    onWheel: translateVerticalWheel,
    role: props.role ?? "list",
    tabIndex: props.tabIndex ?? 0,
    "aria-label": accessibleLabel,
  });
}
