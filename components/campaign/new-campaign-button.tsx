"use client";

import { Plus, Sparkles } from "lucide-react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

/**
 * The canvas's add buttons. "New campaign" is always there: it starts a campaign (a test by default; the composer is
 * where the type can be changed). Once a campaign's page is open, "New ad set" sits beside it and adds to that page.
 *
 * "New campaign" is the single biggest anchor moment in the workflow — everything downstream (angle/offer/persona
 * picks, eventual ad generation) starts here — so it carries the .prism-anchor-action treatment: a quiet interior
 * with a slow thread of prism light circling its edge, one tier up from .prism-contour, still short of .prism-action
 * (reserved for AI generation itself). Deliberate exception; do not spread this class to other buttons.
 *
 */
export function NewCampaignButton() {
  const openComposer = useAppStore((state) => state.openComposer);
  return h(
    "button",
    {
      type: "button",
      onClick: () => openComposer("test"),
      className:
        "canvas-add-button prism-anchor-action pointer-events-auto h-10 shrink-0 whitespace-nowrap px-4 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage focus-visible:ring-offset-2",
    },
    h(Sparkles, { size: 13, className: "prism-anchor-action-icon", "aria-hidden": true }),
    h("span", { className: "prism-anchor-action-label" }, "New campaign"),
  );
}

/** Starts placing an empty ad set on the open campaign page. Shaped like the ad set node itself, in miniature. */
export function NewAdSetButton() {
  const startAdSetGhost = useAppStore((state) => state.startAdSetGhost);
  const cancelAdSetGhost = useAppStore((state) => state.cancelAdSetGhost);
  const ghosting = useAppStore((state) => state.adSetGhost);
  const pageId = useAppStore((state) => {
    const campaigns = state.activeProductId ? state.campaignsByProduct[state.activeProductId] : undefined;
    return (campaigns?.find((campaign) => campaign.id === state.activeCampaignId) ?? campaigns?.[0])?.id ?? null;
  });
  if (!pageId) return null;
  return h(
    "button",
    {
      type: "button",
      onClick: ghosting ? cancelAdSetGhost : startAdSetGhost,
      "aria-pressed": ghosting,
      title: "Add an ad set: it follows your cursor, click on the canvas to drop it",
      className: `canvas-add-button new-adset-button pointer-events-auto${ghosting ? " is-armed" : ""}`,
    },
    h("span", { className: "new-adset-head", "aria-hidden": true }, h("i"), h("i"), h("i")),
    h(
      "span",
      { className: "new-adset-body" },
      h("span", { className: "new-adset-label" }, h(Plus, { size: 13, strokeWidth: 2.4, "aria-hidden": true }), "New ad set"),
      h("span", { className: "new-adset-rows", "aria-hidden": true }, h("i"), h("i"), h("i")),
    ),
  );
}
