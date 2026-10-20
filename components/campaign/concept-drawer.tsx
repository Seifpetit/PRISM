"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Lightbulb, Play, Plus, Rocket, Tag, Trash2, Wallet, X, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { badgeClass } from "@/components/campaign/campaign-flow-nodes";
import { FORMAT_ICON } from "@/components/creatives/ad-card";
import { GenerateAdsButton } from "@/components/campaign/generate-ads-button";
import { PublishToMetaDialog } from "@/components/campaign/publish-to-meta-dialog";
import { MAX_ADS } from "@/components/campaign/ad-plan-section";
import { RelinkPanel } from "@/components/campaign/relink-panel";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { DrawerPages } from "@/components/drawer-pages";
import { h } from "@/lib/h";
import { conceptBadges } from "@/lib/campaign-rules";
import { trackLooks } from "@/lib/creative-tracks";
import { PersonaPhoto } from "@/components/persona-photo";
import { personaInitials, personaMarkStyle } from "@/lib/persona-avatar";
import { useAppStore } from "@/store/use-app-store";
import { AD_FORMAT_LABEL, adSummary, VIDEO_FORMATS } from "@/types/campaign";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** One line of the Details tab: a small icon or mark, a caption, and a value flush right. Persona/angle/offer are
    read-only here on purpose — they are Strategy's to change, not this drawer's (see ConceptIdentity). */
function DetailRow({ mark, label, children }: { mark: React.ReactNode; label: string; children?: React.ReactNode }) {
  return h(
    "div",
    { className: "flex items-center gap-3 border-b border-[#F1F3F5] py-2.5 last:border-0" },
    mark,
    h("span", { className: "w-16 shrink-0 text-[11px] font-medium text-muted" }, label),
    h("div", { className: "min-w-0 flex-1 text-right" }, children),
  );
}

function RowIcon({ Icon }: { Icon: LucideIcon }) {
  return h("span", { className: "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#E7E9EC] text-muted", "aria-hidden": true }, h(Icon, { size: 13, strokeWidth: 1.8 }));
}

/** A role's own mark, same weight as the Persona avatar next to it: angle blue, offer amber, spend emerald — the
    same colours those roles already wear on the canvas (see .adset-tile), so the two rows either side of Persona
    don't read as a lesser, uncoloured afterthought. */
function RoleMark({ Icon, background, color }: { Icon: LucideIcon; background: string; color: string }) {
  return h("span", { className: "grid h-7 w-7 shrink-0 place-items-center rounded-md", style: { background, color }, "aria-hidden": true }, h(Icon, { size: 13, strokeWidth: 1.8 }));
}

/**
 * The drawer for a selected ad set, in three fixed layers: an identity header and a set of action buttons pinned
 * top and bottom, and a tabbed body between them. Details leads with one ad's own cover image at a time — the
 * hero's own arrows and the filmstrip below it are two ways to move through every ad the set holds, so there is
 * no separate list to keep in sync with it. Deep editing of an ad happens in Creatives, reached from the footer;
 * this drawer is a browse-and-glance surface, not an editor. Performance and Activity are named for where those
 * views will live once there is per-ad-set data to show; today they say so plainly instead of pretending to.
 */
export function ConceptDrawer({ conceptId }: { conceptId: string }) {
  const labels = useCampaignLabels();
  const selectConcept = useAppStore((state) => state.selectConcept);
  const openCampaignPanel = useAppStore((state) => state.openCampaignPanel);
  const openCreatives = useAppStore((state) => state.openCreatives);
  const updateConcept = useAppStore((state) => state.updateConcept);
  const deleteConcept = useAppStore((state) => state.deleteConcept);
  const addAd = useAppStore((state) => state.addAd);
  const adPlanPending = useAppStore((state) => state.adPlanPendingId === conceptId);
  const error = useAppStore((state) => state.campaignError);
  // Select an object that already lives in the store. A selector that builds a new object on every call
  // makes React re-render forever ("getSnapshot should be cached").
  const campaign = useAppStore((state) => {
    for (const campaigns of Object.values(state.campaignsByProduct)) {
      const owner = campaigns.find((item) => item.concepts.some((concept) => concept.id === conceptId));
      if (owner) return owner;
    }
    return null;
  });
  const looks = useAppStore((state) => (state.activeProductId ? state.campaignsByProduct[state.activeProductId] : undefined));
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [spend, setSpend] = useState<string | null>(null);
  const [page, setPage] = useState<"details" | "performance" | "activity">("details");
  const [heroIndex, setHeroIndex] = useState(0);

  const concept = campaign?.concepts.find((item) => item.id === conceptId);
  if (!campaign || !concept) return null;
  const badge = conceptBadges(campaign.concepts, campaign.testType)[campaign.concepts.findIndex((item) => item.id === concept.id)];
  const track = looks ? trackLooks(looks).get(concept.id) : undefined;
  const spendText = spend ?? (concept.spend === null ? "" : String(concept.spend));
  const full = concept.ads.length >= MAX_ADS;
  const heroCount = concept.ads.length;
  const safeIndex = heroCount ? Math.min(heroIndex, heroCount - 1) : 0;
  const heroAd = concept.ads[safeIndex] ?? null;
  const heroReady = Boolean(heroAd?.imageStatus === "ready" && heroAd.imageUrl);
  const personaLabel = labels.avatar(concept.avatarId);

  const hero = h(
    "div",
    { className: `adset-hero ${heroReady ? "" : "is-placeholder"}` },
    ...(heroReady && heroAd
      ? [
          h("img", { key: "img", src: heroAd.imageUrl as string, alt: "" }),
          h("div", { key: "scrim", className: "adset-hero-scrim", "aria-hidden": true }),
          heroAd.title || heroAd.hook
            ? h(
                "div",
                { key: "text", className: "adset-hero-text" },
                heroAd.title ? h("p", { className: "adset-hero-title" }, heroAd.title) : null,
                heroAd.hook ? h("p", { className: "adset-hero-subtitle line-clamp-2" }, `“${heroAd.hook}”`) : null,
              )
            : null,
          VIDEO_FORMATS.has(heroAd.format) ? h("span", { key: "play", className: "adset-hero-play", "aria-hidden": true }, h(Play, { size: 15, fill: "currentColor" })) : null,
          h("span", { key: "badge", className: "adset-hero-badge" }, AD_FORMAT_LABEL[heroAd.format]),
        ]
      : [h("span", { key: "empty", className: "text-[11px] text-muted" }, heroAd ? "Generate a cover image to see it here" : "No ads planned yet")]),
    heroCount > 1
      ? h(
          "button",
          { key: "prev", type: "button", onClick: () => setHeroIndex((index) => (index - 1 + heroCount) % heroCount), "aria-label": "Previous ad", className: "adset-hero-nav is-prev" },
          h(ChevronLeft, { size: 15 }),
        )
      : null,
    heroCount > 1
      ? h(
          "button",
          { key: "next", type: "button", onClick: () => setHeroIndex((index) => (index + 1) % heroCount), "aria-label": "Next ad", className: "adset-hero-nav is-next" },
          h(ChevronRight, { size: 15 }),
        )
      : null,
  );

  const carousel = heroCount
    ? h(
        "div",
        { role: "tablist", "aria-label": "Ads in this ad set", className: "adset-carousel" },
        ...concept.ads.map((ad, index) => {
          const current = index === safeIndex;
          const ready = ad.imageStatus === "ready" && ad.imageUrl;
          const Icon = FORMAT_ICON[ad.format];
          return h(
            "button",
            {
              key: ad.id,
              type: "button",
              role: "tab",
              "aria-selected": current,
              onClick: () => setHeroIndex(index),
              title: ad.title ?? `Ad ${index + 1}: ${AD_FORMAT_LABEL[ad.format]}`,
              className: `adset-carousel-tile ${current ? "is-active" : ""} ${ready ? "" : "is-placeholder"}`,
            },
            ready ? h("img", { src: ad.imageUrl as string, alt: "" }) : h(Icon, { size: 16, strokeWidth: 1.8, "aria-hidden": true }),
          );
        }),
        h(
          "button",
          {
            type: "button",
            onClick: () => void addAd(concept.id),
            disabled: full || adPlanPending,
            title: "Plan an ad manually",
            "aria-label": "Plan an ad manually",
            className: "adset-carousel-add",
          },
          h(Plus, { size: 16 }),
        ),
      )
    : h(
        "div",
        { className: "px-4 pb-1 pt-3" },
        h(
          "button",
          {
            type: "button",
            onClick: () => void addAd(concept.id),
            disabled: adPlanPending,
            className: "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#DDE0E4] py-3 text-[11px] font-semibold text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40",
          },
          h(Plus, { size: 12 }),
          "Plan your first ad",
        ),
      );

  return h(
    "aside",
    {
      className:
        "strategy-inspector flex w-full min-h-0 shrink-0 flex-col overflow-y-auto border-l border-[#DFE2E6] bg-white lg:h-full lg:w-[440px] " +
        "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)]",
      "aria-label": "Ad set",
    },
    // Pinned above everything: what this ad set is, and its place among the others in the campaign.
    h(
      "div",
      { className: "sticky top-0 z-10 relative shrink-0 bg-[#FAFBFC]/95 pt-3 backdrop-blur-sm" },
      h(
        "button",
        { type: "button", onClick: () => selectConcept(null), "aria-label": "Close ad set", className: "absolute right-3 top-3 rounded p-1 text-muted hover:bg-canvas hover:text-ink" },
        h(X, { size: 16 }),
      ),
      h(
        "div",
        { className: "flex items-center gap-2 px-4 pr-9" },
        h("span", { className: "h-2 w-2 shrink-0 rounded-full", style: track ? { background: track.color } : undefined, "aria-hidden": true }),
        h("span", { className: "mono text-[11px] font-bold tracking-[.04em] text-ink" }, track?.ref ?? "Ad set"),
        badge ? h("span", { className: `shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[.06em] ${badgeClass[badge.kind]}` }, badge.label) : null,
      ),
      h("h1", { className: "mt-1 truncate px-4 text-base font-bold leading-5 text-ink", title: labels.angle(concept.angleId) }, labels.angle(concept.angleId)),
      h(
        "button",
        {
          type: "button",
          onClick: () => openCampaignPanel(campaign.id),
          title: `Open ${campaign.name}'s campaign details`,
          className: "mono mt-1 block w-full truncate px-4 text-left text-[10px] font-semibold uppercase tracking-[.08em] text-muted hover:text-lineage hover:underline",
        },
        `Created ${dateLabel(concept.createdAt)} · ${adSummary(concept.ads).split(" · ")[0]} · ${campaign.name}`,
      ),
      h(DrawerPages, {
        label: "Ad set views",
        active: page,
        onChange: (id) => setPage(id as typeof page),
        accent: "prism",
        pages: [
          { id: "details", label: "Details" },
          { id: "performance", label: "Performance" },
          { id: "activity", label: "Activity" },
        ],
      }),
    ),
    // The tabbed body. Every page stays mounted (nothing typed on one is lost by looking at another); the hidden
    // ones just don't render.
    h(
      "div",
      { className: "flex-1" },
      h(
        "div",
        { id: "drawer-page-details", role: "tabpanel", "aria-labelledby": "drawer-page-tab-details", className: page === "details" ? "" : "hidden" },
        hero,
        carousel,
        h(
          "div",
          { className: "space-y-4 p-4 pt-1" },
          h(RelinkPanel, { concept, campaign }),
          h(
            "section",
            { "aria-label": "Ad set details" },
            h(
              DetailRow,
              { mark: h("span", { className: "relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold", style: personaMarkStyle(concept.avatarId) }, personaInitials(personaLabel), h(PersonaPhoto, { avatarId: concept.avatarId, size: 72 })), label: "Persona" },
              h("p", { className: "truncate text-[13px] font-semibold text-ink", title: personaLabel }, personaLabel),
            ),
            h(
              DetailRow,
              { mark: h(RoleMark, { Icon: Lightbulb, background: "var(--type-angle-band)", color: "var(--type-angle-on)" }), label: "Angle" },
              h("p", { className: "truncate text-[13px] font-semibold text-ink", title: labels.angle(concept.angleId) }, labels.angle(concept.angleId)),
            ),
            h(
              DetailRow,
              { mark: h(RoleMark, { Icon: Tag, background: "var(--type-offer-band)", color: "var(--type-offer-on)" }), label: "Offer" },
              h("p", { className: "truncate text-[13px] font-semibold text-ink", title: labels.offer(concept.offerId) }, labels.offer(concept.offerId)),
            ),
            h(
              DetailRow,
              { mark: h(RowIcon, { Icon: CalendarDays }), label: "Dates" },
              h("input", {
                type: "date",
                value: concept.startDate ?? "",
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => void updateConcept(concept.id, { startDate: event.target.value || null }),
                className: "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[12.5px] font-semibold text-ink hover:border-[#E7E9EC] focus:border-lineage focus:outline-none",
              }),
            ),
            h(
              DetailRow,
              { mark: h(RoleMark, { Icon: Wallet, background: "#10b981", color: "#ffffff" }), label: "Spend" },
              h("input", {
                type: "number",
                min: 0,
                step: "0.01",
                inputMode: "decimal",
                value: spendText,
                placeholder: "Not set",
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => setSpend(event.target.value),
                onBlur: () => {
                  const next = spendText.trim() === "" ? null : Number(spendText);
                  setSpend(null);
                  if (next !== concept.spend && (next === null || Number.isFinite(next))) void updateConcept(concept.id, { spend: next });
                },
                className: "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[12.5px] font-semibold text-ink placeholder:font-normal placeholder:text-muted hover:border-[#E7E9EC] focus:border-lineage focus:outline-none",
              }),
            ),
          ),
          error ? h("p", { role: "alert", className: "text-[11px] text-red-600" }, error) : null,
          h(
            "button",
            { type: "button", onClick: () => setConfirming(true), className: "flex items-center gap-1 text-[10.5px] font-semibold text-red-700/80 hover:text-red-700" },
            h(Trash2, { size: 11 }),
            "Delete this ad set",
          ),
        ),
      ),
      h(
        "div",
        { id: "drawer-page-performance", role: "tabpanel", "aria-labelledby": "drawer-page-tab-performance", className: page === "performance" ? "flex flex-col items-center gap-1.5 px-4 py-12 text-center" : "hidden" },
        h("p", { className: "text-xs font-semibold text-ink" }, "No performance data yet"),
        h("p", { className: "max-w-[280px] text-[11px] leading-4 text-muted" }, "Per-ad-set performance isn't tracked yet. Imported Meta data shows up per ad in Performance."),
      ),
      h(
        "div",
        { id: "drawer-page-activity", role: "tabpanel", "aria-labelledby": "drawer-page-tab-activity", className: page === "activity" ? "flex flex-col items-center gap-1.5 px-4 py-12 text-center" : "hidden" },
        h("p", { className: "text-xs font-semibold text-ink" }, "No activity yet"),
        h("p", { className: "max-w-[280px] text-[11px] leading-4 text-muted" }, "A history of changes to this ad set isn't tracked yet."),
      ),
    ),
    // Pinned below everything: the two actions worth reaching without scrolling back up. Generate is the AI
    // action and leads; Open in Creatives is neutral navigation and stays smaller.
    h(
      "div",
      { className: "sticky bottom-0 z-10 flex shrink-0 items-center gap-2 border-t border-[#E7E9EC] bg-white p-3" },
      h("div", { className: "min-w-0 flex-1" }, h(GenerateAdsButton, { concept, variant: "drawer" })),
      h(
        "button",
        {
          type: "button",
          onClick: () => setPublishing(true),
          title: "Publish to Meta",
          "aria-label": "Publish this ad set to Meta",
          className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E7E9EC] text-ink hover:bg-[#F6F7F9]",
        },
        h(Rocket, { size: 14 }),
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => openCreatives(concept.id),
          title: "Open in Creatives",
          "aria-label": "Open this ad set in Creatives",
          className: "flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-lineage/55 px-3 text-xs font-semibold text-ink hover:bg-[#F6F7F9]",
        },
        "Open in Creatives",
        h(ArrowRight, { size: 13 }),
      ),
    ),
    h(PublishToMetaDialog, { open: publishing, concept, onClose: () => setPublishing(false) }),
    h(ConfirmationDialog, {
      open: confirming,
      title: "Delete this ad set?",
      description: `It removes the ad set and its ${concept.ads.length} ad${concept.ads.length === 1 ? "" : "s"} from ${campaign.name}. The persona, angle and offer stay.`,
      confirmLabel: "Delete ad set",
      onCancel: () => setConfirming(false),
      onConfirm: () => {
        setConfirming(false);
        void deleteConcept(concept.id);
      },
    }),
  );
}
