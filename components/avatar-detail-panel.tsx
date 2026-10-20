"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Briefcase, Cake, ChevronLeft, ChevronRight, Clock, Link2, ShoppingCart, Sparkles, Trash2, TriangleAlert, UserRound, X, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { GenderIcon } from "@/components/gender-icon";
import { usePersonaPhotoSource } from "@/components/persona-photo";
import { h } from "@/lib/h";
import { personaInitials, personaMarkStyle } from "@/lib/persona-avatar";
import { useAppStore } from "@/store/use-app-store";
import type { TargetAvatar } from "@/types/strategy";

// The persona as a profile card. The portrait fills the whole drawer and never moves; who they are sits over it, and
// what they are like is a row of frosted-glass pages you swipe sideways. The photo shows blurred beneath each page's
// text (backdrop blur), so the writing stays readable while the picture stays the star.

const COLORS = {
  cares: "#e8751a",
  rhythm: "#3b8cf0",
  pain: "#ef5a5f",
  connection: "#9b6cf5",
  buying: "#1fb98e",
  pills: ["#e8751a", "#e64980", "#15aabf", "#845ef7", "#40c057"],
} as const;

/** "Convenience and credible comfort." -> ["Convenience", "Credible comfort"]. Empty when it doesn't split into short items. */
function pillsFrom(text: string): string[] {
  const parts = text
    .split(/,|;|\band\b|&|\/|•/i)
    .map((part) => part.replace(/[.…]+$/g, "").trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  return parts.length >= 2 && parts.length <= 6 && parts.every((part) => part.length <= 38) ? parts : [];
}

const BADGE_COLORS = { age: "#e8751a", gender: "#7048e8", profession: "#0c8599", role: "#d6336c" } as const;

/** A small coloured pill that floats over the photo. Position and size come from `className`. */
function Badge({ color, icon: Icon, iconNode, iconSize = 14, className = "", children }: { color: string; icon?: LucideIcon; iconNode?: React.ReactNode; iconSize?: number; className?: string; children?: React.ReactNode }) {
  return h(
    "span",
    {
      className: `absolute inline-flex items-center gap-2 rounded-full font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,.35)] ring-1 ring-white/25 ${className}`,
      style: { background: color },
    },
    iconNode ?? (Icon ? h(Icon, { size: iconSize, strokeWidth: 2.4, "aria-hidden": true, className: "shrink-0" }) : null),
    children,
  );
}

type Page = { key: string; icon: LucideIcon; label: string; color: string; text: string };

function GlassPage({ page }: { page: Page }) {
  const { icon: Icon, label, color, text } = page;
  const pills = page.key === "cares" ? pillsFrom(text) : [];
  return h(
    "article",
    {
      "aria-label": label,
      className: "flex max-h-full min-h-[150px] w-[calc(100%-56px)] shrink-0 snap-center flex-col overflow-y-auto rounded-2xl p-4 text-white",
      style: {
        background: `color-mix(in srgb, ${color} 26%, rgba(10, 12, 16, 0.5))`,
        border: `1px solid color-mix(in srgb, ${color} 55%, rgba(255, 255, 255, 0.22))`,
        backdropFilter: "blur(22px) saturate(1.25)",
        WebkitBackdropFilter: "blur(22px) saturate(1.25)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28)",
      },
    },
    h(
      "div",
      { className: "flex shrink-0 items-center gap-2.5" },
      h("span", { className: "grid h-8 w-8 shrink-0 place-items-center rounded-full text-white shadow-[0_3px_10px_rgba(0,0,0,.3)]", style: { background: color }, "aria-hidden": true }, h(Icon, { size: 15, strokeWidth: 2.3 })),
      h("h3", { className: "text-[11.5px] font-bold uppercase tracking-[.1em] text-white" }, label),
    ),
    pills.length
      ? h(
          "div",
          { className: "mt-3 flex flex-wrap content-start gap-1.5" },
          ...pills.map((item, index) => h("span", { key: item, className: "inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,.25)]", style: { background: COLORS.pills[index % COLORS.pills.length] } }, item)),
        )
      : h("p", { className: "mt-3 text-[14.5px] leading-[1.5] text-white/95" }, text),
  );
}

/** Focused single-avatar drawer, laid out like a profile card. */
export function AvatarDetailPanel({ avatar }: { avatar: TargetAvatar }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const closeAvatarDetail = useAppStore((state) => state.closeAvatarDetail);
  const deleteTargetAvatar = useAppStore((state) => state.deleteTargetAvatar);
  const photo = usePersonaPhotoSource(avatar.id, 960, false);
  const [broken, setBroken] = useState<string | null>(null);
  const showPhoto = photo && broken !== photo.src;
  const mark = personaMarkStyle(avatar.id);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [current, setCurrent] = useState(0);
  const wheelLock = useRef(0);
  const paging = useRef({ current: 0, count: 0, goTo: (_index: number) => {} });

  const pages: Page[] = (
    [
      { key: "cares", icon: Sparkles, label: "Cares about", color: COLORS.cares, text: avatar.priorities },
      { key: "rhythm", icon: Clock, label: "Life rhythm", color: COLORS.rhythm, text: avatar.lifeRhythm },
      { key: "pain", icon: TriangleAlert, label: "Pain point", color: COLORS.pain, text: avatar.painPoint },
      { key: "connection", icon: Link2, label: "Why this product", color: COLORS.connection, text: avatar.productConnection },
      { key: "buying", icon: ShoppingCart, label: "How they buy", color: COLORS.buying, text: avatar.buyingContext },
    ] as Page[]
  ).filter((page) => page.text?.trim());

  function goTo(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = Math.max(0, Math.min(pages.length - 1, index));
    const child = scroller.children[target] as HTMLElement | undefined;
    if (child) scroller.scrollTo({ left: child.offsetLeft - (scroller.clientWidth - child.clientWidth) / 2, behavior: "smooth" });
    setCurrent(target);
  }

  paging.current = { current, count: pages.length, goTo };

  // A mouse wheel or trackpad swipe over the cards turns a page: the vertical wheel is mapped onto the sideways row,
  // one page per gesture. Native and non-passive, because React's own wheel handlers are passive and could not stop
  // the page behind from scrolling.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    function onWheel(event: WheelEvent) {
      const { current: page, count, goTo: turn } = paging.current;
      if (count < 2) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      event.preventDefault();
      if (Math.abs(delta) < 8) return;
      const now = Date.now();
      if (now < wheelLock.current) return;
      wheelLock.current = now + 420;
      turn(page + (delta > 0 ? 1 : -1));
    }
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [pages.length]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const middle = scroller.scrollLeft + scroller.clientWidth / 2;
    let best = 0;
    let distance = Infinity;
    Array.from(scroller.children).forEach((child, index) => {
      const element = child as HTMLElement;
      const gap = Math.abs(element.offsetLeft + element.clientWidth / 2 - middle);
      if (gap < distance) {
        distance = gap;
        best = index;
      }
    });
    setCurrent(best);
  }

  const roundButton = "grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white backdrop-blur-[3px] transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
  const chip = "inline-flex h-6 items-center gap-1 rounded-full bg-white/20 px-2.5 text-[11px] font-semibold backdrop-blur-[3px]";

  return h(
    Fragment,
    null,
    h(
      "aside",
      {
        className:
          "strategy-inspector relative w-full min-h-0 shrink-0 overflow-hidden border-l border-[#DFE2E6] lg:h-full lg:w-[620px] " +
          "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:h-[78vh] max-lg:rounded-t-2xl " +
          "max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
        style: mark,
        "aria-label": "Target Avatar detail",
      },
      // The photo is one fixed layer that never moves and never takes more than the top half: it fades into the
      // persona's own dark colour below it, which is what the cards sit on. Without a photo: that colour, with the
      // persona's initials big.
      h("span", { className: "absolute inset-0 grid place-items-start justify-items-center pt-[10%] text-[150px] font-black tracking-tight opacity-25", "aria-hidden": true }, personaInitials(avatar.label)),
      h("div", { className: "pointer-events-none absolute inset-x-0 bottom-0 top-[55%]", style: { background: `color-mix(in srgb, ${mark.background} 16%, #0b0d11)` } }),
      // The whole picture, uncropped, in a box 55% of the drawer high: the sides it leaves empty are filled with a
      // blurred copy of the same photo, and nothing is drawn over it.
      showPhoto
        ? h(
            "div",
            { className: "absolute inset-x-0 top-0 h-[55%] overflow-hidden bg-black" },
            h("img", { key: `blur-${photo.src}`, src: photo.src, alt: "", draggable: false, "aria-hidden": true, className: "absolute inset-0 h-full w-full scale-125 object-cover", style: { filter: "blur(26px) brightness(0.6) saturate(1.2)" } }),
            h("img", { key: photo.src, src: photo.src, alt: "", draggable: false, onError: () => setBroken(photo.src), className: "relative h-full w-full object-contain" }),
          )
        : null,
      // Who they are, as badges floating over the photo at different places, each with its own colour and icon.
      h(
        "div",
        { className: "pointer-events-none absolute inset-x-0 top-0 z-[5] h-[55%]" },
        avatar.ageRange
          ? h(Badge, { color: BADGE_COLORS.age, icon: Cake, className: "left-4 top-4 h-11 px-4 text-[22px] font-extrabold tracking-[-.01em]", iconSize: 18 }, avatar.ageRange)
          : null,
        avatar.gender
          ? h(Badge, { color: BADGE_COLORS.gender, className: "left-4 top-[36%] h-8 px-3.5 text-[12.5px] capitalize", iconNode: h(GenderIcon, { gender: avatar.gender, size: 15, strokeWidth: 2.3 }) }, avatar.gender)
          : null,
        avatar.profession
          ? h(Badge, { color: BADGE_COLORS.profession, icon: Briefcase, className: "bottom-4 left-4 h-9 max-w-[58%] px-3.5 text-[13px]", iconSize: 15 }, h("span", { className: "truncate" }, avatar.profession))
          : null,
        avatar.label
          ? h(Badge, { color: BADGE_COLORS.role, icon: UserRound, className: "bottom-4 right-4 min-h-9 max-w-[46%] py-1.5 pl-3 pr-3.5 text-[11.5px] leading-[1.25]", iconSize: 14 }, h("span", { className: "line-clamp-2" }, avatar.label))
          : null,
      ),
      h(
        "div",
        { className: "absolute right-3 top-3 z-10 flex items-center gap-2" },
        h("button", { type: "button", onClick: () => setConfirmingDelete(true), "aria-label": `Delete ${avatar.label}`, title: "Delete this Target Avatar", className: roundButton }, h(Trash2, { size: 15 })),
        h("button", { type: "button", onClick: closeAvatarDetail, "aria-label": "Close Target Avatar detail", className: roundButton }, h(X, { size: 17 })),
      ),
      h(
        "div",
        { className: "relative flex h-full min-h-0 flex-col text-white" },
        // Room for the photo, which sits in the layer behind.
        h("div", { className: "h-[55%] shrink-0", "aria-hidden": true }),
        h(
          "div",
          { className: "flex min-h-0 flex-1 flex-col justify-center gap-3 pb-3" },
        h(
          "div",
          {
            ref: scrollerRef,
            onScroll,
            tabIndex: 0,
            "aria-label": "About this persona. Swipe or use the arrow keys.",
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "ArrowRight") (event.preventDefault(), goTo(current + 1));
              if (event.key === "ArrowLeft") (event.preventDefault(), goTo(current - 1));
            },
            className: "flex min-h-0 snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-7 outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          },
          ...pages.map((page) => h(GlassPage, { key: page.key, page })),
        ),
        h(
          "div",
          { className: "flex shrink-0 items-center justify-between gap-3 px-5" },
          h("p", { className: "min-w-0 truncate text-[10px] text-white/60" }, photo && showPhoto ? photo.credit : ""),
          pages.length > 1
            ? h(
                "div",
                { className: "flex shrink-0 items-center gap-2" },
                h("button", { type: "button", onClick: () => goTo(current - 1), disabled: current === 0, "aria-label": "Previous", className: "grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-opacity hover:bg-white/25 disabled:opacity-30" }, h(ChevronLeft, { size: 15 })),
                h(
                  "div",
                  { className: "flex items-center gap-1.5", role: "tablist", "aria-label": "Pages" },
                  ...pages.map((page, index) =>
                    h("button", {
                      key: page.key,
                      type: "button",
                      role: "tab",
                      "aria-selected": index === current,
                      "aria-label": page.label,
                      onClick: () => goTo(index),
                      className: `h-2 rounded-full transition-all ${index === current ? "w-6" : "w-2 bg-white/40 hover:bg-white/60"}`,
                      style: index === current ? { background: page.color } : undefined,
                    }),
                  ),
                ),
                h("button", { type: "button", onClick: () => goTo(current + 1), disabled: current >= pages.length - 1, "aria-label": "Next", className: "grid h-7 w-7 place-items-center rounded-full bg-white/15 text-white transition-opacity hover:bg-white/25 disabled:opacity-30" }, h(ChevronRight, { size: 15 })),
              )
            : null,
        ),
        ),
      ),
    ),
    h(ConfirmationDialog, {
      open: confirmingDelete,
      title: "Delete this Target Avatar?",
      description: `This removes "${avatar.label}" along with its map placement and any angle link. This can't be undone.`,
      confirmLabel: "Delete avatar",
      onCancel: () => setConfirmingDelete(false),
      onConfirm: () => {
        setConfirmingDelete(false);
        deleteTargetAvatar(avatar.id);
      },
    }),
  );
}
