"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, Lightbulb, Tag, UserRound, type LucideIcon } from "lucide-react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import { TargetAvatarTray } from "@/components/target-avatar-tray";
import { FloatingToolbar } from "@/components/ui/floating-toolbar";
import type { TargetAvatar } from "@/types/strategy";

const EMPTY_TARGET_AVATARS: TargetAvatar[] = [];

/** How long the tray stays open with nobody touching it before it folds back into its button. */
export const TRAY_IDLE_MS = 10_000;

const BADGES: Array<{ key: "avatar" | "angle" | "offer"; label: string; color: string; Icon: LucideIcon }> = [
  { key: "avatar", label: "Personas", color: "var(--type-persona)", Icon: UserRound },
  { key: "angle", label: "Angles", color: "var(--type-angle)", Icon: Lightbulb },
  { key: "offer", label: "Offers", color: "var(--type-offer)", Icon: Tag },
];

/**
 * The personas / angles / offers tray, folded into one button until it is wanted. Clicking the button opens the
 * tray; after ten seconds with no hover, focus, click, key press or scroll on it, it folds away again. While the
 * pointer rests on it or focus is inside it, it stays open. It is only hidden, never unmounted, so a half-made
 * choice (an open settings popover, a pending confirmation) is not lost when it folds.
 */
export function LineageGrammar() {
  const activeProductId = useAppStore((state) => state.activeProductId);
  const targetAvatarsByProduct = useAppStore((state) => state.targetAvatarsByProduct);
  const nodes = useAppStore((state) => state.nodes);
  const targetAvatars = activeProductId
    ? (targetAvatarsByProduct[activeProductId] ?? EMPTY_TARGET_AVATARS)
    : EMPTY_TARGET_AVATARS;
  const targetAvatarGenerationPending = useAppStore((state) => state.targetAvatarGenerationPending);
  const generateTargetAvatars = useAppStore((state) => state.generateTargetAvatars);
  const targetAvatarCount = useAppStore((state) => state.targetAvatarCount);
  const setTargetAvatarCount = useAppStore((state) => state.setTargetAvatarCount);

  const counts = useMemo(
    () => ({
      avatar: targetAvatars.length,
      angle: nodes.filter((node) => node.productId === activeProductId && node.type === "angle").length,
      offer: nodes.filter((node) => node.productId === activeProductId && node.type === "offer").length,
    }),
    [targetAvatars, nodes, activeProductId],
  );

  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const hovering = useRef(false);
  const focused = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  /** Starts (or restarts) the countdown, unless the pointer or focus is on the tray. */
  const schedule = () => {
    clear();
    if (hovering.current || focused.current || targetAvatarGenerationPending) return;
    timer.current = window.setTimeout(() => {
      // Focus inside a hidden tray would be lost to the page; hand it to the button.
      if (document.activeElement && document.activeElement !== document.body && document.activeElement.closest("[data-ingredient-tray]")) buttonRef.current?.focus();
      setOpen(false);
    }, TRAY_IDLE_MS);
  };

  useEffect(() => {
    if (open) schedule();
    else clear();
    return clear;
    // schedule reads refs and the generating flag; re-arming on either is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetAvatarGenerationPending]);

  const trayEvents = {
    onPointerEnter: () => ((hovering.current = true), schedule()),
    onPointerLeave: () => ((hovering.current = false), schedule()),
    onFocus: () => ((focused.current = true), schedule()),
    onBlur: (event: React.FocusEvent) => {
      if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) focused.current = false;
      schedule();
    },
    onPointerDown: schedule,
    onPointerMove: schedule,
    onKeyDown: schedule,
    onWheel: schedule,
    onScrollCapture: schedule,
  };

  return h(
    FloatingToolbar,
    { label: "Creative Exploration controls", layout: "single" },
    h(
      "button",
      {
        ref: buttonRef,
        type: "button",
        onClick: () => setOpen(true),
        "aria-expanded": open,
        "aria-label": `Show personas, angles and offers: ${counts.avatar} personas, ${counts.angle} angles, ${counts.offer} offers`,
        title: "Personas, angles and offers",
        style: open ? { display: "none" } : undefined,
        className:
          "tray-reveal prism-contour prism-contour--bold h-12 gap-3.5 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
      },
      h("span", { className: "text-[13px] font-bold tracking-[-.01em] text-ink" }, "Ingredients"),
      ...BADGES.map(({ key, label, color, Icon }) =>
        h(
          "span",
          { key, className: "inline-flex items-center gap-1.5", title: label },
          h("span", { className: "grid h-7 w-7 place-items-center rounded-md text-white", style: { background: color }, "aria-hidden": true }, h(Icon, { size: 15, strokeWidth: 2.4 })),
          h("span", { className: "mono text-[14px] font-bold tabular-nums text-ink" }, counts[key]),
        ),
      ),
    ),
    h(
      "div",
      { "data-ingredient-tray": true, className: "tray-reveal relative flex min-w-0 flex-1", style: open ? undefined : { display: "none" }, ...trayEvents },
      // A satellite on the tray's corner: fold it away now instead of waiting for the idle timer.
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            hovering.current = false;
            focused.current = false;
            buttonRef.current?.focus();
            setOpen(false);
          },
          "aria-label": "Hide personas, angles and offers",
          title: "Hide",
          className:
            "absolute -right-3 -top-3 z-30 grid h-7 w-7 place-items-center rounded-full border border-border-default bg-panel text-muted shadow-[0_3px_10px_rgba(21,23,26,.18)] transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        },
        h(EyeOff, { size: 13, strokeWidth: 2.2, "aria-hidden": true }),
      ),
      h(TargetAvatarTray, {
        avatars: targetAvatars,
        generating: targetAvatarGenerationPending,
        count: targetAvatarCount,
        onCountChange: setTargetAvatarCount,
        onGenerate: () => void generateTargetAvatars(),
      }),
    ),
  );
}
