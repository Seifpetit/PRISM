"use client";

import { useLayoutEffect, useState } from "react";
import { h } from "@/lib/h";

/**
 * A textarea that is as tall as its text, so a long direction or bridge never scrolls inside its own box.
 * `minRows` is the height of an empty one; the height follows the text and the width (a drawer resizing
 * re-wraps the text).
 */
export function AutoTextarea({
  value,
  onChange,
  onBlur,
  onKeyDown,
  className = "",
  minRows = 2,
  maxLength,
  placeholder,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  minRows?: number;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  // The element lives in state, not a ref object, so it can be read while laying out without touching a ref in render.
  const [element, setElement] = useState<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!element) return;
    const fit = () => {
      element.style.setProperty("height", "auto");
      element.style.setProperty("height", `${element.scrollHeight}px`);
    };
    fit();
    // Only a change of width re-wraps the text; watching the height too would answer our own resize.
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, value]);

  return h("textarea", {
    ref: setElement,
    value,
    rows: minRows,
    maxLength,
    placeholder,
    autoFocus,
    "aria-label": ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    onBlur,
    onKeyDown,
    className: `block resize-none overflow-hidden ${className}`,
  });
}
