"use client";

import { useMemo } from "react";
import { PanelTop } from "lucide-react";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import type { Campaign } from "@/types/campaign";

const NO_CAMPAIGNS: Campaign[] = [];

/**
 * The ad-set count of the open campaign, beside the "New ad set" button. Hovering the icon summons a small hint
 * panel from it, like a genie out of a lamp; the panel is a placeholder for now. (Personas, angles and offers are
 * counted on the Ingredients button.)
 */
export function CanvasVitals() {
  const campaigns = useAppStore((state) =>
    state.activeProductId ? (state.campaignsByProduct[state.activeProductId] ?? NO_CAMPAIGNS) : NO_CAMPAIGNS,
  );
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  const count = useMemo(
    () => (campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0])?.concepts.length ?? 0,
    [campaigns, activeCampaignId],
  );

  return h(
    "div",
    { className: "canvas-vitals pointer-events-auto", role: "group", "aria-label": "Ad sets in this campaign" },
    h(
      "div",
      { className: "canvas-vital", tabIndex: 0, "aria-label": `${count} ad sets` },
      h(
        "span",
        { className: "canvas-vital-icon", style: { background: "var(--control-accent, var(--ink))" }, "aria-hidden": true },
        h(PanelTop, { size: 15, strokeWidth: 2.4 }),
      ),
      h("span", { className: "canvas-vital-count" }, count),
      h(
        "div",
        { className: "canvas-vital-hint", role: "tooltip" },
        h("p", { className: "canvas-vital-hint-title" }, h("b", null, count), " ad sets"),
        h("p", { className: "canvas-vital-hint-text" }, "A persona, an angle and an offer, combined."),
        h("p", { className: "canvas-vital-hint-soon" }, "Hints coming soon"),
      ),
    ),
  );
}
