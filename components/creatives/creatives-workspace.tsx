"use client";

import { GenerateAdsButton } from "@/components/campaign/generate-ads-button";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Lightbulb, Loader2, Plus, ScanSearch, Tag, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { AdCard } from "@/components/creatives/ad-card";
import { PipelineSlot } from "@/components/creatives/pipeline-slot";
import { AdDrawer } from "@/components/creatives/ad-drawer";
import { AdPromptInspector } from "@/components/creatives/ad-prompt-inspector";
import { useCampaignLabels, type CampaignLabels } from "@/components/campaign/use-campaign-labels";
import { adRef, buildTracks, type CreativeTrack } from "@/lib/creative-tracks";
import { usePipelineStore } from "@/store/pipeline-store";
import { h } from "@/lib/h";
import { useAppStore } from "@/store/use-app-store";
import { adSummary, CAMPAIGN_KIND_LABEL, type Campaign, type CampaignAd } from "@/types/campaign";

const NO_CAMPAIGNS: Campaign[] = [];
const MAX_ADS = 20;

function ConceptChip({ Icon, color, label, value }: { Icon: LucideIcon; color: string; label: string; value: string }) {
  return h(
    "span",
    { className: "flex min-w-0 items-center gap-1.5 text-[11px]", title: `${label}: ${value}` },
    h(Icon, { size: 11, strokeWidth: 2.4, style: { color }, className: "shrink-0", "aria-hidden": true }),
    h("span", { className: `truncate font-semibold ${value.startsWith("Removed ") ? "italic text-muted" : "text-ink"}` }, value),
  );
}

/**
 * One ad set as a track: its colour and reference, the fixed concept it executes, and a tray of ad cards. The
 * concept is read-only here; changing it is a Strategy action.
 */
function Track({ track, labels, selectedAdId, current }: { track: CreativeTrack; labels: CampaignLabels; selectedAdId: string | null; current: boolean }) {
  const { concept, campaign } = track;
  const addAd = useAppStore((state) => state.addAd);
  const selectCreativeAd = useAppStore((state) => state.selectCreativeAd);
  const deleteAd = useAppStore((state) => state.deleteAd);
  // The ad whose delete icon was pressed: deleting asks first, as it does from the ad's own drawer.
  const [deleting, setDeleting] = useState<{ ad: CampaignAd; reference: string } | null>(null);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const selectConcept = useAppStore((state) => state.selectConcept);
  const pending = useAppStore((state) => state.adPlanPendingId === concept.id);
  const full = concept.ads.length >= MAX_ADS;

  return h(
    "section",
    { id: `track-${concept.id}`, className: `track ${current ? "is-current" : ""}`, style: { "--track": track.color } as React.CSSProperties, "aria-label": `Ad set ${track.ref}` },
    h(
      "div",
      { className: "track-head space-y-2.5 px-4 pb-3 pt-3" },
      h(
        "div",
        { className: "flex flex-wrap items-center gap-x-3 gap-y-2" },
        h("span", { className: "track-ref" }, track.ref),
        h("span", { className: "mono min-w-0 truncate text-[9px] font-semibold uppercase tracking-[.12em] text-muted" }, `${campaign.name} · ${CAMPAIGN_KIND_LABEL[campaign.kind]}`),
        h("span", { className: "mono text-[9px] uppercase tracking-[.08em] text-muted" }, adSummary(concept.ads)),
        h(
          "span",
          { className: "ml-auto flex items-center gap-2" },
          h(
            "button",
            {
              type: "button",
              onClick: () => {
                setActiveTab("strategy");
                selectConcept(concept.id);
              },
              className: "flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-lineage hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
            },
            "On canvas",
            h(ArrowUpRight, { size: 12, "aria-hidden": true }),
          ),
          // The brand gradient button; it opens the panel that asks what to optimise for.
          h(GenerateAdsButton, { concept, variant: "track" }),
        ),
      ),
      h(
        "div",
        { className: "grid gap-x-4 gap-y-1 sm:grid-cols-3" },
        h(ConceptChip, { Icon: UserRound, color: "var(--type-persona)", label: "Persona", value: labels.avatar(concept.avatarId) }),
        h(ConceptChip, { Icon: Lightbulb, color: "var(--type-angle)", label: "Angle", value: labels.angle(concept.angleId) }),
        h(ConceptChip, { Icon: Tag, color: "var(--type-offer)", label: "Offer", value: labels.offer(concept.offerId) }),
      ),
    ),
    h(
      "div",
      { className: "track-tray", role: "list", "aria-label": `Ads in ${track.ref}` },
      ...concept.ads.map((ad, index) =>
        h(
          "div",
          { key: ad.id, role: "listitem", className: "group/ad relative flex" },
          h(AdCard, { ad, reference: adRef(track, index), selected: ad.id === selectedAdId, onSelect: () => selectCreativeAd(ad.id === selectedAdId ? null : ad.id) }),
          // A quick transfer icon on hover; once the ad is in the pipeline, a badge with its stage in the same place.
          h(PipelineSlot, { productId: concept.productId, ad, reference: adRef(track, index) }),
          // Shown on hover or keyboard focus (and always on touch screens, which have no hover).
          h(
            "button",
            {
              type: "button",
              onClick: () => setDeleting({ ad, reference: adRef(track, index) }),
              "aria-label": `Delete ad ${adRef(track, index)}`,
              title: "Delete this ad",
              className:
                "absolute right-2 top-2 z-[1] grid h-6 w-6 place-items-center rounded-md border border-[#DDE0E4] bg-panel text-muted opacity-0 shadow-sm " +
                "transition-opacity hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage " +
                "group-hover/ad:opacity-100 group-focus-within/ad:opacity-100 [@media(hover:none)]:opacity-100",
            },
            h(Trash2, { size: 12, strokeWidth: 2, "aria-hidden": true }),
          ),
        ),
      ),
      pending
        ? h(
            "div",
            { role: "status", className: "ad-card ad-card-dashed" },
            h(Loader2, { size: 16, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }),
            "Planning ads…",
            h("span", { className: "text-[10px] font-normal" }, "Usually 10 to 30 seconds"),
          )
        : null,
      h(
        "button",
        {
          type: "button",
          onClick: () => void addAd(concept.id),
          disabled: full || pending,
          className: "ad-card ad-card-dashed disabled:cursor-not-allowed disabled:opacity-40",
        },
        h(Plus, { size: 16, "aria-hidden": true }),
        "Plan an ad manually",
      ),
    ),
    h(ConfirmationDialog, {
      open: Boolean(deleting),
      title: "Delete this ad?",
      description: deleting ? `It removes ${deleting.reference} from ${track.ref}. The ad set and its other ads stay.` : "",
      confirmLabel: "Delete ad",
      onCancel: () => setDeleting(null),
      onConfirm: () => {
        const target = deleting;
        setDeleting(null);
        if (!target) return;
        // If the ad is open in the drawer, close it rather than leave the drawer pointing at nothing.
        if (target.ad.id === selectedAdId) selectCreativeAd(null);
        void deleteAd(concept.id, target.ad.id);
      },
    }),
  );
}

/**
 * Where an ad set's creative work is developed. Strategy decides which ad sets exist and what each one is
 * (persona x angle x offer); this workspace lays them out as tracks and lets you develop the ads inside each one.
 * Selecting an ad opens it in a drawer.
 */
export function CreativesWorkspace() {
  const labels = useCampaignLabels();
  const campaigns = useAppStore((state) => (state.activeProductId ? (state.campaignsByProduct[state.activeProductId] ?? NO_CAMPAIGNS) : NO_CAMPAIGNS));
  const creativesConceptId = useAppStore((state) => state.creativesConceptId);
  const creativesAdId = useAppStore((state) => state.creativesAdId);
  const promptOpen = useAppStore((state) => state.creativesPromptOpen);
  const setPromptOpen = useAppStore((state) => state.setCreativesPromptOpen);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const error = useAppStore((state) => state.campaignError);
  const tracks = useMemo(() => buildTracks(campaigns), [campaigns]);
  const adCount = tracks.reduce((total, track) => total + track.concept.ads.length, 0);
  // Each ad card shows where it is in the production pipeline, so the tasks are loaded with the page.
  const activeProductId = useAppStore((state) => state.activeProductId);
  useEffect(() => {
    if (activeProductId) void usePipelineStore.getState().load(activeProductId);
  }, [activeProductId]);

  let selected: { track: CreativeTrack; index: number } | null = null;
  for (const track of tracks) {
    const index = track.concept.ads.findIndex((ad) => ad.id === creativesAdId);
    if (index >= 0) {
      selected = { track, index };
      break;
    }
  }

  // Coming from an ad set on the canvas, land on its track.
  useEffect(() => {
    if (creativesConceptId) document.getElementById(`track-${creativesConceptId}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [creativesConceptId]);

  if (!tracks.length) {
    return h(
      "section",
      { className: "grid min-h-0 flex-1 place-items-center px-6 py-14" },
      h(
        "div",
        { className: "max-w-md text-center" },
        h("h2", { className: "text-lg font-semibold text-ink" }, "No ad sets to develop yet"),
        h("p", { className: "mt-2 text-sm leading-6 text-muted" }, "Each ad set becomes a track here. Build a campaign on the Strategy canvas first, then come back to plan its ads."),
        h(
          "button",
          { type: "button", onClick: () => setActiveTab("strategy"), className: "mt-5 h-9 rounded-md bg-ink px-4 text-xs font-semibold text-white" },
          "Go to Strategy",
        ),
      ),
    );
  }

  return h(
    "div",
    { className: "flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row" },
    h(
      "main",
      { className: "min-h-0 min-w-0 flex-1 overflow-y-auto" },
      h(
        "div",
        { className: "mx-auto w-full max-w-5xl space-y-4 px-5 py-6" },
        h(
          "div",
          { className: "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" },
          h(
            "div",
            null,
            h("h1", { className: "text-base font-semibold text-ink" }, "Creatives"),
            h("p", { className: "mt-0.5 text-[11px] leading-4 text-muted" }, "One track per ad set. Open an ad to develop it; the persona, angle and offer stay fixed."),
          ),
          h(
            "div",
            { className: "flex items-center gap-3" },
            h("p", { className: "mono text-[9px] font-semibold uppercase tracking-[.12em] text-muted" }, `${tracks.length} ad set${tracks.length === 1 ? "" : "s"} · ${adCount} ad${adCount === 1 ? "" : "s"}`),
            h(
              "button",
              {
                type: "button",
                onClick: () => setPromptOpen(!promptOpen),
                "aria-pressed": promptOpen,
                title: "See and edit the prompts that generate ads",
                className: `flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${
                  promptOpen ? "border-lineage bg-canvas text-ink" : "border-border-default text-muted hover:bg-canvas hover:text-ink"
                }`,
              },
              h(ScanSearch, { size: 13, strokeWidth: 2, "aria-hidden": true }),
              "Prompt",
            ),
          ),
        ),
        error ? h("p", { role: "alert", className: "text-[11px] text-red-600" }, error) : null,
        ...tracks.map((track) =>
          h(Track, { key: track.concept.id, track, labels, selectedAdId: creativesAdId, current: selected?.track.concept.id === track.concept.id || (!selected && track.concept.id === creativesConceptId) }),
        ),
      ),
    ),
    promptOpen ? h(AdPromptInspector) : selected ? h(AdDrawer, { key: creativesAdId, track: selected.track, index: selected.index }) : null,
  );
}
