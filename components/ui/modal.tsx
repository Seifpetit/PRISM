"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { h } from "@/lib/h";

const SIZES = {
  md: "max-w-[560px]",
  lg: "max-w-[860px]",
  xl: "max-w-[1120px]",
} as const;

/**
 * A centered dialog over a dimmed backdrop: the same portal-to-body pattern as ConfirmationDialog, for real
 * content. Escape and a press on the backdrop close it; the page behind stays put while it is open.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  size = "lg",
  fill = false,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  size?: keyof typeof SIZES;
  /** Take the full available height, for editors whose body sizes itself. */
  fill?: boolean;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // A dialog stacked on top (a confirmation) holds focus outside this panel and handles its own Escape.
      const panel = panelRef.current;
      if (panel && document.activeElement && document.activeElement !== document.body && !panel.contains(document.activeElement)) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] flex items-center justify-center bg-[#15171A]/80 p-4 backdrop-blur-[2px]",
        role: "presentation",
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => {
          if (event.target === event.currentTarget) onClose();
        },
      },
      h(
        "div",
        {
          ref: panelRef,
          tabIndex: -1,
          role: "dialog",
          "aria-modal": true,
          className: `relative flex w-full ${SIZES[size]} ${fill ? "h-[86vh]" : "max-h-[86vh]"} flex-col overflow-hidden rounded-2xl border border-[#DFE2E6] bg-white shadow-[0_30px_80px_rgba(21,23,26,.35)] outline-none`,
        },
        h(
          "div",
          { className: "flex shrink-0 items-center gap-3 border-b border-[#E7E9EC] px-5 py-3.5" },
          icon ? h("span", { className: "shrink-0" }, icon) : null,
          h(
            "div",
            { className: "min-w-0 flex-1" },
            h("h2", { className: "truncate text-sm font-semibold text-ink" }, title),
            subtitle ? h("p", { className: "mt-0.5 truncate text-[11px] text-muted" }, subtitle) : null,
          ),
          h(
            "button",
            {
              type: "button",
              onClick: onClose,
              "aria-label": "Close",
              className: "grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-[#F6F7F9] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
            },
            h(X, { size: 16 }),
          ),
        ),
        // A "fill" editor sizes and scrolls its own body (the spreadsheet grid, the text area); scrolling here too
        // would fight it — the grid's own vertical scrollbar would stop working because this outer wrapper, not
        // the grid, ends up capturing the scroll. Non-fill content has no such area, so it scrolls here instead.
        h("div", { className: `flex min-h-0 flex-1 flex-col ${fill ? "overflow-hidden" : "overflow-y-auto"}` }, children),
        footer
          ? h("div", { className: "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#E7E9EC] px-5 py-3" }, footer)
          : null,
      ),
    ),
    document.body,
  );
}
