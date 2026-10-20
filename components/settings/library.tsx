"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/select";
import { h } from "@/lib/h";

// The Control room's library screens (Integrations, Data, AI prompts) share one shape: a compact header, one
// toolbar row (search, filter chips, a sorter), and the items laid out like a phone's home screen — as many tiles as
// fit the screen, the rest on further pages you swipe to. Nothing scrolls vertically; the page never grows.

/** The header every Control room page shares, never more than two lines: the small label and the title on the first
 * (with an optional element pushed to the right), the description on the second, cut short with an ellipsis rather
 * than wrapped (its full text is the tooltip). */
export function PageHeader({
  eyebrow,
  title,
  titleId,
  description,
  aside,
  divider = false,
}: {
  eyebrow: string;
  title: string;
  titleId?: string;
  description?: string;
  aside?: ReactNode;
  /** A rule under the header, for the reading pages that scroll. */
  divider?: boolean;
}) {
  return h(
    "header",
    { className: `flex shrink-0 items-end justify-between gap-6 ${divider ? "border-b border-[#DDE0E4] pb-4" : ""}` },
    h(
      "div",
      { className: "min-w-0 flex-1" },
      h(
        "div",
        { className: "flex min-w-0 items-baseline gap-3" },
        h("h1", { id: titleId, className: "shrink-0 text-xl font-semibold tracking-[-.02em] text-ink" }, title),
        h("p", { className: "mono min-w-0 truncate text-[9px] font-semibold uppercase tracking-[.16em]", style: { color: "var(--control-accent, var(--text-muted))" } }, eyebrow),
      ),
      description ? h("p", { className: "mt-1 truncate text-xs leading-5 text-muted", title: description }, description) : null,
    ),
    aside ? h("div", { className: "shrink-0 self-end" }, aside) : null,
  );
}

export function LibraryHeader({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description?: string; aside?: ReactNode }) {
  return h(PageHeader, { eyebrow, title, description, aside });
}

export type LibraryChip = { value: string; label: string; count?: number };

function Chip({ chip, active, onClick }: { chip: LibraryChip; active: boolean; onClick: () => void }) {
  return h(
    "button",
    {
      type: "button",
      onClick,
      "aria-pressed": active,
      className: `inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
        active ? "border-ink bg-ink text-white" : "border-[#DDE0E4] bg-white text-muted hover:border-[#B9C0C9] hover:text-ink"
      }`,
    },
    chip.label,
    chip.count === undefined
      ? null
      : h("span", { className: `rounded-full px-1.5 text-[10px] ${active ? "bg-white/20" : "bg-[#F1F3F5]"}` }, chip.count),
  );
}

export function LibraryToolbar({
  search,
  onSearch,
  searchPlaceholder,
  chips,
  chip,
  onChip,
  sortOptions,
  sort,
  onSort,
  extra,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  chips: LibraryChip[];
  chip: string;
  onChip: (value: string) => void;
  sortOptions: SelectOption[];
  sort: string;
  onSort: (value: string) => void;
  extra?: ReactNode;
}) {
  return h(
    "div",
    { className: "flex shrink-0 flex-wrap items-center gap-2" },
    h(
      "label",
      { className: "relative flex h-8 w-full items-center sm:w-[240px]" },
      h(Search, { size: 13, className: "pointer-events-none absolute left-2.5 text-muted", "aria-hidden": true }),
      h("span", { className: "sr-only" }, searchPlaceholder),
      h("input", {
        type: "search",
        value: search,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onSearch(event.target.value),
        placeholder: searchPlaceholder,
        className:
          "h-8 w-full rounded-full border border-[#DDE0E4] bg-white pl-8 pr-8 text-xs text-ink outline-none placeholder:text-muted focus:border-lineage focus:ring-2 focus:ring-lineage/20 [&::-webkit-search-cancel-button]:hidden",
      }),
      search
        ? h(
            "button",
            { type: "button", onClick: () => onSearch(""), "aria-label": "Clear search", className: "absolute right-2 grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-[#F1F3F5] hover:text-ink" },
            h(X, { size: 11 }),
          )
        : null,
    ),
    h(
      "div",
      { className: "flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]", role: "group", "aria-label": "Filter" },
      ...chips.map((item) => h(Chip, { key: item.value, chip: item, active: item.value === chip, onClick: () => onChip(item.value) })),
    ),
    extra ?? null,
    h(Select, {
      ariaLabel: "Sort",
      value: sort,
      onChange: onSort,
      options: sortOptions,
      align: "right",
      className: "h-8 rounded-full border border-[#DDE0E4] bg-white pl-3 pr-8 text-[11px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
    }),
  );
}

/** Splits `items` into pages that exactly fill the measured area, laid side by side and swiped horizontally. */
export function PagedLibrary<T>({
  items,
  getKey,
  renderTile,
  tileMinWidth,
  tileHeight,
  gap = 12,
  empty,
  resetKey,
  fixedRows,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderTile: (item: T) => ReactNode;
  tileMinWidth: number;
  tileHeight: number;
  gap?: number;
  empty: ReactNode;
  /** Changing it (a new search, filter or sort) returns to the first page. */
  resetKey?: string;
  /** Show exactly this many rows and size the area to them, instead of filling whatever height is left. */
  fixedRows?: number;
}) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const wheelLock = useRef(0);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => (Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1 ? current : { width, height }));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor((size.width + gap) / (tileMinWidth + gap)));
  const rows = fixedRows ?? Math.max(1, Math.floor((size.height + gap) / (tileHeight + gap)));
  const perPage = columns * rows;
  const pages = useMemo(() => {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += perPage) chunks.push(items.slice(index, index + perPage));
    return chunks;
  }, [items, perPage]);
  const pageCount = pages.length;

  function goTo(next: number) {
    const target = Math.max(0, Math.min(pagingRef.current.pageCount - 1, next));
    const track = trackRef.current;
    if (track) track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
    setPage(target);
  }

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
    setPage(0);
  }, [resetKey, perPage]);

  function onScroll() {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    setPage(Math.round(track.scrollLeft / track.clientWidth));
  }

  // A mouse wheel or trackpad swipe turns one page, like a phone's home screen, instead of drifting. Native and
  // non-passive: React's own wheel handlers are passive, so they could not stop the browser's scroll.
  const pagingRef = useRef({ page, pageCount });
  pagingRef.current = { page, pageCount };
  const hasTrack = items.length > 0 && size.width > 0;
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function onWheel(event: WheelEvent) {
      const { page: current, pageCount: count } = pagingRef.current;
      if (count < 2) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      event.preventDefault();
      if (Math.abs(delta) < 12) return;
      const now = Date.now();
      if (now < wheelLock.current) return;
      wheelLock.current = now + 480;
      goTo(current + (delta > 0 ? 1 : -1));
    }
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => track.removeEventListener("wheel", onWheel);
    // goTo reads only refs and the latest pageCount through pagingRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTrack]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") {
      event.preventDefault();
      goTo(page + 1);
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      event.preventDefault();
      goTo(page - 1);
    }
  }

  const arrowClass =
    "grid h-8 w-8 place-items-center rounded-full border border-[#DDE0E4] bg-white text-ink shadow-sm hover:bg-[#F6F7F9] disabled:cursor-default disabled:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage";

  return h(
    "div",
    { className: fixedRows ? "flex shrink-0 flex-col" : "flex min-h-0 flex-1 flex-col" },
    h(
      "div",
      {
        ref: areaRef,
        className: fixedRows ? "relative shrink-0" : "relative min-h-0 flex-1",
        style: fixedRows ? { height: fixedRows * tileHeight + (fixedRows - 1) * gap } : undefined,
      },
      items.length === 0
        ? h("div", { className: "grid h-full place-items-center text-center text-sm text-muted" }, empty)
        : size.width === 0
          ? null
          : h(
              "div",
              {
                ref: trackRef,
                onScroll,
                onKeyDown,
                tabIndex: 0,
                "aria-label": pageCount > 1 ? `Page ${page + 1} of ${pageCount}. Use the arrow keys to turn pages.` : undefined,
                className: "absolute inset-0 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              },
              ...pages.map((chunk, index) =>
                h(
                  "div",
                  {
                    key: index,
                    className: "grid h-full w-full shrink-0 snap-start content-start",
                    style: {
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      gridAutoRows: `${tileHeight}px`,
                      gap: `${gap}px`,
                    },
                  },
                  ...chunk.map((item) => h("div", { key: getKey(item), className: "min-w-0" }, renderTile(item))),
                ),
              ),
            ),
    ),
    h(
      "div",
      { className: "flex h-10 shrink-0 items-center justify-center gap-3" },
      pageCount > 1
        ? [
            h("button", { key: "prev", type: "button", onClick: () => goTo(page - 1), disabled: page === 0, "aria-label": "Previous page", className: arrowClass }, h(ChevronLeft, { size: 15 })),
            h(
              "div",
              { key: "dots", className: "flex items-center gap-1.5", role: "tablist", "aria-label": "Pages" },
              ...pages.map((_, index) =>
                h("button", {
                  key: index,
                  type: "button",
                  role: "tab",
                  "aria-selected": index === page,
                  "aria-label": `Page ${index + 1}`,
                  onClick: () => goTo(index),
                  className: `h-1.5 rounded-full transition-all ${index === page ? "w-5 bg-[var(--control-accent,#15171A)]" : "w-1.5 bg-[#C9CED5] hover:bg-[#9DA4AE]"}`,
                }),
              ),
            ),
            h("button", { key: "next", type: "button", onClick: () => goTo(page + 1), disabled: page >= pageCount - 1, "aria-label": "Next page", className: arrowClass }, h(ChevronRight, { size: 15 })),
          ]
        : null,
    ),
  );
}

/** Case-insensitive match of every word in `query` against any of `fields`. */
export function matchesSearch(query: string, fields: Array<string | null | undefined>) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fields.filter(Boolean).join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}
