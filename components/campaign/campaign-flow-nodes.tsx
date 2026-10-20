"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Fragment, useState } from "react";
import { ArrowUpRight, GitMerge, Lightbulb, Tag, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { FORMAT_ICON } from "@/components/creatives/ad-card";
import { h } from "@/lib/h";
import type { ConceptBadge } from "@/lib/campaign-rules";
import { PersonaPhoto } from "@/components/persona-photo";
import { personaInitials, personaMarkStyle } from "@/lib/persona-avatar";
import { EMPTY_SLOT_LABEL } from "@/lib/ad-set-slots";
import { useAppStore } from "@/store/use-app-store";
import type { AdFormat } from "@/types/campaign";

/** An ad set is a joint: its persona, angle and offer flow in from the left, each on its own handle. */
export const CONCEPT_IN_AVATAR = "in-avatar";
export const CONCEPT_IN_ANGLE = "in-angle";
export const CONCEPT_IN_OFFER = "in-offer";

export type ConceptFlowData = {
  conceptId: string;
  campaignName: string;
  /** The ad set's own colour and reference ("AS-01"), the same in Creatives. */
  color: string;
  reference: string;
  /** Whether each ingredient still exists. A removed one has no wire and its port is dead until another is linked. */
  linked: { avatar: boolean; angle: boolean; offer: boolean };
  avatarId: string;
  avatarLabel: string;
  angleLabel: string;
  offerLabel: string;
  badge: ConceptBadge;
  /** "3 ads · 1 static ad, 2 video": the creative plan in a line. */
  adLine: string;
  /** Whether this ad set holds any ads yet — drives the empty-state placeholder below the ports. */
  hasAds: boolean;
  /** Up to the first 3 ads, for the thumbnail strip: a cover image where one is ready, an icon otherwise
      (image_status "none" — most ads, including every ad made before thumbnails existed — and "failed" look
      the same: a quiet format icon, nothing that reads as broken). */
  thumbs: Array<{ format: AdFormat; imageUrl: string | null }>;
  period: string | null;
  selected: boolean;
};
export type ConceptFlowNode = Node<ConceptFlowData, "conceptNode">;

/** A merger takes the two ingredients a group of ad sets shares and fans out to each of them (lib/merger-rule.ts). */
export const MERGER_IN_A = "merger-in-a";
export const MERGER_IN_B = "merger-in-b";
export const MERGER_OUT = "merger-out";

export type MergerFlowData = {
  /** The two shared ingredients, in port order: the axis, its readable name and its colour token. */
  inputs: [MergerInput, MergerInput];
  /** The axis the fed ad sets differ on. */
  freeLabel: string;
  outputs: number;
};
type MergerInput = { axis: "persona" | "angle" | "offer"; label: string; color: string };
export type MergerFlowNode = Node<MergerFlowData, "mergerNode">;

const MERGER_ICON: Record<MergerInput["axis"], LucideIcon> = { persona: UserRound, angle: Lightbulb, offer: Tag };

/**
 * A merger: two ingredient wires come in on the left, one wire per ad set leaves on the right. It is derived from
 * the ad sets (never stored), so it appears and disappears as they change.
 */
export function MergerNodeCard({ data }: NodeProps<MergerFlowNode>) {
  return h(
    "div",
    { className: "merger-node", "aria-label": `Merger: ${data.inputs[0].label} and ${data.inputs[1].label}, feeding ${data.outputs} ad sets` },
    h(Handle, { type: "target", id: MERGER_IN_A, position: Position.Left, style: { top: "30%" }, className: "merger-handle" }),
    h(Handle, { type: "target", id: MERGER_IN_B, position: Position.Left, style: { top: "70%" }, className: "merger-handle" }),
    h(
      "div",
      { className: "merger-body" },
      h(
        "span",
        { className: "merger-head" },
        h("span", { className: "merger-mark", "aria-hidden": true }, h(GitMerge, { size: 13, strokeWidth: 2.4 })),
        h("span", { className: "merger-title" }, "Merger"),
      ),
      h(
        "span",
        { className: "merger-chips" },
        ...data.inputs.flatMap((input, index) => {
          const Icon = MERGER_ICON[input.axis];
          const chip = h(
            "span",
            { key: input.axis, className: "merger-chip", style: { background: input.color }, title: `${input.axis}: ${input.label}` },
            h(Icon, { size: 11, strokeWidth: 2.5, "aria-hidden": true }),
          );
          return index === 0 ? [chip, h("span", { key: "join", className: "merger-join", "aria-hidden": true }, "+")] : [chip];
        }),
      ),
      h("span", { className: "merger-sub" }, `${data.outputs} ad sets · differ on ${data.freeLabel}`),
    ),
    h(Handle, { type: "source", id: MERGER_OUT, position: Position.Right, className: "merger-handle" }),
  );
}

export const badgeClass: Record<ConceptBadge["kind"], string> = {
  baseline: "border-[#DDE0E4] text-muted",
  variant: "border-emerald-300 text-emerald-700",
  "off-test": "border-amber-300 text-amber-700",
};

/** One input of the joint. The port on its left edge wears the ingredient's colour, so the edge that reaches it does too. A removed ingredient leaves the port dead: no wire, no colour. The persona port swaps its icon for that avatar's own mark (lib/persona-avatar.ts) once it's linked. */
function Port({
  kind,
  handleId,
  Icon,
  label,
  value,
  linked,
  mark,
}: {
  kind: "persona" | "angle" | "offer";
  handleId: string;
  Icon: LucideIcon;
  label: string;
  value: string;
  linked: boolean;
  mark?: { style: { background: string; color: string }; initials: string; avatarId: string } | null;
}) {
  return h(
    "div",
    { className: `adset-row is-${kind} ${linked ? "" : "is-dead"}`, title: linked ? undefined : value === EMPTY_SLOT_LABEL ? `No ${label.toLowerCase()} linked yet` : `${label} removed` },
    h(Handle, { type: "target", id: handleId, position: Position.Left, className: "adset-handle" }),
    h(
      "span",
      { className: "adset-tile", style: mark ? mark.style : undefined },
      mark ? h("span", { className: "persona-mark" }, mark.initials) : h(Icon, { size: 10, strokeWidth: 2.4 }),
      mark ? h(PersonaPhoto, { avatarId: mark.avatarId, size: 48 }) : null,
    ),
    h("span", { className: "adset-row-label" }, label),
    h("span", { className: `min-w-0 flex-1 truncate text-[10.5px] font-semibold ${linked ? "text-ink" : "italic text-muted"}`, title: value }, value),
  );
}

/** Once the ad set has ads, its strip shows each one's own cover image where it has one, and its format icon
    where it doesn't — never generated separately from the ads themselves (see checklist item 3). */
function AdSetThumbStrip({ thumbs }: { thumbs: Array<{ format: AdFormat; imageUrl: string | null }> }) {
  return h(
    "div",
    { className: "adset-thumbs", "aria-hidden": true },
    ...thumbs.map((thumb, index) => {
      if (thumb.imageUrl) return h("span", { key: index, className: "adset-thumb-tile" }, h("img", { src: thumb.imageUrl, alt: "" }));
      const Icon = FORMAT_ICON[thumb.format];
      return h("span", { key: index, className: "adset-thumb-tile is-placeholder" }, h(Icon, { size: 18, strokeWidth: 1.6 }));
    }),
  );
}

/** The strip of ghost tiles that stands in for creatives before any ad exists on this ad set. Dashed, not solid,
    so it reads as "nothing here yet" rather than as a broken thumbnail. Sized to match the real thumbnail strip
    so the card doesn't change height once the first ad gets a cover image. */
function EmptyAdsPlaceholder() {
  return h(
    "div",
    { className: "adset-empty-ads", title: "No ads yet — press Generate ads to fill this in" },
    h(
      "div",
      { className: "adset-empty-tiles" },
      h("span", { className: "adset-empty-tile" }),
      h("span", { className: "adset-empty-tile" }),
      h("span", { className: "adset-empty-tile" }),
    ),
    h("span", { className: "adset-empty-label" }, "No ads yet"),
  );
}

/** Deletes this ad set (and its ads) after a confirmation. A corner satellite on the opposite side from "Open in
    Creatives", only visible on hover or focus. */
function DeleteAdSetButton({ conceptId }: { conceptId: string }) {
  const deleteConcept = useAppStore((state) => state.deleteConcept);
  const [confirming, setConfirming] = useState(false);
  return h(
    Fragment,
    null,
    h(
      "button",
      {
        type: "button",
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          setConfirming(true);
        },
        title: "Delete this ad set",
        "aria-label": "Delete this ad set",
        className:
          "nodrag nopan absolute -top-2.5 -left-2.5 z-20 grid h-6 w-6 place-items-center rounded-full border border-[#DDE0E4] bg-white text-muted opacity-0 shadow-sm transition-opacity hover:border-red-600 hover:bg-red-600 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 group-hover:opacity-100",
      },
      h(Trash2, { size: 12, strokeWidth: 2.4, "aria-hidden": true }),
    ),
    h(ConfirmationDialog, {
      open: confirming,
      title: "Delete this ad set?",
      description: "It removes the ad set and all of its ads. Personas, angles and offers are kept.",
      confirmLabel: "Delete ad set",
      onCancel: () => setConfirming(false),
      onConfirm: () => {
        setConfirming(false);
        void deleteConcept(conceptId);
      },
    }),
  );
}

/** Opens this ad set in Creatives. Neutral (navigation, not generation — see AGENTS.md's Prism-color rule), a
    corner satellite that only appears on hover/focus so it never competes with the card's own content. */
function OpenInCreativesButton({ conceptId }: { conceptId: string }) {
  const openCreatives = useAppStore((state) => state.openCreatives);
  return h(
    "button",
    {
      type: "button",
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        openCreatives(conceptId);
      },
      title: "Open in Creatives",
      "aria-label": "Open this ad set in Creatives",
      className:
        "absolute -top-2.5 -right-2.5 z-20 flex items-center gap-1 rounded-full border border-[#DDE0E4] bg-white px-2 py-1 text-[10px] font-semibold text-ink opacity-0 shadow-sm transition-opacity hover:border-lineage hover:text-lineage focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lineage group-hover:opacity-100",
    },
    "Open in Creatives",
    h(ArrowUpRight, { size: 11, "aria-hidden": true }),
  );
}

/** One concept = one ad set: the joint of a persona, an angle and an offer, and how many ads it holds. */
export function ConceptNodeCard({ data, selected }: NodeProps<ConceptFlowNode>) {
  const personaMark = data.linked.avatar
    ? { style: personaMarkStyle(data.avatarId), initials: personaInitials(data.avatarLabel), avatarId: data.avatarId }
    : null;
  return h(
    "div",
    { className: "group relative w-[240px]" },
    h(DeleteAdSetButton, { conceptId: data.conceptId }),
    h(OpenInCreativesButton, { conceptId: data.conceptId }),
    h(
      "div",
      {
        className: `adset-card is-tracked ${selected || data.selected ? "is-selected" : ""}`,
        style: { "--track": data.color } as React.CSSProperties,
        role: "button",
        tabIndex: 0,
        "aria-label": `Ad set: ${data.avatarLabel}, ${data.angleLabel}, ${data.offerLabel}`,
      },
      // The ad set's colour washes its header and outlines the card; the ports below stay the ingredients' colours.
      h(
        "div",
        { className: "track-head adset-head flex items-center gap-2 px-3 pb-1.5 pt-2" },
        h("span", { className: "track-ref shrink-0" }, data.reference),
        h("p", { className: "mono min-w-0 flex-1 truncate text-[8px] font-bold uppercase tracking-[.14em] text-ink", title: data.campaignName }, data.campaignName),
        h("span", { className: `shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold ${badgeClass[data.badge.kind]}` }, data.badge.label),
      ),
      h(Port, { kind: "persona", handleId: CONCEPT_IN_AVATAR, Icon: UserRound, label: "Persona", value: data.avatarLabel, linked: data.linked.avatar, mark: personaMark }),
      h(Port, { kind: "angle", handleId: CONCEPT_IN_ANGLE, Icon: Lightbulb, label: "Angle", value: data.angleLabel, linked: data.linked.angle }),
      h(Port, { kind: "offer", handleId: CONCEPT_IN_OFFER, Icon: Tag, label: "Offer", value: data.offerLabel, linked: data.linked.offer }),
      data.hasAds
        ? h(
            "div",
            { className: "px-3 pb-2 pt-1.5" },
            h(AdSetThumbStrip, { thumbs: data.thumbs }),
            h(
              "p",
              { className: "mono mt-1.5 truncate text-[9px] text-muted" },
              `${data.adLine}${data.period ? ` · ${data.period}` : ""}`,
            ),
          )
        : h(EmptyAdsPlaceholder),
    ),
  );
}
