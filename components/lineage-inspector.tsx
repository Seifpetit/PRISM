"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Lightbulb,
  Quote,
  Sparkles,
  Tag,
  Target,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { ChipIcon } from "@/components/target-avatar-tray";
import { h } from "@/lib/h";
import { getLineage, getTypeLabel } from "@/lib/lineage";
import { CreativeExplorationProductPanel } from "@/components/strategy-nodes/creative-exploration-product-panel";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { useAppStore } from "@/store/use-app-store";
import type { Campaign } from "@/types/campaign";
import type {
  AudienceExploration,
  AngleExploration,
  AngleNode,
  AudienceNode,
  AudienceProfile,
  AudienceProfileRange,
  OfferNode,
  ProductNode,
  StrategyNode,
  TargetAvatar,
} from "@/types/strategy";

const pages = ["Overview", "Strategy", "Evidence"] as const;
type InspectorPage = (typeof pages)[number];

const awarenessLabels = {
  unaware: "Unaware",
  problem_aware: "Problem aware",
  solution_aware: "Solution aware",
  product_aware: "Product aware",
  most_aware: "Most aware",
} as const;

function clean(value?: string | null) {
  return value?.trim() ?? "";
}

function productTitle(node: ProductNode) {
  return clean(node.workingLabel) || clean(node.name) || node.label;
}

function productName(node: ProductNode) {
  return clean(node.name) || node.label;
}

function humanizeDimension(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return h(
    "section",
    null,
    h(
      "p",
      { className: "mono text-[10px] font-semibold uppercase tracking-[.14em] text-muted" },
      label,
    ),
    h("div", { className: "mt-2 text-sm leading-6 text-ink" }, children),
  );
}

/** A small colour-tinted icon medallion in front of a label, so a section reads at a glance before its text does.
 * Used only by the Angle/Offer bypass views below — the audience ("Personas") overview keeps its own plain
 * `Field` headers untouched. */
function SectionHeading({ icon: Icon, label, accent }: { icon: LucideIcon; label: string; accent?: string }) {
  return h(
    "div",
    { className: "flex items-center gap-1.5" },
    h(
      "span",
      {
        className: "grid h-5 w-5 shrink-0 place-items-center rounded-full",
        style: { background: `color-mix(in srgb, ${accent ?? "var(--muted)"} 16%, transparent)`, color: accent ?? "var(--muted)" },
        "aria-hidden": true,
      },
      h(Icon, { size: 11, strokeWidth: 2.4 }),
    ),
    h("p", { className: "mono text-[10px] font-semibold uppercase tracking-[.14em] text-muted" }, label),
  );
}

function IconField({ icon, label, accent, children }: { icon: LucideIcon; label: string; accent?: string; children?: ReactNode }) {
  return h(
    "section",
    null,
    h(SectionHeading, { icon, label, accent }),
    h("div", { className: "mt-2 pl-[26px] text-sm leading-6 text-ink" }, children),
  );
}

/** A quiet dashed row in place of a paragraph explaining an empty list — one glanceable line, not a sentence. */
function EmptyLinkRow({ icon, text }: { icon: LucideIcon; text: string }) {
  return h(
    "div",
    { className: "flex items-center gap-2.5 rounded-lg border border-dashed border-[#DDE0E4] px-3 py-2.5 text-xs leading-5 text-muted" },
    h(icon, { size: 14, className: "shrink-0 text-border-strong", "aria-hidden": true }),
    text,
  );
}

const EMPTY_AVATARS: TargetAvatar[] = [];
const EMPTY_LINKS: Record<string, string[]> = {};

function LinkedAvatarsList({ productId, angleId }: { productId: string; angleId: string }) {
  const targetAvatars = useAppStore((state) => state.targetAvatarsByProduct[productId] ?? EMPTY_AVATARS);
  const links = useAppStore((state) => state.avatarCanvasByProduct[productId]?.links ?? EMPTY_LINKS);
  const unlinkAvatarAngle = useAppStore((state) => state.unlinkAvatarAngle);
  const linked = targetAvatars.filter((avatar) => (links[avatar.id] ?? []).includes(angleId));

  if (!linked.length) return h(EmptyLinkRow, { icon: UserRound, text: "Drag a persona onto this angle to link it." });

  return h(
    "div",
    { className: "flex flex-wrap gap-3" },
    ...linked.map((avatar) =>
      h(
        "div",
        { key: avatar.id, className: "group/chip relative flex w-[72px] flex-col items-center gap-1.5" },
        h(ChipIcon, { kind: "avatar", avatarId: avatar.id, avatarLabel: avatar.label, gender: avatar.gender }),
        h("p", { className: "line-clamp-2 text-center text-[10.5px] font-semibold leading-[1.25] text-ink" }, avatar.label),
        h(
          "button",
          {
            type: "button",
            onClick: () => unlinkAvatarAngle(avatar.id, angleId),
            "aria-label": `Unlink ${avatar.label}`,
            title: "Unlink",
            className:
              "absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-border-default bg-panel text-muted opacity-0 shadow-sm transition-opacity hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:opacity-100 focus-visible:outline-none group-hover/chip:opacity-100",
          },
          h(X, { size: 11 }),
        ),
      ),
    ),
  );
}

const EMPTY_CAMPAIGNS: Campaign[] = [];

/** The offers actually paired with this angle in an ad set — derived from ad sets, never a separate link of its own. */
function LinkedOffersList({ productId, angleId }: { productId: string; angleId: string }) {
  const campaigns = useAppStore((state) => state.campaignsByProduct[productId] ?? EMPTY_CAMPAIGNS);
  const labels = useCampaignLabels();
  const offerIds = useMemo(() => {
    const seen = new Set<string>();
    for (const campaign of campaigns) {
      for (const concept of campaign.concepts) {
        if (concept.angleId === angleId) seen.add(concept.offerId);
      }
    }
    return [...seen];
  }, [campaigns, angleId]);

  if (!offerIds.length) return h(EmptyLinkRow, { icon: Tag, text: "No offer paired with this angle yet." });

  return h(
    "div",
    { className: "flex flex-wrap gap-3" },
    ...offerIds.map((offerId) =>
      h(
        "div",
        { key: offerId, className: "flex w-[72px] flex-col items-center gap-1.5" },
        h(ChipIcon, { kind: "offer" }),
        h("p", { className: "line-clamp-2 text-center text-[10.5px] font-semibold leading-[1.25] text-ink" }, labels.offer(offerId)),
      ),
    ),
  );
}

/** The angles this offer is actually paired with in an ad set — the mirror of LinkedOffersList above. */
function LinkedAnglesList({ productId, offerId }: { productId: string; offerId: string }) {
  const campaigns = useAppStore((state) => state.campaignsByProduct[productId] ?? EMPTY_CAMPAIGNS);
  const labels = useCampaignLabels();
  const angleIds = useMemo(() => {
    const seen = new Set<string>();
    for (const campaign of campaigns) {
      for (const concept of campaign.concepts) {
        if (concept.offerId === offerId) seen.add(concept.angleId);
      }
    }
    return [...seen];
  }, [campaigns, offerId]);

  if (!angleIds.length) return h(EmptyLinkRow, { icon: Sparkles, text: "No angle paired with this offer yet." });

  return h(
    "div",
    { className: "flex flex-wrap gap-3" },
    ...angleIds.map((angleId) =>
      h(
        "div",
        { key: angleId, className: "flex w-[72px] flex-col items-center gap-1.5" },
        h(ChipIcon, { kind: "angle" }),
        h("p", { className: "line-clamp-2 text-center text-[10.5px] font-semibold leading-[1.25] text-ink" }, labels.angle(angleId)),
      ),
    ),
  );
}

function KeyMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access denied; nothing further to do.
    }
  }
  return h(
    "div",
    { className: "flex items-start justify-between gap-3 rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] px-3.5 py-3" },
    h("p", { className: "text-sm italic leading-6 text-ink" }, `“${message}”`),
    h(
      "button",
      {
        type: "button",
        onClick: () => void copy(),
        className:
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-panel px-2 py-1 text-[11px] font-semibold text-ink hover:bg-canvas",
      },
      copied ? h(Check, { size: 13, className: "text-lineage" }) : h(Copy, { size: 13 }),
      copied ? "Copied" : "Copy",
    ),
  );
}

const ANGLE_ACCENT = "var(--type-angle)";
const OFFER_ACCENT = "var(--type-offer)";

function CreativeExplorationAngleOverview({ angle }: { angle: AngleNode }) {
  const tags = (angle.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  return h(
    "div",
    { className: "space-y-6" },
    tags.length
      ? h(
          "div",
          { className: "flex flex-wrap gap-1.5" },
          ...tags.map((tag) =>
            h(
              "span",
              {
                key: tag,
                className:
                  "mono rounded-full border border-[#DDE0E4] bg-[#FAFBFC] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-muted",
              },
              tag,
            ),
          ),
        )
      : null,
    h(
      IconField,
      { icon: Lightbulb, label: "The angle", accent: ANGLE_ACCENT },
      h("p", { className: "text-base leading-7" }, clean(angle.framing) || "No description available for this angle yet."),
    ),
    clean(angle.summary) ? h(IconField, { icon: Sparkles, label: "Summary", accent: ANGLE_ACCENT }, clean(angle.summary)) : null,
    clean(angle.audienceFitNote) ? h(IconField, { icon: Target, label: "Audience fit", accent: ANGLE_ACCENT }, clean(angle.audienceFitNote)) : null,
    clean(angle.keyMessage)
      ? h(
          IconField,
          { icon: Quote, label: "Key message", accent: ANGLE_ACCENT },
          h(KeyMessage, { message: clean(angle.keyMessage) }),
        )
      : null,
    h(
      "section",
      null,
      h(SectionHeading, { icon: UserRound, label: "Linked personas" }),
      h("div", { className: "mt-2.5" }, h(LinkedAvatarsList, { productId: angle.productId, angleId: angle.id })),
    ),
    h(
      "section",
      null,
      h(SectionHeading, { icon: Tag, label: "Linked offers", accent: OFFER_ACCENT }),
      h("div", { className: "mt-2.5" }, h(LinkedOffersList, { productId: angle.productId, angleId: angle.id })),
    ),
  );
}

/** The Offer drawer's own single-page view (mirrors the Angle one above): an offer only ever carries a short
 * framing and, sometimes, a creative-potential note — there's never enough here to justify a paged
 * Overview/Strategy/Evidence drawer, which used to leave two of its three tabs empty. */
function CreativeExplorationOfferOverview({ offer }: { offer: OfferNode }) {
  const framing = clean(offer.framing);
  const potential = clean(offer.creativePotential);
  return h(
    "div",
    { className: "space-y-6" },
    h(
      IconField,
      { icon: Tag, label: "The offer", accent: OFFER_ACCENT },
      h("p", { className: "text-base leading-7" }, framing || "No description available for this offer yet."),
    ),
    potential ? h(IconField, { icon: Sparkles, label: "Creative potential", accent: OFFER_ACCENT }, potential) : null,
    h(
      "section",
      null,
      h(SectionHeading, { icon: Lightbulb, label: "Paired angles", accent: ANGLE_ACCENT }),
      h("div", { className: "mt-2.5" }, h(LinkedAnglesList, { productId: offer.productId, offerId: offer.id })),
    ),
  );
}

function AwarenessBadge({ level }: { level: AudienceProfile["awarenessLevel"] }) {
  return h(
    "span",
    {
      className:
        "mono inline-flex rounded-full border border-[#DDE0E4] bg-[#FAFBFC] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.1em] text-muted",
    },
    awarenessLabels[level],
  );
}

function ProfileDetail({ label, children }: { label: string; children?: string }) {
  return h(
    "div",
    null,
    h(
      "p",
      { className: "mono text-[7px] font-semibold uppercase tracking-[.12em] text-muted" },
      label,
    ),
    h("p", { className: "mt-0.5 text-[11px] leading-[1.55] text-ink" }, children),
  );
}

function EdgeProfile({ profile }: { profile: AudienceProfile }) {
  return h(
    "article",
    { className: "px-3.5 py-3.5" },
    h(
      "div",
      { className: "flex flex-wrap items-center justify-between gap-2" },
      h("h4", { className: "text-xs font-semibold leading-4 text-ink" }, profile.label),
      h(AwarenessBadge, { level: profile.awarenessLevel }),
    ),
    h("p", { className: "mt-2 text-xs leading-5 text-ink" }, profile.problemExperience),
    h(
      "div",
      { className: "mt-3 space-y-2.5" },
      h(ProfileDetail, { label: "Behavior" }, profile.currentBehavior),
      h(ProfileDetail, { label: "Solution familiarity" }, profile.solutionExperience),
      h(ProfileDetail, { label: "Buying state" }, profile.buyingState),
    ),
  );
}

function ProfileRangeSection({ range }: { range: AudienceProfileRange }) {
  const edgeA = range.profiles.find((profile) => profile.position === "edge_a");
  const edgeB = range.profiles.find((profile) => profile.position === "edge_b");
  if (!edgeA || !edgeB) return null;

  return h(
    "section",
    null,
    h(
      "p",
      { className: "mono text-[8px] font-semibold uppercase tracking-[.14em] text-muted" },
      "Profile range",
    ),
    h("p", { className: "mt-1.5 text-sm font-semibold leading-5 text-ink" }, range.dimension),
    h(
      "p",
      { className: "mt-1 text-[11px] leading-4 text-muted" },
      "Two contrasting profiles showing meaningful variation within this audience.",
    ),
    h(
      "div",
      { className: "mt-3 overflow-hidden rounded-lg border border-[#DDE0E4] bg-[#FAFBFC]" },
      h(EdgeProfile, { profile: edgeA }),
      h(
        "div",
        {
          className: "relative flex h-7 items-center justify-center",
          "aria-label": "Two edges of one audience range",
        },
        h("span", {
          className: "absolute inset-x-3 top-1/2 border-t border-[#DDE0E4]",
          "aria-hidden": true,
        }),
        h(
          "span",
          {
            className:
              "relative grid h-7 w-7 place-items-center rounded-full border border-[#DDE0E4] bg-white text-lineage",
          },
          h(ArrowLeftRight, { size: 13, "aria-hidden": true }),
        ),
      ),
      h(EdgeProfile, { profile: edgeB }),
    ),
  );
}

function ExplorationSummary({ exploration }: { exploration: AudienceExploration }) {
  const selectedCount = exploration.candidateTerritories.filter(
    (candidate) => candidate.decision === "selected",
  ).length;
  return h(
    "section",
    { className: "space-y-3" },
    h(
      Field,
      { label: "Audience exploration" },
      h("p", { className: "text-sm font-semibold" }, `${selectedCount} recommended territories`),
      h(
        "p",
        { className: "mt-1 text-xs text-muted" },
        `Selected from ${exploration.candidateTerritories.length} plausible territories`,
      ),
    ),
    exploration.coverageDimensions.length
      ? h(
          "div",
          null,
          h(
            "p",
            { className: "mono text-[8px] font-semibold uppercase tracking-[.14em] text-muted" },
            "Coverage",
          ),
          h(
            "div",
            { className: "mt-2 flex flex-wrap gap-1.5" },
            ...exploration.coverageDimensions.map((dimension) =>
              h(
                "span",
                {
                  key: dimension,
                  className:
                    "mono inline-flex rounded-full border border-[#DDE0E4] bg-[#FAFBFC] px-1.5 py-1 text-[8px] font-semibold tracking-[.04em] text-muted",
                },
                humanizeDimension(dimension),
              ),
            ),
          ),
        )
      : null,
    clean(exploration.selectionSummary)
      ? h("p", { className: "text-xs leading-5 text-muted" }, clean(exploration.selectionSummary))
      : null,
  );
}

function AngleExplorationSummary({ exploration }: { exploration: AngleExploration }) {
  const selected = exploration.candidateAngles.filter((candidate) => candidate.decision === "selected");
  const rejected = exploration.candidateAngles.filter((candidate) => candidate.decision === "rejected");
  return h(
    "section",
    { className: "space-y-3" },
    h(
      Field,
      { label: "Angle exploration" },
      h("p", { className: "text-sm font-semibold" }, `${selected.length} recommended framings`),
      h(
        "p",
        { className: "mt-1 text-xs text-muted" },
        `Selected from ${exploration.candidateAngles.length} plausible candidates`,
      ),
    ),
    clean(exploration.selectionSummary)
      ? h("p", { className: "text-xs leading-5 text-muted" }, clean(exploration.selectionSummary))
      : null,
    h(
      "details",
      { className: "group rounded-lg border border-[#DDE0E4] bg-[#FAFBFC] p-3" },
      h(
        "summary",
        { className: "cursor-pointer text-xs font-semibold text-ink" },
        "View angle map",
      ),
      h(
        "div",
        { className: "mt-3 space-y-3" },
        selected.length
          ? h(
              "div",
              null,
              h("p", { className: "mono text-[8px] font-semibold uppercase tracking-[.14em] text-muted" }, "Selected"),
              ...selected.map((candidate) =>
                h("p", { key: candidate.label, className: "mt-2 text-xs leading-5 text-ink" }, `✓ ${candidate.label} — ${candidate.reason}`),
              ),
            )
          : null,
        rejected.length
          ? h(
              "div",
              null,
              h("p", { className: "mono text-[8px] font-semibold uppercase tracking-[.14em] text-muted" }, "Considered alternatives"),
              ...rejected.map((candidate) =>
                h("p", { key: candidate.label, className: "mt-2 text-xs leading-5 text-muted" }, `× ${candidate.label} — ${candidate.reason}`),
              ),
            )
          : null,
      ),
    ),
  );
}

function AngleOverview({ angle }: { angle: AngleNode }) {
  const fit = angle.profileRangeFit;
  const fitLabel = fit?.primary === "edge_a" ? "Edge A" : fit?.primary === "edge_b" ? "Edge B" : "Broad";
  const fields = [
    clean(angle.framing) ? h(Field, { key: "framing", label: "Framing" }, clean(angle.framing)) : null,
    clean(angle.audienceConnection)
      ? h(Field, { key: "audience", label: "Why it fits this audience" }, clean(angle.audienceConnection))
      : null,
    fit
      ? h(
          Field,
          { key: "range", label: "Profile range fit" },
          h("p", { className: "text-xs font-semibold text-ink" }, fitLabel),
          clean(fit.rationale) ? h("p", { className: "mt-1 text-xs leading-5 text-muted" }, clean(fit.rationale)) : null,
        )
      : null,
    clean(angle.creativeOpportunity)
      ? h(Field, { key: "creative", label: "Creative opportunity" }, clean(angle.creativeOpportunity))
      : null,
    clean(angle.productConnection)
      ? h(Field, { key: "product", label: "Product connection" }, clean(angle.productConnection))
      : null,
    clean(angle.whyItCouldWork)
      ? h(Field, { key: "why", label: "Why it could work" }, clean(angle.whyItCouldWork))
      : null,
  ].filter(Boolean);
  return fields.length
    ? h("div", { className: "space-y-5" }, ...fields)
    : h("p", { className: "text-xs leading-5 text-muted" }, "No strategic angle details are available for this older node.");
}

function OverviewPage({
  selected,
  product,
  audienceExploration,
  angleExploration,
}: {
  selected: StrategyNode;
  product?: ProductNode;
  audienceExploration?: AudienceExploration | null;
  angleExploration?: AngleExploration | null;
}) {
  if (selected.type === "audience") {
    const audience = selected as AudienceNode;
    const whyProduct = product ? `Why ${productTitle(product)}` : "Product relevance";
    const fields = [
      clean(audience.definingNeed)
        ? h(Field, { key: "need", label: "Defining need" }, clean(audience.definingNeed))
        : null,
      clean(audience.context)
        ? h(Field, { key: "context", label: "Context" }, clean(audience.context))
        : null,
      clean(audience.productRelevance)
        ? h(Field, { key: "relevance", label: whyProduct }, clean(audience.productRelevance))
        : null,
    ].filter(Boolean);
    return fields.length
      ? h(
          "div",
          { className: "space-y-5" },
          ...fields,
          angleExploration ? h(AngleExplorationSummary, { exploration: angleExploration }) : null,
        )
      : h(
          "p",
          { className: "text-xs leading-5 text-muted" },
          "No additional overview details are available for this audience yet.",
        );
  }

  if (selected.type === "angle") return h(AngleOverview, { angle: selected });
  if (selected.type === "product" && audienceExploration)
    return h(ExplorationSummary, { exploration: audienceExploration });
  return h(
    "p",
    { className: "text-xs leading-5 text-muted" },
    "This node’s core strategy is shown on the canvas. Evidence and ancestry remain available here as the lineage expands.",
  );
}

function StrategyPage({
  selected,
  exploration,
}: {
  selected: StrategyNode;
  exploration?: AudienceExploration | null;
}) {
  if (selected.type !== "audience") {
    return exploration && selected.type === "product"
      ? h(ExplorationSummary, { exploration })
      : h(
          "p",
          { className: "text-xs leading-5 text-muted" },
          "Strategic approach details will appear as this lineage stage gains supporting data.",
        );
  }
  const audience = selected as AudienceNode;
  const selectedCount = exploration?.candidateTerritories.filter(
    (candidate) => candidate.decision === "selected",
  ).length;
  const consideredCount = exploration?.candidateTerritories.length;
  return h(
    "div",
    { className: "space-y-5" },
    selectedCount && consideredCount
      ? h(
          Field,
          { label: "Recommended territory" },
          h("p", { className: "text-xs text-ink" }, `One of ${selectedCount} selected`),
          h(
            "p",
            { className: "mt-1 text-xs text-muted" },
            `${consideredCount} territories considered`,
          ),
        )
      : null,
    audience.awarenessLevel
      ? h(Field, { label: "Awareness" }, h(AwarenessBadge, { level: audience.awarenessLevel }))
      : null,
    audience.profileRange ? h(ProfileRangeSection, { range: audience.profileRange }) : null,
    clean(audience.messagingImplication)
      ? h(Field, { label: "Messaging direction" }, clean(audience.messagingImplication))
      : null,
    clean(audience.awarenessRationale)
      ? h(Field, { label: "Why this awareness level?" }, clean(audience.awarenessRationale))
      : null,
    !audience.awarenessLevel &&
      !clean(audience.messagingImplication) &&
      !clean(audience.awarenessRationale)
      ? h(
          "p",
          { className: "text-xs leading-5 text-muted" },
          "No audience approach details are available yet.",
        )
      : null,
  );
}

function EvidencePage({ selected, lineage }: { selected: StrategyNode; lineage: StrategyNode[] }) {
  const supportedBy =
    selected.type === "audience" || selected.type === "angle"
      ? (selected.supportedBy ?? []).filter((item) => clean(item))
      : [];
  return h(
    "div",
    { className: "space-y-5" },
    supportedBy.length
      ? h(
          Field,
          { label: "Supported by" },
          h(
            "ul",
            { className: "space-y-2" },
            ...supportedBy.map((item, index) =>
              h(
                "li",
                {
                  key: `${item}-${index}`,
                  className: "border-l border-[#DDE0E4] pl-2.5 text-xs leading-5 text-ink",
                },
                item,
              ),
            ),
          ),
        )
      : null,
    h(
      Field,
      { label: "Ancestry" },
      h(
        "ol",
        { className: "space-y-1.5", "aria-label": "Selected node ancestry" },
        ...lineage.flatMap((node, index) => {
          const text =
            node.type === "creative"
              ? node.title
              : node.type === "product"
                ? productTitle(node)
                : node.label;
          const item = h("li", { key: node.id, className: "text-xs leading-5 text-ink" }, text);
          const arrow =
            index < lineage.length - 1
              ? h(
                  "li",
                  {
                    key: `${node.id}-arrow`,
                    className: "h-4 pl-1 text-lineage",
                    "aria-hidden": true,
                  },
                  h(ArrowDown, { size: 12 }),
                )
              : null;
          return arrow ? [item, arrow] : [item];
        }),
      ),
    ),
    !supportedBy.length
      ? h(
          "p",
          { className: "text-xs leading-5 text-muted" },
          "No product-specific evidence is available for this node yet.",
        )
      : null,
  );
}

function SelectedIdentity({ selected, onClose }: { selected: StrategyNode; onClose: () => void }) {
  const title =
    selected.type === "creative"
      ? selected.title
      : selected.type === "product"
        ? productTitle(selected)
        : selected.label;
  return h(
    "div",
    { className: "relative border-b border-[#E7E9EC] bg-[#FAFBFC] px-5 py-3" },
    h(
      "button",
      {
        type: "button",
        onClick: onClose,
        className:
          "absolute right-3 top-3 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
        "aria-label": "Close inspector",
      },
      h(X, { size: 16 }),
    ),
    h(
      "p",
      { className: "mono text-[10px] font-semibold uppercase tracking-[.14em] text-muted" },
      getTypeLabel(selected.type),
    ),
    h("p", { className: "mt-1.5 line-clamp-3 pr-8 text-base font-semibold leading-6 text-ink" }, title),
    selected.type === "audience" && selected.awarenessLevel
      ? h(
          "span",
          {
            className:
              "mono mt-2 inline-flex rounded-full border border-[#DDE0E4] bg-white px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.1em] text-muted",
          },
          awarenessLabels[selected.awarenessLevel],
        )
      : null,
    selected.type === "product" && selected.category?.trim()
      ? h(
          "p",
          { className: "mono mt-1 text-[8px] font-semibold uppercase tracking-[.12em] text-muted" },
          selected.category.trim(),
        )
      : null,
    selected.type === "product" &&
      productTitle(selected).toLowerCase() !== productName(selected).toLowerCase()
      ? h(
          "p",
          { className: "mt-1 line-clamp-2 text-xs leading-4 text-muted" },
          productName(selected),
        )
      : null,
  );
}

export function LineageInspector() {
  const nodes = useAppStore((state) => state.nodes);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectNode = useAppStore((state) => state.selectNode);
  const [page, setPage] = useState<InspectorPage>("Overview");
  const selected = nodes.find((node) => node.id === selectedNodeId);
  const pageIndex = pages.indexOf(page);
  const lineage = useMemo(
    () => (selected ? getLineage(selected.id, nodes) : []),
    [nodes, selected],
  );
  const product = selected
    ? nodes.find(
        (node): node is ProductNode =>
          node.productId === selected.productId && node.type === "product",
      )
    : undefined;
  // Audience and angle explorations belonged to the removed Strategy Lineage mode.
  const exploration = null;
  const angleExploration = null;

  useEffect(() => setPage("Overview"), [selected?.id]);

  if (!selected) return null;

  const isSimpleAngle = selected.type === "angle" && selected.lineageMode === "creative_exploration";
  // An offer only ever carries a short framing and an optional creative-potential note — never enough to
  // justify a paged Overview/Strategy/Evidence drawer, which used to leave two of its three tabs empty.
  const isSimpleOffer = selected.type === "offer";
  const isCreativeExplorationProduct = selected.type === "product";
  const bypassPagedContent = isSimpleAngle || isSimpleOffer || isCreativeExplorationProduct;
  // Every Creative Exploration inspector uses the shared 620px drawer width.
  const wideDrawer = isCreativeExplorationProduct || selected.type === "angle" || selected.type === "offer";

  const content = isSimpleAngle
    ? h(CreativeExplorationAngleOverview, { angle: selected })
    : isSimpleOffer
      ? h(CreativeExplorationOfferOverview, { offer: selected })
      : isCreativeExplorationProduct
      ? null
      : page === "Overview"
      ? h(OverviewPage, { selected, product, audienceExploration: exploration, angleExploration })
      : page === "Strategy"
        ? h(StrategyPage, { selected, exploration })
        : h(EvidencePage, { selected, lineage });

  return h(
    "aside",
    {
      className: `strategy-inspector w-full min-h-0 shrink-0 border-l border-[#DFE2E6] bg-white lg:h-full max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:max-h-[78vh] max-lg:rounded-t-2xl max-lg:shadow-[0_-12px_34px_rgba(21,23,26,.16)] ${wideDrawer ? "lg:w-[620px]" : "lg:w-[460px]"}`,
      "aria-label": "Lineage inspector",
    },
    h(
      "div",
      { className: "flex h-full min-h-0 flex-col max-lg:max-h-[78vh]" },
      isCreativeExplorationProduct
        ? h(CreativeExplorationProductPanel, {
            product: selected,
            onClose: () => selectNode(null),
          })
        : h(SelectedIdentity, { selected, onClose: () => selectNode(null) }),
      bypassPagedContent
        ? null
        : h(
        "nav",
        {
          className: "flex items-center justify-between gap-3 border-b border-[#E7E9EC] px-4",
          "aria-label": "Inspector page navigation",
        },
        h(
          "div",
          { className: "flex min-w-0 items-center gap-4" },
          ...pages.map((pageName) =>
            h(
              "button",
              {
                key: pageName,
                type: "button",
                onClick: () => setPage(pageName),
                className: `relative shrink-0 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage ${page === pageName ? "text-lineage after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-lineage" : "text-muted hover:text-ink"}`,
                "aria-current": page === pageName ? "page" : undefined,
              },
              pageName,
            ),
          ),
        ),
        h(
          "div",
          { className: "flex shrink-0 items-center gap-1.5" },
          h(
            "p",
            {
              className: "mono text-[9px] font-semibold tracking-[.1em] text-muted",
              "aria-live": "polite",
            },
            `${pageIndex + 1} / ${pages.length}`,
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => setPage(pages[pageIndex - 1]),
              disabled: pageIndex === 0,
              className:
                "grid h-7 w-7 place-items-center rounded border border-[#E1E4E8] text-muted hover:bg-canvas hover:text-ink disabled:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
              "aria-label": "Previous inspector page",
            },
            h(ChevronLeft, { size: 14 }),
          ),
          h(
            "button",
            {
              type: "button",
              onClick: () => setPage(pages[pageIndex + 1]),
              disabled: pageIndex === pages.length - 1,
              className:
                "grid h-7 w-7 place-items-center rounded border border-[#E1E4E8] text-muted hover:bg-canvas hover:text-ink disabled:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage",
              "aria-label": "Next inspector page",
            },
            h(ChevronRight, { size: 14 }),
          ),
        ),
      ),
      isCreativeExplorationProduct
        ? null
        : h(
        "div",
        { className: "min-h-0 flex-1 overflow-y-auto px-5 py-5" },
        h("div", { key: `${selected.id}-${page}`, className: "inspector-page" }, content),
      ),
    ),
  );
}
