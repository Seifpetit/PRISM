"use client";

import { useEffect, useRef } from "react";
import { ImageIcon, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ImportedAd } from "@/api/api";
import { formatCell } from "@/components/performance/ads-table";
import { useCurrency } from "@/components/performance/currency-context";
import { PrismAction } from "@/components/prism-action";
import { StatusPill } from "@/components/performance/status-pill";
import { COLUMNS, GROUPS, type Context } from "@/lib/ad-columns";
import { h } from "@/lib/h";

const MEDIA_MAX_HEIGHT = 300;

/**
 * The full metadata for one imported ad: its actual creative when Meta still serves one (playable if it is a
 * video, its cover image otherwise), its delivery status, and every metric the By ad table can show, grouped
 * the same way. Analyze is reserved for a later AI reading of this ad; for now it is present but inert.
 */
export function AdDetailModal({ ad, context, spendCurrency, revenueCurrency, onClose }: { ad: ImportedAd | null; context: Context; spendCurrency: string; revenueCurrency: string; onClose: () => void }) {
  const { money } = useCurrency();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!ad) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ad, onClose]);

  if (!ad) return null;

  return createPortal(
    h(
      "div",
      {
        className: "fixed inset-0 z-[150] grid place-items-center bg-[#15171A]/80 p-4 backdrop-blur-[1px]",
        role: "presentation",
        onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose(); },
      },
      h(
        "div",
        { role: "dialog", "aria-modal": true, "aria-label": `${ad.name} details`, className: "flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#DDE0E4] bg-white shadow-[0_24px_60px_rgb(21_23_26/.24)]" },
        h(
          "div",
          { className: "relative flex w-full shrink-0 items-center justify-center bg-[#0B0C0E]", style: { maxHeight: MEDIA_MAX_HEIGHT } },
          ad.videoUrl
            ? h("video", { src: ad.videoUrl, poster: ad.imageUrl ?? undefined, controls: true, playsInline: true, preload: "metadata", className: "w-full object-contain", style: { maxHeight: MEDIA_MAX_HEIGHT } })
            : ad.imageStatus === "ready" && ad.imageUrl
              ? h("img", { src: ad.imageUrl, alt: "", className: "w-full object-contain", style: { maxHeight: MEDIA_MAX_HEIGHT } })
              : h("span", { className: "grid h-40 w-full place-items-center text-[#5A5F68]", "aria-hidden": true }, h(ImageIcon, { size: 32, strokeWidth: 1.6 })),
          h(
            "button",
            { ref: closeRef, type: "button", onClick: onClose, "aria-label": "Close", className: "absolute right-3 top-3 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" },
            h(X, { size: 15 }),
          ),
        ),
        h(
          "div",
          { className: "border-b border-[#ECEEF1] px-5 py-4" },
          h("p", { className: "break-words text-sm font-semibold leading-5 text-ink" }, ad.name),
          h(
            "div",
            { className: "mt-2 flex flex-wrap items-center gap-1.5" },
            ad.delivery ? h(StatusPill, { status: ad.delivery.toUpperCase() }) : h("span", { className: "text-[11px] text-muted" }, "No delivery status"),
            ad.hasMeta ? h("span", { className: "text-[10.5px] text-muted" }, "In the ad export") : null,
            ad.hasConverty ? h("span", { className: "text-[10.5px] text-muted" }, "In the order file") : null,
          ),
        ),
        h(
          "div",
          { className: "flex-1 overflow-y-auto px-5 py-4" },
          ...GROUPS.map((group) => {
            const keys = COLUMNS.filter((column) => column.group === group.id);
            return h(
              "div",
              { key: group.id, className: "mb-4 last:mb-0" },
              h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, group.label),
              h(
                "dl",
                { className: "mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3" },
                ...keys.map((column) =>
                  h(
                    "div",
                    { key: column.key, title: column.definition },
                    h("dt", { className: "text-[10.5px] leading-4 text-muted" }, column.label),
                    h("dd", { className: "text-xs font-semibold tabular-nums text-ink" }, formatCell(column.key, ad, context, money, spendCurrency, revenueCurrency)),
                  ),
                ),
              ),
            );
          }),
        ),
        h(
          "div",
          { className: "border-t border-[#ECEEF1] px-5 py-4" },
          h(PrismAction, { onClick: () => {}, logo: false, className: "onboarding-confirm-button" }, "Analyze"),
        ),
      ),
    ),
    document.body,
  );
}
