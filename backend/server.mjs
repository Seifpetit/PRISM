import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import { listAiModels } from "./ai/model-gateway.mjs";
import { inputTemplates } from "./ai/input-templates/index.mjs";
import {
  promptPlaceholders,
  promptTemplateMetadata,
  editablePromptTemplate,
  savePromptTemplate,
} from "./ai/input-templates/prompt-overrides.mjs";
import { readCostLedgerEntriesForApi } from "./ai-cost-tracker/index.mjs";
import { ProductContextDomainError } from "./product-context/errors.mjs";
import { buildProductContextArtifact } from "./product-context/service.mjs";
import { typeDefs } from "./schema.mjs";
import { inspectProductUrl } from "./url-inspection/index.mjs";
import {
  generateCreativeExplorationAngles,
  generateCreativeExplorationTargetAvatars,
  generateCreativeExplorationAdHooks,
  generateCreativeExplorationAdPlan,
  generateCreativeExplorationOffers,
  readCreativeExplorationPromptTemplate,
  writeCreativeExplorationPromptTemplate,
} from "./creative-exploration/service.mjs";
import { generateAdSetThumbnails, generateAdThumbnail } from "./creative-exploration/ad-thumbnails.mjs";
import { generateProductImage } from "./product-context/product-image.mjs";
import { completeOperationOutput, failOperation } from "./database/operation-log-repository.mjs";
import { readOperationLogsForApi } from "./database/operation-log-api.mjs";
import { createUserNote, listUserNotes } from "./database/user-notes-repository.mjs";
import {
  getShopifyStatus,
  fetchShopifyOrders,
  fetchShopifyProduct,
  fetchShopifyProducts,
  resolveShopifyConfig,
} from "./integrations/shopify.mjs";
import {
  addCampaignAd,
  addCampaignAds,
  addCampaignConcepts,
  CampaignInputError,
  createCampaign,
  createCampaignWithConcepts,
  deleteCampaign,
  deleteCampaignAd,
  deleteCampaignConcept,
  getCampaign,
  getCampaignAd,
  getCampaignConcept,
  listCampaigns,
  MAX_CONCEPTS_PER_CAMPAIGN,
  setCampaignAdImage,
  updateCampaign,
  updateCampaignAd,
  updateCampaignConcept,
  relinkCampaignConcept,
  createEmptyCampaignConcept,
  unlinkCampaignConceptSlot,
} from "./database/campaigns-repository.mjs";
import {
  deleteProductLink,
  getProductLink,
  saveProductLink,
} from "./database/product-links-repository.mjs";
import { connectMetaAds, getMetaAdsStatus, resolveMetaAdsToken } from "./integrations/meta-ads.mjs";
import { getIntegrationConnection } from "./database/integration-connections-repository.mjs";
import { listMetaPages } from "./integrations/meta-ads-write.mjs";
import { publishConceptToMeta } from "./integrations/meta-publish.mjs";
import { getShopifySales } from "./integrations/shopify-performance.mjs";
import { analyzeCsvImport, commitCsvImport } from "./csv-import/service.mjs";
import { squash } from "./csv-import/resolve.mjs";
import { ContextSourceError } from "./context-library/extract.mjs";
import { createPipelineTask, deletePipelineTask, listPipelineTasks, movePipelineTask, PipelineError, updatePipelineTask } from "./pipeline/service.mjs";
import {
  addContextSource,
  contextSourceContent,
  deleteContextSource,
  generationProvenance,
  listContextSources,
  previewGenerationContext,
  recordGenerationProvenance,
  resolveGenerationContext,
  updateContextSource,
} from "./context-library/service.mjs";
import { csvCoverage, csvImportTable, deleteCsvImport, importedAdPerformance, listCsvImports } from "./database/csv-imports-repository.mjs";
import { metaAdRefImageMap } from "./database/pipeline-repository.mjs";
import { normalizeAdPlanOptions } from "./ai/modes/creative-exploration/ad-plan-options.mjs";
import { getExchangeRates } from "./integrations/exchange-rates.mjs";
import { getMetaAdsPerformance, listMetaAdThumbnails, listMetaCampaigns } from "./integrations/meta-performance.mjs";
import { listMetaCampaignAssignments, listProductMetaCampaigns, setProductMetaCampaigns } from "./database/product-meta-campaigns-repository.mjs";
import { disconnectIntegration, isDisconnectableProvider } from "./integrations/disconnect.mjs";
import { startMetaInstall, handleMetaCallback } from "./integrations/meta-oauth.mjs";
import { startShopifyInstall, handleShopifyCallback, isBlockedTunnelRequest } from "./integrations/shopify-oauth.mjs";
import { searchPexelsBanners } from "./integrations/pexels.mjs";
import { avatarImageStatuses, ensureAvatarImages } from "./creative-exploration/avatar-images.mjs";
import { deleteAvatarImages, getAvatarImageUrl } from "./database/avatar-images-repository.mjs";
import { startGoogleDriveInstall, handleGoogleDriveCallback } from "./integrations/google-drive-oauth.mjs";
import { startConvertyInstall, handleConvertyCallback } from "./integrations/converty-oauth.mjs";
import { getConvertyStatus } from "./integrations/converty.mjs";
import { listPromptCatalog, readPromptCatalogContent, savePromptCatalogContent } from "./ai/prompt-catalog.mjs";
import { addDataItem, copyDataItem, DataItemError, deleteDataItem, duplicateDataItem, readDataItem, renameDataItem, saveDataItem, saveDataItemPreview } from "./data-library/service.mjs";
import {
  downloadGoogleDriveFile,
  getGoogleDriveStatus,
  resolveGoogleDriveToken,
  uploadGoogleDriveFile,
} from "./integrations/google-drive.mjs";
import { runDatabaseMigrations } from "./database/migrate.mjs";
import {
  addWorkspaceMember,
  getSessionByToken,
  listWorkspaceMembers,
  revokeSession,
  signInWithoutPassword,
  switchSessionWorkspace,
} from "./database/auth-repository.mjs";
import {
  createWorkspaceProduct,
  getWorkspaceProduct,
  getWorkspaceProductContext,
  getWorkspaceSource,
  getWorkspaceStrategyNode,
  listProductStrategy,
  listWorkspaceProducts,
  listWorkspaceSources,
  listProductMedia,
  persistProductContext,
  persistProductSources,
  persistStrategyNodes,
  updateWorkspaceProductImage,
  listTargetAvatars,
  persistTargetAvatars,
  deleteTargetAvatars,
  getAvatarCanvas,
  persistAvatarCanvas,
  updateStrategyNodePosition,
  deleteStrategySubtree,
  listLineageHistory,
} from "./database/workspace-data-repository.mjs";

// ----- Module state and id helpers -----

const generationTraces = new Map();

const now = () => new Date().toISOString();
const nextId = (prefix) => `${prefix}-${randomUUID()}`;

// ----- Domain guards and generation setup -----

function requireProduct(workspaceId, productId) {
  const product = getWorkspaceProduct(workspaceId, productId);
  if (!product) throw new Error(`Product not found: ${productId}`);
  return product;
}

/** Context Library refusals reach the person as their own message and code, not as an internal error. */
async function contextGuard(run) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ContextSourceError) throw new GraphQLError(error.message, { extensions: { code: error.code } });
    throw error;
  }
}

/** Data library refusals (a view-only item, an empty edit) reach the person as their own message. */
async function dataItemGuard(run) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DataItemError) throw new GraphQLError(error.message);
    throw error;
  }
}

/** Pipeline refusals reach the person as their own message and code. */
function pipelineGuard(run) {
  try {
    return run();
  } catch (error) {
    if (error instanceof PipelineError) throw new GraphQLError(error.message, { extensions: { code: error.code } });
    throw error;
  }
}

/** The product's confirmed context and what the request selected on top of it, resolved on the server from ids alone. */
function generationSetup(workspaceId, productId, generator, context, missingMessage) {
  const productContext = getWorkspaceProductContext(workspaceId, productId);
  if (!productContext) throw new GraphQLError(missingMessage);
  return { productContext, setup: resolveSetup(workspaceId, productId, generator, productContext, context) };
}

/** Resolves the selected sources and instructions of a request, turning the library's refusals into GraphQL errors. */
function resolveSetup(workspaceId, productId, generator, productContext, context) {
  try {
    return resolveGenerationContext(workspaceId, { productId, generator, productContext, context });
  } catch (error) {
    if (error instanceof ContextSourceError) throw new GraphQLError(error.message, { extensions: { code: error.code } });
    throw error;
  }
}

function strategyFor(workspaceId, productId) {
  requireProduct(workspaceId, productId);
  return listProductStrategy(workspaceId, productId);
}

// ----- JSON scalar -----

function parseJsonLiteral(ast) {
  if (ast.kind === Kind.OBJECT)
    return Object.fromEntries(
      ast.fields.map((field) => [field.name.value, parseJsonLiteral(field.value)]),
    );
  if (ast.kind === Kind.LIST) return ast.values.map(parseJsonLiteral);
  if (
    ast.kind === Kind.STRING ||
    ast.kind === Kind.BOOLEAN ||
    ast.kind === Kind.INT ||
    ast.kind === Kind.FLOAT
  )
    return ast.value;
  if (ast.kind === Kind.NULL) return null;
  return undefined;
}

const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: parseJsonLiteral,
});

// ----- Session, ownership, and strategy loaders -----

function requireSession(context) {
  if (!context.session) {
    throw new GraphQLError("Sign in is required.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.session;
}

/** Campaign input problems are the caller's to fix, so they reach the client instead of "Unexpected error". */
function campaignOp(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof CampaignInputError) throw new GraphQLError(error.message);
    throw error;
  }
}

/** Each imported ad's image and, when it is a video, its playable source: Meta's own live creative first, PRISM's linked image second, none otherwise. */
function attachAdImages(ads, liveAssets, linkedImages) {
  return ads.map((ad) => {
    const key = squash(ad.name);
    const live = liveAssets.get(key);
    if (live) return { ...ad, imageStatus: "ready", imageUrl: live.thumbnailUrl, videoUrl: live.videoUrl ?? null };
    const linkedUrl = linkedImages.get(key);
    if (linkedUrl) return { ...ad, imageStatus: "ready", imageUrl: linkedUrl, videoUrl: null };
    return { ...ad, imageStatus: "none", imageUrl: null, videoUrl: null };
  });
}

function requireOwnProduct(workspaceId, productId) {
  const product = getWorkspaceProduct(workspaceId, productId);
  if (!product) throw new GraphQLError("Product not found.");
  return product;
}

function requireCampaign(workspaceId, campaignId) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) throw new GraphQLError("Campaign not found.");
  return campaign;
}

/** A concept can only be built from this product's own persona, angle and offer. */
function requireOwnCombos(workspaceId, productId, combos) {
  if (!combos.length) throw new GraphQLError("Pick at least one persona, angle and offer.");
  if (combos.length > MAX_CONCEPTS_PER_CAMPAIGN) {
    throw new GraphQLError(`Add at most ${MAX_CONCEPTS_PER_CAMPAIGN} concepts at a time.`);
  }
  const avatarIds = new Set(listTargetAvatars(workspaceId, productId).map((avatar) => avatar.id));
  const isNodeOf = (id, type) => {
    const node = getWorkspaceStrategyNode(workspaceId, id);
    return Boolean(node && node.type === type && node.productId === productId);
  };
  for (const combo of combos) {
    if (!avatarIds.has(combo.avatarId)) throw new GraphQLError("A persona in that selection doesn't belong to this product.");
    if (!isNodeOf(combo.angleId, "angle")) throw new GraphQLError("An angle in that selection doesn't belong to this product.");
    if (!isNodeOf(combo.offerId, "offer")) throw new GraphQLError("An offer in that selection doesn't belong to this product.");
  }
}

/**
 * What an ad set is made of, read on the server: its product context, angle, offer and persona. The client never
 * supplies these, so a request can only ever generate for the ad set it names. Throws a client-facing error when
 * any part is gone (a removed ingredient has to be relinked first).
 */
function loadConceptStrategy(workspaceId, concept) {
  const productContext = getWorkspaceProductContext(workspaceId, concept.productId);
  if (!productContext) throw new GraphQLError("Product Context is required to plan ads.");
  const angle = getWorkspaceStrategyNode(workspaceId, concept.angleId);
  const offer = getWorkspaceStrategyNode(workspaceId, concept.offerId);
  const avatar = listTargetAvatars(workspaceId, concept.productId).find((item) => item.id === concept.avatarId);
  if (!angle || !offer || !avatar) {
    const empty = [concept.avatarId, concept.angleId, concept.offerId].some((id) => String(id).startsWith("~"));
    throw new GraphQLError(empty ? "Link a persona, an angle and an offer to this ad set first." : "This ad set's persona, angle or offer no longer exists. Relink it first.");
  }
  const pick = (node) => ({ label: node.label, framing: node.framing, creativePotential: node.creativePotential });
  const { id: _avatarId, ...personaFields } = avatar;
  return { productContext, angle: pick(angle), offer: pick(offer), avatar: personaFields };
}

/** The connected Meta token plus the ad account (act_...) it reaches, or a clear reason it can't publish yet. */
function requireMetaAdsAccount(workspaceId) {
  const token = resolveMetaAdsToken(workspaceId);
  if (!token) throw new GraphQLError("Connect Meta Ads first, from Integrations.");
  const connection = getIntegrationConnection(workspaceId, "meta-ads");
  const adAccountId = connection?.externalAccountId;
  if (!adAccountId?.startsWith("act_")) {
    throw new GraphQLError("This Meta connection doesn't reach an ad account. Reconnect Meta Ads with an account that has one.");
  }
  return { token, adAccountId };
}

function activeWorkspaceId(context) {
  return requireSession(context).workspace.id;
}

function authenticated(resolver) {
  return (parent, args, context, info) => {
    requireSession(context);
    return resolver(parent, args, context, info);
  };
}

// ----- GraphQL resolvers -----

const resolvers = {
  JSON: jsonScalar,
  Query: {
    session: (_parent, _args, context) => context.session,
    integrationStatus: authenticated(async (_parent, _args, context) => [
      await getMetaAdsStatus(activeWorkspaceId(context)),
      await getShopifyStatus(activeWorkspaceId(context)),
      await getGoogleDriveStatus(activeWorkspaceId(context)),
      await getConvertyStatus(activeWorkspaceId(context)),
    ]),
    googleDrivePickerToken: authenticated(async (_parent, _args, context) =>
      resolveGoogleDriveToken(activeWorkspaceId(context)),
    ),
    targetAvatarImageStatuses: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return avatarImageStatuses({ workspaceId, productId });
    }),
    targetAvatarImage: authenticated((_parent, { avatarId }, context) => getAvatarImageUrl(activeWorkspaceId(context), avatarId)),
    pexelsBanners: authenticated(async (_parent, args) => {
      try {
        return await searchPexelsBanners(args);
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    productSources: authenticated((_parent, _args, context) =>
      listWorkspaceSources(activeWorkspaceId(context)),
    ),
    productMedia: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, productId);
      return listProductMedia(workspaceId, productId);
    }),
    campaigns: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, productId);
      return listCampaigns(workspaceId, productId);
    }),
    // scope "product" reads only the campaigns assigned to the product; anything else reads the whole ad account.
    metaAdsPerformance: authenticated(async (_parent, { days, refresh, productId, scope }, context) => {
      const workspaceId = activeWorkspaceId(context);
      try {
        let campaignIds = null;
        if (scope === "product") {
          if (!productId) throw new Error("Open a product to read its campaigns.");
          requireOwnProduct(workspaceId, productId);
          campaignIds = listProductMetaCampaigns(workspaceId, productId).map((row) => row.campaignId);
          if (!campaignIds.length) return { connected: true, scope: "product", unassigned: true, campaignCount: 0 };
        }
        return await getMetaAdsPerformance(workspaceId, { days: days ?? 30, refresh: Boolean(refresh), campaignIds });
      } catch (error) {
        // GraphQLError so the client sees the reason (a bad range) instead of "Unexpected error."
        throw new GraphQLError(error.message);
      }
    }),
    // scope "product" reads only the orders that contain the Shopify product linked to this PRISM product.
    shopifySales: authenticated(async (_parent, { days, refresh, productId, scope }, context) => {
      const workspaceId = activeWorkspaceId(context);
      try {
        let productGid = null;
        let linkedTitle = null;
        if (scope === "product") {
          if (!productId) throw new Error("Open a product to read its sales.");
          requireOwnProduct(workspaceId, productId);
          const link = getProductLink(workspaceId, productId, "shopify");
          if (!link) return { connected: resolveShopifyConfig(workspaceId) !== null, scope: "product", unlinked: true };
          productGid = link.externalId;
          linkedTitle = link.externalTitle;
        }
        const sales = await getShopifySales(workspaceId, { days: days ?? 30, refresh: Boolean(refresh), productGid });
        return { ...sales, linkedTitle };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    // Live exchange rates per one US dollar, for the Performance currency button. Public data: nothing of the person's is sent.
    exchangeRates: authenticated(async () => {
      try {
        const { rates, source, updatedAt, stale } = await getExchangeRates();
        return { source, updatedAt, stale, rates: Object.entries(rates).map(([currency, rate]) => ({ currency, rate })) };
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    // scope "account" adds up every product's imported ads; otherwise it is the open product's. Each row's
    // image is Meta's own live creative thumbnail first (see listMetaAdThumbnails), a PRISM-generated one
    // linked through a pipeline task's "live Meta ad" field second, or none.
    importedAds: authenticated(async (_parent, { productId, scope }, context) => {
      const workspaceId = activeWorkspaceId(context);
      if (scope === "account") {
        const result = importedAdPerformance(workspaceId, null);
        const liveThumbs = await listMetaAdThumbnails(workspaceId, null);
        return { ...result, ads: attachAdImages(result.ads, liveThumbs, new Map()) };
      }
      if (!productId) throw new GraphQLError("Open a product to read its imported ads.");
      requireOwnProduct(workspaceId, productId);
      const result = importedAdPerformance(workspaceId, productId);
      const campaignIds = listProductMetaCampaigns(workspaceId, productId).map((row) => row.campaignId);
      const liveThumbs = await listMetaAdThumbnails(workspaceId, campaignIds);
      const linkedImages = metaAdRefImageMap(workspaceId, productId);
      return { ...result, ads: attachAdImages(result.ads, liveThumbs, linkedImages) };
    }),
    csvCoverage: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, productId);
      return csvCoverage(workspaceId, productId);
    }),
    csvImports: authenticated((_parent, { limit }, context) => listCsvImports(activeWorkspaceId(context), limit ?? 10)),
    pipelineTasks: authenticated((_parent, { productId }, context) =>
      pipelineGuard(() => listPipelineTasks(activeWorkspaceId(context), productId))),
    contextSources: authenticated((_parent, { productId }, context) =>
      contextGuard(() => listContextSources(activeWorkspaceId(context), productId))),
    contextSourceContent: authenticated((_parent, { id }, context) =>
      contextGuard(() => contextSourceContent(activeWorkspaceId(context), id))),
    generationContextPreview: authenticated((_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, input.productId);
      const productContext = getWorkspaceProductContext(workspaceId, input.productId);
      if (!productContext) throw new GraphQLError("Confirm the Product Context before previewing a generation.");
      return contextGuard(() => previewGenerationContext(workspaceId, { productId: input.productId, generator: input.generator, productContext, context: input.context }));
    }),
    generationProvenance: authenticated((_parent, { generationId }, context) =>
      generationProvenance(activeWorkspaceId(context), generationId)),
    metaCampaigns: authenticated(async (_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, productId);
      try {
        const [campaigns, assignments] = [await listMetaCampaigns(workspaceId), listMetaCampaignAssignments(workspaceId)];
        const byCampaign = new Map(assignments.map((row) => [row.campaignId, row]));
        return campaigns.map((campaign) => ({
          ...campaign,
          assignedProductId: byCampaign.get(campaign.id)?.productId ?? null,
          assignedProductName: byCampaign.get(campaign.id)?.productName ?? null,
        }));
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    // The Pages this workspace's Meta connection can run ads as; needed to publish (object_story_spec.page_id).
    metaPages: authenticated(async (_parent, _args, context) => {
      const { token } = requireMetaAdsAccount(activeWorkspaceId(context));
      try {
        return await listMetaPages(token);
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    shopifyProducts: authenticated(async (_parent, { search }, context) => {
      try {
        return await fetchShopifyProducts(activeWorkspaceId(context), { search });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    shopifyProductLink: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return getProductLink(workspaceId, productId, "shopify");
    }),
    shopifyOrders: authenticated((_parent, { limit }, context) =>
      fetchShopifyOrders(activeWorkspaceId(context), { limit: limit ?? undefined }),
    ),
    workspaceMembers: (_parent, _args, context) =>
      listWorkspaceMembers(requireSession(context)),
    products: authenticated((_parent, _args, context) =>
      listWorkspaceProducts(activeWorkspaceId(context))),
    aiModels: authenticated((_parent, { provider }) => listAiModels({ provider })),
    aiPromptTemplates: authenticated(() =>
      Object.entries(inputTemplates).map(([name, factory]) => {
        const template = factory({
          sources: [],
          product: {},
          productContext: {},
          lineage: [],
          parent: { id: "preview", label: "Preview" },
        });
        return {
          id: template.id,
          label: promptTemplateMetadata[template.id].label,
          prompt: editablePromptTemplate(template.id, template.system),
          placeholders: promptPlaceholders.map(({ token, description }) => ({ token, description })),
        };
      }),
    ),
    costLedger: authenticated((_parent, { limit }, context) =>
      readCostLedgerEntriesForApi({
        workspaceId: activeWorkspaceId(context),
        limit: limit ?? undefined,
      })),
    operationLogs: authenticated((_parent, { limit }, context) =>
      readOperationLogsForApi({
        workspaceId: activeWorkspaceId(context),
        limit: limit ?? undefined,
      })),
    productStrategy: authenticated((_parent, { productId, lineageMode }, context) => {
      requireProduct(activeWorkspaceId(context), productId);
      return listProductStrategy(activeWorkspaceId(context), productId, lineageMode ?? "strategy_lineage");
    }),
    lineageHistory: authenticated((_parent, { productId, limit }, context) =>
      listLineageHistory(activeWorkspaceId(context), productId, limit ?? 20)),
    creatives: authenticated((_parent, { productId }, context) =>
      strategyFor(activeWorkspaceId(context), productId).filter(
        (node) => node.type === "creative",
      )),
    performance: authenticated((_parent, { productId }, context) => {
      requireProduct(activeWorkspaceId(context), productId);
      return { spend: 8700, revenue: 26100, roas: 3, winningCreativeId: "CR-0184" };
    }),
    productContext: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return getWorkspaceProductContext(workspaceId, productId);
    }),
    creativeExplorationPromptTemplate: authenticated((_parent, { templateId }, context) =>
      readCreativeExplorationPromptTemplate(activeWorkspaceId(context), templateId)),
    promptCatalog: authenticated((_parent, _args, context) => listPromptCatalog(activeWorkspaceId(context))),
    promptCatalogContent: authenticated((_parent, { id }, context) => {
      try {
        return readPromptCatalogContent(activeWorkspaceId(context), id);
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    dataItem: authenticated((_parent, { id }, context) => dataItemGuard(() => readDataItem(activeWorkspaceId(context), id))),
    csvImportTable: authenticated((_parent, { id }, context) => {
      const table = csvImportTable(activeWorkspaceId(context), id);
      if (!table) throw new GraphQLError("Import not found.");
      return table;
    }),
    targetAvatars: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return listTargetAvatars(workspaceId, productId);
    }),
    avatarCanvas: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return getAvatarCanvas(workspaceId, productId);
    }),
    userNotes: authenticated((_parent, { limit }) => listUserNotes(limit ?? undefined)),
  },
  Mutation: {
    // ----- Session mutations -----
    signInWithoutPassword: (_parent, { input }) => signInWithoutPassword(input),
    signOut: async (_parent, _args, context) => revokeSession(requireSession(context).token),

    // ----- Campaign, ad set, and ad mutations -----
    createCampaign: authenticated((_parent, args, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, args.productId);
      return campaignOp(() => createCampaign(workspaceId, args));
    }),
    updateCampaign: authenticated((_parent, { id, ...patch }, context) => {
      const updated = campaignOp(() => updateCampaign(activeWorkspaceId(context), id, patch));
      if (!updated) throw new GraphQLError("Campaign not found.");
      return updated;
    }),
    deleteCampaign: authenticated((_parent, { id }, context) => deleteCampaign(activeWorkspaceId(context), id)),
    createCampaignWithConcepts: authenticated((_parent, { combos, ...campaignInput }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, campaignInput.productId);
      requireOwnCombos(workspaceId, campaignInput.productId, combos);
      return campaignOp(() => createCampaignWithConcepts(workspaceId, { ...campaignInput, combos }));
    }),
    addCampaignConcepts: authenticated((_parent, { campaignId, combos }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const campaign = requireCampaign(workspaceId, campaignId);
      requireOwnCombos(workspaceId, campaign.productId, combos);
      return campaignOp(() => addCampaignConcepts(workspaceId, campaignId, combos));
    }),
    updateCampaignConcept: authenticated((_parent, { id, ...patch }, context) => {
      const updated = campaignOp(() => updateCampaignConcept(activeWorkspaceId(context), id, patch));
      if (!updated) throw new GraphQLError("Concept not found.");
      return updated;
    }),
    // Only a removed persona, angle or offer can be relinked; a live one is part of what the ad set is.
    relinkCampaignConcept: authenticated((_parent, { id, ...slots }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const concept = getCampaignConcept(workspaceId, id);
      if (!concept) throw new GraphQLError("Concept not found.");
      const avatarIds = new Set(listTargetAvatars(workspaceId, concept.productId).map((avatar) => avatar.id));
      const isNodeOf = (nodeId, type) => {
        const node = getWorkspaceStrategyNode(workspaceId, nodeId);
        return Boolean(node && node.type === type && node.productId === concept.productId);
      };
      const next = {};
      if (slots.avatarId) {
        if (avatarIds.has(concept.avatarId)) throw new GraphQLError("This ad set's persona is still linked.");
        if (!avatarIds.has(slots.avatarId)) throw new GraphQLError("That persona doesn't belong to this product.");
        next.avatarId = slots.avatarId;
      }
      for (const [field, type, label] of [["angleId", "angle", "angle"], ["offerId", "offer", "offer"]]) {
        if (!slots[field]) continue;
        if (isNodeOf(concept[field], type)) throw new GraphQLError(`This ad set's ${label} is still linked.`);
        if (!isNodeOf(slots[field], type)) throw new GraphQLError(`That ${label} doesn't belong to this product.`);
        next[field] = slots[field];
      }
      if (!Object.keys(next).length) throw new GraphQLError("Choose a persona, angle or offer to link.");
      return campaignOp(() => relinkCampaignConcept(workspaceId, id, next));
    }),
    createEmptyCampaignConcept: authenticated((_parent, { campaignId, positionX, positionY }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireCampaign(workspaceId, campaignId);
      return campaignOp(() => createEmptyCampaignConcept(workspaceId, campaignId, { positionX, positionY }));
    }),
    unlinkCampaignConcept: authenticated((_parent, { id, slot }, context) => {
      const updated = campaignOp(() => unlinkCampaignConceptSlot(activeWorkspaceId(context), id, slot));
      if (!updated) throw new GraphQLError("Concept not found.");
      return updated;
    }),
    deleteCampaignConcept: authenticated((_parent, { id }, context) => deleteCampaignConcept(activeWorkspaceId(context), id)),
    addCampaignAd: authenticated((_parent, { conceptId, ...fields }, context) =>
      campaignOp(() => addCampaignAd(activeWorkspaceId(context), conceptId, fields)),
    ),
    updateCampaignAd: authenticated((_parent, { id, ...patch }, context) => {
      const updated = campaignOp(() => updateCampaignAd(activeWorkspaceId(context), id, patch));
      if (!updated) throw new GraphQLError("Ad not found.");
      return updated;
    }),
    deleteCampaignAd: authenticated((_parent, { id }, context) => deleteCampaignAd(activeWorkspaceId(context), id)),
    // Plans the ads inside one ad set. The persona, angle and offer come from the ad set itself, never from the client.
    generateCampaignAdPlan: authenticated(async (_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const concept = getCampaignConcept(workspaceId, input.conceptId);
      if (!concept) throw new GraphQLError("Ad set not found.");
      const { productContext, angle, offer, avatar } = loadConceptStrategy(workspaceId, concept);
      const setup = resolveSetup(workspaceId, concept.productId, "adPlan", productContext, input.context);
      let options;
      try {
        options = normalizeAdPlanOptions(input.options);
      } catch (error) {
        throw new GraphQLError(error.message);
      }
      const generationId = randomUUID();
      const related = { productId: concept.productId, strategyNodeId: concept.productId };
      let output;
      try {
        output = await generateCreativeExplorationAdPlan({
          workspaceId,
          productContext,
          angle,
          offer,
          avatar,
          existingAds: concept.ads.map((ad) => ({ title: ad.title, awareness: ad.awareness, format: ad.format, hook: ad.hook, direction: ad.direction })),
          options,
          generationContext: setup.modelContext,
          ai: input.ai,
          operationId: generationId,
          related,
        });
      } catch (error) {
        try {
          await failOperation({ workspaceId, operationId: generationId, stage: "validation", error });
        } catch (traceError) {
          console.error("[OPERATION DATABASE] Ad plan failure tracing failed.", traceError);
        }
        throw error;
      }
      try {
        await completeOperationOutput({ workspaceId, operationId: generationId, output, related });
      } catch (error) {
        console.error("[OPERATION DATABASE] Ad plan output tracing failed; generation will continue.", error);
      }
      recordGenerationProvenance(workspaceId, generationId, setup);
      const savedAds = campaignOp(() => addCampaignAds(workspaceId, concept.id, output.ads));
      // Every ad's cover image runs together, as sibling attempts under the same generationId as the plan
      // text call above (attempt 1) — not a second operation, so its cost is attributed to this one generation.
      // A failed image never touches the ad itself: it stays as saved, just without a picture.
      const thumbnails = await generateAdSetThumbnails({
        workspaceId,
        operationId: generationId,
        related,
        productContext,
        avatar,
        angle,
        ads: savedAds,
        startAttempt: 2,
      });
      return thumbnails.map(({ adId, status, url }) => {
        const updated = campaignOp(() => setCampaignAdImage(workspaceId, adId, { status, url }));
        return updated ?? savedAds.find((ad) => ad.id === adId);
      });
    }),
    // One ad's own cover image, on demand: covers an ad made before thumbnails existed, and a retry after a
    // failed one. Never a second run of the whole plan, so it never touches this ad's other fields. An ad with
    // no direction yet (a fresh hand-planned slot) has nothing to draw a scene from, so this refuses rather
    // than generating something ungrounded.
    generateCampaignAdImage: authenticated(async (_parent, { id }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const ad = getCampaignAd(workspaceId, id);
      if (!ad) throw new GraphQLError("Ad not found.");
      if (!ad.direction?.trim()) throw new GraphQLError("Add a scene for this ad first — there is nothing yet to draw a cover image from.");
      const concept = getCampaignConcept(workspaceId, ad.conceptId);
      if (!concept) throw new GraphQLError("Ad set not found.");
      const { productContext, angle, avatar } = loadConceptStrategy(workspaceId, concept);
      const generationId = randomUUID();
      const related = { productId: concept.productId, strategyNodeId: concept.productId };
      let url = null;
      let status = "failed";
      try {
        url = await generateAdThumbnail({ workspaceId, operationId: generationId, attempt: 1, related, productContext, avatar, angle, ad });
        status = "ready";
      } catch (error) {
        console.error("[AD THUMBNAIL] On-demand generation failed; ad is kept without an image.", error);
      }
      const updated = campaignOp(() => setCampaignAdImage(workspaceId, ad.id, { status, url }));
      if (!updated) throw new GraphQLError("Ad not found.");
      if (status === "failed") throw new GraphQLError("Couldn't generate a cover image this time. Try again.");
      return updated;
    }),
    // Publishes one ad set (concept) to Meta: creates or reuses its Meta Campaign, creates its Meta Ad Set, and
    // creates an Ad Creative + Ad for every one of its ads that already has a ready cover image. Everything is
    // created PAUSED — this never turns on real spend by itself (backend/integrations/meta-publish.mjs).
    publishConceptToMeta: authenticated(async (_parent, { id, input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const concept = getCampaignConcept(workspaceId, id);
      if (!concept) throw new GraphQLError("Ad set not found.");
      const campaign = getCampaign(workspaceId, concept.campaignId);
      if (!campaign) throw new GraphQLError("Campaign not found.");
      if (!concept.ads.length) throw new GraphQLError("This ad set has no ads yet.");

      const pageId = input.pageId?.trim();
      const destinationUrl = input.destinationUrl?.trim();
      if (!pageId) throw new GraphQLError("Choose a Facebook Page to publish as.");
      if (!/^https?:\/\//i.test(destinationUrl ?? "")) throw new GraphQLError("The destination link must be a full https:// URL.");
      if (!Number.isInteger(input.dailyBudgetCents) || input.dailyBudgetCents < 100) {
        throw new GraphQLError("Daily budget must be at least $1.00.");
      }

      const { token, adAccountId } = requireMetaAdsAccount(workspaceId);
      const { avatar, angle, offer } = loadConceptStrategy(workspaceId, concept);
      const conceptName = `${avatar.label} × ${angle.label} × ${offer.label}`.slice(0, 400);

      let result;
      try {
        result = await publishConceptToMeta({
          workspaceId,
          token,
          adAccountId,
          campaign,
          concept,
          conceptName,
          ads: concept.ads,
          pageId,
          destinationUrl,
          dailyBudgetCents: input.dailyBudgetCents,
        });
      } catch (error) {
        throw new GraphQLError(`Meta refused the publish: ${error.message}`);
      }

      return {
        concept: getCampaignConcept(workspaceId, id),
        metaCampaignId: result.metaCampaignId,
        metaAdSetId: result.metaAdSetId,
        publishedCount: result.published.filter((ad) => ad.metaPublishStatus === "published").length,
        notReadyCount: result.notReadyCount,
      };
    }),
    // Alternative hooks for one ad. They are returned, not saved: the person picks one and it is saved as the hook.
    generateAdHookAlternatives: authenticated(async (_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const ad = getCampaignAd(workspaceId, input.adId);
      if (!ad) throw new GraphQLError("Ad not found.");
      const concept = getCampaignConcept(workspaceId, ad.conceptId);
      if (!concept) throw new GraphQLError("Ad set not found.");
      const { productContext, angle, offer, avatar } = loadConceptStrategy(workspaceId, concept);
      const setup = resolveSetup(workspaceId, concept.productId, "adHooks", productContext, input.context);
      const generationId = randomUUID();
      const related = { productId: concept.productId, strategyNodeId: concept.productId };
      let hooks;
      try {
        hooks = await generateCreativeExplorationAdHooks({
          workspaceId,
          productContext,
          angle,
          offer,
          avatar,
          ad: { title: ad.title, awareness: ad.awareness, format: ad.format, direction: ad.direction, hook: ad.hook, beats: ad.beats, cta: ad.cta },
          generationContext: setup.modelContext,
          ai: input.ai,
          operationId: generationId,
          related,
        });
      } catch (error) {
        try {
          await failOperation({ workspaceId, operationId: generationId, stage: "validation", error });
        } catch (traceError) {
          console.error("[OPERATION DATABASE] Hook alternatives failure tracing failed.", traceError);
        }
        throw error;
      }
      try {
        await completeOperationOutput({ workspaceId, operationId: generationId, output: { hooks }, related });
      } catch (error) {
        console.error("[OPERATION DATABASE] Hook alternatives output tracing failed; generation will continue.", error);
      }
      recordGenerationProvenance(workspaceId, generationId, setup);
      return hooks;
    }),

    // ----- Store links and ad-account connection -----
    linkShopifyProduct: authenticated(async (_parent, { productId, shopifyProductId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      try {
        requireProduct(workspaceId, productId);
        const config = resolveShopifyConfig(workspaceId);
        if (!config) throw new Error("Connect Shopify before linking a product.");
        // Ask the store itself, so a link can only point at a product that exists there.
        const product = await fetchShopifyProduct(workspaceId, shopifyProductId);
        if (!product) throw new Error("That product doesn't exist in the connected store.");
        return saveProductLink(workspaceId, {
          productId,
          provider: "shopify",
          externalAccountId: config.domain,
          externalId: product.id,
          externalTitle: product.title,
        });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    unlinkShopifyProduct: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return deleteProductLink(workspaceId, productId, "shopify");
    }),
    disconnectIntegration: authenticated(async (_parent, { id }, context) => {
      if (!isDisconnectableProvider(id)) throw new GraphQLError(`Unknown integration: ${id}`);
      return disconnectIntegration(activeWorkspaceId(context), id);
    }),
    connectMetaAds: authenticated(async (_parent, { accessToken }, context) => {
      try {
        return await connectMetaAds(activeWorkspaceId(context), accessToken);
      } catch (error) {
        // GraphQLError so the client sees Meta's reason instead of "Unexpected error."
        throw new GraphQLError(error.message);
      }
    }),

    // ----- Pipeline, context source, and CSV import mutations -----
    // Reads a CSV and says what it is and which product each ad belongs to. Writes nothing.
    createPipelineTask: authenticated((_parent, { input }, context) =>
      pipelineGuard(() => createPipelineTask(activeWorkspaceId(context), input))),
    updatePipelineTask: authenticated((_parent, { input }, context) =>
      pipelineGuard(() => updatePipelineTask(activeWorkspaceId(context), input))),
    movePipelineTask: authenticated((_parent, { input }, context) =>
      pipelineGuard(() => movePipelineTask(activeWorkspaceId(context), input))),
    deletePipelineTask: authenticated((_parent, { id }, context) =>
      deletePipelineTask(activeWorkspaceId(context), id)),
    addContextSource: authenticated((_parent, { input }, context) =>
      contextGuard(() => addContextSource(activeWorkspaceId(context), input))),
    updateContextSource: authenticated((_parent, { input }, context) =>
      contextGuard(() => updateContextSource(activeWorkspaceId(context), input))),
    deleteContextSource: authenticated((_parent, { id }, context) =>
      deleteContextSource(activeWorkspaceId(context), id)),
    deleteCsvImport: authenticated((_parent, { id }, context) => {
      const removed = deleteCsvImport(activeWorkspaceId(context), id);
      if (removed === null) throw new GraphQLError("Import not found.");
      return removed;
    }),
    analyzeCsvImport: authenticated((_parent, { fileName, csv }, context) => {
      try {
        return analyzeCsvImport(activeWorkspaceId(context), { fileName, csv });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    commitCsvImport: authenticated((_parent, { analysisId, decisions }, context) => {
      try {
        return commitCsvImport(activeWorkspaceId(context), analysisId, decisions ?? {});
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),

    // ----- Integration connections and Google Drive -----
    setProductMetaCampaigns: authenticated((_parent, { productId, campaigns }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireOwnProduct(workspaceId, productId);
      try {
        return setProductMetaCampaigns(workspaceId, productId, campaigns).length;
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    startMetaConnection: authenticated((_parent, _args, context) => {
      try {
        return startMetaInstall({ workspaceId: activeWorkspaceId(context) });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    startShopifyConnection: authenticated((_parent, { shop }, context) => {
      try {
        return startShopifyInstall({ workspaceId: activeWorkspaceId(context), shop });
      } catch (error) {
        // GraphQLError so the client sees the reason (missing app credentials, bad domain).
        throw new GraphQLError(error.message);
      }
    }),
    startConvertyConnection: authenticated((_parent, _args, context) => {
      try {
        return startConvertyInstall({ workspaceId: activeWorkspaceId(context) });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    startGoogleDriveConnection: authenticated((_parent, _args, context) => {
      try {
        return startGoogleDriveInstall({ workspaceId: activeWorkspaceId(context) });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    importGoogleDriveFile: authenticated(async (_parent, { fileId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      try {
        const file = await downloadGoogleDriveFile(workspaceId, fileId);
        const isImage = file.mimeType?.startsWith("image/");
        const source = {
          id: nextId("source"),
          type: isImage ? "image" : "file",
          label: file.name,
          value: JSON.stringify(
            isImage
              ? { version: 1, kind: "image", dataUrl: `data:${file.mimeType};base64,${file.bytesBase64}` }
              : { version: 1, kind: "document", data: file.bytesBase64 },
          ),
          filename: file.name,
          mimeType: file.mimeType,
          status: "ready",
        };
        persistProductSources(workspaceId, [source]);
        return source;
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    exportAdImageToGoogleDrive: authenticated(async (_parent, { adId, targetFileId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const ad = getCampaignAd(workspaceId, adId);
      if (!ad) throw new GraphQLError("Ad not found.");
      if (!ad.imageUrl) throw new GraphQLError("This ad has no image yet.");
      try {
        let mimeType = "image/png";
        let bytesBase64;
        if (ad.imageUrl.startsWith("data:")) {
          const match = /^data:([^;]+);base64,(.+)$/.exec(ad.imageUrl);
          if (!match) throw new Error("This ad's image isn't in a format PRISM can export.");
          mimeType = match[1];
          bytesBase64 = match[2];
        } else {
          const response = await fetch(ad.imageUrl, { signal: AbortSignal.timeout(30_000) });
          if (!response.ok) throw new Error(`Could not fetch the ad image (HTTP ${response.status}).`);
          mimeType = response.headers.get("content-type") ?? mimeType;
          bytesBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");
        }
        return await uploadGoogleDriveFile(workspaceId, {
          fileId: targetFileId ?? undefined,
          name: `${ad.title ?? ad.id}.${mimeType.split("/")[1] ?? "png"}`,
          mimeType,
          bytesBase64,
        });
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),

    // ----- Prompt templates and workspaces -----
    updateAiPromptTemplate: authenticated((_parent, { input }) => ({
      id: input.id,
      label: promptTemplateMetadata[input.id].label,
      prompt: savePromptTemplate(input.id, input.prompt),
      placeholders: promptPlaceholders.map(({ token, description }) => ({ token, description })),
    })),
    addWorkspaceMember: (_parent, { input }, context) =>
      addWorkspaceMember(requireSession(context), input),
    switchWorkspace: (_parent, { workspaceId }, context) =>
      switchSessionWorkspace(requireSession(context), workspaceId),

    // ----- Product intake and product image -----
    inspectProductUrl: authenticated((_parent, { url }) => inspectProductUrl(url)),
    ingestProductSource: authenticated(async (_parent, { url }, context) => {
      const inspection = await inspectProductUrl(url);
      const source = {
        id: nextId("source"),
        type: "url",
        label: inspection.candidates[0]?.name ?? "Product page",
        value: url,
        status: inspection.fetch.status === "SUCCESS" ? "ready" : "error",
        inspection,
      };
      persistProductSources(activeWorkspaceId(context), [source]);
      return source;
    }),
    buildProductContext: authenticated(async (_parent, { sources: inputSources, ai }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const generationId = randomUUID();
      persistProductSources(workspaceId, inputSources);
      try {
        return await buildProductContextArtifact({
          workspaceId,
          sources: inputSources,
          ai,
          operationId: generationId,
          parentGenerationId: generationId,
          dependencies: {
            getStoredSource: (sourceId) => getWorkspaceSource(workspaceId, sourceId),
            inspectProductUrl,
            updateStoredSource: (sourceId, source) => {
              if (source) persistProductSources(workspaceId, [source]);
            },
            persist: (artifact) => {
              const context = {
                ...artifact,
                id: nextId("context"),
                createdAt: now(),
              };
              return persistProductContext(workspaceId, context);
            },
            recordGeneration: (trace) => {
              generationTraces.set(generationId, trace);
            },
          },
        });
      } catch (error) {
        if (error instanceof ProductContextDomainError) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[product-context]", {
              code: error.code,
              details: error.details,
              cause: error.cause?.message,
            });
          }
          throw new GraphQLError(error.message, { extensions: { code: error.code } });
        }
        console.error("[product-context] unexpected failure", error);
        throw new GraphQLError("Product context could not be built. Try again.", {
          extensions: { code: "PRODUCT_CONTEXT_BUILD_FAILED" },
        });
      }
    }),
    createProduct: authenticated((_parent, { input }, context) => {
      const { contextId, ...productInput } = input;
      return createWorkspaceProduct(activeWorkspaceId(context), {
        id: nextId("product"),
        ...productInput,
        contextId,
        createdAt: now(),
      });
    }),
    // On demand only, from the product node itself. Works from whatever context exists — the richer Product
    // Context once it is built, or just the product's own name and description before that — so it never
    // hard-blocks the way an ad's cover image does on a missing scene. There is no image_status column on
    // products, so a failure simply leaves the product without an image rather than writing a "failed" state.
    generateProductImage: authenticated(async (_parent, { id }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const product = getWorkspaceProduct(workspaceId, id);
      if (!product) throw new GraphQLError("Product not found.");
      const productContext = getWorkspaceProductContext(workspaceId, id);
      const generationId = randomUUID();
      let url;
      try {
        url = await generateProductImage({ workspaceId, operationId: generationId, related: { productId: id, strategyNodeId: id }, product, productContext });
      } catch (error) {
        console.error("[PRODUCT IMAGE] Generation failed; product is kept without an image.", error);
        throw new GraphQLError("Couldn't generate an image this time. Try again.");
      }
      const updated = updateWorkspaceProductImage(workspaceId, id, url);
      if (!updated) throw new GraphQLError("Product not found.");
      return updated;
    }),
    // A person's own choice from the media picker: an existing context image, or a frame captured from a
    // context video. Not AI-generated, so it never touches productImagePendingId's generation error state.
    setProductImage: authenticated((_parent, { id, imageUrl }, context) => {
      const workspaceId = activeWorkspaceId(context);
      if (!getWorkspaceProduct(workspaceId, id)) throw new GraphQLError("Product not found.");
      if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(imageUrl) || imageUrl.length > 12_000_000) {
        throw new GraphQLError("That doesn't look like a usable image.");
      }
      const updated = updateWorkspaceProductImage(workspaceId, id, imageUrl);
      if (!updated) throw new GraphQLError("Product not found.");
      return updated;
    }),

    // ----- Strategy graph and creative exploration -----
    updateStrategyNodePosition: authenticated((_parent, { input }, context) =>
      updateStrategyNodePosition(activeWorkspaceId(context), input.nodeId, input)),
    deleteStrategySubtree: authenticated((_parent, { nodeId }, context) =>
      deleteStrategySubtree(activeWorkspaceId(context), nodeId)),
    generateCreativeExplorationAngles: authenticated(async (_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, input.productId);
      const { productContext, setup } = generationSetup(workspaceId, input.productId, "angles", input.context, "Product Context is required for Creative Exploration.");
      const generationId = randomUUID();
      const related = { productId: input.productId, strategyNodeId: input.productId };
      let output;
      try {
        output = await generateCreativeExplorationAngles({
          workspaceId,
          productContext,
          generationContext: setup.modelContext,
          ai: input.ai,
          operationId: generationId,
          related,
        });
      } catch (error) {
        try {
          await failOperation({ workspaceId, operationId: generationId, stage: "validation", error });
        } catch (traceError) {
          console.error("[OPERATION DATABASE] Creative Angle failure tracing failed.", traceError);
        }
        throw error;
      }
      try {
        await completeOperationOutput({ workspaceId, operationId: generationId, output, related });
      } catch (error) {
        console.error("[OPERATION DATABASE] Creative Angle output tracing failed; generation will continue.", error);
      }
      recordGenerationProvenance(workspaceId, generationId, setup);
      return persistStrategyNodes(workspaceId, output.angles.map((angle) => ({
        ...angle,
        id: nextId("cea"),
        parentId: input.productId,
        productId: input.productId,
        type: "angle",
        lineageMode: "creative_exploration",
        generationId,
        createdAt: now(),
        generated: true,
      })));
    }),
    generateCreativeExplorationOffers: authenticated(async (_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, input.productId);
      const { productContext, setup } = generationSetup(workspaceId, input.productId, "offers", input.context, "Product Context is required for Creative Exploration.");
      const generationId = randomUUID();
      const related = { productId: input.productId, strategyNodeId: input.productId };
      let output;
      try {
        output = await generateCreativeExplorationOffers({
          workspaceId,
          productContext,
          generationContext: setup.modelContext,
          ai: input.ai,
          operationId: generationId,
          related,
        });
      } catch (error) {
        try {
          await failOperation({ workspaceId, operationId: generationId, stage: "validation", error });
        } catch (traceError) {
          console.error("[OPERATION DATABASE] Creative Offer failure tracing failed.", traceError);
        }
        throw error;
      }
      try {
        await completeOperationOutput({ workspaceId, operationId: generationId, output, related });
      } catch (error) {
        console.error("[OPERATION DATABASE] Creative Offer output tracing failed; generation will continue.", error);
      }
      recordGenerationProvenance(workspaceId, generationId, setup);
      return persistStrategyNodes(workspaceId, output.offers.map((offer) => ({
        ...offer,
        id: nextId("ceo"),
        parentId: input.productId,
        productId: input.productId,
        type: "offer",
        lineageMode: "creative_exploration",
        generationId,
        createdAt: now(),
        generated: true,
      })));
    }),
    generateCreativeExplorationTargetAvatars: authenticated(async (_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, input.productId);
      const { productContext, setup } = generationSetup(workspaceId, input.productId, "targetAvatars", input.context, "Product Context is required for Target Avatar generation.");
      const generationId = randomUUID();
      const related = { productId: input.productId, strategyNodeId: input.productId };
      let output;
      try {
        output = await generateCreativeExplorationTargetAvatars({
          workspaceId,
          productContext,
          generationContext: setup.modelContext,
          ai: input.ai,
          count: input.count,
          operationId: generationId,
          related,
        });
      } catch (error) {
        try {
          await failOperation({ workspaceId, operationId: generationId, stage: "validation", error });
        } catch (traceError) {
          console.error("[OPERATION DATABASE] Target Avatar failure tracing failed.", traceError);
        }
        throw error;
      }
      try {
        await completeOperationOutput({ workspaceId, operationId: generationId, output, related });
      } catch (error) {
        console.error("[OPERATION DATABASE] Target Avatar output tracing failed; generation will continue.", error);
      }
      recordGenerationProvenance(workspaceId, generationId, setup);
      const targetAvatars = output.targetAvatars.map((targetAvatar) => ({
        ...targetAvatar,
        id: nextId("tav"),
      }));
      try {
        // A regenerated set replaces the old one, so the old portraits go with it.
        deleteAvatarImages(workspaceId, input.productId);
        persistTargetAvatars(workspaceId, input.productId, targetAvatars, generationId);
        // Their portraits are made in the background; the app polls for them.
        ensureAvatarImages({ workspaceId, productId: input.productId, parentGenerationId: generationId });
      } catch (error) {
        console.error("[TARGET AVATARS] Persist failed; returning generated set anyway.", error);
      }
      return targetAvatars;
    }),
    deleteTargetAvatar: authenticated((_parent, { productId, avatarId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      const remaining = listTargetAvatars(workspaceId, productId).filter(
        (avatar) => avatar.id !== avatarId,
      );
      deleteAvatarImages(workspaceId, productId, [avatarId]);
      if (remaining.length === 0) {
        deleteTargetAvatars(workspaceId, productId);
        return [];
      }
      return persistTargetAvatars(workspaceId, productId, remaining);
    }),
    resetTargetAvatars: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      deleteAvatarImages(workspaceId, productId);
      return deleteTargetAvatars(workspaceId, productId);
    }),
    // Covers avatars that predate portraits: whenever a product's avatars are opened, the missing portraits are
    // requested. Only ones with nothing (or a stale failure) are generated, so repeat calls cost nothing.
    ensureTargetAvatarImages: authenticated((_parent, { productId }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      return ensureAvatarImages({ workspaceId, productId });
    }),
    saveAvatarCanvas: authenticated((_parent, { productId, canvas }, context) => {
      const workspaceId = activeWorkspaceId(context);
      requireProduct(workspaceId, productId);
      persistAvatarCanvas(workspaceId, productId, canvas ?? {});
      return true;
    }),

    // ----- Prompt catalog, data library, and notes -----
    savePromptCatalogContent: authenticated((_parent, { id, content }, context) => {
      try {
        return savePromptCatalogContent(activeWorkspaceId(context), id, content, requireSession(context).user.id);
      } catch (error) {
        throw new GraphQLError(error.message);
      }
    }),
    saveDataItem: authenticated((_parent, { input }, context) => dataItemGuard(() => saveDataItem(activeWorkspaceId(context), input))),
    copyDataItem: authenticated((_parent, { input }, context) => dataItemGuard(() => copyDataItem(activeWorkspaceId(context), input))),
    renameDataItem: authenticated((_parent, { id, label }, context) => dataItemGuard(() => renameDataItem(activeWorkspaceId(context), id, label))),
    duplicateDataItem: authenticated((_parent, { id }, context) => dataItemGuard(() => duplicateDataItem(activeWorkspaceId(context), id))),
    deleteDataItem: authenticated((_parent, { id }, context) => dataItemGuard(() => deleteDataItem(activeWorkspaceId(context), id))),
    addDataItem: authenticated((_parent, { input }, context) => dataItemGuard(() => addDataItem(activeWorkspaceId(context), input))),
    saveDataItemPreview: authenticated((_parent, { input }, context) => dataItemGuard(() => saveDataItemPreview(activeWorkspaceId(context), input))),
    updateCreativeExplorationPromptTemplate: authenticated((_parent, { input }, context) => {
      const workspaceId = activeWorkspaceId(context);
      const userId = requireSession(context).user.id;
      return writeCreativeExplorationPromptTemplate(workspaceId, input.templateId, input.content, userId);
    }),
    submitUserNote: authenticated((_parent, { input }) => createUserNote(input.note)),
  },
};

// ----- GraphQL Yoga endpoint -----

const yoga = createYoga({
  schema: createSchema({ typeDefs, resolvers }),
  graphqlEndpoint: "/graphql",
  cors: { origin: "*" },
  context: async ({ request }) => {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    return { session: await getSessionByToken(token) };
  },
});

// ----- HTTP listener and OAuth callbacks -----

const port = Number(process.env.BACKEND_PORT ?? 4000);
await runDatabaseMigrations();

const yogaListener = yoga;
createServer((req, res) => {
  if (isBlockedTunnelRequest(req)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }
  if (req.url?.startsWith("/shopify/callback")) return handleShopifyCallback(req, res);
  if (req.url?.startsWith("/meta/callback")) return handleMetaCallback(req, res);
  if (req.url?.startsWith("/google-drive/callback")) return handleGoogleDriveCallback(req, res);
  if (req.url?.startsWith("/converty/callback")) return handleConvertyCallback(req, res);
  return yogaListener(req, res);
}).listen(port, () => console.log(`GraphQL backend running at http://localhost:${port}/graphql`));
