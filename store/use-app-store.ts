"use client";

import { useGenerationSetup } from "@/store/generation-setup-store";
import { create } from "zustand";
import { api } from "@/api/api";
import { readLastView, saveLastView } from "@/lib/last-view";
import { createCampaignSlice, EMPTY_PICK, type CampaignSlice } from "@/store/campaign-slice";
import { MOCK_BRANDS } from "@/data/mock";
import {
  createProduct as createProductService,
  generateProductImage as generateProductImageService,
  setProductImage as setProductImageService,
  getProducts,
  inspectProductUrl,
} from "@/services/products";
import { setNextRequestShouldFail } from "@/services/mock-client";
import {
  generateCreativeExplorationAngles,
  generateCreativeExplorationOffers,
  generateCreativeExplorationTargetAvatars,
  getStrategy,
  getTargetAvatars,
  deleteTargetAvatarRemote,
  resetTargetAvatarsRemote,
  getAvatarCanvas,
  saveAvatarCanvasRemote,
  getLineageHistory,
  deleteStrategySubtree,
  updateStrategyNodePosition,
} from "@/services/strategy";
import { AI_MODEL_OPTIONS, TARGET_AVATAR_COUNT_BOUNDS } from "@/types/strategy";
import type {
  AiProvider,
  AppTab,
  SettingsSectionId,
  Brand,
  Product,
  ProductContext,
  StrategyNode,
  LineageHistoryEvent,
  TargetAvatar,
  AvatarCanvas,
} from "@/types/strategy";

/** Fire-and-forget persistence of a product's avatar canvas ({ positions, links }). */
function persistAvatarCanvas(productId: string, canvas: AvatarCanvas) {
  void saveAvatarCanvasRemote({ productId, canvas }).catch((error) => {
    console.error("[AVATAR CANVAS] Remote save failed; local state already updated.", error);
  });
}

const CANVAS_NODE_TYPES = new Set(["product", "angle", "offer"]);
const isCanvasNode = (node: StrategyNode) => CANVAS_NODE_TYPES.has(node.type);

export interface AppState extends CampaignSlice {
  brands: Brand[];
  products: Product[];
  /** The product whose own representative image is generating, or null. One at a time, same as an ad's cover image. */
  productImagePendingId: string | null;
  nodes: StrategyNode[];
  targetAvatarsByProduct: Record<string, TargetAvatar[]>;
  targetAvatarGenerationPending: boolean;
  targetAvatarCount: number;
  avatarCanvasByProduct: Record<string, AvatarCanvas>;
  selectedAvatarId: string | null;
  offerGenerationPending: boolean;
  targetAvatarInspectorOpen: boolean;
  /** What the prompt inspector is for while `targetAvatarInspectorOpen` is set. */
  inspectorKind: "avatar" | "angle" | "offer";
  avatarDetailId: string | null;
  lineageHistory: Record<string, LineageHistoryEvent[]>;
  historyUpdatedAt: number | null;
  activeBrandId: string;
  activeProductId: string | null;
  activeTab: AppTab;
  settingsSection: SettingsSectionId;
  selectedNodeId: string | null;
  generatingParentId: string | null;
  generationExpansion: {
    id: string;
    parentNodeId: string;
    newNodeIds: string[];
    children: StrategyNode[];
    startedAt: number;
    state: "pending" | "success" | "revealing";
  } | null;
  generationError: string | null;
  failNextGeneration: boolean;
  aiProvider: AiProvider;
  aiModels: Record<AiProvider, string>;
  setActiveBrand: (id: string) => void;
  setActiveProduct: (id: string | null) => void;
  setActiveTab: (tab: AppTab) => void;
  setSettingsSection: (section: SettingsSectionId) => void;
  /** Opens the personal settings page directly on `section`. */
  openSettings: (section: SettingsSectionId) => void;
  selectNode: (id: string | null) => void;
  setFailNextGeneration: (value: boolean) => void;
  setAiProvider: (provider: AiProvider) => void;
  setAiModel: (model: string) => void;
  clearGenerationError: () => void;
  loadWorkspace: () => Promise<void>;
  resetWorkspace: () => void;
  saveNodePosition: (nodeId: string, x: number, y: number) => Promise<void>;
  loadLineageHistory: (productId: string) => Promise<void>;
  deleteSelectedSubtree: () => Promise<void>;
  resetProductGenerations: () => Promise<void>;
  /** Deletes every angle, or every offer, of the active product. Ad sets that used them go with them. */
  resetIngredients: (kind: "angle" | "offer") => Promise<void>;
  /** Deletes angles or offers by id. Ad sets that used them go with them. */
  deleteIngredients: (ids: string[]) => Promise<void>;
  resetTargetAvatars: () => void;
  deleteTargetAvatar: (avatarId: string) => void;
  createProduct: (description: string) => Promise<void>;
  createProductFromContext: (context: ProductContext, imageUrl?: string | null) => Promise<void>;
  /** On demand only, from the product node itself. Never fired automatically at creation or elsewhere. */
  generateProductImage: (productId: string) => Promise<void>;
  /** A person's own choice from the media picker: an existing context image, or a captured video frame. */
  setProductImage: (productId: string, imageUrl: string) => Promise<void>;
  /** Expands a product into angles. It uses the selected product node, or the one given (the composer has none selected). */
  generateFromSelected: (productNodeId?: string) => Promise<void>;
  generateTargetAvatars: () => Promise<void>;
  setTargetAvatarCount: (count: number) => void;
  placeAvatarOnCanvas: (avatarId: string, position: { x: number; y: number }) => void;
  removeAvatarFromCanvas: (avatarId: string) => void;
  selectAvatar: (avatarId: string | null) => void;
  openTargetAvatarInspector: () => void;
  /** Opens the prompt drawer for the angles or the offers. */
  openIngredientInspector: (kind: "angle" | "offer") => void;
  closeTargetAvatarInspector: () => void;
  openAvatarDetail: (avatarId: string) => void;
  closeAvatarDetail: () => void;
  linkAvatarToAngle: (avatarId: string, angleId: string) => void;
  unlinkAvatarAngle: (avatarId: string, angleId: string) => void;
  generateOffers: () => Promise<void>;
  revealGenerationExpansion: (id: string) => void;
  settleGenerationExpansion: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get, store) => ({
  ...createCampaignSlice(set, get, store),
  brands: MOCK_BRANDS,
  products: [],
  productImagePendingId: null,
  nodes: [],
  targetAvatarsByProduct: {},
  targetAvatarGenerationPending: false,
  targetAvatarCount: TARGET_AVATAR_COUNT_BOUNDS.default,
  avatarCanvasByProduct: {},
  selectedAvatarId: null,
  offerGenerationPending: false,
  targetAvatarInspectorOpen: false,
  inspectorKind: "avatar",
  avatarDetailId: null,
  lineageHistory: {},
  historyUpdatedAt: null,
  activeBrandId: "brand-northstar",
  activeProductId: null,
  activeTab: "strategy",
  settingsSection: "profile",
  selectedNodeId: null,
  generatingParentId: null,
  generationExpansion: null,
  generationError: null,
  failNextGeneration: false,
  aiProvider: "openai",
  aiModels: {
    openai: AI_MODEL_OPTIONS.openai[1].id,
    anthropic: AI_MODEL_OPTIONS.anthropic[1].id,
    deepseek: AI_MODEL_OPTIONS.deepseek[0].id,
    gemini: AI_MODEL_OPTIONS.gemini[0].id,
    perplexity: AI_MODEL_OPTIONS.perplexity[1].id,
  },

  setActiveBrand: (id) =>
    set((state) => ({
      activeBrandId: id,
      activeProductId: state.products.find((product) => product.brandId === id)?.id ?? null,
      selectedNodeId: null,
      activeTab: "strategy",
      generationError: null,
    })),
  setActiveProduct: (id) =>
    set((state) => ({
      activeProductId: id,
      activeCampaignId: id ? (state.campaignsByProduct[id]?.[0]?.id ?? null) : null,
      composerKind: null,
      composePick: EMPTY_PICK,
      selectedConceptId: null,
      campaignError: null,
      selectedNodeId: null,
      activeTab: "strategy",
      generationError: null,
      targetAvatarInspectorOpen: false,
      avatarDetailId: null,
    })),
  setActiveTab: (tab) => set({ activeTab: tab, generationError: null }),
  setSettingsSection: (section) => set({ settingsSection: section }),
  openSettings: (section) =>
    set({ activeTab: "profile", settingsSection: section, generationError: null }),
  selectNode: (id) =>
    set((state) => ({
      selectedNodeId: id,
      composerKind: id ? null : state.composerKind,
      selectedConceptId: id ? null : state.selectedConceptId,
      campaignPanelOpen: id ? false : state.campaignPanelOpen,
      generationError: null,
      targetAvatarInspectorOpen: id ? false : state.targetAvatarInspectorOpen,
      avatarDetailId: id ? null : state.avatarDetailId,
      selectedAvatarId: id ? null : state.selectedAvatarId,
    })),
  setFailNextGeneration: (value) => set({ failNextGeneration: value }),
  setAiProvider: (provider) => set({ aiProvider: provider, generationError: null }),
  setAiModel: (model) =>
    set((state) => ({
      aiModels: { ...state.aiModels, [state.aiProvider]: model },
      generationError: null,
    })),
  clearGenerationError: () => set({ generationError: null }),
  loadWorkspace: async () => {
    const products = await getProducts();
    const [creativeExplorations, avatarSets, avatarCanvases, campaignSets] = await Promise.all([
      Promise.all(
        products.map((product) =>
          getStrategy({ productId: product.id, lineageMode: "creative_exploration" }),
        ),
      ),
      Promise.all(products.map((product) => getTargetAvatars({ productId: product.id }))),
      Promise.all(products.map((product) => getAvatarCanvas({ productId: product.id }))),
      Promise.all(products.map((product) => api.campaigns({ productId: product.id }).catch(() => []))),
    ]);
    const campaignsByProduct = Object.fromEntries(products.map((product, index) => [product.id, campaignSets[index]]));
    // Nodes saved by the removed Strategy Lineage mode, or by the removed Creative Concept and Direction steps, stay in
    // the database but are no longer shown. Only the product, its angles and its offers are part of the canvas.
    const creativeExplorationNodes = creativeExplorations.flat().filter(isCanvasNode);
    const targetAvatarsByProduct: Record<string, TargetAvatar[]> = {};
    const avatarCanvasByProduct: Record<string, AvatarCanvas> = {};
    products.forEach((product, index) => {
      const avatars = avatarSets[index];
      if (avatars.length > 0) targetAvatarsByProduct[product.id] = avatars;
      const canvas = avatarCanvases[index];
      if (canvas && (Object.keys(canvas.positions ?? {}).length || Object.keys(canvas.links ?? {}).length)) {
        avatarCanvasByProduct[product.id] = {
          positions: canvas.positions ?? {},
          links: canvas.links ?? {},
        };
      }
    });
    // On a fresh start, land where the person left off: the same page, and the same product if it is still there.
    const remembered = get().activeProductId === null ? readLastView() : null;
    const wantedProduct = get().activeProductId ?? remembered?.productId ?? null;
    const activeProductId = products.some((product) => product.id === wantedProduct) ? wantedProduct : (products[0]?.id ?? null);
    const restoreView = remembered && (remembered.tab === "profile" || (activeProductId !== null && activeProductId === remembered.productId));
    set({
      products,
      nodes: creativeExplorationNodes,
      lineageHistory: {},
      targetAvatarsByProduct,
      targetAvatarGenerationPending: false,
      avatarCanvasByProduct,
      selectedAvatarId: null,
      targetAvatarInspectorOpen: false,
      avatarDetailId: null,
      activeProductId,
      ...(restoreView ? { activeTab: remembered.tab, settingsSection: remembered.settingsSection } : {}),
      campaignsByProduct,
      activeCampaignId: campaignsByProduct[activeProductId ?? ""]?.[0]?.id ?? null,
      composePick: EMPTY_PICK,
      selectedConceptId: null,
      selectedNodeId: null,
      generationExpansion: null,
      generationError: null,
    });
  },
  resetWorkspace: () =>
    set({
      products: [],
      nodes: [],
      targetAvatarsByProduct: {},
      targetAvatarGenerationPending: false,
      avatarCanvasByProduct: {},
      selectedAvatarId: null,
      targetAvatarInspectorOpen: false,
      avatarDetailId: null,
      activeProductId: null,
      campaignsByProduct: {},
      composerKind: null,
      activeCampaignId: null,
      composePick: EMPTY_PICK,
      selectedConceptId: null,
      selectedNodeId: null,
      generationExpansion: null,
      generationError: null,
    }),
  saveNodePosition: async (nodeId, x, y) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, positionX: x, positionY: y } : node,
      ) as StrategyNode[],
    }));
    await updateStrategyNodePosition({ nodeId, x, y });
  },
  loadLineageHistory: async (productId) => {
    const history = await getLineageHistory({ productId });
    set((state) => ({ lineageHistory: { ...state.lineageHistory, [productId]: history } }));
  },
  deleteSelectedSubtree: async () => {
    const selectedNodeId = get().selectedNodeId;
    const node = get().nodes.find((item) => item.id === selectedNodeId);
    if (!node || node.type === "product") return;
    try {
      const event = await deleteStrategySubtree({ nodeId: node.id });
      const removed = new Set(event.removedNodes.map((item) => item.id));
      set((state) => ({
        nodes: state.nodes.filter((item) => !removed.has(item.id)),
        selectedNodeId: null,
        lineageHistory: { ...state.lineageHistory, [node.productId]: [event, ...(state.lineageHistory[node.productId] ?? [])] },
        historyUpdatedAt: Date.now(),
      }));
      void get().reconcileCampaigns(node.productId);
    } catch (error) {
      const [strategy, history] = await Promise.all([
        getStrategy({ productId: node.productId, lineageMode: "creative_exploration" }),
        getLineageHistory({ productId: node.productId }),
      ]);
      set((state) => ({
        nodes: [...state.nodes.filter((item) => item.productId !== node.productId), ...strategy],
        selectedNodeId: null,
        lineageHistory: { ...state.lineageHistory, [node.productId]: history },
        generationError: error instanceof Error ? error.message : "Lineage deletion failed.",
      }));
    }
  },

  resetProductGenerations: async () => {
    const state = get();
    const productId = state.activeProductId;
    if (!productId) return;
    const rootChildren = state.nodes.filter(
      (node) => node.productId === productId && node.parentId === productId,
    );
    if (!rootChildren.length) return;
    try {
      const events = await Promise.all(
        rootChildren.map((child) => deleteStrategySubtree({ nodeId: child.id })),
      );
      const removed = new Set(events.flatMap((event) => event.removedNodes.map((item) => item.id)));
      set((current) => ({
        nodes: current.nodes.filter((item) => !removed.has(item.id)),
        selectedNodeId: null,
        generationExpansion: null,
        lineageHistory: {
          ...current.lineageHistory,
          [productId]: [...events, ...(current.lineageHistory[productId] ?? [])],
        },
        historyUpdatedAt: Date.now(),
      }));
      void get().reconcileCampaigns(productId);
    } catch (error) {
      const [strategy, history] = await Promise.all([
        getStrategy({ productId, lineageMode: "creative_exploration" }),
        getLineageHistory({ productId }),
      ]);
      set((current) => ({
        nodes: [...current.nodes.filter((item) => item.productId !== productId), ...strategy],
        selectedNodeId: null,
        lineageHistory: { ...current.lineageHistory, [productId]: history },
        generationError: error instanceof Error ? error.message : "Reset failed. Please try again.",
      }));
    }
  },

  resetIngredients: async (kind) => {
    const productId = get().activeProductId;
    if (!productId) return;
    await get().deleteIngredients(get().nodes.filter((node) => node.productId === productId && node.type === kind).map((node) => node.id));
  },

  deleteIngredients: async (ids) => {
    const productId = get().activeProductId;
    if (!productId || !ids.length) return;
    try {
      const events = await Promise.all(ids.map((nodeId) => deleteStrategySubtree({ nodeId })));
      const removed = new Set(events.flatMap((event) => event.removedNodes.map((item) => item.id)));
      set((current) => ({
        nodes: current.nodes.filter((item) => !removed.has(item.id)),
        selectedNodeId: current.selectedNodeId && removed.has(current.selectedNodeId) ? null : current.selectedNodeId,
        lineageHistory: {
          ...current.lineageHistory,
          [productId]: [...events, ...(current.lineageHistory[productId] ?? [])],
        },
        historyUpdatedAt: Date.now(),
      }));
      void get().reconcileCampaigns(productId);
    } catch (error) {
      const [strategy, history] = await Promise.all([
        getStrategy({ productId, lineageMode: "creative_exploration" }),
        getLineageHistory({ productId }),
      ]);
      set((current) => ({
        nodes: [...current.nodes.filter((item) => item.productId !== productId), ...strategy],
        selectedNodeId: null,
        lineageHistory: { ...current.lineageHistory, [productId]: history },
        generationError: error instanceof Error ? error.message : "Reset failed. Please try again.",
      }));
    }
  },

  resetTargetAvatars: () => {
    const productId = get().activeProductId;
    if (!productId) return;
    set((state) => {
      const targetAvatarsByProduct = { ...state.targetAvatarsByProduct };
      delete targetAvatarsByProduct[productId];
      const avatarCanvasByProduct = { ...state.avatarCanvasByProduct };
      delete avatarCanvasByProduct[productId];
      return { targetAvatarsByProduct, avatarCanvasByProduct, selectedAvatarId: null };
    });
    void resetTargetAvatarsRemote({ productId })
      .then(() => get().reconcileCampaigns(productId))
      .catch((error) => {
        console.error("[TARGET AVATARS] Remote reset failed; local state already cleared.", error);
      });
    persistAvatarCanvas(productId, { positions: {}, links: {} });
  },

  deleteTargetAvatar: (avatarId) => {
    const productId = get().activeProductId;
    if (!productId) return;
    void deleteTargetAvatarRemote({ productId, avatarId })
      .then(() => get().reconcileCampaigns(productId))
      .catch((error) => {
        console.error("[TARGET AVATARS] Remote delete failed; local state already updated.", error);
      });
    set((state) => {
      const avatars = state.targetAvatarsByProduct[productId] ?? [];
      const targetAvatarsByProduct = {
        ...state.targetAvatarsByProduct,
        [productId]: avatars.filter((avatar) => avatar.id !== avatarId),
      };
      const currentCanvas = state.avatarCanvasByProduct[productId];
      let avatarCanvasByProduct = state.avatarCanvasByProduct;
      if (currentCanvas) {
        const positions = { ...currentCanvas.positions };
        delete positions[avatarId];
        const links = { ...currentCanvas.links };
        delete links[avatarId];
        const nextCanvas = { positions, links };
        avatarCanvasByProduct = { ...state.avatarCanvasByProduct, [productId]: nextCanvas };
        persistAvatarCanvas(productId, nextCanvas);
      }
      return {
        targetAvatarsByProduct,
        avatarCanvasByProduct,
        selectedAvatarId: state.selectedAvatarId === avatarId ? null : state.selectedAvatarId,
        avatarDetailId: state.avatarDetailId === avatarId ? null : state.avatarDetailId,
      };
    });
  },

  createProduct: async (description) => {
    const trimmed = description.trim();
    const isUrl = trimmed.startsWith("http");
    const name = isUrl ? "New product" : trimmed.split(/[.!?]/)[0].slice(0, 42);
    // A pasted URL is the only quick-create input worth inspecting for a photo — free text has nothing to look
    // at. Best-effort only: a slow or failed inspection must never block creating the product, so it just leaves
    // the node photo-less, the same as any product made without a usable image source.
    let imageUrl: string | null = null;
    if (isUrl) {
      try {
        const inspection = await inspectProductUrl(trimmed);
        imageUrl = inspection.candidates.find((candidate) => candidate.imageUrl)?.imageUrl ?? null;
      } catch {
        imageUrl = null;
      }
    }
    const product = await createProductService({
      brandId: get().activeBrandId,
      name: name || "Untitled product",
      description,
      imageUrl,
    });
    const root: StrategyNode = {
      id: product.id,
      parentId: null,
      productId: product.id,
      type: "product",
      label: product.name,
      createdAt: product.createdAt,
      generated: true,
    };
    set((state) => ({
      products: [...state.products, product],
      nodes: [...state.nodes, root],
      activeProductId: product.id,
      selectedNodeId: product.id,
      activeTab: "strategy",
    }));
    // Product context is ready as soon as the product exists — get a first
    // Target Avatar pool in place automatically so the user finds one ready
    // rather than having to trigger generation themselves. They can still
    // regenerate or reset later.
    void get().generateTargetAvatars();
  },

  createProductFromContext: async (context, imageUrl = null) => {
    const product = await createProductService({
      brandId: get().activeBrandId,
      name: context.name,
      description: context.summary,
      contextId: context.id,
      imageUrl,
    });
    const root: StrategyNode = {
      id: product.id,
      parentId: null,
      productId: product.id,
      type: "product",
      label: product.name,
      createdAt: product.createdAt,
    };
    set((state) => ({
      products: [...state.products, product],
      nodes: [...state.nodes, root],
      activeProductId: product.id,
      selectedNodeId: product.id,
      activeTab: "strategy",
    }));
    // Same as createProduct: context is already ready here, so get a first
    // Target Avatar pool in place automatically.
    void get().generateTargetAvatars();
  },

  generateProductImage: async (productId) => {
    if (get().productImagePendingId) return;
    set({ productImagePendingId: productId, generationError: null });
    try {
      const product = await generateProductImageService(productId);
      set((state) => ({
        products: state.products.map((existing) => (existing.id === productId ? product : existing)),
        productImagePendingId: null,
      }));
    } catch (error) {
      set({
        productImagePendingId: null,
        generationError: error instanceof Error ? error.message : "Couldn't generate an image this time. Try again.",
      });
    }
  },

  setProductImage: async (productId, imageUrl) => {
    if (get().productImagePendingId) return;
    set({ productImagePendingId: productId, generationError: null });
    try {
      const product = await setProductImageService(productId, imageUrl);
      set((state) => ({
        products: state.products.map((existing) => (existing.id === productId ? product : existing)),
        productImagePendingId: null,
      }));
    } catch (error) {
      set({
        productImagePendingId: null,
        generationError: error instanceof Error ? error.message : "Couldn't set that image. Try again.",
      });
    }
  },

  revealGenerationExpansion: (id) =>
    set((state) => {
      const expansion = state.generationExpansion;
      if (!expansion || expansion.id !== id || expansion.state !== "success") return {};
      return {
        nodes: [...state.nodes, ...expansion.children],
        generationExpansion: { ...expansion, state: "revealing" },
      };
    }),

  settleGenerationExpansion: (id) =>
    set((state) => {
      const expansion = state.generationExpansion;
      if (!expansion || expansion.id !== id) return {};
      const newNodeIds = new Set(expansion.newNodeIds);
      return {
        nodes: state.nodes.map((node) =>
          newNodeIds.has(node.id) ? { ...node, generated: false } : node,
        ) as StrategyNode[],
        generatingParentId: null,
        generationExpansion: null,
      };
    }),

  /** Expands the product into angles. Angles are the only thing the canvas generates from a node. */
  generateFromSelected: async (productNodeId) => {
    const state = get();
    const parent = state.nodes.find((node) => node.id === (productNodeId ?? state.selectedNodeId));
    if (!parent || parent.type !== "product") return;

    if (state.failNextGeneration) setNextRequestShouldFail();
    const expansionId = `${parent.id}-${Date.now()}`;
    set({
      generatingParentId: parent.id,
      generationExpansion: {
        id: expansionId,
        parentNodeId: parent.id,
        newNodeIds: [],
        children: [],
        startedAt: Date.now(),
        state: "pending",
      },
      generationError: null,
      failNextGeneration: false,
    });
    try {
      const ai = { provider: state.aiProvider, model: state.aiModels[state.aiProvider] };
      // The sources selected in Generation Setup, if any; a run's instructions are spent once it has succeeded.
      const setup = useGenerationSetup.getState();
      const children: StrategyNode[] = await generateCreativeExplorationAngles({ productId: parent.productId, ai, context: setup.requestFor(parent.productId, "angles") });
      setup.finishRun(parent.productId, "angles");
      if (!children.length) {
        set({ generatingParentId: null, generationExpansion: null });
        return;
      }
      set({
        generationExpansion: {
          id: expansionId,
          parentNodeId: parent.id,
          newNodeIds: children.map((child) => child.id),
          children,
          startedAt: get().generationExpansion?.startedAt ?? Date.now(),
          state: "success" as const,
        },
      });
    } catch (error) {
      set({
        generatingParentId: null,
        generationExpansion: null,
        generationError:
          error instanceof Error ? error.message : "Generation failed. Please try again.",
      });
    }
  },

  generateTargetAvatars: async () => {
    const state = get();
    const productId = state.activeProductId;
    if (!productId || state.targetAvatarGenerationPending) return;
    set({ targetAvatarGenerationPending: true, generationError: null });
    try {
      const ai = { provider: state.aiProvider, model: state.aiModels[state.aiProvider] };
      const setup = useGenerationSetup.getState();
      const targetAvatars = await generateCreativeExplorationTargetAvatars({
        productId,
        ai,
        count: state.targetAvatarCount,
        context: setup.requestFor(productId, "targetAvatars"),
      });
      setup.finishRun(productId, "targetAvatars");
      set((current) => ({
        targetAvatarsByProduct: {
          ...current.targetAvatarsByProduct,
          [productId]: targetAvatars,
        },
        targetAvatarGenerationPending: false,
      }));
      // New personas replace the old set, and the backend drops ad sets that used the old ones.
      void get().reconcileCampaigns(productId);
    } catch (error) {
      set({
        targetAvatarGenerationPending: false,
        generationError:
          error instanceof Error ? error.message : "Target Avatar generation failed. Please try again.",
      });
    }
  },

  setTargetAvatarCount: (count) => {
    const clamped = Math.min(
      TARGET_AVATAR_COUNT_BOUNDS.max,
      Math.max(TARGET_AVATAR_COUNT_BOUNDS.min, Math.round(count) || TARGET_AVATAR_COUNT_BOUNDS.default),
    );
    set({ targetAvatarCount: clamped });
  },

  placeAvatarOnCanvas: (avatarId, position) => {
    const productId = get().activeProductId;
    if (!productId) return;
    let nextCanvas: AvatarCanvas | null = null;
    set((state) => {
      const current = state.avatarCanvasByProduct[productId] ?? { positions: {}, links: {} };
      nextCanvas = { ...current, positions: { ...current.positions, [avatarId]: position } };
      return {
        avatarCanvasByProduct: { ...state.avatarCanvasByProduct, [productId]: nextCanvas },
      };
    });
    if (nextCanvas) persistAvatarCanvas(productId, nextCanvas);
  },
  removeAvatarFromCanvas: (avatarId) => {
    const productId = get().activeProductId;
    if (!productId || !get().avatarCanvasByProduct[productId]) return;
    let nextCanvas: AvatarCanvas | null = null;
    set((state) => {
      const current = state.avatarCanvasByProduct[productId]!;
      const positions = { ...current.positions };
      delete positions[avatarId];
      const links = { ...current.links };
      delete links[avatarId];
      nextCanvas = { positions, links };
      return {
        avatarCanvasByProduct: { ...state.avatarCanvasByProduct, [productId]: nextCanvas },
        selectedAvatarId: state.selectedAvatarId === avatarId ? null : state.selectedAvatarId,
      };
    });
    if (nextCanvas) persistAvatarCanvas(productId, nextCanvas);
  },
  selectAvatar: (avatarId) =>
    set((state) => ({
      selectedAvatarId: avatarId,
      composerKind: avatarId ? null : state.composerKind,
      selectedConceptId: avatarId ? null : state.selectedConceptId,
      campaignPanelOpen: avatarId ? false : state.campaignPanelOpen,
      selectedNodeId: null,
      avatarDetailId: null,
      targetAvatarInspectorOpen: false,
    })),
  openTargetAvatarInspector: () =>
    set({
      targetAvatarInspectorOpen: true,
      inspectorKind: "avatar",
      composerKind: null,
      selectedConceptId: null,
      campaignPanelOpen: false,
      selectedNodeId: null,
      avatarDetailId: null,
      selectedAvatarId: null,
    }),
  openIngredientInspector: (kind) =>
    set({
      targetAvatarInspectorOpen: true,
      inspectorKind: kind,
      composerKind: null,
      selectedConceptId: null,
      campaignPanelOpen: false,
      selectedNodeId: null,
      avatarDetailId: null,
      selectedAvatarId: null,
    }),
  closeTargetAvatarInspector: () => set({ targetAvatarInspectorOpen: false }),
  openAvatarDetail: (avatarId) =>
    set({ avatarDetailId: avatarId, composerKind: null, selectedNodeId: null, targetAvatarInspectorOpen: false, selectedAvatarId: null }),
  closeAvatarDetail: () => set({ avatarDetailId: null }),
  linkAvatarToAngle: (avatarId, angleId) => {
    const productId = get().activeProductId;
    if (!productId) return;
    let nextCanvas: AvatarCanvas | null = null;
    set((state) => {
      const current = state.avatarCanvasByProduct[productId] ?? { positions: {}, links: {} };
      const existing = current.links[avatarId] ?? [];
      if (existing.includes(angleId)) return {};
      nextCanvas = { ...current, links: { ...current.links, [avatarId]: [...existing, angleId] } };
      return {
        avatarCanvasByProduct: { ...state.avatarCanvasByProduct, [productId]: nextCanvas },
      };
    });
    if (nextCanvas) persistAvatarCanvas(productId, nextCanvas);
  },
  unlinkAvatarAngle: (avatarId, angleId) => {
    const productId = get().activeProductId;
    if (!productId || !get().avatarCanvasByProduct[productId]) return;
    let nextCanvas: AvatarCanvas | null = null;
    set((state) => {
      const current = state.avatarCanvasByProduct[productId]!;
      const remaining = (current.links[avatarId] ?? []).filter((id) => id !== angleId);
      const links = { ...current.links };
      if (remaining.length) links[avatarId] = remaining;
      else delete links[avatarId];
      nextCanvas = { ...current, links };
      return { avatarCanvasByProduct: { ...state.avatarCanvasByProduct, [productId]: nextCanvas } };
    });
    if (nextCanvas) persistAvatarCanvas(productId, nextCanvas);
  },
  generateOffers: async () => {
    const state = get();
    const productId = state.activeProductId;
    if (!productId || state.offerGenerationPending) return;
    set({ offerGenerationPending: true, generationError: null });
    try {
      const ai = { provider: state.aiProvider, model: state.aiModels[state.aiProvider] };
      const setup = useGenerationSetup.getState();
      const offers = await generateCreativeExplorationOffers({ productId, ai, context: setup.requestFor(productId, "offers") });
      setup.finishRun(productId, "offers");
      set((current) => ({ nodes: [...current.nodes, ...offers], offerGenerationPending: false }));
    } catch (error) {
      set({
        offerGenerationPending: false,
        generationError:
          error instanceof Error ? error.message : "Offer generation failed. Please try again.",
      });
    }
  },
}));

// Keep the last page, product and settings section, so the app reopens where it was left. Nothing is saved before the
// workspace has loaded, or a reset would overwrite what was remembered.
useAppStore.subscribe((state, previous) => {
  if (state.products.length === 0) return;
  if (state.activeTab === previous.activeTab && state.activeProductId === previous.activeProductId && state.settingsSection === previous.settingsSection) return;
  saveLastView({ tab: state.activeTab, productId: state.activeProductId, settingsSection: state.settingsSection });
});
