"use client";

import { Plus } from "lucide-react";
import { AdEditor } from "@/components/campaign/ad-editor";
import { GenerateAdsButton } from "@/components/campaign/generate-ads-button";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import { adSummary, type CampaignConcept } from "@/types/campaign";

export const MAX_ADS = 20;

/**
 * The creative plan of one ad set: its ads, and the two ways to add to them. "Generate ads" asks what to optimise for
 * and then has the AI plan executions of this fixed concept; "Plan an ad manually" adds an empty slot. Shared by the ad-set
 * drawer (ads collapsed) and the Creatives workspace (ads open).
 */
export function AdPlanSection({ concept, variant }: { concept: CampaignConcept; variant: "drawer" | "workspace" }) {
  const addAd = useAppStore((state) => state.addAd);
  const pending = useAppStore((state) => state.adPlanPendingId === concept.id);
  const full = concept.ads.length >= MAX_ADS;
  const empty = concept.ads.length === 0;

  return h(
    "section",
    { "aria-label": "Creative plan" },
    h(
      "div",
      { className: "flex items-baseline justify-between gap-2" },
      h("h2", { className: "text-xs font-semibold text-ink" }, "Creative plan"),
      h("span", { className: "mono text-[9px] font-semibold uppercase tracking-[.1em] text-muted" }, adSummary(concept.ads)),
    ),
    h(
      "p",
      { className: "mt-1 text-[11px] leading-4 text-muted" },
      empty
        ? "Turn this concept into ads: different awareness stages, formats and hooks. The persona, angle and offer stay fixed."
        : "Each ad is one execution of this concept. Awareness stage decides how long the bridge to the product should be.",
    ),
    h(
      "div",
      { className: "mt-3 space-y-2" },
      // The brand gradient button; it opens the panel that asks what to optimise for.
      h(GenerateAdsButton, { concept, variant: "drawer" }),
      h(
        "button",
        {
          type: "button",
          onClick: () => void addAd(concept.id),
          disabled: full || pending,
          className: "flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#DDE0E4] text-xs font-semibold text-ink hover:bg-[#F6F7F9] disabled:cursor-not-allowed disabled:opacity-40",
        },
        h(Plus, { size: 13 }),
        "Plan an ad manually",
      ),
    ),
    pending
      ? h("p", { role: "status", className: "mt-2 text-[11px] leading-4 text-muted" }, "Planning ads for this concept. This usually takes 10 to 30 seconds.")
      : null,
    concept.ads.length
      ? h(
          "ul",
          { className: "mt-3 space-y-2" },
          ...concept.ads.map((ad, index) => h(AdEditor, { key: ad.id, conceptId: concept.id, ad, index, defaultOpen: variant === "workspace" })),
        )
      : pending
        ? null
        : h("p", { className: "mt-3 rounded-lg border border-dashed border-[#DDE0E4] px-3 py-4 text-center text-[11px] text-muted" }, "No ads planned yet."),
  );
}
