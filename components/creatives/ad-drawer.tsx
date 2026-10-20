"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { AdBrief } from "@/components/creatives/ad-brief";
import { AdCoverImage } from "@/components/creatives/ad-cover-image";
import { RelinkPanel } from "@/components/campaign/relink-panel";
import { ConceptIdentity } from "@/components/campaign/concept-identity";
import { SendToPipeline } from "@/components/creatives/send-to-pipeline";
import { SaveToDrive } from "@/components/creatives/save-to-drive";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { adRef, type CreativeTrack } from "@/lib/creative-tracks";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";

/**
 * The drawer for one ad in a track. The ad set's concept sits on top, read-only and in the track's colour; below
 * it the ad's six dimensions are edited in place. Previous and next move along the same track.
 */
export function AdDrawer({ track, index }: { track: CreativeTrack; index: number }) {
  const labels = useCampaignLabels();
  const selectCreativeAd = useAppStore((state) => state.selectCreativeAd);
  const deleteAd = useAppStore((state) => state.deleteAd);
  const error = useAppStore((state) => state.campaignError);
  const [confirming, setConfirming] = useState(false);
  const { concept } = track;
  const ad = concept.ads[index];
  if (!ad) return null;
  const reference = adRef(track, index);
  const previous = concept.ads[index - 1];
  const next = concept.ads[index + 1];

  return h(
    "aside",
    {
      style: { "--track": track.color } as React.CSSProperties,
      className:
        "strategy-inspector w-full min-h-0 shrink-0 overflow-y-auto border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[440px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": `Ad ${reference}`,
    },
    h(
      "div",
      { className: "track-head relative border-b border-[#E7E9EC] px-4 py-3" },
      h(
        "button",
        { type: "button", onClick: () => selectCreativeAd(null), "aria-label": "Close ad", className: "absolute right-3 top-3 rounded p-1 text-muted hover:bg-canvas hover:text-ink" },
        h(X, { size: 16 }),
      ),
      h(
        "div",
        { className: "flex flex-wrap items-center gap-2 pr-9" },
        h("span", { className: "track-ref" }, reference),
        h("span", { className: "min-w-0 truncate text-[11px] font-semibold text-ink" }, ad.title ?? "Untitled idea"),
      ),
      h("p", { className: "mono mt-2 text-[9px] font-semibold uppercase tracking-[.14em] text-muted" }, `Ad set ${track.ref} · ${track.campaign.name}`),
      h(
        "div",
        { className: "mt-1.5" },
        h(ConceptIdentity, { persona: labels.avatar(concept.avatarId), angle: labels.angle(concept.angleId), offer: labels.offer(concept.offerId), color: track.color }),
      ),
      h(
        "div",
        { className: "mt-2.5 flex items-center justify-between" },
        h("span", { className: "mono text-[9px] font-semibold uppercase tracking-[.12em] text-muted" }, `Ad ${index + 1} of ${concept.ads.length}`),
        h(
          "span",
          { className: "flex items-center gap-1" },
          h(
            "button",
            {
              type: "button",
              disabled: !previous,
              onClick: () => previous && selectCreativeAd(previous.id),
              "aria-label": "Previous ad",
              className: "rounded p-1 text-muted hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent",
            },
            h(ChevronLeft, { size: 15 }),
          ),
          h(
            "button",
            {
              type: "button",
              disabled: !next,
              onClick: () => next && selectCreativeAd(next.id),
              "aria-label": "Next ad",
              className: "rounded p-1 text-muted hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent",
            },
            h(ChevronRight, { size: 15 }),
          ),
        ),
      ),
    ),
    h(AdCoverImage, { conceptId: concept.id, ad }),
    h(
      "div",
      { className: "space-y-5 p-4" },
      h(SendToPipeline, { productId: concept.productId, ad, reference }),
      h(SaveToDrive, { ad }),
      h(RelinkPanel, { concept, campaign: track.campaign }),
      h(AdBrief, { key: ad.id, conceptId: concept.id, ad, index }),
      error ? h("p", { role: "alert", className: "text-[11px] text-red-600" }, error) : null,
      h(
        "button",
        {
          type: "button",
          onClick: () => setConfirming(true),
          className: "flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-700 hover:bg-red-50",
        },
        h(Trash2, { size: 12 }),
        "Delete this ad",
      ),
    ),
    h(ConfirmationDialog, {
      open: confirming,
      title: "Delete this ad?",
      description: `It removes ${reference} from ${track.ref}. The ad set and its other ads stay.`,
      confirmLabel: "Delete ad",
      onCancel: () => setConfirming(false),
      onConfirm: () => {
        setConfirming(false);
        selectCreativeAd(next?.id ?? previous?.id ?? null);
        void deleteAd(concept.id, ad.id);
      },
    }),
  );
}
