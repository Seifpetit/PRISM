import type { StateCreator } from "zustand";
import { api, type AdPlanRequest } from "@/api/api";
import { expandPick, type ComposePick, type ConceptKey, type TestType } from "@/lib/campaign-rules";
import type { Campaign, CampaignAd, CampaignAdFields, CampaignConcept, CampaignKind } from "@/types/campaign";
import { useGenerationSetup } from "@/store/generation-setup-store";
import type { AppState } from "@/store/use-app-store";

/** Test campaigns on the canvas: what is picked, the active campaign, and edits to campaigns, ad sets and ads. */
export interface CampaignSlice {
  campaignsByProduct: Record<string, Campaign[]>;
  /** The campaign that "Add ad sets" adds into. */
  activeCampaignId: string | null;
  /** Personas, angles and offers picked on the canvas (shift-click) to become ad sets. */
  composePick: ComposePick;
  selectedConceptId: string | null;
  /** The campaign drawer (rename, test type, warnings, export) is open for the active campaign. */
  campaignPanelOpen: boolean;
  campaignError: string | null;
  campaignBusy: boolean;
  /** The campaign composer drawer: the kind of campaign being composed, or null while it is closed. */
  composerKind: CampaignKind | null;
  openComposer: (kind?: CampaignKind) => void;
  closeComposer: () => void;
  /** True while a ghost ad set follows the cursor, waiting to be dropped on the canvas. */
  adSetGhost: boolean;
  /** "New ad set": a ghost follows the cursor until a click drops an empty ad set there (Escape cancels). */
  startAdSetGhost: () => void;
  cancelAdSetGhost: () => void;
  /** Drops an empty ad set on the open campaign page at a canvas position and ends the ghost. */
  placeEmptyAdSet: (x: number, y: number) => Promise<void>;
  /** An ingredient waiting to be linked: the next click on an ad set with that slot empty links it. */
  pendingLink: { axis: "avatar" | "angle" | "offer"; ingredientId: string } | null;
  startLink: (axis: "avatar" | "angle" | "offer", ingredientId: string) => void;
  cancelLink: () => void;
  /** Cuts one ingredient link of an ad set. */
  unlinkConcept: (conceptId: string, slot: "avatar" | "angle" | "offer") => Promise<void>;
  /** Switches the canvas to a campaign's page. */
  openCampaignPage: (id: string) => void;
  /** Creates the campaign and its ad sets in one step. Resolves to whether that worked. */
  createCampaignFromComposer: (input: { kind: CampaignKind; testType: TestType; combos: ConceptKey[] }) => Promise<boolean>;
  openCampaignPanel: (id: string) => void;
  closeCampaignPanel: () => void;
  loadCampaigns: (productId: string) => Promise<void>;
  /**
   * Re-syncs after personas, angles or offers change. The backend removes ad sets whose persona, angle or
   * offer is gone, and picks that point at removed ingredients are dropped.
   */
  reconcileCampaigns: (productId: string) => Promise<void>;
  setActiveCampaign: (id: string | null) => void;
  createCampaign: (input?: { name?: string; kind?: CampaignKind; testType?: TestType; position?: { x: number; y: number } }) => Promise<void>;
  updateCampaign: (id: string, patch: { name?: string; kind?: CampaignKind; testType?: TestType }) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
  togglePick: (axis: "avatar" | "angle" | "offer", id: string) => void;
  clearPick: () => void;
  addPickedAsConcepts: () => Promise<void>;
  selectConcept: (id: string | null) => void;
  updateConcept: (
    id: string,
    patch: { startDate?: string | null; endDate?: string | null; spend?: number | null },
  ) => Promise<void>;
  saveConceptPosition: (id: string, x: number, y: number) => void;
  deleteConcept: (id: string) => Promise<void>;
  addAd: (conceptId: string, fields?: CampaignAdFields) => Promise<void>;
  updateAd: (
    conceptId: string,
    adId: string,
    patch: {
      format?: string;
      awareness?: string;
      title?: string | null;
      hook?: string | null;
      notes?: string | null;
      direction?: string | null;
      beats?: string[] | null;
      cta?: string | null;
    },
  ) => Promise<void>;
  deleteAd: (conceptId: string, adId: string) => Promise<void>;
  /** The ad set whose ads are being planned by AI right now, or null. */
  adPlanPendingId: string | null;
  /** Plans the ads inside one ad set with AI and adds them. The persona, angle and offer stay fixed. */
  generateAdPlan: (conceptId: string, options?: AdPlanRequest) => Promise<void>;
  /** The ad whose cover image is being generated right now, or null. */
  adImagePendingId: string | null;
  /** One ad's own cover image, on demand: for an ad made before thumbnails existed, or a retry after "failed". */
  generateAdImage: (conceptId: string, adId: string) => Promise<void>;
  /** The ad set open in the Creatives workspace. */
  creativesConceptId: string | null;
  /** Opens the Creatives workspace on one ad set. */
  openCreatives: (conceptId: string) => void;
  /** The ad open in the Creatives drawer. */
  creativesAdId: string | null;
  selectCreativeAd: (adId: string | null) => void;
  /** Whether the Creatives drawer shows the prompts behind ad generation. It shares the drawer with an open ad. */
  creativesPromptOpen: boolean;
  setCreativesPromptOpen: (open: boolean) => void;
  /** Asks the AI for other ways to open one ad. Returns them without saving; an empty list means it failed (see campaignError). */
  generateHookAlternatives: (adId: string) => Promise<string[]>;
  /** Points an ad set's removed persona, angle or offer at another one. */
  relinkConcept: (conceptId: string, slot: "avatar" | "angle" | "offer", ingredientId: string) => Promise<void>;
  clearCampaignError: () => void;
  /** The ad set being published to Meta right now, or null. */
  metaPublishPendingId: string | null;
  /** Publishes an ad set to Meta as a (paused) Campaign / Ad Set / Ads. Null return means it failed (see campaignError). */
  publishConceptToMeta: (
    conceptId: string,
    input: { pageId: string; destinationUrl: string; dailyBudgetCents: number },
  ) => Promise<{ publishedCount: number; notReadyCount: number } | null>;
}

export const EMPTY_PICK: ComposePick = { avatarIds: [], angleIds: [], offerIds: [] };

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export const createCampaignSlice: StateCreator<AppState, [], [], CampaignSlice> = (set, get) => {
  const replaceCampaign = (productId: string, next: Campaign) =>
    set((state) => ({
      campaignsByProduct: {
        ...state.campaignsByProduct,
        [productId]: (state.campaignsByProduct[productId] ?? []).map((campaign) => (campaign.id === next.id ? next : campaign)),
      },
    }));

  const findCampaign = (id: string) => {
    for (const [productId, campaigns] of Object.entries(get().campaignsByProduct)) {
      const campaign = campaigns.find((item) => item.id === id);
      if (campaign) return { productId, campaign };
    }
    return null;
  };

  const findConcept = (conceptId: string) => {
    for (const [productId, campaigns] of Object.entries(get().campaignsByProduct)) {
      for (const campaign of campaigns) {
        const concept = campaign.concepts.find((item) => item.id === conceptId);
        if (concept) return { productId, campaign, concept };
      }
    }
    return null;
  };

  /** Applies a change to one concept and keeps the rest of the campaign as it is. */
  const patchConcept = (conceptId: string, change: (concept: CampaignConcept) => CampaignConcept) => {
    const found = findConcept(conceptId);
    if (!found) return;
    replaceCampaign(found.productId, {
      ...found.campaign,
      concepts: found.campaign.concepts.map((concept) => (concept.id === conceptId ? change(concept) : concept)),
    });
  };

  return {
    campaignsByProduct: {},
    activeCampaignId: null,
    composePick: EMPTY_PICK,
    selectedConceptId: null,
    campaignPanelOpen: false,
    campaignError: null,
    campaignBusy: false,
    composerKind: null,
    adSetGhost: false,
    pendingLink: null,
    adPlanPendingId: null,
    adImagePendingId: null,
    creativesConceptId: null,
    creativesAdId: null,
    creativesPromptOpen: false,

    openComposer: (kind = "test") =>
      set({
        composerKind: kind,
        adSetGhost: false,
        pendingLink: null,
        campaignPanelOpen: false,
        selectedConceptId: null,
        selectedNodeId: null,
        selectedAvatarId: null,
        targetAvatarInspectorOpen: false,
        avatarDetailId: null,
        campaignError: null,
      }),
    closeComposer: () => set({ composerKind: null, campaignError: null }),

    startAdSetGhost: () => {
      const { activeProductId, campaignsByProduct, activeCampaignId } = get();
      const campaigns = activeProductId ? (campaignsByProduct[activeProductId] ?? []) : [];
      if (!campaigns.length) return;
      set({
        adSetGhost: true,
        pendingLink: null,
        activeCampaignId: campaigns.some((campaign) => campaign.id === activeCampaignId) ? activeCampaignId : campaigns[0].id,
        composerKind: null,
        campaignPanelOpen: false,
        selectedConceptId: null,
        selectedNodeId: null,
        selectedAvatarId: null,
        targetAvatarInspectorOpen: false,
        avatarDetailId: null,
        campaignError: null,
      });
    },
    cancelAdSetGhost: () => set({ adSetGhost: false }),

    placeEmptyAdSet: async (x, y) => {
      const campaignId = get().activeCampaignId;
      const found = campaignId ? findCampaign(campaignId) : null;
      set({ adSetGhost: false });
      if (!found) return;
      try {
        const created = await api.createEmptyCampaignConcept({ campaignId: found.campaign.id, positionX: x, positionY: y });
        replaceCampaign(found.productId, {
          ...(findCampaign(found.campaign.id)?.campaign ?? found.campaign),
          concepts: [...(findCampaign(found.campaign.id)?.campaign.concepts ?? found.campaign.concepts), { ...created, ads: created.ads ?? [] }],
        });
      } catch (error) {
        set({ campaignError: message(error, "Could not add the ad set.") });
      }
    },

    startLink: (axis, ingredientId) => set({ pendingLink: { axis, ingredientId }, adSetGhost: false }),
    cancelLink: () => set({ pendingLink: null }),

    unlinkConcept: async (conceptId, slot) => {
      set({ campaignError: null });
      try {
        const next = await api.unlinkCampaignConcept({ id: conceptId, slot });
        patchConcept(conceptId, (concept) => ({ ...concept, ...next, ads: concept.ads }));
      } catch (error) {
        set({ campaignError: message(error, "Could not remove the link.") });
      }
    },

    openCampaignPage: (id) =>
      set({
        activeCampaignId: id,
        composerKind: null,
        adSetGhost: false,
        pendingLink: null,
        campaignPanelOpen: false,
        selectedConceptId: null,
        selectedNodeId: null,
        selectedAvatarId: null,
        targetAvatarInspectorOpen: false,
        avatarDetailId: null,
        campaignError: null,
      }),

    createCampaignFromComposer: async ({ kind, testType, combos }) => {
      const productId = get().activeProductId;
      if (!productId || get().campaignBusy) return false;
      set({ campaignBusy: true, campaignError: null });
      try {
        const campaign = await api.createCampaignWithConcepts({ productId, kind, testType, combos });
        set((state) => ({
          campaignsByProduct: {
            ...state.campaignsByProduct,
            [productId]: [...(state.campaignsByProduct[productId] ?? []), campaign],
          },
          activeCampaignId: campaign.id,
          composePick: EMPTY_PICK,
          composerKind: null,
          campaignBusy: false,
        }));
        // What comes next is in the campaign drawer: its ad sets, and adding ads to them.
        get().openCampaignPanel(campaign.id);
        return true;
      } catch (error) {
        set({ campaignBusy: false, campaignError: message(error, "Could not create the campaign.") });
        return false;
      }
    },

    openCampaignPanel: (id) =>
      set((state) => ({
        activeCampaignId: id,
        campaignPanelOpen: true,
        composerKind: null,
        selectedConceptId: null,
        selectedNodeId: null,
        selectedAvatarId: null,
        targetAvatarInspectorOpen: false,
        avatarDetailId: null,
        campaignError: state.activeCampaignId === id ? state.campaignError : null,
      })),
    closeCampaignPanel: () => set({ campaignPanelOpen: false }),

    loadCampaigns: async (productId) => {
      try {
        const campaigns = await api.campaigns({ productId });
        set((state) => ({
          campaignsByProduct: { ...state.campaignsByProduct, [productId]: campaigns },
          activeCampaignId:
            state.activeCampaignId && campaigns.some((campaign) => campaign.id === state.activeCampaignId)
              ? state.activeCampaignId
              : state.activeProductId === productId
                ? (campaigns[0]?.id ?? null)
                : state.activeCampaignId,
          // Personas, angles or offers may have been removed since; drop picks that no longer exist.
          selectedConceptId: campaigns.some((c) => c.concepts.some((k) => k.id === state.selectedConceptId))
            ? state.selectedConceptId
            : null,
        }));
      } catch {
        // Campaigns are additive; a failed load must never stop the rest of the workspace from rendering.
        set((state) => ({ campaignsByProduct: { ...state.campaignsByProduct, [productId]: state.campaignsByProduct[productId] ?? [] } }));
      }
    },

    reconcileCampaigns: async (productId) => {
      await get().loadCampaigns(productId);
      set((state) => {
        const avatarIds = new Set((state.targetAvatarsByProduct[productId] ?? []).map((avatar) => avatar.id));
        const nodeIds = new Set(state.nodes.map((node) => node.id));
        return {
          composePick: {
            avatarIds: state.composePick.avatarIds.filter((id) => avatarIds.has(id)),
            angleIds: state.composePick.angleIds.filter((id) => nodeIds.has(id)),
            offerIds: state.composePick.offerIds.filter((id) => nodeIds.has(id)),
          },
        };
      });
    },

    setActiveCampaign: (id) => set({ activeCampaignId: id, campaignError: null }),

    createCampaign: async (input = {}) => {
      const productId = get().activeProductId;
      if (!productId || get().campaignBusy) return;
      set({ campaignBusy: true, campaignError: null });
      try {
        const campaign = await api.createCampaign({
          productId,
          name: input.name,
          kind: input.kind,
          testType: input.testType,
          positionX: input.position?.x,
          positionY: input.position?.y,
        });
        set((state) => ({
          campaignsByProduct: {
            ...state.campaignsByProduct,
            [productId]: [...(state.campaignsByProduct[productId] ?? []), campaign],
          },
          activeCampaignId: campaign.id,
          campaignBusy: false,
        }));
      } catch (error) {
        set({ campaignBusy: false, campaignError: message(error, "Could not create the campaign.") });
      }
    },

    updateCampaign: async (id, patch) => {
      const found = findCampaign(id);
      if (!found) return;
      set({ campaignError: null });
      try {
        const next = await api.updateCampaign({ id, ...patch });
        replaceCampaign(found.productId, next);
      } catch (error) {
        set({ campaignError: message(error, "Could not update the campaign.") });
      }
    },

    deleteCampaign: async (id) => {
      const found = findCampaign(id);
      if (!found) return;
      try {
        await api.deleteCampaign({ id });
        set((state) => {
          const remaining = (state.campaignsByProduct[found.productId] ?? []).filter((campaign) => campaign.id !== id);
          return {
            campaignsByProduct: { ...state.campaignsByProduct, [found.productId]: remaining },
            activeCampaignId: state.activeCampaignId === id ? (remaining[0]?.id ?? null) : state.activeCampaignId,
            campaignPanelOpen: state.activeCampaignId === id ? false : state.campaignPanelOpen,
            selectedConceptId: found.campaign.concepts.some((concept) => concept.id === state.selectedConceptId)
              ? null
              : state.selectedConceptId,
          };
        });
      } catch (error) {
        set({ campaignError: message(error, "Could not delete the campaign.") });
      }
    },

    togglePick: (axis, id) =>
      set((state) => {
        const key = axis === "avatar" ? "avatarIds" : axis === "angle" ? "angleIds" : "offerIds";
        const current = state.composePick[key];
        return {
          composePick: {
            ...state.composePick,
            [key]: current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
          },
          campaignError: null,
        };
      }),

    clearPick: () => set({ composePick: EMPTY_PICK, campaignError: null }),

    addPickedAsConcepts: async () => {
      const state = get();
      const productId = state.activeProductId;
      const campaign = (state.campaignsByProduct[productId ?? ""] ?? []).find((item) => item.id === state.activeCampaignId);
      if (!productId || !campaign || state.campaignBusy) return;
      const existing: ConceptKey[] = campaign.concepts;
      const { combos, error } = expandPick(state.composePick, campaign.testType, existing);
      if (error) {
        set({ campaignError: error });
        return;
      }
      set({ campaignBusy: true, campaignError: null });
      try {
        const { created, skipped } = await api.addCampaignConcepts({ campaignId: campaign.id, combos });
        set((current) => {
          const latest = (current.campaignsByProduct[productId] ?? []).map((item) =>
            item.id === campaign.id ? { ...item, concepts: [...item.concepts, ...created] } : item,
          );
          return {
            campaignsByProduct: { ...current.campaignsByProduct, [productId]: latest },
            composePick: EMPTY_PICK,
            campaignBusy: false,
            campaignError: skipped ? `${skipped} of those ad sets were already in this campaign, so they were skipped.` : null,
          };
        });
      } catch (error) {
        set({ campaignBusy: false, campaignError: message(error, "Could not add the ad sets.") });
      }
    },

    selectConcept: (id) =>
      set((state) => ({
        selectedConceptId: id,
        composerKind: id ? null : state.composerKind,
        campaignPanelOpen: id ? false : state.campaignPanelOpen,
        selectedNodeId: id ? null : state.selectedNodeId,
        selectedAvatarId: id ? null : state.selectedAvatarId,
        targetAvatarInspectorOpen: id ? false : state.targetAvatarInspectorOpen,
        avatarDetailId: id ? null : state.avatarDetailId,
      })),

    updateConcept: async (id, patch) => {
      set({ campaignError: null });
      try {
        const next = await api.updateCampaignConcept({ id, ...patch });
        patchConcept(id, (concept) => ({ ...concept, ...next, ads: concept.ads }));
      } catch (error) {
        set({ campaignError: message(error, "Could not update the ad set.") });
      }
    },

    relinkConcept: async (conceptId, slot, ingredientId) => {
      set({ campaignError: null });
      try {
        const next = await api.relinkCampaignConcept({ id: conceptId, [`${slot}Id`]: ingredientId });
        patchConcept(conceptId, (concept) => ({ ...concept, ...next, ads: concept.ads }));
      } catch (error) {
        set({ campaignError: message(error, "Could not relink the ad set.") });
      }
    },

    saveConceptPosition: (id, x, y) => {
      patchConcept(id, (concept) => ({ ...concept, positionX: x, positionY: y }));
      void api.updateCampaignConcept({ id, positionX: x, positionY: y }).catch(() => {});
    },

    deleteConcept: async (id) => {
      try {
        await api.deleteCampaignConcept({ id });
        const found = findConcept(id);
        if (found) {
          replaceCampaign(found.productId, { ...found.campaign, concepts: found.campaign.concepts.filter((concept) => concept.id !== id) });
        }
        set((state) => ({ selectedConceptId: state.selectedConceptId === id ? null : state.selectedConceptId }));
      } catch (error) {
        set({ campaignError: message(error, "Could not delete the ad set.") });
      }
    },

    addAd: async (conceptId, fields) => {
      set({ campaignError: null });
      try {
        const ad = await api.addCampaignAd({ conceptId, ...fields });
        patchConcept(conceptId, (concept) => ({ ...concept, ads: [...concept.ads, ad] }));
      } catch (error) {
        set({ campaignError: message(error, "Could not add the ad.") });
      }
    },

    updateAd: async (conceptId, adId, patch) => {
      set({ campaignError: null });
      try {
        const ad = await api.updateCampaignAd({ id: adId, ...patch });
        patchConcept(conceptId, (concept) => ({
          ...concept,
          ads: concept.ads.map((existing: CampaignAd) => (existing.id === adId ? ad : existing)),
        }));
      } catch (error) {
        set({ campaignError: message(error, "Could not update the ad.") });
      }
    },

    deleteAd: async (conceptId, adId) => {
      try {
        await api.deleteCampaignAd({ id: adId });
        patchConcept(conceptId, (concept) => ({ ...concept, ads: concept.ads.filter((existing) => existing.id !== adId) }));
      } catch (error) {
        set({ campaignError: message(error, "Could not delete the ad.") });
      }
    },

    generateAdPlan: async (conceptId, options) => {
      if (get().adPlanPendingId) return;
      set({ adPlanPendingId: conceptId, campaignError: null });
      try {
        const state = get();
        // The sources and run instructions chosen in the ad prompts drawer, if any; instructions are spent by a run.
        const setup = useGenerationSetup.getState();
        const context = state.activeProductId ? setup.requestFor(state.activeProductId, "adPlan") : undefined;
        const ads = await api.generateCampaignAdPlan({ conceptId, ai: { provider: state.aiProvider, model: state.aiModels[state.aiProvider] }, ...(options ? { options } : {}), ...(context ? { context } : {}) });
        if (state.activeProductId) setup.finishRun(state.activeProductId, "adPlan");
        patchConcept(conceptId, (concept) => ({ ...concept, ads: [...concept.ads, ...ads] }));
        set({ adPlanPendingId: null });
      } catch (error) {
        set({ adPlanPendingId: null, campaignError: message(error, "Could not plan the ads. Try again.") });
      }
    },

    generateAdImage: async (conceptId, adId) => {
      if (get().adImagePendingId) return;
      set({ adImagePendingId: adId, campaignError: null });
      try {
        const ad = await api.generateCampaignAdImage({ id: adId });
        patchConcept(conceptId, (concept) => ({
          ...concept,
          ads: concept.ads.map((existing: CampaignAd) => (existing.id === adId ? ad : existing)),
        }));
        set({ adImagePendingId: null });
      } catch (error) {
        set({ adImagePendingId: null, campaignError: message(error, "Could not generate a cover image. Try again.") });
      }
    },

    openCreatives: (conceptId) => set({ activeTab: "creatives", creativesConceptId: conceptId, creativesAdId: null, campaignError: null }),

    selectCreativeAd: (adId) => set((state) => ({ creativesAdId: adId, creativesPromptOpen: adId ? false : state.creativesPromptOpen, campaignError: null })),

    setCreativesPromptOpen: (open) => set((state) => ({ creativesPromptOpen: open, creativesAdId: open ? null : state.creativesAdId })),

    generateHookAlternatives: async (adId) => {
      set({ campaignError: null });
      try {
        const state = get();
        const setup = useGenerationSetup.getState();
        const context = state.activeProductId ? setup.requestFor(state.activeProductId, "adHooks") : undefined;
        const hooks = await api.generateAdHookAlternatives({ adId, ai: { provider: state.aiProvider, model: state.aiModels[state.aiProvider] }, ...(context ? { context } : {}) });
        if (state.activeProductId) setup.finishRun(state.activeProductId, "adHooks");
        return hooks;
      } catch (error) {
        set({ campaignError: message(error, "Could not write hook alternatives. Try again.") });
        return [];
      }
    },

    clearCampaignError: () => set({ campaignError: null }),

    metaPublishPendingId: null,

    publishConceptToMeta: async (conceptId, input) => {
      if (get().metaPublishPendingId) return null;
      set({ metaPublishPendingId: conceptId, campaignError: null });
      try {
        const result = await api.publishConceptToMeta({ id: conceptId, ...input });
        const found = findConcept(conceptId);
        if (found) {
          replaceCampaign(found.productId, {
            ...found.campaign,
            metaCampaignId: result.metaCampaignId,
            concepts: found.campaign.concepts.map((concept) => (concept.id === conceptId ? result.concept : concept)),
          });
        }
        set({ metaPublishPendingId: null });
        return { publishedCount: result.publishedCount, notReadyCount: result.notReadyCount };
      } catch (error) {
        set({ metaPublishPendingId: null, campaignError: message(error, "Could not publish to Meta. Try again.") });
        return null;
      }
    },
  };
};
