"use client";

import { h } from "@/lib/h";

export interface DrawerPage {
  id: string;
  label: string;
  /** A small count or mark next to the label, e.g. how many sources are selected. */
  badge?: string | number | null;
}

const PRISM_UNDERLINE = "linear-gradient(90deg, var(--prism-blue), var(--prism-violet))";

/**
 * A slim page switcher for the drawers on the right of the canvas: one line of text tabs, about 32px tall, with a
 * short bar under the current page instead of a line under the whole row. Labels stay neutral even when active —
 * only the bar carries colour — so the row reads as navigation, not as another generation surface. It only
 * chooses the page; the drawer decides what each page shows (and can keep them all mounted, so nothing typed on
 * one page is lost by looking at another).
 */
export function DrawerPages({ pages, active, onChange, label = "Drawer pages", accent }: {
  pages: DrawerPage[];
  active: string;
  onChange: (id: string) => void;
  label?: string;
  /** The current page's underline. "prism" draws the same blue-to-violet bar as selection elsewhere in the app;
      a colour string (an ad set's track, say) draws a solid bar in that colour; omitted defaults to ink. */
  accent?: string | "prism";
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const index = pages.findIndex((page) => page.id === active);
    const next = pages[(index + step + pages.length) % pages.length];
    event.preventDefault();
    onChange(next.id);
    (event.currentTarget.querySelector(`[data-page="${next.id}"]`) as HTMLElement | null)?.focus();
  }

  const underline = accent === "prism" ? PRISM_UNDERLINE : accent;

  return h(
    "div",
    { role: "tablist", "aria-label": label, onKeyDown, className: "flex shrink-0 items-center gap-5 px-4" },
    ...pages.map((page) => {
      const current = page.id === active;
      return h(
        "button",
        {
          key: page.id,
          type: "button",
          role: "tab",
          id: `drawer-page-tab-${page.id}`,
          "aria-selected": current,
          "aria-controls": `drawer-page-${page.id}`,
          tabIndex: current ? 0 : -1,
          "data-page": page.id,
          onClick: () => onChange(page.id),
          className:
            `relative inline-flex items-center gap-1.5 pb-2.5 pt-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ` +
            (current ? "text-ink" : "text-muted hover:text-ink"),
        },
        page.label,
        page.badge !== undefined && page.badge !== null && page.badge !== 0 && page.badge !== ""
          ? h("span", { className: `mono rounded-full px-1.5 text-[9px] font-semibold leading-4 ${current ? "bg-ink text-white" : "bg-[#E7E9EC] text-muted"}` }, page.badge)
          : null,
        h("span", {
          "aria-hidden": true,
          className: "absolute inset-x-0 bottom-0 h-[2.5px] rounded-full transition-opacity",
          style: { background: underline ?? "var(--ink)", opacity: current ? 1 : 0 },
        }),
      );
    }),
  );
}
