"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { h } from "@/lib/h";
import {
  MAX_ADS,
  MAX_COUNT,
  MAX_NOTE,
  MIN_COUNT,
  PRESETS,
  VSL_FORMATS,
  activePreset,
  countLimits,
  readChoices,
  saveChoices,
  tidy,
  toRequest,
  type Choices,
} from "@/lib/ad-plan-options";
import { useAppStore } from "@/store/use-app-store";
import { AD_FORMATS, AD_FORMAT_LABEL, AWARENESS_LABEL, AWARENESS_STAGES, type CampaignConcept } from "@/types/campaign";

/** Where the floating panel sits: below the button, or above it when there is more room there. */
interface Anchor {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const chip = (selected: boolean, disabled = false) =>
  `rounded-md border px-2.5 py-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
    selected ? "border-ink bg-ink text-white" : "border-[#DDE0E4] text-muted hover:text-ink"
  } ${disabled ? "cursor-not-allowed opacity-40 hover:text-muted" : ""}`;

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return h("div", { className: "mt-3.5" }, h("p", { className: "mono mb-1.5 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, label), h("div", { className: "flex flex-wrap gap-1.5" }, children));
}

/** One line saying what will be generated, so the request is readable before it is sent. */
function summarize(choices: Choices): string {
  const parts = [choices.count ? `${choices.count} ads` : "3–4 ads"];
  if (choices.awareness === "spread") parts.push("each at a different stage");
  else if (choices.awareness) parts.push(`all ${AWARENESS_LABEL[choices.awareness].toLowerCase()}`);
  if (choices.format) parts.push(AD_FORMAT_LABEL[choices.format]);
  if (choices.structure === "vsl") parts.push("VSL");
  if (choices.note.trim()) parts.push("with your note");
  return parts.join(" · ");
}

/**
 * "Generate ads": a button that opens a small panel asking what to optimise for before anything is generated: a
 * format to fix (an AI talking head), VSLs, how many ads, one ad per awareness stage or one stage for all, and a note.
 * The persona, angle and offer stay fixed. The panel floats above the page (a track clips what overflows it).
 */
export function GenerateAdsButton({ concept, variant }: { concept: CampaignConcept; variant: "drawer" | "track" }) {
  const generateAdPlan = useAppStore((state) => state.generateAdPlan);
  const pending = useAppStore((state) => state.adPlanPendingId === concept.id);
  const otherPending = useAppStore((state) => state.adPlanPendingId !== null && state.adPlanPendingId !== concept.id);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [choices, setChoices] = useState<Choices>(() => readChoices());
  const room = MAX_ADS - concept.ads.length;
  const empty = concept.ads.length === 0;
  const full = room <= 0;
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("[data-generate-ads]"));
    const onDown = (event: MouseEvent) => {
      if (!inside(event.target)) setAnchor(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnchor(null);
    };
    const onMove = (event: Event) => {
      if (!inside(event.target)) setAnchor(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const openPanel = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (open) return setAnchor(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom - 20;
    const above = rect.top - 20;
    setChoices((current) => tidy(current, room));
    // Under the button when it fits (or there is more room there); otherwise above it, so it never runs off the screen.
    setAnchor(below >= 460 || below >= above ? { top: rect.bottom + 8, left, width, maxHeight: Math.max(240, below) } : { bottom: window.innerHeight - rect.top + 8, left, width, maxHeight: Math.max(240, above) });
  };

  const set = (patch: Partial<Choices>) => setChoices((current) => tidy({ ...current, ...patch }, room));
  const limits = countLimits(choices, room);
  const canGenerate = room >= MIN_COUNT;
  const current = activePreset(choices);

  const generate = () => {
    saveChoices(choices);
    setAnchor(null);
    void generateAdPlan(concept.id, toRequest(choices));
  };

  const trigger = h(
    "button",
    {
      type: "button",
      onClick: openPanel,
      disabled: full || pending || otherPending,
      "aria-busy": pending || undefined,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "data-generate-ads": true,
      className:
        "prism-icon-action flex items-center justify-center gap-2 rounded-md font-semibold text-white " +
        (variant === "drawer" ? "h-9 w-full text-xs " : "h-8 px-3 text-[11px] ") +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
    },
    pending ? h(Loader2, { size: variant === "drawer" ? 14 : 13, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : null,
    pending ? "Planning ads…" : empty ? "Generate ads" : "Generate more ads",
  );

  const panel = anchor
    ? createPortal(
        h(
          "div",
          { "data-generate-ads": true, role: "dialog", "aria-label": "Generate ads", style: { position: "fixed", top: anchor.top, bottom: anchor.bottom, left: anchor.left, width: anchor.width, maxHeight: anchor.maxHeight }, className: "z-[60] flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#DDE0E4] bg-white shadow-xl" },
          h(
            "div",
            { className: "flex shrink-0 items-start justify-between gap-3 px-4 pt-4" },
            h("div", null, h("h3", { className: "text-sm font-semibold text-ink" }, "Generate ads"), h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, "Choose what to optimise for. The persona, angle and offer stay fixed.")),
            h("button", { type: "button", onClick: () => setAnchor(null), "aria-label": "Close", className: "rounded p-1 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, h(X, { size: 14 })),
          ),
          h(
            "div",
            { className: "min-h-0 flex-1 overflow-y-auto px-4 pb-3" },
          h(
            "div",
            { role: "radiogroup", "aria-label": "Quick choices", className: "mt-3 flex flex-wrap gap-1.5" },
            ...PRESETS.map((preset) => h("button", { key: preset.id, type: "button", role: "radio", "aria-checked": current === preset.id, autoFocus: preset.id === "ai", onClick: () => setChoices(tidy(preset.choices, room)), className: chip(current === preset.id) }, preset.label)),
          ),
          h("p", { className: "mt-1.5 text-[11px] leading-4 text-muted" }, current === "custom" ? "Custom: you changed something below." : (PRESETS.find((preset) => preset.id === current)?.help ?? "")),
          h(
            Field,
            { label: "Format" },
            h("button", { type: "button", onClick: () => set({ format: null }), "aria-pressed": choices.format === null, className: chip(choices.format === null) }, "AI chooses"),
            ...AD_FORMATS.map((format) => {
              const blocked = choices.structure === "vsl" && !VSL_FORMATS.includes(format);
              return h("button", { key: format, type: "button", disabled: blocked, title: blocked ? "A VSL is a video" : undefined, onClick: () => set({ format }), "aria-pressed": choices.format === format, className: chip(choices.format === format, blocked) }, AD_FORMAT_LABEL[format]);
            }),
          ),
          h(
            Field,
            { label: "Awareness" },
            h("button", { type: "button", onClick: () => set({ awareness: null }), "aria-pressed": choices.awareness === null, className: chip(choices.awareness === null) }, "AI chooses"),
            h("button", { type: "button", onClick: () => set({ awareness: "spread" }), "aria-pressed": choices.awareness === "spread", title: "Each ad at a different awareness stage", className: chip(choices.awareness === "spread") }, "Each a different stage"),
            ...AWARENESS_STAGES.map((stage) => h("button", { key: stage, type: "button", onClick: () => set({ awareness: stage }), "aria-pressed": choices.awareness === stage, title: `Every ad at the ${AWARENESS_LABEL[stage].toLowerCase()} stage`, className: chip(choices.awareness === stage) }, AWARENESS_LABEL[stage])),
          ),
          h(
            Field,
            { label: "Number of ads" },
            h("button", { type: "button", onClick: () => set({ count: null }), "aria-pressed": choices.count === null, className: chip(choices.count === null) }, "AI decides"),
            ...Array.from({ length: MAX_COUNT - MIN_COUNT + 1 }, (_, index) => MIN_COUNT + index).map((count) => {
              const blocked = count > limits.max;
              return h("button", { key: count, type: "button", disabled: blocked, title: blocked ? (choices.awareness === "spread" ? "There are four awareness stages" : "No room for more in this ad set") : undefined, onClick: () => set({ count }), "aria-pressed": choices.count === count, className: chip(choices.count === count, blocked) }, String(count));
            }),
          ),
          h(
            Field,
            { label: "Length" },
            h("button", { type: "button", onClick: () => set({ structure: "short" }), "aria-pressed": choices.structure === "short", className: chip(choices.structure === "short") }, "Short ad"),
            h("button", { type: "button", onClick: () => set({ structure: "vsl" }), "aria-pressed": choices.structure === "vsl", title: "A long-form video sales letter", className: chip(choices.structure === "vsl") }, "VSL · long-form"),
          ),
          h(
            "label",
            { className: "mt-3.5 block" },
            h("span", { className: "mono mb-1.5 block text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, "Anything else to optimise for"),
            h("textarea", { value: choices.note, maxLength: MAX_NOTE, rows: 2, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => set({ note: event.target.value }), placeholder: "e.g. answer the installation objection", className: "w-full resize-none rounded-md border border-[#DDE0E4] bg-transparent px-2.5 py-1.5 text-xs leading-5 text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }),
          ),
          ),
          h(
            "div",
            { className: "shrink-0 border-t border-[#ECEEF1] px-4 pb-4 pt-3" },
            h("p", { className: "text-[11px] leading-4 text-muted", "aria-live": "polite" }, canGenerate ? summarize(choices) : `This ad set has room for ${Math.max(room, 0)} more ad${room === 1 ? "" : "s"}. Plan one manually instead.`),
            h(
              "div",
              { className: "mt-2.5 flex items-center justify-end gap-2" },
              h("button", { type: "button", onClick: () => setAnchor(null), className: "rounded-md border border-[#DDE0E4] px-3 py-1.5 text-[11px] font-semibold text-ink hover:bg-[#F6F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage" }, "Cancel"),
              h("button", { type: "button", onClick: generate, disabled: !canGenerate, className: "prism-icon-action rounded-md px-3.5 py-1.5 text-[11px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" }, `Generate ${choices.count ?? "3–4"} ads`),
            ),
          ),
        ),
        document.body,
      )
    : null;

  return h("span", { className: variant === "drawer" ? "block w-full" : "inline-flex" }, trigger, panel);
}

