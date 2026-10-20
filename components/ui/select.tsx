"use client";

import { useEffect, useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { h } from "@/lib/h";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Accessible name; there is no visible <label> tied to the control. */
  ariaLabel: string;
  /** Trigger styling (size, border, padding). Leave right padding for the chevron. */
  className?: string;
  /** Wrapper styling, e.g. a max width. */
  wrapperClassName?: string;
  chevronSize?: number;
  /** Shown when `value` matches no option (otherwise the first option is shown). */
  placeholder?: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: "left" | "right";
}

/**
 * Themed replacement for the native <select>. The native option list is drawn by the
 * OS and cannot follow the app theme, so this renders the same menu surface as the
 * account menu. Follows the select-only combobox pattern: focus stays on the trigger.
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  wrapperClassName = "",
  chevronSize = 13,
  placeholder,
  align = "left",
}: SelectProps) {
  const listId = useId();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open || !root) return;
    function handlePointerDown(event: PointerEvent) {
      if (root && !root.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open, root]);

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, listId]);

  function openMenu() {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    setOpen(false);
    if (option && option.value !== value) onChange(option.value);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === "ArrowDown") setActiveIndex((index) => Math.min(index + 1, last));
    else if (event.key === "ArrowUp") setActiveIndex((index) => Math.max(index - 1, 0));
    else if (event.key === "Home") setActiveIndex(0);
    else if (event.key === "End") setActiveIndex(last);
    else if (event.key === "Enter" || event.key === " ") choose(activeIndex);
    else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  }

  return h(
    "div",
    { ref: setRoot, className: `relative flex min-w-0 items-center ${wrapperClassName}` },
    h(
      "button",
      {
        type: "button",
        role: "combobox",
        "aria-label": ariaLabel,
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        "aria-controls": listId,
        "aria-activedescendant": open ? `${listId}-${activeIndex}` : undefined,
        onClick: () => (open ? setOpen(false) : openMenu()),
        onKeyDown: handleKeyDown,
        className: `min-w-0 truncate text-left ${className}`,
      },
      placeholder !== undefined && !options.some((option) => option.value === value) ? placeholder : (selected?.label ?? ""),
    ),
    h(ChevronDown, {
      size: chevronSize,
      "aria-hidden": true,
      className: `pointer-events-none absolute right-2 text-muted transition-transform ${open ? "rotate-180" : ""}`,
    }),
    open
      ? h(
          "div",
          {
            id: listId,
            role: "listbox",
            "aria-label": ariaLabel,
            className:
              `absolute top-[calc(100%+6px)] z-[90] max-h-64 w-max min-w-full max-w-[320px] overflow-y-auto ` +
              `rounded-lg border border-border-default bg-panel p-1.5 ` +
              `shadow-[0_12px_30px_rgb(21_23_26/.16)] ${align === "right" ? "right-0" : "left-0"}`,
          },
          ...options.map((option, index) =>
            h(
              "div",
              {
                key: option.value,
                id: `${listId}-${index}`,
                role: "option",
                "aria-selected": option.value === value,
                // Keep focus on the trigger so keyboard handling keeps working.
                onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
                onMouseEnter: () => setActiveIndex(index),
                onClick: () => choose(index),
                className:
                  `flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 ` +
                  `text-xs font-semibold text-ink ${index === activeIndex ? "bg-canvas" : ""}`,
              },
              h("span", { className: "truncate" }, option.label),
              option.value === value
                ? h(Check, { size: 13, className: "shrink-0 text-ink", "aria-hidden": true })
                : null,
            ),
          ),
        )
      : null,
  );
}
