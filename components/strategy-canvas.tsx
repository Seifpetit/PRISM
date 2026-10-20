"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  getViewportForBounds,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import { animateChildGeneration } from "@/graph/animations/animate-child-generation";
import { h } from "@/lib/h";
import { getDescendantIds, getLineage } from "@/lib/lineage";
import { buildComboPalette } from "@/lib/combo-color";
import { conceptBadges } from "@/lib/campaign-rules";
import { planMergers, type MergeAxis, type MergerPlan } from "@/lib/merger-rule";
import { trackLooks } from "@/lib/creative-tracks";
import { adSummary, CAMPAIGN_KINDS, type Campaign } from "@/types/campaign";
import { buildNodeTags } from "@/lib/node-tags";
import { useAppStore } from "@/store/use-app-store";
import { STRATEGY_TYPES, type StrategyNode } from "@/types/strategy";
import { AVATAR_LINK_HANDLE_ID, PRODUCT_AVATAR_HANDLE_ID, StrategyNodeCard, productHandleFor, type StrategyFlowNode } from "@/components/strategy-node";
import {
  AvatarNodeCard,
  AVATAR_ANGLE_HANDLE_ID,
  AVATAR_CONCEPT_HANDLE_ID,
  AVATAR_FROM_PRODUCT_HANDLE_ID,
  type AvatarFlowNode,
} from "@/components/avatar-node";
import { AVATAR_DRAG_MIME } from "@/components/target-avatar-tray";
import { StrategyPrismEdge } from "@/components/strategy-prism-edge";
import { AvatarLinkEdge } from "@/components/avatar-link-edge";
import { GenerationSatellites } from "@/components/generation-satellites";
import {
  CONCEPT_IN_ANGLE,
  CONCEPT_IN_AVATAR,
  CONCEPT_IN_OFFER,
  ConceptNodeCard,
  MERGER_IN_A,
  MERGER_IN_B,
  MERGER_OUT,
  MergerNodeCard,
  type ConceptFlowNode,
  type MergerFlowNode,
} from "@/components/campaign/campaign-flow-nodes";
import { CampaignPages } from "@/components/campaign/campaign-pages";
import { CanvasVitals } from "@/components/campaign/canvas-vitals";
import { CanvasInteractionLayer } from "@/components/campaign/canvas-interaction-layer";
import { LinkEdge } from "@/components/campaign/link-edge";
import { EMPTY_SLOT_LABEL, isEmptySlotId, type SlotAxis } from "@/lib/ad-set-slots";
import { NewAdSetButton } from "@/components/campaign/new-campaign-button";
import { useCampaignLabels } from "@/components/campaign/use-campaign-labels";
import { LineageBreadcrumb } from "@/components/lineage-breadcrumb";
import { useTheme } from "@/components/theme-provider";

type CanvasFlowNode = StrategyFlowNode | AvatarFlowNode | ConceptFlowNode | MergerFlowNode;
const AVATAR_NODE_PREFIX = "avatar-";
// A colon can't appear in the ids strategy nodes and avatars use, so this can never collide with them.
const CONCEPT_NODE_PREFIX = "adset:";
// Mergers are derived from the ad sets and carry their own id ("merger:persona-offer:..."), never stored.
const MERGER_NODE_PREFIX = "merger:";
const MERGER_W = 148;
const MERGER_H = 76;
const MERGER_GAP = 110;
const MERGER_COLOR = "var(--type-merger)";
const AXIS_COLOR: Record<MergeAxis, string> = { persona: "var(--type-persona)", angle: "var(--type-angle)", offer: "var(--type-offer)" };
const AXIS_PORT: Record<MergeAxis, string> = { persona: CONCEPT_IN_AVATAR, angle: CONCEPT_IN_ANGLE, offer: CONCEPT_IN_OFFER };
const NO_CAMPAIGNS: Campaign[] = [];

const nodeTypes = {
  strategyNode: StrategyNodeCard,
  avatarNode: AvatarNodeCard,
  conceptNode: ConceptNodeCard,
  mergerNode: MergerNodeCard,
};
const edgeTypes = { prismLineage: StrategyPrismEdge, avatarLink: AvatarLinkEdge, junctionLink: LinkEdge };
const columnX = [0, 285, 620, 965, 1225, 1500];
const NODE_GAP = 20;

// Ad sets sit to the right of the angle and persona columns; each campaign's ad sets stack in their own block.
const AD_SET_X = 1260;
const CONCEPT_ROWS = 5;
const CONCEPT_W = 260;
const CONCEPT_H = 150;
const CAMPAIGN_GAP = 60;
// A persona that an ad set uses but nobody placed by hand stacks in the column between the angles and the ad sets.
const AVATAR_DEFAULT_X = 930;
const AVATAR_DEFAULT_STEP = 136;

/** Default spots for ad sets: one block per campaign, stacked. Positions the user saved always win. */
function layoutCampaigns(campaigns: Campaign[]) {
  const blockOrigins = new Map<string, { x: number; y: number }>();
  const conceptPositions = new Map<string, { x: number; y: number }>();
  let cursorY = 0;
  for (const campaign of campaigns) {
    const base = { x: AD_SET_X, y: cursorY };
    blockOrigins.set(campaign.id, base);
    campaign.concepts.forEach((concept, index) => {
      conceptPositions.set(concept.id, {
        x: Number.isFinite(concept.positionX) ? (concept.positionX as number) : base.x + Math.floor(index / CONCEPT_ROWS) * CONCEPT_W,
        y: Number.isFinite(concept.positionY) ? (concept.positionY as number) : base.y + (index % CONCEPT_ROWS) * CONCEPT_H,
      });
    });
    // Every campaign reserves room for a full column of ad sets, so a growing campaign never overlaps the next.
    cursorY = base.y + CONCEPT_ROWS * CONCEPT_H + CAMPAIGN_GAP;
  }
  return { blockOrigins, conceptPositions };
}

/** A node change's id (an "add" change carries it on `item`). */
const changeNodeId = (change: NodeChange<CanvasFlowNode>) => ("id" in change ? change.id : change.item.id);

function formatPeriod(startDate: string | null, endDate: string | null, spend: number | null) {
  const range = startDate ? `${startDate} → ${endDate ?? "ongoing"}` : null;
  const money = spend === null ? null : `spend ${spend}`;
  return [range, money].filter(Boolean).join(" · ") || null;
}

/** Column x for a node type, incl. the Creative Exploration concept column. */
function typeColumnX(type: StrategyNode["type"]): number {
  // Offers sit in their own lane to the left of the product (its left port), mirroring the Angles on its right.
  if (type === "offer") return -columnX[1];
  if (type === "creativeConcept") return columnX[3];
  const index = STRATEGY_TYPES.indexOf(type as (typeof STRATEGY_TYPES)[number]);
  return columnX[index >= 0 ? index : 0];
}

type SmokeTestPreview = {
  parentId: string;
  nodes: StrategyNode[];
  state: "pending" | "revealing";
};

function nodeSize(node: StrategyNode) {
  const width =
    node.type === "product"
      ? 250
      : node.type === "audience"
        ? 290
        : node.type === "angle"
          ? 260
          : node.type === "creative"
            ? 210
            : node.type === "creativeConcept"
              ? 210
              : 205;
  const height =
    node.type === "creative"
      ? 92
      : node.type === "product"
        ? 112
        : node.type === "audience"
          ? 112
          : node.type === "angle"
            ? 108
            : node.type === "creativeConcept"
              ? 104
              : node.type === "offer"
                ? 104
                : 62;
  return { width, height };
}

function positionsOverlap(
  node: StrategyNode,
  position: { x: number; y: number },
  other: StrategyNode,
  otherPosition: { x: number; y: number },
) {
  const size = nodeSize(node);
  const otherSize = nodeSize(other);
  return (
    position.x < otherPosition.x + otherSize.width + NODE_GAP &&
    position.x + size.width + NODE_GAP > otherPosition.x &&
    position.y < otherPosition.y + otherSize.height + NODE_GAP &&
    position.y + size.height + NODE_GAP > otherPosition.y
  );
}

function nearestOpenPosition(
  node: StrategyNode,
  preferred: { x: number; y: number },
  occupied: Array<{ node: StrategyNode; position: { x: number; y: number } }>,
) {
  const step = nodeSize(node).height + NODE_GAP;
  for (let distance = 0; distance < 80; distance += 1) {
    const offsets = distance === 0 ? [0] : [distance * step, -distance * step];
    for (const offset of offsets) {
      const candidate = { x: preferred.x, y: preferred.y + offset };
      if (!occupied.some((entry) => positionsOverlap(node, candidate, entry.node, entry.position)))
        return candidate;
    }
  }
  return preferred;
}

function layoutNodes(nodes: StrategyNode[]): Map<string, { x: number; y: number }> {
  const children = new Map<string, StrategyNode[]>();
  nodes.forEach((node) => {
    if (!node.parentId) return;
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  });
  const result = new Map<string, { x: number; y: number }>();
  let leafIndex = 0;

  function place(node: StrategyNode): number {
    const childNodes = children.get(node.id) ?? [];
    let y: number;
    if (childNodes.length === 0) {
      y = leafIndex * 118;
      leafIndex += 1;
    } else {
      const ys = childNodes.map(place);
      y = ys.reduce((total, childY) => total + childY, 0) / ys.length;
    }
    result.set(node.id, { x: typeColumnX(node.type), y });
    return y;
  }

  nodes.filter((node) => node.type === "product").forEach(place);
  nodes.forEach((node) => {
    if (Number.isFinite(node.positionX) && Number.isFinite(node.positionY)) {
      result.set(node.id, { x: node.positionX!, y: node.positionY! });
    }
  });
  return result;
}

function CanvasInner({
  productNodes,
  canvasRef,
}: {
  productNodes: StrategyNode[];
  canvasRef: MutableRefObject<HTMLElement | null>;
}) {
  const { preference } = useTheme();
  const reactFlow = useReactFlow<CanvasFlowNode>();
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectNode = useAppStore((state) => state.selectNode);
  const generatingParentId = useAppStore((state) => state.generatingParentId);
  const generationExpansion = useAppStore((state) => state.generationExpansion);
  const revealGenerationExpansion = useAppStore((state) => state.revealGenerationExpansion);
  const settleGenerationExpansion = useAppStore((state) => state.settleGenerationExpansion);
  const saveNodePosition = useAppStore((state) => state.saveNodePosition);
  const activeProductId = useAppStore((state) => state.activeProductId);
  const targetAvatarsByProduct = useAppStore((state) => state.targetAvatarsByProduct);
  const avatarCanvasByProduct = useAppStore((state) => state.avatarCanvasByProduct);
  const selectedAvatarId = useAppStore((state) => state.selectedAvatarId);
  // Several nodes selected at once with a right-drag box. They are highlighted and move together; any click
  // (or selecting something else) resets them. The store still holds a single selection.
  const [boxIds, setBoxIds] = useState<string[]>([]);
  const boxSet = useMemo(() => new Set(boxIds), [boxIds]);
  const placeAvatarOnCanvas = useAppStore((state) => state.placeAvatarOnCanvas);
  const selectAvatar = useAppStore((state) => state.selectAvatar);
  const linkAvatarToAngle = useAppStore((state) => state.linkAvatarToAngle);
  const campaigns = useAppStore((state) =>
    state.activeProductId ? (state.campaignsByProduct[state.activeProductId] ?? NO_CAMPAIGNS) : NO_CAMPAIGNS,
  );
  const activeCampaignId = useAppStore((state) => state.activeCampaignId);
  // Each campaign is a page of the canvas: only the open page's ad sets are drawn, on the shared map of ingredients.
  const pageCampaigns = useMemo(() => {
    const page = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? campaigns[0];
    return page ? [page] : NO_CAMPAIGNS;
  }, [campaigns, activeCampaignId]);
  // The product node badges the kinds of campaign the product has (test, scaling, retargeting).
  const campaignKinds = useMemo(
    () => CAMPAIGN_KINDS.filter((kind) => campaigns.some((campaign) => campaign.kind === kind)),
    [campaigns],
  );
  // The product node's footer: every ad across the product's campaigns, and how many of those campaigns are tests.
  const creativeCount = useMemo(
    () => campaigns.reduce((total, campaign) => total + campaign.concepts.reduce((sum, concept) => sum + concept.ads.length, 0), 0),
    [campaigns],
  );
  const testCount = useMemo(() => campaigns.filter((campaign) => campaign.kind === "test").length, [campaigns]);
  const pendingLink = useAppStore((state) => state.pendingLink);
  const cancelLink = useAppStore((state) => state.cancelLink);
  const relinkConcept = useAppStore((state) => state.relinkConcept);
  const unlinkConcept = useAppStore((state) => state.unlinkConcept);
  const selectedConceptId = useAppStore((state) => state.selectedConceptId);
  const selectConcept = useAppStore((state) => state.selectConcept);
  const closeCampaignPanel = useAppStore((state) => state.closeCampaignPanel);
  const saveConceptPosition = useAppStore((state) => state.saveConceptPosition);
  const campaignLabels = useCampaignLabels();
  const targetAvatars = useMemo(
    () => (activeProductId ? targetAvatarsByProduct[activeProductId] ?? [] : []),
    [activeProductId, targetAvatarsByProduct],
  );
  const avatarCanvas = activeProductId ? avatarCanvasByProduct[activeProductId] : undefined;
  const comboColorFor = useMemo(() => buildComboPalette(avatarCanvas?.links), [avatarCanvas]);
  const nodeTags = useMemo(
    () => buildNodeTags(productNodes, avatarCanvas?.links),
    [productNodes, avatarCanvas],
  );
  const stablePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const initialViewportAppliedRef = useRef(false);
  const [reactFlowReady, setReactFlowReady] = useState(false);
  const [positionRevision, setPositionRevision] = useState(0);
  const [smokeTestPreview, setSmokeTestPreview] = useState<SmokeTestPreview | null>(null);
  const smokeTestTimersRef = useRef<Set<number>>(new Set());
  const smokeTestControllerRef = useRef<AbortController | null>(null);

  const positions = useMemo(() => {
    const calculated = layoutNodes(productNodes);
    const previous = stablePositionsRef.current;
    if (!previous.size) return calculated;
    const stable = new Map(calculated);
    productNodes.forEach((node) => {
      const position = previous.get(node.id);
      if (position) stable.set(node.id, position);
    });
    const occupied = productNodes
      .filter((node) => previous.has(node.id))
      .map((node) => ({ node, position: stable.get(node.id)! }));
    const newNodesByParent = new Map<string, StrategyNode[]>();
    productNodes
      .filter((node) => !previous.has(node.id) && node.parentId)
      .forEach((node) => {
        newNodesByParent.set(node.parentId!, [
          ...(newNodesByParent.get(node.parentId!) ?? []),
          node,
        ]);
      });
    newNodesByParent.forEach((children, parentId) => {
      const parentPosition = stable.get(parentId);
      if (!parentPosition) return;
      children.forEach((child, index) => {
        const position = nearestOpenPosition(
          child,
          {
            x: typeColumnX(child.type),
            y: parentPosition.y + (index - (children.length - 1) / 2) * 118,
          },
          occupied,
        );
        stable.set(child.id, position);
        occupied.push({ node: child, position });
      });
    });
    return stable;
  }, [positionRevision, productNodes]);

  // Concepts branch off the avatar node (right side).
  const resolvedPositions = useMemo(() => {
    const concepts = productNodes.filter((node) => node.type === "creativeConcept");
    if (!concepts.length || !avatarCanvas) return positions;
    const merged = new Map(positions);

    const byAvatar = new Map<string, StrategyNode[]>();
    concepts.forEach((concept) => {
      const avatarId = "avatarId" in concept ? (concept.avatarId as string | undefined) : undefined;
      if (!avatarId) return;
      byAvatar.set(avatarId, [...(byAvatar.get(avatarId) ?? []), concept]);
    });
    byAvatar.forEach((group, avatarId) => {
      const anchor = avatarCanvas.positions[avatarId];
      if (!anchor) return;
      const startX = anchor.x + 155 + 90; // avatar width + gap
      const startY = anchor.y - ((group.length - 1) * 130) / 2;
      group.forEach((concept, index) => {
        if (Number.isFinite(concept.positionX) && Number.isFinite(concept.positionY)) return;
        merged.set(concept.id, { x: startX, y: startY + index * 130 });
      });
    });

    return merged;
  }, [positions, productNodes, avatarCanvas]);

  useEffect(() => {
    stablePositionsRef.current = new Map(positions);
  }, [positions]);

  useEffect(
    () => () => {
      smokeTestControllerRef.current?.abort();
      smokeTestTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      smokeTestTimersRef.current.clear();
    },
    [],
  );
  // While an ad set is selected, only its own persona, angle and offer (and the path from the product to them) stay lit.
  const focusedConcept = useMemo(() => {
    if (!selectedConceptId) return null;
    for (const campaign of pageCampaigns) {
      const found = campaign.concepts.find((concept) => concept.id === selectedConceptId);
      if (found) return found;
    }
    return null;
  }, [pageCampaigns, selectedConceptId]);
  const pathIds = useMemo(() => {
    if (selectedNodeId) return new Set(getLineage(selectedNodeId, productNodes).map((node) => node.id));
    if (focusedConcept) {
      return new Set([focusedConcept.angleId, focusedConcept.offerId].flatMap((id) => getLineage(id, productNodes).map((node) => node.id)));
    }
    return new Set<string>();
  }, [selectedNodeId, focusedConcept, productNodes]);
  const descendantIds = useMemo(
    () => (selectedNodeId ? getDescendantIds(selectedNodeId, productNodes) : new Set<string>()),
    [selectedNodeId, productNodes],
  );
  // The full lineage of the selected node: its ancestor chain plus its whole subtree.
  const lineageIds = useMemo(() => {
    if (!selectedNodeId && !focusedConcept) return null;
    return new Set<string>([...(selectedNodeId ? [selectedNodeId] : []), ...pathIds, ...descendantIds]);
  }, [selectedNodeId, focusedConcept, pathIds, descendantIds]);
  // Avatars that feed the selected node's lineage (linked to a selected angle, or
  // the author of any concept/direction inside its subtree).
  const lineageAvatarIds = useMemo(() => {
    if (focusedConcept) return new Set([focusedConcept.avatarId]);
    if (!lineageIds || !avatarCanvas) return null;
    const ids = new Set<string>();
    for (const [avatarId, angleIds] of Object.entries(avatarCanvas.links)) {
      if ((angleIds ?? []).some((angleId) => lineageIds.has(angleId))) ids.add(avatarId);
    }
    for (const node of productNodes) {
      if (
        lineageIds.has(node.id) &&
        "avatarId" in node &&
        typeof node.avatarId === "string"
      ) {
        ids.add(node.avatarId);
      }
    }
    return ids;
  }, [focusedConcept, lineageIds, avatarCanvas, productNodes]);
  const generationNodeIds = useMemo(
    () => new Set(generationExpansion?.state === "revealing" ? generationExpansion.newNodeIds : []),
    [generationExpansion],
  );

  const flowNodes: StrategyFlowNode[] = useMemo(
    () =>
      [...productNodes, ...(smokeTestPreview?.nodes ?? [])].map((node) => {
        const isSmokeTest =
          smokeTestPreview?.nodes.some((preview) => preview.id === node.id) ?? false;
        const smokeParentPosition =
          isSmokeTest && smokeTestPreview ? positions.get(smokeTestPreview.parentId) : undefined;
        const smokeIndex =
          isSmokeTest && smokeTestPreview
            ? smokeTestPreview.nodes.findIndex((preview) => preview.id === node.id)
            : -1;
        const smokePosition = smokeParentPosition
          ? {
              x: typeColumnX(node.type),
              y: smokeParentPosition.y + (smokeIndex - 1) * 118,
            }
          : undefined;
        const inLineage = !lineageIds || lineageIds.has(node.id);
        const opacity =
          isSmokeTest || generationNodeIds.has(node.id) || inLineage ? 1 : 0.16;
        return {
          id: node.id,
          type: "strategyNode",
          position: smokePosition ?? resolvedPositions.get(node.id) ?? { x: 0, y: 0 },
          data: {
            strategyNode: node,
            campaignKinds: node.type === "product" ? campaignKinds : undefined,
            campaignCount: node.type === "product" ? campaigns.length : undefined,
            creativeCount: node.type === "product" ? creativeCount : undefined,
            testCount: node.type === "product" ? testCount : undefined,
            tag: nodeTags.forNode(node.id),
            isOnPath: pathIds.has(node.id),
            isGenerating: generatingParentId === node.id || smokeTestPreview?.parentId === node.id,
            isSmokeTest,
            generationVisualState:
              smokeTestPreview?.parentId === node.id
                ? smokeTestPreview.state === "pending"
                  ? "pending"
                  : "completing"
                : generationExpansion?.parentNodeId === node.id
                  ? generationExpansion.state === "pending"
                    ? "pending"
                    : "completing"
                  : undefined,
            generationStartedAt:
              generationExpansion?.parentNodeId === node.id
                ? generationExpansion.startedAt
                : undefined,
          },
          selected: selectedNodeId === node.id || boxSet.has(node.id),
          className: generationNodeIds.has(node.id) || isSmokeTest ? "prism-generation-node-reveal" : "",
          style: { opacity, zIndex: inLineage ? 4 : 1 },
          draggable: !isSmokeTest,
          selectable: true,
          focusable: false,
          ariaLabel: `${node.type}: ${node.label}`,
        };
      }),
    [
      boxSet,
      campaignKinds,
      campaigns.length,
      creativeCount,
      testCount,
      descendantIds,
      generationExpansion,
      generationNodeIds,
      generatingParentId,
      lineageIds,
      nodeTags,
      pathIds,
      positions,
      resolvedPositions,
      productNodes,
      selectedNodeId,
      smokeTestPreview,
    ],
  );
  const [renderedNodes, setRenderedNodes, applyRenderedNodeChanges] =
    useNodesState<StrategyFlowNode>(flowNodes);

  useEffect(() => {
    // React Flow owns the live position while a drag is in progress. `flowNodes`
    // also changes for selection and generation presentation, but its positions
    // remain the last committed layout until drag-stop. Preserve the live
    // coordinate for existing nodes so those visual updates cannot reset edge
    // handle geometry mid-drag. New nodes still receive their calculated slot.
    setRenderedNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return flowNodes.map((nextNode) => {
        const currentNode = currentById.get(nextNode.id);
        return currentNode
          ? { ...nextNode, position: currentNode.position, dragging: currentNode.dragging }
          : nextNode;
      });
    });
  }, [flowNodes, setRenderedNodes]);

  // A persona is on the canvas when it was placed by hand or an ad set uses it, so an ad set can always be
  // drawn as the joint of its persona, angle and offer.
  const usedAvatarIds = useMemo(
    () => new Set(pageCampaigns.flatMap((campaign) => campaign.concepts.map((concept) => concept.avatarId))),
    [pageCampaigns],
  );
  const onCanvasAvatarIds = useMemo(
    () => new Set([...Object.keys(avatarCanvas?.positions ?? {}), ...usedAvatarIds]),
    [avatarCanvas, usedAvatarIds],
  );

  const avatarFlowNodes: AvatarFlowNode[] = useMemo(() => {
    const positions = avatarCanvas?.positions ?? {};
    let nextDefaultSlot = 0;
    return targetAvatars
      .filter((avatar) => onCanvasAvatarIds.has(avatar.id))
      .map((avatar) => {
        const linkedAngleIds = avatarCanvas?.links[avatar.id] ?? [];
        const inLineage =
          !lineageAvatarIds || lineageAvatarIds.has(avatar.id) || selectedAvatarId === avatar.id;
        return {
          id: `${AVATAR_NODE_PREFIX}${avatar.id}`,
          type: "avatarNode",
          position: positions[avatar.id] ?? { x: AVATAR_DEFAULT_X, y: nextDefaultSlot++ * AVATAR_DEFAULT_STEP },
          data: {
            avatar,
            tag: nodeTags.forAvatar(avatar.id),
            linkedAngleCount: linkedAngleIds.length,
            awaitingLink: selectedAvatarId === avatar.id,
            inUse: usedAvatarIds.has(avatar.id),
          },
          selected: selectedAvatarId === avatar.id || boxSet.has(`${AVATAR_NODE_PREFIX}${avatar.id}`),
          draggable: true,
          selectable: true,
          focusable: false,
          zIndex: 5,
          style: { opacity: inLineage ? 1 : 0.16 },
          ariaLabel: `Target avatar: ${avatar.label}`,
        };
      });
  }, [avatarCanvas, boxSet, lineageAvatarIds, nodeTags, onCanvasAvatarIds, productNodes, selectedAvatarId, targetAvatars, usedAvatarIds]);

  const [renderedAvatarNodes, setRenderedAvatarNodes] = useState<AvatarFlowNode[]>([]);

  useEffect(() => {
    setRenderedAvatarNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return avatarFlowNodes.map((nextNode) => {
        const currentNode = currentById.get(nextNode.id);
        return currentNode
          ? { ...nextNode, position: currentNode.position, dragging: currentNode.dragging }
          : nextNode;
      });
    });
  }, [avatarFlowNodes]);

  // Ad sets: a third layer next to strategy nodes and avatars. The campaign is not a node; it names its ad sets.
  const campaignLayout = useMemo(() => layoutCampaigns(pageCampaigns), [pageCampaigns]);
  // An ad set stays lit while nothing is focused, when it is the selected ad set, or when the selected strategy
  // node is one of its ingredients (or an ancestor of them, like the product).
  const isAdSetLit = useCallback(
    (concept: { id: string; angleId: string; offerId: string }) => {
      if (focusedConcept) return focusedConcept.id === concept.id;
      if (lineageIds) return lineageIds.has(concept.angleId) || lineageIds.has(concept.offerId);
      return true;
    },
    [focusedConcept, lineageIds],
  );

  // An ad set wears one colour and reference everywhere (canvas, drawers, Creatives), by its place in the product.
  const adSetLooks = useMemo(() => trackLooks(campaigns), [campaigns]);
  // An ingredient is linked while it still exists. A wire is drawn for each linked one; a removed one leaves its
  // port dead until another is linked.
  const liveAvatarIds = useMemo(() => new Set(targetAvatars.map((avatar) => avatar.id)), [targetAvatars]);
  const liveNodeIds = useMemo(() => new Set(productNodes.map((node) => node.id)), [productNodes]);
  // An ad set slot is open when nothing live sits in it (never linked, cut, or its ingredient was removed): that is
  // the only kind of slot a link can land in.
  const slotOpen = useCallback(
    (concept: { avatarId: string; angleId: string; offerId: string }, axis: SlotAxis) =>
      axis === "avatar" ? !liveAvatarIds.has(concept.avatarId) : axis === "angle" ? !liveNodeIds.has(concept.angleId) : !liveNodeIds.has(concept.offerId),
    [liveAvatarIds, liveNodeIds],
  );

  const conceptFlowNodes: ConceptFlowNode[] = useMemo(
    () =>
      pageCampaigns.flatMap((campaign) => {
        const badges = conceptBadges(campaign.concepts, campaign.testType);
        return campaign.concepts.map((concept, index) => ({
          id: `${CONCEPT_NODE_PREFIX}${concept.id}`,
          type: "conceptNode" as const,
          position: campaignLayout.conceptPositions.get(concept.id) ?? { x: AD_SET_X, y: 0 },
          data: {
            conceptId: concept.id,
            campaignName: campaign.name,
            color: adSetLooks.get(concept.id)?.color ?? "var(--ink)",
            reference: adSetLooks.get(concept.id)?.ref ?? "",
            linked: { avatar: liveAvatarIds.has(concept.avatarId), angle: liveNodeIds.has(concept.angleId), offer: liveNodeIds.has(concept.offerId) },
            avatarId: concept.avatarId,
            avatarLabel: isEmptySlotId(concept.avatarId) ? EMPTY_SLOT_LABEL : campaignLabels.avatar(concept.avatarId),
            angleLabel: isEmptySlotId(concept.angleId) ? EMPTY_SLOT_LABEL : campaignLabels.angle(concept.angleId),
            offerLabel: isEmptySlotId(concept.offerId) ? EMPTY_SLOT_LABEL : campaignLabels.offer(concept.offerId),
            badge: badges[index],
            adLine: adSummary(concept.ads),
            hasAds: concept.ads.length > 0,
            thumbs: concept.ads.slice(0, 3).map((ad) => ({ format: ad.format, imageUrl: ad.imageStatus === "ready" ? ad.imageUrl : null })),
            period: formatPeriod(concept.startDate, concept.endDate, concept.spend),
            selected: selectedConceptId === concept.id,
          },
          selected: selectedConceptId === concept.id || boxSet.has(`${CONCEPT_NODE_PREFIX}${concept.id}`),
          draggable: true,
          selectable: true,
          focusable: false,
          zIndex: 5,
          // While a link is pending, only the ad sets that can take it stay lit and ringed in the ingredient's colour.
          className: pendingLink ? (slotOpen(concept, pendingLink.axis) ? "is-link-eligible" : "is-link-ineligible") : undefined,
          style: {
            opacity: pendingLink ? (slotOpen(concept, pendingLink.axis) ? 1 : 0.25) : isAdSetLit(concept) ? 1 : 0.16,
            ...(pendingLink ? { "--axis-color": pendingLink.axis === "avatar" ? "var(--type-persona)" : pendingLink.axis === "angle" ? "var(--type-angle)" : "var(--type-offer)" } : {}),
          } as React.CSSProperties,
          ariaLabel: `Ad set in ${campaign.name}`,
        }));
      }),
    [adSetLooks, boxSet, campaignLabels, campaignLayout, isAdSetLit, liveAvatarIds, liveNodeIds, pageCampaigns, pendingLink, selectedConceptId, slotOpen],
  );

  // React Flow reports live drags and measured sizes through onNodesChange. Keep just those in a map and
  // layer them over the store-derived nodes, so the campaign layer needs no state-syncing effect: the
  // stored position is the truth once a drag ends (the override is cleared then).
  const [nodeOverrides, setNodeOverrides] = useState<
    Record<string, { position?: { x: number; y: number }; measured?: { width: number; height: number }; dragging?: boolean }>
  >({});
  const renderedConceptNodes = useMemo(
    () => conceptFlowNodes.map((node) => ({ ...node, ...nodeOverrides[node.id] })),
    [conceptFlowNodes, nodeOverrides],
  );
  // The merger rule (lib/merger-rule.ts), applied once per campaign page on the ad sets that are drawn.
  const mergerPlans: MergerPlan[] = useMemo(
    () =>
      pageCampaigns.flatMap((campaign) =>
        planMergers(campaign.concepts, (axis, id) =>
          axis === "persona" ? liveAvatarIds.has(id) && onCanvasAvatarIds.has(id) : liveNodeIds.has(id),
        ),
      ),
    [liveAvatarIds, liveNodeIds, onCanvasAvatarIds, pageCampaigns],
  );
  const mergerByConcept = useMemo(() => {
    const map = new Map<string, MergerPlan>();
    for (const plan of mergerPlans) for (const id of plan.conceptIds) map.set(id, plan);
    return map;
  }, [mergerPlans]);
  const renderedMergerNodes: MergerFlowNode[] = useMemo(() => {
    const labelFor = (axis: MergeAxis, id: string) =>
      axis === "persona" ? campaignLabels.avatar(id) : axis === "angle" ? campaignLabels.angle(id) : campaignLabels.offer(id);
    return mergerPlans.map((plan) => {
      const fed = renderedConceptNodes.filter((node) => plan.conceptIds.includes(node.data.conceptId));
      const left = Math.min(...fed.map((node) => node.position.x));
      const middle = fed.reduce((sum, node) => sum + node.position.y, 0) / Math.max(fed.length, 1);
      const lit = fed.some((node) => (node.style?.opacity ?? 1) !== 0.16);
      return {
        id: plan.id,
        type: "mergerNode" as const,
        position: { x: left - MERGER_GAP - MERGER_W, y: middle + 66 - MERGER_H / 2 },
        data: {
          inputs: [
            { axis: plan.axes[0], label: labelFor(plan.axes[0], plan.sharedIds[0]), color: AXIS_COLOR[plan.axes[0]] },
            { axis: plan.axes[1], label: labelFor(plan.axes[1], plan.sharedIds[1]), color: AXIS_COLOR[plan.axes[1]] },
          ],
          freeLabel: plan.freeAxis,
          outputs: plan.conceptIds.length,
        },
        draggable: true,
        selectable: false,
        focusable: false,
        zIndex: 4,
        style: { opacity: lit ? 1 : 0.16 },
        ...nodeOverrides[plan.id],
      };
    });
  }, [campaignLabels, mergerPlans, nodeOverrides, renderedConceptNodes]);
  const applyLayerChanges = useCallback((changes: NodeChange<CanvasFlowNode>[]) => {
    setNodeOverrides((current) => {
      const next = { ...current };
      for (const change of changes) {
        if (change.type === "position") {
          next[change.id] = {
            ...next[change.id],
            position: change.position ?? next[change.id]?.position,
            dragging: change.dragging,
          };
        } else if (change.type === "dimensions" && change.dimensions) {
          next[change.id] = { ...next[change.id], measured: change.dimensions };
        } else if (change.type === "remove") {
          delete next[change.id];
        }
      }
      return next;
    });
  }, []);
  const clearDragOverrides = useCallback((ids: string[]) => {
    setNodeOverrides((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (next[id]) next[id] = { measured: next[id].measured };
      }
      return next;
    });
  }, []);

  // Bring a brand-new campaign's ad sets into view (the initial viewport is centred on the product). Campaigns
  // that already existed when the product opened are never panned to.
  const seenCampaignsRef = useRef<{ productId: string | null; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!reactFlowReady) return;
    const ids = new Set(campaigns.map((campaign) => campaign.id));
    const seen = seenCampaignsRef.current;
    seenCampaignsRef.current = { productId: activeProductId, ids };
    if (!seen || seen.productId !== activeProductId) return;
    const fresh = campaigns.find((campaign) => !seen.ids.has(campaign.id));
    const at = fresh ? campaignLayout.blockOrigins.get(fresh.id) : undefined;
    if (at) {
      void reactFlow.setCenter(at.x + 40, at.y + 180, {
        duration: 350,
        zoom: Math.min(Math.max(reactFlow.getZoom(), 0.6), 0.85),
      });
    }
  }, [activeProductId, campaignLayout, campaigns, reactFlow, reactFlowReady]);

  // Switching to another existing campaign page brings that page into view: its ad sets and the personas,
  // angles and offers they join. (A brand-new campaign is framed by the effect above.)
  const pageRef = useRef<{ productId: string | null; pageId: string | null; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!reactFlowReady) return;
    const pageId = pageCampaigns[0]?.id ?? null;
    const previous = pageRef.current;
    pageRef.current = { productId: activeProductId, pageId, ids: new Set(campaigns.map((campaign) => campaign.id)) };
    if (!previous || previous.productId !== activeProductId || !pageId || !previous.pageId || previous.pageId === pageId || !previous.ids.has(pageId)) return;
    const rects: Array<{ x: number; y: number; width: number; height: number }> = conceptFlowNodes.map((node) => ({ ...node.position, width: 240, height: 132 }));
    const wanted = new Set(pageCampaigns.flatMap((campaign) => campaign.concepts.flatMap((concept) => [concept.angleId, concept.offerId])));
    for (const node of productNodes) {
      const at = wanted.has(node.id) ? resolvedPositions.get(node.id) : undefined;
      if (at) rects.push({ ...at, ...nodeSize(node) });
    }
    const wantedAvatars = new Set(pageCampaigns.flatMap((campaign) => campaign.concepts.map((concept) => `${AVATAR_NODE_PREFIX}${concept.avatarId}`)));
    for (const node of avatarFlowNodes) if (wantedAvatars.has(node.id)) rects.push({ ...node.position, width: 240, height: 120 });
    if (!rects.length) return;
    const left = Math.min(...rects.map((rect) => rect.x));
    const top = Math.min(...rects.map((rect) => rect.y));
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!canvas) return;
    const bounds = { x: left, y: top, width: Math.max(...rects.map((rect) => rect.x + rect.width)) - left, height: Math.max(...rects.map((rect) => rect.y + rect.height)) - top };
    void reactFlow.setViewport(getViewportForBounds(bounds, canvas.width, canvas.height, 0.25, 0.9, 0.15), { duration: 400 });
  }, [activeProductId, avatarFlowNodes, campaigns, canvasRef, conceptFlowNodes, pageCampaigns, productNodes, reactFlow, reactFlowReady, resolvedPositions]);

  // The graph's first viewport is established once, after React Flow has
  // measured the root and the flex layout has resolved the real canvas size.
  // Subsequent resizes, drawer changes, theme changes, and generations leave
  // the user's camera untouched.
  useEffect(() => {
    if (!reactFlowReady || initialViewportAppliedRef.current || !productNodes.length) return;
    const rootNode = productNodes.find((node) => node.type === "product");
    if (!rootNode) return;
    let frame = 0;
    let attempts = 0;
    const applyInitialViewport = () => {
      const canvas = canvasRef.current;
      const measuredRoot = reactFlow.getNode(rootNode.id);
      const rootWidth =
        measuredRoot?.measured?.width ?? measuredRoot?.width ?? nodeSize(rootNode).width;
      const rootHeight =
        measuredRoot?.measured?.height ?? measuredRoot?.height ?? nodeSize(rootNode).height;
      if (!canvas || !canvas.clientWidth || !canvas.clientHeight || !measuredRoot || attempts < 2) {
        attempts += 1;
        if (attempts < 24) frame = window.requestAnimationFrame(applyInitialViewport);
        return;
      }
      const zoom = Math.min(reactFlow.getViewport().zoom || 1, 0.82);
      const targetCenterX = canvas.clientWidth * 0.38;
      const targetCenterY = canvas.clientHeight * 0.47;
      reactFlow.setViewport(
        {
          x: targetCenterX - (measuredRoot.position.x + rootWidth / 2) * zoom,
          y: targetCenterY - (measuredRoot.position.y + rootHeight / 2) * zoom,
          zoom,
        },
        { duration: 0 },
      );
      initialViewportAppliedRef.current = true;
    };
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(applyInitialViewport);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [productNodes, reactFlow, reactFlowReady]);

  const handleNodeChanges = useCallback(
    (changes: NodeChange<StrategyFlowNode>[]) => {
      applyRenderedNodeChanges(changes);
    },
    [applyRenderedNodeChanges],
  );

  const handleAllNodeChanges = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const layerOf = (change: NodeChange<CanvasFlowNode>) => {
        const id = changeNodeId(change);
        return id.startsWith(AVATAR_NODE_PREFIX)
          ? "avatar"
          : id.startsWith(CONCEPT_NODE_PREFIX) || id.startsWith(MERGER_NODE_PREFIX)
            ? "concept"
            : "strategy";
      };
      const inLayer = (layer: string) => changes.filter((change) => layerOf(change) === layer);
      const strategyChanges = inLayer("strategy");
      const avatarChanges = inLayer("avatar");
      const conceptChanges = inLayer("concept");
      if (strategyChanges.length) handleNodeChanges(strategyChanges as NodeChange<StrategyFlowNode>[]);
      if (avatarChanges.length)
        setRenderedAvatarNodes((nodes) =>
          applyNodeChanges(avatarChanges as NodeChange<AvatarFlowNode>[], nodes),
        );
      if (conceptChanges.length) applyLayerChanges(conceptChanges);
    },
    [applyLayerChanges, handleNodeChanges],
  );

  const edges: Edge<{ generationReveal?: boolean }>[] = useMemo(() => {
    const productIds = new Set(productNodes.filter((node) => node.type === "product").map((node) => node.id));
    const productPort = (parentId: string | null | undefined, childType: string | undefined) =>
      parentId && productIds.has(parentId) && childType ? productHandleFor(childType) : undefined;
    // A wire leaving the product wears the colour of the ingredient it feeds, at rest and lit.
    const productWire = (parentId: string | null | undefined, childType: string | undefined) =>
      parentId && productIds.has(parentId) ? (childType === "offer" ? "var(--type-offer)" : "var(--type-angle)") : undefined;
    const canonicalEdges = productNodes.flatMap((node) => {
      if (!node.parentId) return [];
      // Concepts branch visually from the avatar node, not the angle (see conceptLinkEdges).
      if (node.type === "creativeConcept") return [];
      // An edge is "in lineage" when both of its nodes are in the selected node's lineage.
      const inLineage =
        !lineageIds || (lineageIds.has(node.parentId) && lineageIds.has(node.id));
      const isGenerationEdge =
        generationExpansion?.state === "revealing" &&
        generationExpansion.parentNodeId === node.parentId &&
        generationNodeIds.has(node.id);
      const highlight = (inLineage && Boolean(lineageIds)) || isGenerationEdge;
      const wire = productWire(node.parentId, node.type);
      return [
        {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId,
          sourceHandle: productPort(node.parentId, node.type),
          target: node.id,
          type: highlight ? "prismLineage" : "default",
          data: isGenerationEdge ? { generationReveal: true } : undefined,
          animated: false,
          style: {
            stroke: wire ?? (highlight ? "var(--lineage-selected)" : "var(--lineage-default)"),
            strokeWidth: highlight ? 2.4 : 1.6,
            opacity: isGenerationEdge ? 1 : !lineageIds ? 0.9 : inLineage ? 1 : 0.1,
          },
          markerEnd: highlight
            ? {
                type: MarkerType.ArrowClosed,
                color: wire ?? "var(--lineage-selected)",
                width: 13,
                height: 13,
              }
            : undefined,
          zIndex: highlight ? 3 : 0,
        },
      ];
    });
    const smokeEdges =
      smokeTestPreview?.nodes.map((node) => ({
        id: `${smokeTestPreview.parentId}-${node.id}`,
        source: smokeTestPreview.parentId,
        sourceHandle: productPort(smokeTestPreview.parentId, node.type),
        target: node.id,
        type: "prismLineage",
        data: { generationReveal: true },
        animated: false,
        style: { stroke: productWire(smokeTestPreview.parentId, node.type) ?? "var(--lineage-selected)", strokeWidth: 2.4, opacity: 1 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: productWire(smokeTestPreview.parentId, node.type) ?? "var(--lineage-selected)",
          width: 13,
          height: 13,
        },
        zIndex: 3,
      })) ?? [];
    return [...canonicalEdges, ...smokeEdges];
  }, [
    generationExpansion,
    generationNodeIds,
    lineageIds,
    productNodes,
    smokeTestPreview,
  ]);

  // The product's top port feeds every persona on the canvas.
  const productAvatarEdges: Edge[] = useMemo(() => {
    const product = productNodes.find((node) => node.type === "product");
    if (!product || !avatarCanvas) return [];
    return [...onCanvasAvatarIds].map((avatarId) => ({
      id: `product-avatar-${avatarId}`,
      source: product.id,
      sourceHandle: PRODUCT_AVATAR_HANDLE_ID,
      target: `${AVATAR_NODE_PREFIX}${avatarId}`,
      targetHandle: AVATAR_FROM_PRODUCT_HANDLE_ID,
      type: "default",
      animated: false,
      style: { stroke: "var(--type-persona)", strokeWidth: 1.6, opacity: !lineageIds || selectedAvatarId === avatarId ? 0.9 : 0.1 },
      zIndex: 0,
    }));
  }, [avatarCanvas, lineageIds, onCanvasAvatarIds, productNodes, selectedAvatarId]);

  const avatarLinkEdges: Edge[] = useMemo(() => {
    if (!avatarCanvas) return [];
    return Object.entries(avatarCanvas.links)
      .filter(([avatarId]) => onCanvasAvatarIds.has(avatarId))
      .flatMap(([avatarId, angleIds]) =>
        (angleIds ?? []).map((angleId) => {
          const active = selectedAvatarId === avatarId;
          const color = comboColorFor(avatarId, angleId);
          const inLineage =
            !lineageIds ||
            (focusedConcept ? avatarId === focusedConcept.avatarId && lineageIds.has(angleId) : lineageIds.has(angleId)) ||
            selectedAvatarId === avatarId;
          return {
            id: `avatar-link-${avatarId}-${angleId}`,
            source: `${AVATAR_NODE_PREFIX}${avatarId}`,
            sourceHandle: AVATAR_ANGLE_HANDLE_ID,
            target: angleId,
            targetHandle: AVATAR_LINK_HANDLE_ID,
            type: "avatarLink",
            data: { avatarId, angleId, active },
            selected: active,
            animated: active,
            style: {
              stroke: color,
              strokeWidth: active ? 3.6 : 2.4,
              strokeDasharray: active ? undefined : "6 4",
              opacity: active ? 1 : inLineage ? 0.8 : 0.08,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color,
              width: active ? 15 : 13,
              height: active ? 15 : 13,
            },
            zIndex: active ? 6 : 4,
          };
        }),
      );
  }, [avatarCanvas, focusedConcept, lineageIds, onCanvasAvatarIds, selectedAvatarId]);

  // Creative Concepts branch off the avatar node's right side into each concept's left.
  const conceptLinkEdges: Edge[] = useMemo(() => {
    if (!avatarCanvas) return [];
    return productNodes.flatMap((node) => {
      if (node.type !== "creativeConcept") return [];
      const avatarId = "avatarId" in node ? (node.avatarId as string | undefined) : undefined;
      if (!avatarId || !onCanvasAvatarIds.has(avatarId) || !node.parentId) return [];
      const color = comboColorFor(avatarId, node.parentId);
      const inLineage =
        !lineageIds || lineageIds.has(node.id) || selectedAvatarId === avatarId;
      return [
        {
          id: `concept-link-${avatarId}-${node.id}`,
          source: `${AVATAR_NODE_PREFIX}${avatarId}`,
          sourceHandle: AVATAR_CONCEPT_HANDLE_ID,
          target: node.id,
          type: "default",
          animated: false,
          style: { stroke: color, strokeWidth: 2.2, opacity: inLineage ? 0.85 : 0.08 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 13, height: 13 },
          zIndex: 2,
        },
      ];
    });
  }, [avatarCanvas, lineageIds, onCanvasAvatarIds, productNodes, selectedAvatarId]);

  // An ad set is a joint: its persona, angle and offer flow into it. Every ad set draws all three, muted until
  // it is selected. Each edge wears its ingredient's colour, so it matches the port it lands on. Ad sets that
  // belong to a merger (lib/merger-rule.ts) take the two shared ingredients through it instead: the ingredient
  // wires run into the merger once, and the merger sends one wire to each ad set.
  const junctionEdges: Edge[] = useMemo(() => {
    const look = (color: string, chosen: boolean, lit: boolean) => ({
      style: chosen
        ? { stroke: color, strokeWidth: 2.6, strokeDasharray: "6 4", opacity: 1 }
        : { stroke: color, strokeWidth: 1.4, opacity: lit ? 0.5 : 0.06 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: chosen ? 13 : 10, height: chosen ? 13 : 10 },
      zIndex: chosen ? 6 : 2,
    });
    const slotOf = (axis: MergeAxis): SlotAxis => (axis === "persona" ? "avatar" : axis);
    const deletable = (onDelete: () => void, deleteLabel: string) => ({ type: "junctionLink" as const, data: { onDelete, deleteLabel } });
    const sourceFor = (axis: MergeAxis, id: string) =>
      axis === "persona" ? { source: `${AVATAR_NODE_PREFIX}${id}`, sourceHandle: AVATAR_CONCEPT_HANDLE_ID } : { source: id };
    const direct = pageCampaigns.flatMap((campaign) =>
      campaign.concepts.flatMap((concept) => {
        const chosen = selectedConceptId === concept.id;
        const lit = isAdSetLit(concept);
        const target = `${CONCEPT_NODE_PREFIX}${concept.id}`;
        const merged = mergerByConcept.get(concept.id);
        const viaMerger = (axis: MergeAxis) => Boolean(merged?.axes.includes(axis));
        const edges: Edge[] = [];
        if (!viaMerger("persona") && liveAvatarIds.has(concept.avatarId) && onCanvasAvatarIds.has(concept.avatarId)) {
          edges.push({ id: `junction-avatar-${concept.id}`, ...sourceFor("persona", concept.avatarId), target, targetHandle: CONCEPT_IN_AVATAR, ...look(AXIS_COLOR.persona, chosen, lit), ...deletable(() => void unlinkConcept(concept.id, "avatar"), "Remove the persona link") });
        }
        if (!viaMerger("angle") && liveNodeIds.has(concept.angleId)) {
          edges.push({ id: `junction-angle-${concept.id}`, source: concept.angleId, target, targetHandle: CONCEPT_IN_ANGLE, ...look(AXIS_COLOR.angle, chosen, lit), ...deletable(() => void unlinkConcept(concept.id, "angle"), "Remove the angle link") });
        }
        if (!viaMerger("offer") && liveNodeIds.has(concept.offerId)) {
          edges.push({ id: `junction-offer-${concept.id}`, source: concept.offerId, target, targetHandle: CONCEPT_IN_OFFER, ...look(AXIS_COLOR.offer, chosen, lit), ...deletable(() => void unlinkConcept(concept.id, "offer"), "Remove the offer link") });
        }
        return edges;
      }),
    );
    const throughMergers = mergerPlans.flatMap((plan) => {
      const members = pageCampaigns.flatMap((campaign) => campaign.concepts).filter((concept) => plan.conceptIds.includes(concept.id));
      const anyChosen = members.some((concept) => concept.id === selectedConceptId);
      const anyLit = members.some((concept) => isAdSetLit(concept));
      const inputs: Edge[] = plan.axes.map((axis, index) => ({
        id: `${plan.id}:in-${axis}`,
        ...sourceFor(axis, plan.sharedIds[index]),
        target: plan.id,
        targetHandle: index === 0 ? MERGER_IN_A : MERGER_IN_B,
        ...look(AXIS_COLOR[axis], anyChosen, anyLit),
        // Cutting an ingredient's wire into the merger cuts it from every ad set the merger feeds.
        ...deletable(() => plan.conceptIds.forEach((conceptId) => void unlinkConcept(conceptId, slotOf(axis))), `Remove this ${slotOf(axis) === "avatar" ? "persona" : slotOf(axis)} link from all ${plan.conceptIds.length} ad sets`),
      }));
      const outputs: Edge[] = members.map((concept) => ({
        id: `${plan.id}:out-${concept.id}`,
        source: plan.id,
        sourceHandle: MERGER_OUT,
        target: `${CONCEPT_NODE_PREFIX}${concept.id}`,
        // The merged wire lands on the first of the two merged ports; the other merged port is fed by the same wire.
        targetHandle: AXIS_PORT[plan.axes[0]],
        ...look(MERGER_COLOR, selectedConceptId === concept.id, isAdSetLit(concept)),
        // Cutting an ad set's wire from the merger takes it out of the merger: both shared links are cut.
        ...deletable(() => plan.axes.forEach((axis) => void unlinkConcept(concept.id, slotOf(axis))), "Take this ad set out of the merger (cuts both shared links)"),
      }));
      return [...inputs, ...outputs];
    });
    return [...direct, ...throughMergers];
  }, [isAdSetLit, liveAvatarIds, liveNodeIds, mergerByConcept, mergerPlans, onCanvasAvatarIds, pageCampaigns, selectedConceptId, unlinkConcept]);

  const miniMapNodeColor = useCallback(
    (node: { type?: string; data?: { strategyNode?: StrategyNode; color?: string } }) => {
      if (node.type === "avatarNode") return "var(--type-persona)";
      if (node.type === "conceptNode") return node.data?.color ?? "var(--ink)";
      if (node.type === "mergerNode") return MERGER_COLOR;
      const sn = node.data?.strategyNode;
      if (!sn) return "#c7ccd2";
      if (sn.type === "product") return "#15171a";
      if (sn.type === "angle") return "var(--type-angle)";
      if (sn.type === "offer") return "var(--type-offer)";
      if (sn.type === "creativeConcept" && "avatarId" in sn && typeof sn.avatarId === "string" && sn.parentId) {
        return comboColorFor(sn.avatarId, sn.parentId);
      }
      return "#9aa1a9";
    },
    [comboColorFor],
  );

  useEffect(() => {
    if (!generationExpansion) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: number | undefined;
    if (generationExpansion.state === "success") {
      // Fast responses still get a readable perimeter pass, without delaying
      // the completed graph longer than the interaction needs.
      const minimumPendingTime = 260;
      const wait = Math.max(0, minimumPendingTime - (Date.now() - generationExpansion.startedAt));
      const completionAndHold = reducedMotion ? 0 : 330;
      timer = window.setTimeout(
        () => revealGenerationExpansion(generationExpansion.id),
        wait + completionAndHold,
      );
    }
    if (generationExpansion.state === "revealing") {
      if (selectedNodeId !== generationExpansion.parentNodeId) {
        settleGenerationExpansion(generationExpansion.id);
        return;
      }
      const controller = new AbortController();
      let firstFrame = 0;
      let secondFrame = 0;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          void animateChildGeneration({
            parentNodeId: generationExpansion.parentNodeId,
            childNodeIds: generationExpansion.newNodeIds,
            childEdgeIds: generationExpansion.newNodeIds.map(
              (id) => `${generationExpansion.parentNodeId}-${id}`,
            ),
            duration: 650,
            signal: controller.signal,
            onComplete: () => settleGenerationExpansion(generationExpansion.id),
          });
        });
      });
      return () => {
        controller.abort();
        if (firstFrame) window.cancelAnimationFrame(firstFrame);
        if (secondFrame) window.cancelAnimationFrame(secondFrame);
      };
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [generationExpansion, revealGenerationExpansion, selectedNodeId, settleGenerationExpansion]);

  // Right-drag on the canvas draws a box; on release every node it touches is selected.
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeActive = marquee !== null;
  const finishMarquee = useCallback(() => {
    const box = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    // A plain right-click is not a box.
    if (!box || (Math.abs(box.x1 - box.x0) < 4 && Math.abs(box.y1 - box.y0) < 4)) return;
    const start = reactFlow.screenToFlowPosition({ x: Math.min(box.x0, box.x1), y: Math.min(box.y0, box.y1) });
    const end = reactFlow.screenToFlowPosition({ x: Math.max(box.x0, box.x1), y: Math.max(box.y0, box.y1) });
    const hits = reactFlow.getIntersectingNodes({ x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y }, true);
    selectNode(null);
    selectAvatar(null);
    selectConcept(null);
    closeCampaignPanel();
    setBoxIds(hits.map((node) => node.id));
  }, [closeCampaignPanel, reactFlow, selectAvatar, selectConcept, selectNode]);
  // The box starts on a right-button press over the canvas itself (not over a node, a control or the mini map).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = (event: PointerEvent) => {
      if (event.button !== 2) return;
      if ((event.target as HTMLElement).closest(".react-flow__node, .react-flow__panel, .react-flow__controls, .react-flow__minimap")) return;
      const box = { x0: event.clientX, y0: event.clientY, x1: event.clientX, y1: event.clientY };
      marqueeRef.current = box;
      setMarquee(box);
    };
    canvas.addEventListener("pointerdown", start);
    return () => canvas.removeEventListener("pointerdown", start);
  }, [canvasRef]);
  useEffect(() => {
    if (!marqueeActive) return;
    const move = (event: PointerEvent) => {
      const current = marqueeRef.current;
      if (!current) return;
      const next = { ...current, x1: event.clientX, y1: event.clientY };
      marqueeRef.current = next;
      setMarquee(next);
    };
    const end = () => finishMarquee();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [finishMarquee, marqueeActive]);
  // Selecting something else, or opening another product or page, ends the box selection.
  useEffect(
    () =>
      useAppStore.subscribe((state, previous) => {
        const picked =
          (state.selectedNodeId && state.selectedNodeId !== previous.selectedNodeId) ||
          (state.selectedAvatarId && state.selectedAvatarId !== previous.selectedAvatarId) ||
          (state.selectedConceptId && state.selectedConceptId !== previous.selectedConceptId) ||
          (state.avatarDetailId && state.avatarDetailId !== previous.avatarDetailId);
        if (picked || state.activeProductId !== previous.activeProductId || state.activeCampaignId !== previous.activeCampaignId) {
          setBoxIds((current) => (current.length ? [] : current));
        }
      }),
    [],
  );

  return h(
    Fragment,
    null,
    marquee
      ? h("div", {
          className: "pointer-events-none fixed z-30 rounded-sm border border-lineage bg-lineage/10",
          style: {
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          },
          "aria-hidden": true,
        })
      : null,
    h(
      "div",
      {
        className: "absolute inset-0",
        // The box uses the right button, so the browser's menu stays out of the way on the canvas.
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onDragOver: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes(AVATAR_DRAG_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        },
        onDrop: (event: React.DragEvent) => {
          const avatarId = event.dataTransfer.getData(AVATAR_DRAG_MIME);
          if (!avatarId) return;
          event.preventDefault();
          const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
          placeAvatarOnCanvas(avatarId, position);
          selectAvatar(avatarId);
        },
      },
      h(
        ReactFlow<CanvasFlowNode>,
        {
          nodes: [...renderedNodes, ...renderedAvatarNodes, ...renderedConceptNodes, ...renderedMergerNodes],
          edges: [...edges, ...productAvatarEdges, ...avatarLinkEdges, ...conceptLinkEdges, ...junctionEdges],
          nodeTypes,
          edgeTypes,
          onNodesChange: handleAllNodeChanges,
          onNodeClick: (_event, node) => {
            setBoxIds([]);
            if (pendingLink) {
              // A link is waiting: an ad set with that slot open takes it; anything else just cancels.
              const conceptId = node.id.startsWith(CONCEPT_NODE_PREFIX) ? node.id.slice(CONCEPT_NODE_PREFIX.length) : null;
              const target = conceptId ? pageCampaigns.flatMap((campaign) => campaign.concepts).find((concept) => concept.id === conceptId) : undefined;
              if (conceptId && target && slotOpen(target, pendingLink.axis)) void relinkConcept(conceptId, pendingLink.axis, pendingLink.ingredientId);
              cancelLink();
              return;
            }
            if (node.id.startsWith(MERGER_NODE_PREFIX)) return;
            if (node.id.startsWith(CONCEPT_NODE_PREFIX)) {
              selectConcept(node.id.slice(CONCEPT_NODE_PREFIX.length));
              return;
            }
            if (node.id.startsWith(AVATAR_NODE_PREFIX)) {
              const avatarId = node.id.slice(AVATAR_NODE_PREFIX.length);
              selectAvatar(selectedAvatarId === avatarId ? null : avatarId);
              return;
            }
            const clicked = productNodes.find((candidate) => candidate.id === node.id);
            if (selectedAvatarId) {
              if (clicked?.type === "angle") {
                linkAvatarToAngle(selectedAvatarId, clicked.id);
                return;
              }
            }
            selectNode(node.id);
          },
          // Dragging a node that is not in the box selection leaves the box behind.
          onNodeDragStart: (_event, node) => {
            if (boxIds.length && !boxSet.has(node.id)) setBoxIds([]);
          },
          // Every node that moved is saved, so a selected group keeps its shape.
          onNodeDragStop: (_event, node, dragged) => {
            const moved = dragged?.length ? dragged : [node];
            const adSetIds: string[] = [];
            let strategyMoved = false;
            for (const item of moved) {
              if (item.id.startsWith(MERGER_NODE_PREFIX)) continue;
              if (item.id.startsWith(CONCEPT_NODE_PREFIX)) {
                saveConceptPosition(item.id.slice(CONCEPT_NODE_PREFIX.length), item.position.x, item.position.y);
                adSetIds.push(item.id);
                continue;
              }
              if (item.id.startsWith(AVATAR_NODE_PREFIX)) {
                placeAvatarOnCanvas(item.id.slice(AVATAR_NODE_PREFIX.length), { x: item.position.x, y: item.position.y });
                continue;
              }
              const strategyNode = productNodes.find((candidate) => candidate.id === item.id);
              if (!strategyNode) continue;
              stablePositionsRef.current.set(item.id, { x: item.position.x, y: item.position.y });
              void saveNodePosition(item.id, item.position.x, item.position.y);
              strategyMoved = true;
            }
            if (adSetIds.length) clearDragOverrides(adSetIds);
            if (strategyMoved) setPositionRevision((revision) => revision + 1);
          },
          onPaneClick: () => {
            cancelLink();
            setBoxIds([]);
            selectNode(null);
            selectAvatar(null);
            selectConcept(null);
            closeCampaignPanel();
          },
          minZoom: 0.25,
          maxZoom: 1.5,
          onInit: () => setReactFlowReady(true),
          proOptions: { hideAttribution: true },
          nodesDraggable: true,
          nodesConnectable: false,
          deleteKeyCode: null,
          // The app has no multi-selection, so React Flow must not start its own on Shift/Ctrl-click.
          multiSelectionKeyCode: null,
          selectionKeyCode: null,
          className: "strategy-grid",
          colorMode: preference === "dark" ? "dark" : "light",
        },
        h(Background, { variant: BackgroundVariant.Dots, gap: 18, size: 0.7, color: "transparent" }),
        h(Controls, {
          showInteractive: false,
          position: "bottom-left",
          "aria-label": "Canvas zoom controls",
        }),
        h(MiniMap, {
          position: "bottom-left",
          pannable: true,
          zoomable: true,
          ariaLabel: "Canvas mini map",
          // Sits to the right of the zoom Controls and just above the breadcrumb Panel.
          className:
            "!bottom-[62px] !left-[56px] !m-0 !h-[104px] !w-[172px] overflow-hidden rounded-md " +
            "border border-[#DDE0E4] !bg-white shadow-[0_2px_10px_rgba(21,23,26,.12)]",
          maskColor: "rgba(21,23,26,0.08)",
          nodeStrokeWidth: 2,
          nodeBorderRadius: 3,
          nodeColor: miniMapNodeColor,
        }),
        h(Panel, { position: "bottom-left", className: "!mb-[15px] !ml-[56px]" }, h(LineageBreadcrumb)),
        // The campaign dock (pages + add button) sits top-left, just under the Ingredients button.
        h(Panel, { position: "top-left", className: "!m-0 !ml-3 !mt-[76px]" }, h(CampaignPages)),
        // The ad-set count and "New ad set" (the ad set node in miniature) share the top-right corner.
        h(Panel, { position: "top-right", className: "!m-0 !mr-3 !mt-3 flex items-start gap-2" }, h(CanvasVitals), h(NewAdSetButton)),
      ),
      h(CanvasInteractionLayer),
    ),
    h(GenerationSatellites, {
      selected: productNodes.find((node) => node.id === selectedNodeId) ?? null,
    }),
  );
}

export function StrategyCanvas({ productNodes }: { productNodes: StrategyNode[] }) {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const canvasRef = useRef<HTMLElement | null>(null);
  return h(
    "section",
    {
      ref: canvasRef,
      className:
        "strategy-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden border-t border-[#E0E3E7] bg-canvas",
      "aria-label": "Strategy lineage canvas",
      "data-strategy-graph-root": true,
    },
    h(ReactFlowProvider, null, h(CanvasInner, { productNodes, canvasRef })),
  );
}
