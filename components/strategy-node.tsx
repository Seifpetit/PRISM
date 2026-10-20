"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BarChart3, Check, Clock3, Crown, Images, Lightbulb, Loader2, Package, Pencil, RotateCcw, Sparkles, Tag, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { CreativeThumbnail } from "@/components/creative-thumbnail";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { FocusedStrategyNode } from "@/components/focused-strategy-node";
import {
  AudienceNodeCompact,
  AudienceNodeExpanded,
} from "@/components/strategy-nodes/audience-node-content";
import { IngredientPlus } from "@/components/ingredient-plus";
import { ProductMediaPicker } from "@/components/strategy-nodes/product-media-picker";
import { h } from "@/lib/h";
import { getLineage, getTypeLabel } from "@/lib/lineage";
import { buildComboPalette } from "@/lib/combo-color";
import type { NodeTag } from "@/lib/node-tags";
import { useAppStore } from "@/store/use-app-store";
import { CAMPAIGN_KIND_LABEL, type CampaignKind } from "@/types/campaign";
import type { StrategyNode } from "@/types/strategy";

export type StrategyFlowData = {
  strategyNode: StrategyNode;
  /** Product node only: the kinds of campaign this product has (test, scaling, retargeting), shown as badges. */
  campaignKinds?: CampaignKind[];
  campaignCount?: number;
  /** Product node only: ads across all of the product campaigns, and how many of those campaigns are tests. */
  creativeCount?: number;
  testCount?: number;
  isOnPath: boolean;
  isGenerating?: boolean;
  isSmokeTest?: boolean;
  generationVisualState?: "pending" | "completing";
  generationStartedAt?: number;
  tag?: NodeTag | null;
};
export type StrategyFlowNode = Node<StrategyFlowData, "strategyNode">;

/** One flat dot color per campaign kind, so the pills on the product node read apart at a glance without relying
 * on their (identical) label typography alone. Purely descriptive — not the Prism generation gradient. */
const CAMPAIGN_KIND_DOT: Record<CampaignKind, string> = {
  test: "var(--lineage-selected, #2864DC)",
  scaling: "var(--lime, #B8F06A)",
  retargeting: "var(--type-offer, #E89400)",
};

function compactIdentity(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function differsMeaningfully(first: string, second: string) {
  return compactIdentity(first).toLowerCase() !== compactIdentity(second).toLowerCase();
}

function connector(kind: "target" | "source", options?: { id?: string; position?: Position; color?: string; style?: React.CSSProperties }) {
  return h(Handle, {
    type: kind,
    position: options?.position ?? (kind === "target" ? Position.Left : Position.Right),
    id: options?.id,
    className: "!h-2 !w-2 !border-2 !border-white !bg-[#AAB0B8]",
    style: options?.color || options?.style ? { ...(options.color ? { background: options.color } : null), ...options.style } : undefined,
  });
}

/**
 * The product's outgoing wires are typed by side: the top feeds personas (target avatars), the left feeds offers, the
 * right feeds angles. Each port wears its ingredient's colour, matching the cards it leads to.
 */
export const PRODUCT_AVATAR_HANDLE_ID = "product-avatars";
export const PRODUCT_OFFER_HANDLE_ID = "product-offers";
export const PRODUCT_ANGLE_HANDLE_ID = "product-angles";

/** Which of the product's ports a wire to a child of this type leaves from. */
export function productHandleFor(childType: string) {
  return childType === "offer" ? PRODUCT_OFFER_HANDLE_ID : PRODUCT_ANGLE_HANDLE_ID;
}

function productPorts() {
  return h(
    Fragment,
    null,
    connector("source", { id: PRODUCT_AVATAR_HANDLE_ID, position: Position.Top, color: "var(--type-persona)" }),
    connector("source", { id: PRODUCT_OFFER_HANDLE_ID, position: Position.Left, color: "var(--type-offer)" }),
    connector("source", { id: PRODUCT_ANGLE_HANDLE_ID, position: Position.Right, color: "var(--type-angle)" }),
  );
}

/** Dedicated right-side anchor for Target Avatar links, independent of the left-to-right lineage flow. */
export const AVATAR_LINK_HANDLE_ID = "avatar-link";

function PrismNodeContour({
  selected,
  generationState,
  accent,
}: {
  selected: boolean;
  generationState?: "pending" | "completing";
  accent?: string;
}) {
  if (!selected && !generationState) return null;
  // A selection contour takes the node's own accent (combo / lineage color);
  // generation keeps the shared prismatic sweep.
  const useAccent = Boolean(selected && !generationState && accent);
  return h("span", {
    className: `prism-node-contour${selected ? " is-selected" : ""}${useAccent ? " is-accent" : ""}${generationState ? ` is-generating is-${generationState}` : ""}`,
    style: useAccent ? ({ "--prism-contour-color": accent } as React.CSSProperties) : undefined,
    "aria-hidden": true,
  });
}

/** Short reference code (e.g. `A2·P1·C3`) so a lineage is followable without color. */
function NodeRefTag({ tag }: { tag?: NodeTag | null }) {
  if (!tag) return null;
  return h(
    "span",
    { className: "node-ref-tag", style: { color: tag.accent }, title: `Reference ${tag.code}` },
    tag.code,
  );
}

export function StrategyNodeCard({ data, selected }: NodeProps<StrategyFlowNode>) {
  const node = data.strategyNode;
  const tag = data.tag ?? null;
  const accent = tag?.accent;
  const selectNode = useAppStore((state) => state.selectNode);
  const nodes = useAppStore((state) => state.nodes);
  // The product node's own photo (the preview shown while it was brought in) lives on the Product record, not
  // on this strategy node — they share an id (see createWorkspaceProduct), so look it up by that.
  const productImageUrl = useAppStore((state) =>
    node.type === "product" ? (state.products.find((product) => product.id === node.id)?.imageUrl ?? null) : null,
  );
  const productImagePending = useAppStore((state) => state.productImagePendingId === node.id);
  const generateProductImage = useAppStore((state) => state.generateProductImage);
  const comboLinks = useAppStore((state) =>
    state.activeProductId ? state.avatarCanvasByProduct[state.activeProductId]?.links : undefined,
  );
  const comboColorFor = buildComboPalette(comboLinks);
  const deleteSelectedSubtree = useAppStore((state) => state.deleteSelectedSubtree);
  const resetProductGenerations = useAppStore((state) => state.resetProductGenerations);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const remove = (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); setConfirmingDelete(true); };
  const confirmDelete = () => { selectNode(node.id); setConfirmingDelete(false); window.setTimeout(() => void deleteSelectedSubtree(), 0); };
  const deleteDialog = h(ConfirmationDialog, { open: confirmingDelete, title: "Delete this lineage?", description: `This removes ${node.label} and every child beneath it.`, confirmLabel: "Delete lineage", onCancel: () => setConfirmingDelete(false), onConfirm: confirmDelete });
  const hasGenerations = node.type === "product" && nodes.some((candidate) => candidate.parentId === node.id);
  const resetButton = node.type === "product" && hasGenerations
    ? h(
        "button",
        {
          type: "button",
          onClick: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); setConfirmingReset(true); },
          className:
            "product-node-badge-button nodrag nopan absolute right-2 top-9 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-muted opacity-0 shadow-sm hover:bg-red-600 hover:text-white focus:opacity-100 group-hover:opacity-100",
          "aria-label": "Reset all generations for this product",
          title: "Reset all generations, start from zero",
        },
        h(RotateCcw, { size: 14 }),
      )
    : null;
  const resetDialog = h(ConfirmationDialog, {
    open: confirmingReset,
    title: "Reset all generations?",
    description: "This clears every audience, angle, and downstream node generated for this product so you can start from zero. Target Avatars are not affected.",
    confirmLabel: "Reset to zero",
    onCancel: () => setConfirmingReset(false),
    onConfirm: () => { setConfirmingReset(false); void resetProductGenerations(); },
  });
  // A badge the same size and place as the reset button (its mirror, top-left instead of top-right), hidden
  // until hover/focus the same way. Not .prism-icon-action: its hover transform fights the centering a plain
  // Tailwind translate gives a wider pill, which is what made an earlier version of this drift on hover. Gone
  // the moment a real image exists; this is a one-time action, not a persistent "regenerate" affordance (same
  // restraint as AdCoverImage).
  const generateImageButton =
    node.type === "product" && !productImageUrl
      ? h(
          "button",
          {
            type: "button",
            disabled: productImagePending,
            onClick: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); void generateProductImage(node.id); },
            "aria-label": productImagePending ? "Generating a product image" : "Generate a product image",
            title: "Generate a product image",
            className:
              "product-node-badge-button nodrag nopan absolute left-2 top-9 z-20 grid h-8 w-8 place-items-center rounded-full text-white opacity-0 shadow-sm focus:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-100",
            style: { background: "linear-gradient(110deg, var(--prism-blue), var(--prism-violet), var(--prism-pink), var(--prism-amber))" },
          },
          productImagePending ? h(Loader2, { size: 14, className: "animate-spin motion-reduce:animate-none", "aria-hidden": true }) : h(Sparkles, { size: 14, "aria-hidden": true }),
        )
      : null;
  // Once a real image exists, swap the AI badge for a neutral edit affordance (choosing/replacing an image is
  // utility, not generation — see AGENTS.md). Same badge slot and reveal-on-hover as generateImageButton/resetButton.
  const editImageButton =
    node.type === "product" && productImageUrl
      ? h(
          "button",
          {
            type: "button",
            onClick: (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); setMediaPickerOpen(true); },
            "aria-label": "Change this product's image",
            title: "Change this product's image",
            className:
              "product-node-badge-button nodrag nopan absolute left-2 top-9 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-muted opacity-0 shadow-sm hover:bg-ink hover:text-white focus:opacity-100 focus:bg-ink focus:text-white group-hover:opacity-100",
          },
          h(Pencil, { size: 15 }),
        )
      : null;
  const mediaPicker =
    node.type === "product"
      ? h(ProductMediaPicker, { open: mediaPickerOpen, productId: node.id, onClose: () => setMediaPickerOpen(false) })
      : null;
  const deleteButton = node.type === "product" ? null : h("button", { type: "button", onClick: remove, className: "nodrag nopan absolute right-1.5 top-1.5 z-20 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-muted opacity-0 shadow-sm transition-opacity hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100", "aria-label": `Delete ${node.label} and descendants`, title: "Delete lineage" }, h(Trash2, { size: 11 }));
  const accentRingStyle =
    !selected && !data.isOnPath && node.generated && node.type !== "audience" && accent
      ? ({ boxShadow: `0 0 0 2px color-mix(in srgb, ${accent} 42%, transparent)` } as React.CSSProperties)
      : undefined;
  const interactiveProps = {
    type: "button" as const,
    onClick: () => {
      selectNode(node.id);
    },
    style: accentRingStyle,
    "aria-label": `Select ${getTypeLabel(node.type).toLowerCase()}: ${node.label}`,
  };
  const common = `prism-generation-card-surface relative overflow-hidden border bg-white text-left shadow-node ${node.type === "audience" ? "audience-node-card cursor-pointer transition-[border-color,box-shadow] hover:border-[#A8AFB8] hover:shadow-[0_2px_5px_rgba(21,23,26,.1)] motion-reduce:transition-none" : "transition-colors"} ${selected ? `${node.type === "audience" ? "prism-selected-audience" : "prism-selected-node"} border-[#DDE0E4]` : data.isOnPath ? "border-lineage/70 bg-[#F8FAFF]" : node.generated && node.type !== "audience" && !accent ? "border-lime ring-2 ring-lime/35" : "border-[#DDE0E4]"}`;
  const before = node.type !== "product" ? connector("target") : null;
  const after = node.type === "product" ? productPorts() : node.type !== "creative" ? connector("source") : null;
  const avatarLinkHandle =
    node.type === "angle"
      ? connector("target", { id: AVATAR_LINK_HANDLE_ID, position: Position.Right })
      : null;

  if (data.isSmokeTest) {
    return h(
      "div",
      {
        className: `${common} prism-smoke-test-node w-[205px] rounded-lg`,
        "aria-label": "Temporary generation preview card",
      },
      before,
      after,
    );
  }

  if (node.type === "creative") {
    return h(
      "div", { className: "group relative w-[210px]" },
      h("button", { ...interactiveProps, className: `${common} w-full rounded-lg` },
      before,
      h(PrismNodeContour, { selected, generationState: data.generationVisualState, accent }),
      h(CreativeThumbnail, { theme: node.thumbnail, compact: true }),
      h(
        "div",
        { className: "absolute left-[104px] right-2 top-2" },
        h(
          "p",
          { className: "line-clamp-2 text-[11px] font-semibold leading-4 text-ink" },
          node.title,
        ),
        h("p", { className: "mono mt-1 text-[9px] text-muted" }, `${node.id} · ${node.duration}s`),
      ),
      node.generated
        ? h("span", { className: "absolute right-7 top-2 h-2 w-2 rounded-full bg-lime" })
        : null), deleteButton, deleteDialog,
    );
  }

  if (node.type === "product") {
    const title = compactIdentity(node.workingLabel) || compactIdentity(node.name) || node.label;
    const factualName = compactIdentity(node.name) || node.label;
    const showFactualName = differsMeaningfully(title, factualName);
    const creatives = data.creativeCount ?? 0;
    const tests = data.testCount ?? 0;
    const stat = (Icon: typeof Images, count: number, noun: string) =>
      h(
        "span",
        { className: "product-card-stat" },
        h(Icon, { size: 15, strokeWidth: 2, "aria-hidden": true }),
        h("b", null, count),
        noun,
      );

    // The root of the strategy: a framed card in the preference colour. A header (kind + root marker), the
    // product photo set into the frame, its name, and two live counts underneath.
    return h(
      "div",
      { className: "group relative w-[270px]" },
      h(
        "button",
        { ...interactiveProps, className: `product-card w-full text-left ${selected ? "is-selected" : ""}` },
        before,
        h(PrismNodeContour, { selected, generationState: data.generationVisualState, accent }),
        h(
          "span",
          { className: "product-card-head" },
          h(Package, { size: 20, strokeWidth: 1.9, "aria-hidden": true }),
          h("span", { className: "product-card-kind" }, "Product"),
          h("span", { className: "product-card-root" }, h(Crown, { size: 12, strokeWidth: 2.2, "aria-hidden": true }), "Root product"),
        ),
        h(
          "span",
          { className: "product-card-photo", "aria-hidden": true },
          productImageUrl ? h("img", { src: productImageUrl, alt: "", draggable: false }) : h(Package, { size: 34, strokeWidth: 1.4 }),
        ),
        h(
          "span",
          { className: "product-card-body" },
          h("span", { className: "product-card-title" }, title),
          showFactualName ? h("span", { className: "product-card-sub line-clamp-1" }, factualName) : null,
          h(
            "span",
            { className: "product-card-sub" },
            data.campaignCount
              ? `Strategy root · ${data.campaignCount} campaign${data.campaignCount === 1 ? "" : "s"}`
              : "Strategy root",
          ),
        ),
        h(
          "span",
          { className: "product-card-foot" },
          stat(Images, creatives, creatives === 1 ? "creative" : "creatives"),
          h("i", { "aria-hidden": true }),
          stat(BarChart3, tests, tests === 1 ? "active test" : "active tests"),
        ),
        after,
      ),
      generateImageButton,
      editImageButton,
      resetButton,
      resetDialog,
      mediaPicker,
    );
  }

  const width =
    node.type === "audience" ? "w-[290px]" : node.type === "angle" ? "w-[260px]" : "w-[205px]";
  const padding = node.type === "audience" || node.type === "angle" ? "p-3.5" : "px-3 py-2.5";

  if (node.type === "audience") {
    const lineage = getLineage(node.id, nodes);
    return h("div", { className: `group relative ${width}` }, h(FocusedStrategyNode, {
      node,
      selected,
      onSelect: () => selectNode(node.id),
      triggerClassName: `${common} w-full rounded-lg p-4`,
      compact: h(
        Fragment,
        null,
        before,
        h(PrismNodeContour, { selected, generationState: data.generationVisualState, accent }),
        h(AudienceNodeCompact, { node, selected, sharedLayout: false }),
        after,
      ),
      expanded: h(AudienceNodeExpanded, { node, lineage, sharedLayout: false }),
    }), deleteButton, deleteDialog);
  }

  // Angle and offer are two of the three things an ad set is made of, so they get their own colour and shape:
  // an angle is a blue card with a lightbulb and a tilted header, an offer an amber ticket with a perforated edge.
  if (node.type === "angle" || node.type === "offer") {
    const isAngle = node.type === "angle";
    const Icon = isAngle ? Lightbulb : Tag;
    const detail = node.framing?.trim();
    const pill = (label: string, className: string, icon?: React.ReactNode) =>
      h(
        "div",
        { className: `absolute right-7 top-1.5 z-10 flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider ${className}` },
        icon,
        label,
      );
    return h(
      "div",
      { className: `group relative ${width}` },
      h(
        "button",
        {
          ...interactiveProps,
          style: undefined,
          className: [
            "prism-generation-card-surface ingredient-card rounded-lg",
            isAngle ? "ingredient-angle" : "ingredient-offer",
            selected ? "prism-selected-node" : "",
            data.isOnPath && !selected ? "is-on-path" : "",
          ]
            .filter(Boolean)
            .join(" "),
        },
        before,
        h(PrismNodeContour, { selected, generationState: data.generationVisualState, accent: isAngle ? "var(--type-angle)" : "var(--type-offer)" }),
        node.generated ? pill("New", "bg-lime text-[#15171a]", h(Check, { size: 8 })) : null,
        data.isGenerating ? pill("Expanding", "bg-[#EAF1FF] text-lineage") : null,
        h(
          "div",
          { className: "ingredient-band" },
          h(Icon, { size: 12, strokeWidth: 2.2, "aria-hidden": true }),
          h("span", null, getTypeLabel(node.type)),
          tag ? h("span", { className: "node-ref-tag ml-auto", title: `Reference ${tag.code}` }, tag.code) : null,
        ),
        isAngle ? null : h("span", { className: "ingredient-notch is-left", "aria-hidden": true }),
        isAngle ? null : h("span", { className: "ingredient-notch is-right", "aria-hidden": true }),
        h(
          "div",
          { className: "ingredient-body" },
          h("p", { className: `${isAngle ? "text-[12.5px]" : "text-xs"} pr-2 font-semibold leading-[1.3] text-ink` }, node.label),
          node.type === "angle" && node.profileRangeFit
            ? h(
                "span",
                { className: "mono mt-1.5 inline-flex rounded-full border border-current px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[.1em] text-[color:var(--type-angle)]" },
                node.profileRangeFit.primary === "edge_a" ? "Edge A" : node.profileRangeFit.primary === "edge_b" ? "Edge B" : "Broad",
              )
            : null,
          detail ? h("p", { className: "mt-1 line-clamp-2 text-[10px] leading-[1.4] text-muted" }, detail) : null,
        ),
        after,
        avatarLinkHandle,
      ),
      h(IngredientPlus, { axis: isAngle ? "angle" : "offer", ingredientId: node.id, label: node.label }),
      deleteButton,
      deleteDialog,
    );
  }

  return h(
    "div", { className: `group relative ${width}` },
    h("button", { ...interactiveProps, className: `${common} w-full ${padding} rounded-lg` },
    before,
    h(PrismNodeContour, { selected, generationState: data.generationVisualState, accent }),
    node.generated
      ? h(
          "div",
          {
            className:
              "absolute right-7 top-2 flex items-center gap-1 rounded-full bg-lime px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider",
          },
          h(Check, { size: 8 }),
          "New",
        )
      : null,
    data.isGenerating
      ? h(
          "div",
          {
            className:
              "absolute right-7 top-2 rounded-full bg-[#EAF1FF] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-lineage",
          },
          "Expanding",
        )
      : null,
    h(
      "div",
      { className: "mb-1.5 flex items-center gap-1.5" },
      h(NodeRefTag, { tag }),
      h(
        "p",
        { className: "mono text-[8px] uppercase tracking-[.14em] text-muted" },
        getTypeLabel(node.type),
      ),
    ),
    h(
      "p",
      {
        className: "text-xs pr-3 font-semibold leading-snug text-ink",
      },
      node.label,
    ),
    node.type === "creativeConcept" && node.avatarId && node.parentId
      ? h("span", {
          className: "absolute inset-y-0 left-0 w-1 rounded-l-lg",
          style: { background: comboColorFor(node.avatarId, node.parentId) },
          "aria-hidden": true,
        })
      : null,
    node.type === "creativeConcept" && node.premise?.trim()
      ? h("p", { className: "mt-2 line-clamp-3 text-[10px] leading-4 text-muted" }, node.premise)
      : null,
    node.type === "execution" && node.edit
      ? h(
          "p",
          { className: "mono mt-1 flex items-center gap-1 text-[9px] text-muted" },
          h(Clock3, { size: 9 }),
          node.edit,
        )
      : null,
    after, avatarLinkHandle), deleteButton, deleteDialog,
  );
}
