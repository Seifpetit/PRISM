import { buildGraphQLHttpRequest, sendHttpRequest } from "@/api/http";
import type { PerformanceSummary } from "@/services/performance";
import type { AiCostLedgerEntry } from "@/types/cost-ledger";
import type { OperationLog } from "@/types/operation-log";
import type { TestType } from "@/lib/campaign-rules";
import type { Campaign, CampaignAd, CampaignConcept, CampaignKind } from "@/types/campaign";

type CampaignAdInput = {
  format?: string;
  awareness?: string;
  title?: string | null;
  hook?: string | null;
  notes?: string | null;
  direction?: string | null;
  beats?: string[] | null;
  cta?: string | null;
};
import type { AuthSession, WorkspaceMember, WorkspaceRole } from "@/types/auth";
import type {
  AiModelOption,
  AngleNode,
  AngleExploration,
  AudienceNode,
  AudienceExploration,
  CreativeNode,
  CreativeTypeNode,
  ExecutionNode,
  Product,
  ProductContext,
  ProductSource,
  StrategyNode,
  TargetAvatar,
  AvatarCanvas,
  LineageHistoryEvent,
  UrlInspectionResult,
} from "@/types/strategy";

export interface GraphQLApi {
  session(): Promise<AuthSession | null>;
  signInWithoutPassword(input: {
    displayName: string;
    email: string;
  }): Promise<AuthSession>;
  signOut(): Promise<boolean>;
  workspaceMembers(): Promise<WorkspaceMember[]>;
  addWorkspaceMember(input: {
    displayName: string;
    email: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMember>;
  products(): Promise<Product[]>;
  aiModels(provider: string): Promise<AiModelOption[]>;
  aiPromptTemplates(): Promise<AiPromptTemplate[]>;
  updateAiPromptTemplate(input: { id: string; prompt: string }): Promise<AiPromptTemplate>;
  /** Every prompt Prism sends to a model, in workflow order. */
  promptCatalog(): Promise<PromptCatalogEntry[]>;
  promptCatalogContent(input: { id: string }): Promise<PromptCatalogContent>;
  savePromptCatalogContent(input: { id: string; content: string }): Promise<PromptCatalogContent>;
  /** One stored data item whole (file contents included), for its editor. */
  dataItem(input: { id: string }): Promise<DataItemContent>;
  saveDataItem(input: DataItemEdit): Promise<DataItemContent>;
  copyDataItem(input: DataItemEdit): Promise<DataItemContent>;
  renameDataItem(input: { id: string; label: string }): Promise<DataItemContent>;
  duplicateDataItem(input: { id: string }): Promise<DataItemContent>;
  deleteDataItem(input: { id: string }): Promise<boolean>;
  /** Adds a file (base64 `data`), a link (`url`) or a note (`text`) to the Data library; returns the new id. */
  addDataItem(input: DataItemAdd): Promise<string>;
  /** Stores a media item's card preview: a still, a waveform and/or its length. */
  saveDataItemPreview(input: { id: string; thumbnail?: string | null; peaks?: number[] | null; duration?: number | null }): Promise<boolean>;
  /** The rows a CSV import still provides to Performance, read-only. */
  csvImportTable(input: { id: string }): Promise<CsvImportTable>;
  costLedger(input?: { limit?: number }): Promise<AiCostLedgerEntry[]>;
  operationLogs(input?: { limit?: number }): Promise<OperationLog[]>;
  inspectProductUrl(input: { url: string }): Promise<UrlInspectionResult>;
  ingestProductSource(input: { url: string }): Promise<ProductSource>;
  buildProductContext(input: {
    sources: ProductSource[];
    ai?: AiModelInput;
  }): Promise<ProductContext>;
  createProduct(input: {
    brandId: string;
    name: string;
    description: string;
    contextId?: string;
    imageUrl?: string | null;
  }): Promise<Product>;
  /** The product's own representative image, generated from its context on demand. Never fired automatically. */
  generateProductImage(input: { id: string }): Promise<Product>;
  /** Sets the product's own image directly, from a context source or a captured video frame. Not AI-generated. */
  setProductImage(input: { id: string; imageUrl: string }): Promise<Product>;
  /** One product's own image and video context sources, with their actual bytes, for the node's media picker. */
  productMedia(input: { productId: string }): Promise<ProductMediaAsset[]>;
  productStrategy(input: {
    productId: string;
    lineageMode?: "strategy_lineage" | "creative_exploration";
  }): Promise<StrategyNode[]>;
  lineageHistory(input: { productId: string; limit?: number }): Promise<LineageHistoryEvent[]>;
  deleteStrategySubtree(input: { nodeId: string }): Promise<LineageHistoryEvent>;
  updateStrategyNodePosition(input: {
    nodeId: string;
    x: number;
    y: number;
  }): Promise<boolean>;
  generateCreativeExplorationAngles(input: {
    productId: string;
    ai?: AiModelInput;
    context?: GenerationContextRequest;
  }): Promise<AngleNode[]>;
  generateCreativeExplorationOffers(input: {
    productId: string;
    ai?: AiModelInput;
    context?: GenerationContextRequest;
  }): Promise<StrategyNode[]>;
  generateCreativeExplorationTargetAvatars(input: {
    productId: string;
    ai?: AiModelInput;
    count?: number;
    context?: GenerationContextRequest;
  }): Promise<TargetAvatar[]>;
  contextSources(input: { productId: string }): Promise<ContextSource[]>;
  contextSourceContent(input: { id: string }): Promise<ContextSourceContent>;
  addContextSource(input: AddContextSourceRequest): Promise<ContextSource>;
  updateContextSource(input: { id: string; name?: string; market?: string | null; text?: string }): Promise<ContextSource>;
  deleteContextSource(input: { id: string }): Promise<boolean>;
  generationContextPreview(input: { productId: string; generator: string; context?: GenerationContextRequest }): Promise<GenerationContextPreview>;
  generationProvenance(input: { generationId: string }): Promise<GenerationProvenance | null>;
  pipelineTasks(input: { productId: string }): Promise<PipelineTask[]>;
  createPipelineTask(input: { adId: string; variant?: string; adRef?: string }): Promise<PipelineTask>;
  updatePipelineTask(input: { id: string; title?: string; variant?: string | null; notes?: string | null; metaAdRef?: string | null; checklist?: Array<{ id?: string; label: string; done?: boolean }> }): Promise<PipelineTask>;
  movePipelineTask(input: { id: string; stage: string; index?: number }): Promise<PipelineTask>;
  deletePipelineTask(input: { id: string }): Promise<boolean>;
  targetAvatars(input: { productId: string }): Promise<TargetAvatar[]>;
  deleteTargetAvatar(input: { productId: string; avatarId: string }): Promise<TargetAvatar[]>;
  resetTargetAvatars(input: { productId: string }): Promise<boolean>;
  avatarCanvas(input: { productId: string }): Promise<AvatarCanvas | null>;
  saveAvatarCanvas(input: { productId: string; canvas: AvatarCanvas }): Promise<boolean>;
  creatives(input: { productId: string }): Promise<CreativeNode[]>;
  performance(input: { productId: string }): Promise<PerformanceSummary>;
  productContext(input: { productId: string }): Promise<ProductContext | null>;
  creativeExplorationPromptTemplate(input: { templateId: string }): Promise<CreativeExplorationPromptTemplate>;
  updateCreativeExplorationPromptTemplate(input: {
    templateId: string;
    content: string;
  }): Promise<CreativeExplorationPromptTemplate>;
  userNotes(input?: { limit?: number }): Promise<UserNote[]>;
  submitUserNote(input: { note: string }): Promise<UserNote>;
  integrationStatus(): Promise<IntegrationStatus[]>;
  /** Metadata for everything the workspace has given Prism as product context. Never includes file contents. */
  productSources(): Promise<StoredProductSource[]>;
  /** Validates a Meta Marketing API token with Meta and stores it for the active workspace. */
  connectMetaAds(input: { accessToken: string }): Promise<IntegrationStatus>;
  metaAdsPerformance(input: { days: number; refresh?: boolean; productId?: string; scope?: "product" | "account" }): Promise<MetaAdsPerformance>;
  metaCampaigns(input: { productId: string }): Promise<MetaAccountCampaign[]>;
  /** Facebook Pages the connected Meta account can publish ads as. */
  metaPages(): Promise<MetaPage[]>;
  analyzeCsvImport(input: { fileName: string; csv: string }): Promise<CsvAnalysis>;
  commitCsvImport(input: { analysisId: string; decisions?: CsvDecisions }): Promise<CsvCommitResult>;
  csvImports(input?: { limit?: number }): Promise<CsvImportRecord[]>;
  csvCoverage(input: { productId: string }): Promise<CsvCoverage>;
  importedAds(input: { productId?: string; scope?: "product" | "account" }): Promise<ImportedAds>;
  exchangeRates(): Promise<ExchangeRates>;
  deleteCsvImport(input: { id: string }): Promise<number>;
  shopifySales(input: { days: number; refresh?: boolean; productId?: string; scope?: "product" | "store" }): Promise<ShopifySales>;
  setProductMetaCampaigns(input: { productId: string; campaigns: Array<{ id: string; name: string }> }): Promise<number>;
  /** Starts the Shopify OAuth install for the active workspace; redirect the browser to `url`. */
  startShopifyConnection(input: { shop?: string }): Promise<ShopifyConnectionStart>;
  /** Starts "Log in with Facebook" for the active workspace; send the browser to `url`. */
  startMetaConnection(): Promise<{ url: string }>;
  /** Starts the Google Drive OAuth install for the active workspace; send the browser to `url`. */
  startConvertyConnection(): Promise<{ url: string }>;
  startGoogleDriveConnection(): Promise<{ url: string }>;
  /** The workspace's live Google Drive access token, for the Picker widget. Null when not connected. */
  googleDrivePickerToken(): Promise<string | null>;
  /** Makes sure every persona of a product has a generated portrait or one on the way (only missing ones are made). */
  ensureTargetAvatarImages(input: { productId: string }): Promise<TargetAvatarImageStatus[]>;
  targetAvatarImageStatuses(input: { productId: string }): Promise<TargetAvatarImageStatus[]>;
  /** One persona's generated portrait as a data URL, or null when it has none yet. */
  targetAvatarImage(input: { avatarId: string }): Promise<string | null>;
  /** Profile banner photos from Pexels. `configured` is false until the backend has a PEXELS_API_KEY. */
  pexelsBanners(input: { query?: string; page?: number; perPage?: number; orientation?: "landscape" | "portrait" | "square" }): Promise<PexelsBannerPage>;
  /** Downloads a Drive file the person picked and adds it as a product source. */
  importGoogleDriveFile(input: { fileId: string }): Promise<ProductSource>;
  /** Saves an ad's image to Google Drive, overwriting targetFileId when given. */
  exportAdImageToGoogleDrive(input: { adId: string; targetFileId?: string }): Promise<GoogleDriveExportResult>;
  /** Removes the workspace's saved connection. For Shopify the app is also uninstalled on the store (best effort). */
  disconnectIntegration(input: { id: string }): Promise<DisconnectResult>;
  /** First page of the connected Shopify store's products, optionally filtered by title. */
  shopifyProducts(input?: { search?: string }): Promise<ShopifyProduct[]>;
  shopifyProductLink(input: { productId: string }): Promise<ProductLink | null>;
  linkShopifyProduct(input: { productId: string; shopifyProductId: string }): Promise<ProductLink>;
  unlinkShopifyProduct(input: { productId: string }): Promise<boolean>;
  campaigns(input: { productId: string }): Promise<Campaign[]>;
  createCampaign(input: { productId: string; name?: string; kind?: CampaignKind; testType?: TestType; positionX?: number; positionY?: number }): Promise<Campaign>;
  updateCampaign(input: { id: string; name?: string; kind?: CampaignKind; testType?: TestType; positionX?: number | null; positionY?: number | null }): Promise<Campaign>;
  /** A campaign and its first ad sets in one step: all of it is created, or none of it. */
  createCampaignWithConcepts(input: { productId: string; name?: string; kind?: CampaignKind; testType?: TestType; combos: Array<{ avatarId: string; angleId: string; offerId: string }> }): Promise<Campaign>;
  deleteCampaign(input: { id: string }): Promise<boolean>;
  /** One concept (ad set) per persona x angle x offer combination; combinations already in the campaign are skipped. */
  addCampaignConcepts(input: { campaignId: string; combos: Array<{ avatarId: string; angleId: string; offerId: string }> }): Promise<{ created: CampaignConcept[]; skipped: number }>;
  relinkCampaignConcept(input: { id: string; avatarId?: string; angleId?: string; offerId?: string }): Promise<CampaignConcept>;
  /** An ad set with no persona, angle or offer yet, placed at a spot on the canvas. */
  createEmptyCampaignConcept(input: { campaignId: string; positionX?: number; positionY?: number }): Promise<CampaignConcept>;
  /** Cuts one ingredient link of an ad set (the slot goes back to empty). */
  unlinkCampaignConcept(input: { id: string; slot: "avatar" | "angle" | "offer" }): Promise<CampaignConcept>;
  updateCampaignConcept(input: { id: string; startDate?: string | null; endDate?: string | null; spend?: number | null; positionX?: number | null; positionY?: number | null }): Promise<CampaignConcept>;
  deleteCampaignConcept(input: { id: string }): Promise<boolean>;
  addCampaignAd(input: { conceptId: string } & CampaignAdInput): Promise<CampaignAd>;
  updateCampaignAd(input: { id: string } & CampaignAdInput): Promise<CampaignAd>;
  /** Plans the ads inside one ad set with AI and saves them. The ad set's persona, angle and offer stay fixed. */
  generateCampaignAdPlan(input: { conceptId: string; ai?: AiModelInput; options?: AdPlanRequest; context?: GenerationContextRequest }): Promise<CampaignAd[]>;
  /** One ad's own cover image, on demand: for an ad made before thumbnails existed, or a retry after imageStatus is "failed". */
  generateCampaignAdImage(input: { id: string }): Promise<CampaignAd>;
  /** Publishes an ad set to Meta as a (paused) Campaign / Ad Set / Ads. */
  publishConceptToMeta(input: { id: string; pageId: string; destinationUrl: string; dailyBudgetCents: number }): Promise<MetaPublishResult>;
  generateAdHookAlternatives(input: { adId: string; ai?: AiModelInput; context?: GenerationContextRequest }): Promise<string[]>;
  deleteCampaignAd(input: { id: string }): Promise<boolean>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  imageUrl: string | null;
}

export interface ProductLink {
  productId: string;
  provider: string;
  storeDomain: string;
  externalId: string;
  title: string;
  linkedAt: string;
}

export interface DisconnectResult {
  id: string;
  disconnected: boolean;
  /** Shopify only: true when the app was also uninstalled on the store. */
  remoteRevoked: boolean | null;
  message: string;
}

export interface ShopifyConnectionStart {
  url: string;
  shop: string;
}

export interface GoogleDriveExportResult {
  fileId: string;
  webViewLink: string | null;
}

export type DataItemKind = "note" | "document" | "table" | "link" | "image" | "video" | "audio";

export interface DataItemContent {
  id: string;
  kind: DataItemKind;
  label: string;
  filename: string | null;
  mimeType: string | null;
  productId: string | null;
  text: string | null;
  dataUrl: string | null;
  frames: string[] | null;
  url: string | null;
  trim: { start: number; end: number } | null;
  /** "overwrite": Save writes over the item. "copy-only": edits go to a copy. "none": view only. */
  saveMode: "overwrite" | "copy-only" | "none";
  notice: string | null;
}

export interface DataItemEdit {
  id: string;
  text?: string;
  dataUrl?: string;
  trim?: { start: number; end: number };
  filename?: string;
}

export interface TargetAvatarImageStatus {
  avatarId: string;
  status: "none" | "pending" | "ready" | "failed" | string;
}

export interface PexelsBanner {
  id: string;
  alt: string | null;
  photographer: string;
  photographerUrl: string | null;
  pageUrl: string | null;
  avgColor: string;
  thumbUrl: string;
  bannerUrl: string;
}

export interface PexelsBannerPage {
  configured: boolean;
  photos: PexelsBanner[];
  page: number;
  hasMore: boolean;
}

export interface DataItemAdd {
  filename?: string;
  mimeType?: string;
  /** A file's bytes, base64 (a data: URL prefix is accepted and stripped). */
  data?: string;
  url?: string;
  text?: string;
  productId?: string | null;
}

export interface CsvImportTable {
  id: string;
  fileName: string;
  columns: string[];
  rows: string[][];
  truncated: boolean;
}

export interface PromptCatalogEntry {
  id: string;
  label: string;
  group: "product" | "strategy" | "ads";
  modality: "text" | "image";
  description: string;
  usedWhen: string | null;
  inactiveNote: string | null;
  chars: number;
  isCustom: boolean;
  version: number | null;
  updatedAt: string | null;
  placeholders: Array<{ token: string; description: string }>;
}

export interface PromptCatalogContent {
  id: string;
  content: string;
  isCustom: boolean;
  version: number | null;
  updatedAt: string | null;
  placeholders: Array<{ token: string; description: string }>;
}

export interface StoredProductSource {
  id: string;
  productId: string | null;
  type: "url" | "file" | "image" | "video" | "text" | string;
  /** Which editor it opens in. */
  kind: DataItemKind;
  label: string;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Bytes this row occupies in the database (files are stored inline as base64). */
  storedBytes: number;
  status: string;
  text: string | null;
  url: string | null;
  /** How many identical copies of this file the workspace has stored. */
  copies: number;
  /** Media only, once the library has made it: a small still (image, video). */
  thumbnail?: string | null;
  /** Media only: the audio waveform, 0..1 per bar. */
  peaks?: number[] | null;
  durationSeconds?: number | null;
  createdAt: string;
}

export interface ProductMediaAsset {
  id: string;
  type: "image" | "video" | string;
  label: string;
  filename: string | null;
  /** A data: URI. For a video this is its first stored frame. */
  url: string | null;
  /** Video only: the data: URIs of every frame stored for it, in order. */
  frames: string[] | null;
}

export interface MetaTotals {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  purchases: number;
  revenue: number;
}
export interface MetaDay {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
}
export interface MetaCampaignRow extends MetaTotals {
  id: string;
  name: string;
  status: string;
}
export interface MetaAdsPerformance {
  connected: boolean;
  error?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  currency?: string | null;
  /** ACTIVE, DISABLED, UNSETTLED, ... as Meta reports the ad account. */
  accountStatus?: string | null;
  range?: { since: string; until: string; days: number } | null;
  totals?: MetaTotals | null;
  previousTotals?: MetaTotals | null;
  daily?: MetaDay[] | null;
  campaigns?: MetaCampaignRow[] | null;
  fetchedAt?: string | null;
  /** "product": only the campaigns assigned to the product; "account": the whole ad account. */
  scope?: string | null;
  campaignCount?: number | null;
  /** The product scope was asked for and the product has no assigned campaigns yet. */
  unassigned?: boolean | null;
}

export interface ShopifyTotals {
  orders: number;
  units: number;
  revenue: number;
}
export interface ShopifyDay {
  date: string;
  orders: number;
  revenue: number;
}
export interface ShopifyRecentOrder {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  total: number;
  items: string;
  test: boolean;
}
export interface ShopifyTopProduct {
  id?: string | null;
  title: string;
  units: number;
  revenue: number;
}
export interface ShopifySales {
  connected: boolean;
  error?: string | null;
  shopName?: string | null;
  currency?: string | null;
  /** "product": only orders containing the linked Shopify product; "store": every order. */
  scope?: string | null;
  /** The product scope was asked for and no Shopify product is linked yet. */
  unlinked?: boolean | null;
  linkedTitle?: string | null;
  range?: { since: string; until: string; days: number } | null;
  totals?: ShopifyTotals | null;
  previousTotals?: ShopifyTotals | null;
  daily?: ShopifyDay[] | null;
  recentOrders?: ShopifyRecentOrder[] | null;
  topProducts?: ShopifyTopProduct[] | null;
  testOrders?: number | null;
  /** The range starts before the 60 days of orders Shopify returns, so it is cut short. */
  historyLimited?: boolean | null;
  truncated?: boolean | null;
  fetchedAt?: string | null;
}

export interface CsvProductMatch {
  productId: string;
  productName: string;
  ads: number;
  rows: number;
  /** Why these ads were placed in this product. */
  reason: string;
}
/** What a CSV file is and which product each of its ads belongs to. Nothing is saved until it is committed. */
export interface CsvAnalysis {
  analysisId: string;
  fileName: string;
  kind: string;
  kindLabel: string;
  rows: number;
  adCount: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
  /** False when the file does not say which currency its amounts are in. */
  currencyKnown: boolean;
  products: CsvProductMatch[];
  unresolved: { ads: number; rows: number; samples: string[] };
  suggestedProductId?: string | null;
  warnings: string[];
}
export interface CsvDecisions {
  currency?: string;
  assignUnresolvedTo?: string;
  skipUnresolved?: boolean;
  forceProductId?: string;
}
export interface CsvCommitResult {
  /** Null when every row was already stored exactly as it is, so nothing was recorded. */
  importId: string | null;
  fileName: string;
  kind: string;
  currency: string;
  imported: number;
  updated: number;
  unchanged: number;
  skipped: number;
  products: Array<{ productId: string; productName: string; imported: number; updated: number }>;
}
export interface CsvCoverageKind {
  rows: number;
  dateFrom?: string | null;
  dateTo?: string | null;
  importedAt?: string | null;
}
/** What has been imported from CSV files for one product, per template. */
export interface CsvCoverage {
  meta: CsvCoverageKind;
  converty: CsvCoverageKind;
}
export interface CsvImportRecord {
  id: string;
  kind: string;
  fileName: string;
  currency?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  rowsTotal: number;
  rowsImported: number;
  rowsUpdated: number;
  rowsSkipped: number;
  /** How many of the file's rows are in use now. */
  rowsHeld: number;
  products: string[];
  productIds: string[];
  createdAt: string;
}

/** One imported ad: the Meta export's days added up, joined by name with the Converty summary. */
export interface ImportedAd {
  name: string;
  delivery?: string | null;
  hasMeta: boolean;
  hasConverty: boolean;
  days: number;
  spend: number;
  /** Spend over the days the order file covers: what a cost per confirmed or delivered order divides. */
  spendInOrderWindow: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  results: number;
  /** The results that are purchases, as Meta attributes them to this ad. */
  purchases: number;
  hookRate?: number | null;
  holdRate?: number | null;
  orders: number;
  deleted: number;
  confirmed: number;
  delivered: number;
  returned: number;
  deliveredRevenue: number;
  /** Meta's own live thumbnail first, a PRISM-linked one second, "none" otherwise. */
  imageStatus: "none" | "pending" | "ready" | "failed";
  imageUrl: string | null;
  /** Meta's own playable source for this ad's creative, when it is a video and Meta still serves one. */
  videoUrl: string | null;
}
/** What to optimise a generation of ads for. Every field is optional; nothing chosen means the AI decides. */
/** What a generation is given beyond the Product Context: library sources chosen by id, and focus for one run. */
export interface GenerationContextRequest {
  sourceIds?: string[];
  instructions?: string | null;
}

export type ContextSourceKind = "pdf" | "text" | "csv" | "note";
export type ContextSourceStatus = "processing" | "ready" | "failed";

/** A note or file in a product's Context Library; its text is fetched separately. */
export interface ContextSource {
  id: string;
  productId: string;
  name: string;
  kind: ContextSourceKind;
  status: ContextSourceStatus;
  statusDetail: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  market: string | null;
  version: number;
  charCount: number;
  summary: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContextSourceContent {
  id: string;
  text: string;
  structure: unknown;
}

export interface AddContextSourceRequest {
  productId: string;
  kind: "file" | "note";
  name?: string;
  fileName?: string;
  mimeType?: string;
  /** A note's text, or the contents of a text / CSV file. */
  text?: string;
  /** A PDF's bytes, base64. */
  contentBase64?: string;
  market?: string;
}

export interface ContextPreviewSource {
  id: string;
  name: string;
  kind: ContextSourceKind;
  market: string | null;
  version: number;
  availableChars: number;
  includedChars: number;
  truncated: boolean;
  coverage: string;
  warnings: string[];
  text: string;
}

/** What a generation would be given right now: the same assembly a real run uses. */
export interface GenerationContextPreview {
  generator: string;
  templateVersion: number;
  productContext: string;
  instructions: string | null;
  sources: ContextPreviewSource[];
  totalChars: number;
  budgetChars: number;
  rules: string[];
}

/** What one finished generation was given beyond the Product Context, as recorded when it ran. */
export interface GenerationProvenance {
  generationId: string;
  productId: string;
  generator: string;
  templateId: string;
  templateVersion: number;
  instructions: string | null;
  sources: Array<{ id: string; name: string; kind: ContextSourceKind; version: number; contentHash: string | null; availableChars: number; includedChars: number; truncated: boolean; coverage: string | null }>;
  contextChars: number;
  createdAt: string;
}

export interface PipelineChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

/** A piece of creative work made from a Prism ad, moving across the production pipeline. */
export interface PipelineTask {
  id: string;
  productId: string;
  adId: string;
  conceptId: string | null;
  adRef: string | null;
  title: string;
  format: string;
  awareness: string | null;
  hook: string | null;
  variant: string | null;
  stage: string;
  checklist: PipelineChecklistItem[];
  notes: string | null;
  metaAdRef: string | null;
  sortOrder: number;
  /** The ad this task was made from has been deleted. */
  adRemoved: boolean;
  /** Read live off the ad, not copied at creation — "none" once the ad is removed. */
  imageStatus: "none" | "pending" | "ready" | "failed";
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string;
}

export interface AdPlanRequest {
  /** One format for every ad. */
  format?: string | null;
  /** A stage for every ad, or "spread" for each ad at a different stage. */
  awareness?: string | null;
  count?: number | null;
  /** "short" (default) or "vsl", a long-form video sales letter. */
  structure?: string | null;
  note?: string | null;
}

/** Live exchange rates: how many of each currency one US dollar buys. */
export interface ExchangeRates {
  source: string;
  updatedAt?: string | null;
  /** The service could not be reached, so these are the last rates that were. */
  stale: boolean;
  rates: Array<{ currency: string; rate: number }>;
}

/** One day of the imported Meta export, added up across ads. */
export interface ImportedDay {
  date: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number;
  /** The results that are purchases, as Meta attributes them. */
  purchases: number;
}
export interface ImportedTotals {
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number;
  purchases: number;
  orders: number;
  deleted: number;
  confirmed: number;
  delivered: number;
  returned: number;
  deliveredRevenue: number;
}
export interface ImportedSpan {
  rows: number;
  currency?: string | null;
  mixedCurrency: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
}
/** The imported Meta export and Converty summary, joined by ad name. Money stays in each file's own currency. */
export interface ImportedAds {
  meta: ImportedSpan;
  converty: ImportedSpan;
  ads: ImportedAd[];
  daily: ImportedDay[];
  totals: ImportedTotals;
  /** Orders Converty could not attribute to an ad. */
  unattributed?: Omit<ImportedTotals, "spend" | "impressions" | "linkClicks" | "results"> | null;
}

export interface MetaAccountCampaign {
  id: string;
  name: string;
  status: string;
  assignedProductId?: string | null;
  assignedProductName?: string | null;
}

export interface MetaPage {
  id: string;
  name: string;
}

export interface MetaPublishResult {
  concept: CampaignConcept;
  metaCampaignId: string;
  metaAdSetId: string;
  publishedCount: number;
  notReadyCount: number;
}

export interface IntegrationStatus {
  id: string;
  connected: boolean;
  label?: string | null;
  error?: string | null;
  /** When the saved token stops working, if it expires (Meta OAuth tokens last about 60 days). */
  expiresAt?: string | null;
}

export interface AiPromptTemplate {
  id: string;
  label: string;
  prompt: string;
  placeholders: Array<{ token: string; description: string }>;
}

export interface UserNote {
  id: string;
  note: string;
  createdAt: string;
}

export interface CreativeExplorationPromptTemplate {
  templateId: string;
  content: string;
  version: number;
  isCustom: boolean;
  updatedAt: string | null;
}

export interface AiModelInput {
  provider?: string;
  model?: string;
  options?: Record<string, unknown>;
}

const AD_FIELDS =
  "id conceptId order format awareness title hook direction beats cta notes imageStatus imageUrl metaPublishStatus metaAdId metaPublishError";
const PIPELINE_TASK_FIELDS =
  "id productId adId conceptId adRef title format awareness hook variant stage checklist { id label done } notes metaAdRef sortOrder adRemoved imageStatus imageUrl createdAt updatedAt stageChangedAt";
const CONCEPT_FIELDS = `id campaignId productId avatarId angleId offerId startDate endDate spend positionX positionY createdAt metaAdSetId ads { ${AD_FIELDS} }`;
const CAMPAIGN_FIELDS = `id productId name kind testType positionX positionY createdAt metaCampaignId concepts { ${CONCEPT_FIELDS} }`;

const DATA_ITEM_FIELDS = "id kind label filename mimeType productId text dataUrl frames url trim { start end } saveMode notice";

const documents = {
  session: `query session { session { token expiresAt user { id displayName email } workspace { id name role } } }`,
  signInWithoutPassword: `mutation signInWithoutPassword($input: PasswordlessSignInInput!) { signInWithoutPassword(input: $input) { token expiresAt user { id displayName email } workspace { id name role } } }`,
  signOut: `mutation signOut { signOut }`,
  workspaceMembers: `query workspaceMembers { workspaceMembers { user { id displayName email } role createdAt } }`,
  addWorkspaceMember: `mutation addWorkspaceMember($input: AddWorkspaceMemberInput!) { addWorkspaceMember(input: $input) { user { id displayName email } role createdAt } }`,
  products: `query products { products { id brandId name description imageUrl createdAt } }`,
  aiModels: `query aiModels($provider: String!) { aiModels(provider: $provider) { id label tier } }`,
  aiPromptTemplates: `query aiPromptTemplates { aiPromptTemplates { id label prompt placeholders { token description } } }`,
  updateAiPromptTemplate: `mutation updateAiPromptTemplate($input: UpdateAiPromptTemplateInput!) { updateAiPromptTemplate(input: $input) { id label prompt placeholders { token description } } }`,
  costLedger: `query costLedger($limit: Int) { costLedger(limit: $limit) { id createdAt occurredAt provider model providerRequestId operation operationId parentGenerationId attempt requestContext rawUsage normalizedUsage { inputTokens uncachedInputTokens cachedInputTokens cacheWriteTokens outputTokens reasoningTokens totalTokens } cost { status usd reason breakdown } pricing } }`,
  operationLogs: `query operationLogs($limit: Int) { operationLogs(limit: $limit) { id operationType status startedAt completedAt durationMs totalCostUsd input { id traceStatus representation content redactionStatus byteSize } output { id traceStatus representation content redactionStatus byteSize } error { stage code message } related { productId strategyNodeId creativeId generationId } attempts { id attemptNumber costSource provider service model status startedAt completedAt durationMs providerRequestId requestOptions flags error { stage code message } request { id traceStatus representation content redactionStatus byteSize } response { id traceStatus representation content redactionStatus byteSize } rawResponse { id traceStatus representation content redactionStatus byteSize } usage cost { status usd currency reason breakdown pricing } } } }`,
  inspectProductUrl: `mutation inspectProductUrl($url: String!) { inspectProductUrl(url: $url) { fetch { status failureReason httpStatus requestedUrl finalUrl renderMode } classification listingScope confidence scores { product listing rawProduct rawListing } unknownReason signals candidates { name url imageUrl price currency sku evidence { structuredProduct offer purchaseAction productHeading productDescription productGallery variantSelector } confidence } evidence classificationPolicyVersion } }`,
  ingestProductSource: `mutation ingestProductSource($url: String!) { ingestProductSource(url: $url) { id type label value status inspection { fetch { status failureReason httpStatus requestedUrl finalUrl renderMode } classification listingScope confidence scores { product listing rawProduct rawListing } unknownReason signals candidates { name url imageUrl price currency sku evidence { structuredProduct offer purchaseAction productHeading productDescription productGallery variantSelector } confidence } evidence classificationPolicyVersion } } }`,
  buildProductContext: `mutation buildProductContext($sources: [ProductSourceInput!]!, $ai: AiModelInput) { buildProductContext(sources: $sources, ai: $ai) { id name workingLabel category summary features mechanisms benefits proofPoints useCases claims constraints sourceIds createdAt } }`,
  createProduct: `mutation createProduct($input: CreateProductInput!) { createProduct(input: $input) { id brandId name description imageUrl createdAt } }`,
  generateProductImage: `mutation generateProductImage($id: ID!) { generateProductImage(id: $id) { id brandId name description imageUrl createdAt } }`,
  setProductImage: `mutation setProductImage($id: ID!, $imageUrl: String!) { setProductImage(id: $id, imageUrl: $imageUrl) { id brandId name description imageUrl createdAt } }`,
  productMedia: `query productMedia($productId: ID!) { productMedia(productId: $productId) { id type label filename url frames } }`,
  productStrategy: `query productStrategy($productId: ID!, $lineageMode: String) { productStrategy(productId: $productId, lineageMode: $lineageMode) { id parentId productId type label name workingLabel category definingNeed context productRelevance supportedBy awarenessLevel awarenessRationale messagingImplication profileRange { dimension profiles { position label problemExperience currentBehavior solutionExperience awarenessLevel buyingState } } framing audienceConnection creativeOpportunity creativePotential summary keyMessage tags audienceFitNote lineageMode productConnection whyItCouldWork profileRangeFit { primary rationale } premise whyItLands executionNote avatarId offerId createdAt generated positionX positionY } }`,
  lineageHistory: `query lineageHistory($productId: ID!, $limit: Int) { lineageHistory(productId: $productId, limit: $limit) { id productId type summary createdAt rootNode { id parentId productId type label createdAt } removedNodes { id parentId productId type label createdAt } } }`,
  deleteStrategySubtree: `mutation deleteStrategySubtree($nodeId: ID!) { deleteStrategySubtree(nodeId: $nodeId) { id productId type summary createdAt rootNode { id type label } removedNodes { id type label } } }`,
  updateStrategyNodePosition: `mutation updateStrategyNodePosition($input: UpdateStrategyNodePositionInput!) { updateStrategyNodePosition(input: $input) }`,
  creatives: `query creatives($productId: ID!) { creatives(productId: $productId) { id parentId productId type label title thumbnail duration status platform createdAt generated } }`,
  performance: `query performance($productId: ID!) { performance(productId: $productId) { spend revenue roas winningCreativeId } }`,
  contextSources: `query contextSources($productId: ID!) { contextSources(productId: $productId) { id productId name kind status statusDetail fileName mimeType sizeBytes market version charCount summary warnings createdAt updatedAt } }`,
  contextSourceContent: `query contextSourceContent($id: ID!) { contextSourceContent(id: $id) { id text structure } }`,
  addContextSource: `mutation addContextSource($input: AddContextSourceInput!) { addContextSource(input: $input) { id productId name kind status statusDetail fileName mimeType sizeBytes market version charCount summary warnings createdAt updatedAt } }`,
  updateContextSource: `mutation updateContextSource($input: UpdateContextSourceInput!) { updateContextSource(input: $input) { id productId name kind status statusDetail fileName mimeType sizeBytes market version charCount summary warnings createdAt updatedAt } }`,
  deleteContextSource: `mutation deleteContextSource($id: ID!) { deleteContextSource(id: $id) }`,
  generationContextPreview: `query generationContextPreview($input: GenerationContextPreviewInput!) { generationContextPreview(input: $input) { generator templateVersion productContext instructions totalChars budgetChars rules sources { id name kind market version availableChars includedChars truncated coverage warnings text } } }`,
  generationProvenance: `query generationProvenance($generationId: ID!) { generationProvenance(generationId: $generationId) { generationId productId generator templateId templateVersion instructions contextChars createdAt sources { id name kind version contentHash availableChars includedChars truncated coverage } } }`,
  pipelineTasks: `query pipelineTasks($productId: ID!) { pipelineTasks(productId: $productId) { ${PIPELINE_TASK_FIELDS} } }`,
  createPipelineTask: `mutation createPipelineTask($input: CreatePipelineTaskInput!) { createPipelineTask(input: $input) { ${PIPELINE_TASK_FIELDS} } }`,
  updatePipelineTask: `mutation updatePipelineTask($input: UpdatePipelineTaskInput!) { updatePipelineTask(input: $input) { ${PIPELINE_TASK_FIELDS} } }`,
  movePipelineTask: `mutation movePipelineTask($input: MovePipelineTaskInput!) { movePipelineTask(input: $input) { ${PIPELINE_TASK_FIELDS} } }`,
  deletePipelineTask: `mutation deletePipelineTask($id: ID!) { deletePipelineTask(id: $id) }`,
  generateCreativeExplorationAngles: `mutation generateCreativeExplorationAngles($input: GenerateCreativeExplorationAnglesInput!) { generateCreativeExplorationAngles(input: $input) { id parentId productId type label framing creativePotential lineageMode createdAt generated } }`,
  generateCreativeExplorationOffers: `mutation generateCreativeExplorationOffers($input: GenerateCreativeExplorationOffersInput!) { generateCreativeExplorationOffers(input: $input) { id parentId productId type label framing creativePotential lineageMode createdAt generated } }`,
  generateCreativeExplorationTargetAvatars: `mutation generateCreativeExplorationTargetAvatars($input: GenerateCreativeExplorationTargetAvatarsInput!) { generateCreativeExplorationTargetAvatars(input: $input) { id label gender ageRange profession lifeRhythm painPoint productConnection priorities buyingContext } }`,
  targetAvatars: `query targetAvatars($productId: ID!) { targetAvatars(productId: $productId) { id label gender ageRange profession lifeRhythm painPoint productConnection priorities buyingContext } }`,
  deleteTargetAvatar: `mutation deleteTargetAvatar($productId: ID!, $avatarId: ID!) { deleteTargetAvatar(productId: $productId, avatarId: $avatarId) { id label gender ageRange profession lifeRhythm painPoint productConnection priorities buyingContext } }`,
  resetTargetAvatars: `mutation resetTargetAvatars($productId: ID!) { resetTargetAvatars(productId: $productId) }`,
  avatarCanvas: `query avatarCanvas($productId: ID!) { avatarCanvas(productId: $productId) }`,
  saveAvatarCanvas: `mutation saveAvatarCanvas($productId: ID!, $canvas: JSON!) { saveAvatarCanvas(productId: $productId, canvas: $canvas) }`,
  productContext: `query productContext($productId: ID!) { productContext(productId: $productId) { id name workingLabel category summary features mechanisms benefits proofPoints useCases claims constraints sourceIds createdAt } }`,
  creativeExplorationPromptTemplate: `query creativeExplorationPromptTemplate($templateId: String!) { creativeExplorationPromptTemplate(templateId: $templateId) { templateId content version isCustom updatedAt } }`,
  updateCreativeExplorationPromptTemplate: `mutation updateCreativeExplorationPromptTemplate($input: UpdateCreativeExplorationPromptTemplateInput!) { updateCreativeExplorationPromptTemplate(input: $input) { templateId content version isCustom updatedAt } }`,
  userNotes: `query userNotes($limit: Int) { userNotes(limit: $limit) { id note createdAt } }`,
  submitUserNote: `mutation submitUserNote($input: SubmitUserNoteInput!) { submitUserNote(input: $input) { id note createdAt } }`,
  productSources: `query productSources { productSources { id productId type kind label filename mimeType sizeBytes storedBytes status text url copies thumbnail peaks durationSeconds createdAt } }`,
  promptCatalog: `query promptCatalog { promptCatalog { id label group modality description usedWhen inactiveNote chars isCustom version updatedAt placeholders { token description } } }`,
  promptCatalogContent: `query promptCatalogContent($id: ID!) { promptCatalogContent(id: $id) { id content isCustom version updatedAt placeholders { token description } } }`,
  savePromptCatalogContent: `mutation savePromptCatalogContent($id: ID!, $content: String!) { savePromptCatalogContent(id: $id, content: $content) { id content isCustom version updatedAt placeholders { token description } } }`,
  dataItem: `query dataItem($id: ID!) { dataItem(id: $id) { ${DATA_ITEM_FIELDS} } }`,
  saveDataItem: `mutation saveDataItem($input: DataItemEditInput!) { saveDataItem(input: $input) { ${DATA_ITEM_FIELDS} } }`,
  copyDataItem: `mutation copyDataItem($input: DataItemEditInput!) { copyDataItem(input: $input) { ${DATA_ITEM_FIELDS} } }`,
  renameDataItem: `mutation renameDataItem($id: ID!, $label: String!) { renameDataItem(id: $id, label: $label) { ${DATA_ITEM_FIELDS} } }`,
  duplicateDataItem: `mutation duplicateDataItem($id: ID!) { duplicateDataItem(id: $id) { ${DATA_ITEM_FIELDS} } }`,
  deleteDataItem: `mutation deleteDataItem($id: ID!) { deleteDataItem(id: $id) }`,
  addDataItem: `mutation addDataItem($input: DataItemAddInput!) { addDataItem(input: $input) }`,
  saveDataItemPreview: `mutation saveDataItemPreview($input: DataItemPreviewInput!) { saveDataItemPreview(input: $input) }`,
  csvImportTable: `query csvImportTable($id: ID!) { csvImportTable(id: $id) { id fileName columns rows truncated } }`,
  integrationStatus: `query integrationStatus { integrationStatus { id connected label error expiresAt } }`,
  shopifyProducts: `query shopifyProducts($search: String) { shopifyProducts(search: $search) { id title handle status imageUrl } }`,
  shopifyProductLink: `query shopifyProductLink($productId: ID!) { shopifyProductLink(productId: $productId) { productId provider storeDomain externalId title linkedAt } }`,
  linkShopifyProduct: `mutation linkShopifyProduct($productId: ID!, $shopifyProductId: ID!) { linkShopifyProduct(productId: $productId, shopifyProductId: $shopifyProductId) { productId provider storeDomain externalId title linkedAt } }`,
  unlinkShopifyProduct: `mutation unlinkShopifyProduct($productId: ID!) { unlinkShopifyProduct(productId: $productId) }`,
  campaigns: `query campaigns($productId: ID!) { campaigns(productId: $productId) { ${CAMPAIGN_FIELDS} } }`,
  createCampaign: `mutation createCampaign($productId: ID!, $name: String, $kind: String, $testType: String, $positionX: Float, $positionY: Float) { createCampaign(productId: $productId, name: $name, kind: $kind, testType: $testType, positionX: $positionX, positionY: $positionY) { ${CAMPAIGN_FIELDS} } }`,
  createCampaignWithConcepts: `mutation createCampaignWithConcepts($productId: ID!, $name: String, $kind: String, $testType: String, $combos: [ConceptComboInput!]!) { createCampaignWithConcepts(productId: $productId, name: $name, kind: $kind, testType: $testType, combos: $combos) { ${CAMPAIGN_FIELDS} } }`,
  updateCampaign: `mutation updateCampaign($id: ID!, $name: String, $kind: String, $testType: String, $positionX: Float, $positionY: Float) { updateCampaign(id: $id, name: $name, kind: $kind, testType: $testType, positionX: $positionX, positionY: $positionY) { ${CAMPAIGN_FIELDS} } }`,
  deleteCampaign: `mutation deleteCampaign($id: ID!) { deleteCampaign(id: $id) }`,
  addCampaignConcepts: `mutation addCampaignConcepts($campaignId: ID!, $combos: [ConceptComboInput!]!) { addCampaignConcepts(campaignId: $campaignId, combos: $combos) { skipped created { ${CONCEPT_FIELDS} } } }`,
  relinkCampaignConcept: `mutation relinkCampaignConcept($id: ID!, $avatarId: ID, $angleId: ID, $offerId: ID) { relinkCampaignConcept(id: $id, avatarId: $avatarId, angleId: $angleId, offerId: $offerId) { ${CONCEPT_FIELDS} } }`,
  createEmptyCampaignConcept: `mutation createEmptyCampaignConcept($campaignId: ID!, $positionX: Float, $positionY: Float) { createEmptyCampaignConcept(campaignId: $campaignId, positionX: $positionX, positionY: $positionY) { ${CONCEPT_FIELDS} } }`,
  unlinkCampaignConcept: `mutation unlinkCampaignConcept($id: ID!, $slot: String!) { unlinkCampaignConcept(id: $id, slot: $slot) { ${CONCEPT_FIELDS} } }`,
  updateCampaignConcept: `mutation updateCampaignConcept($id: ID!, $startDate: String, $endDate: String, $spend: Float, $positionX: Float, $positionY: Float) { updateCampaignConcept(id: $id, startDate: $startDate, endDate: $endDate, spend: $spend, positionX: $positionX, positionY: $positionY) { ${CONCEPT_FIELDS} } }`,
  deleteCampaignConcept: `mutation deleteCampaignConcept($id: ID!) { deleteCampaignConcept(id: $id) }`,
  addCampaignAd: `mutation addCampaignAd($conceptId: ID!, $format: String, $awareness: String, $title: String, $hook: String, $notes: String, $direction: String, $beats: [String!], $cta: String) { addCampaignAd(conceptId: $conceptId, format: $format, awareness: $awareness, title: $title, hook: $hook, notes: $notes, direction: $direction, beats: $beats, cta: $cta) { ${AD_FIELDS} } }`,
  updateCampaignAd: `mutation updateCampaignAd($id: ID!, $format: String, $awareness: String, $title: String, $hook: String, $notes: String, $direction: String, $beats: [String!], $cta: String) { updateCampaignAd(id: $id, format: $format, awareness: $awareness, title: $title, hook: $hook, notes: $notes, direction: $direction, beats: $beats, cta: $cta) { ${AD_FIELDS} } }`,
  generateAdHookAlternatives: `mutation generateAdHookAlternatives($input: GenerateAdHooksInput!) { generateAdHookAlternatives(input: $input) }`,
  generateCampaignAdPlan: `mutation generateCampaignAdPlan($input: GenerateCampaignAdPlanInput!) { generateCampaignAdPlan(input: $input) { ${AD_FIELDS} } }`,
  generateCampaignAdImage: `mutation generateCampaignAdImage($id: ID!) { generateCampaignAdImage(id: $id) { ${AD_FIELDS} } }`,
  publishConceptToMeta: `mutation publishConceptToMeta($id: ID!, $input: MetaPublishInput!) { publishConceptToMeta(id: $id, input: $input) { metaCampaignId metaAdSetId publishedCount notReadyCount concept { ${CONCEPT_FIELDS} } } }`,
  deleteCampaignAd: `mutation deleteCampaignAd($id: ID!) { deleteCampaignAd(id: $id) }`,
  disconnectIntegration: `mutation disconnectIntegration($id: ID!) { disconnectIntegration(id: $id) { id disconnected remoteRevoked message } }`,
  startMetaConnection: `mutation startMetaConnection { startMetaConnection { url } }`,
  startShopifyConnection: `mutation startShopifyConnection($shop: String) { startShopifyConnection(shop: $shop) { url shop } }`,
  startConvertyConnection: `mutation startConvertyConnection { startConvertyConnection { url } }`,
  startGoogleDriveConnection: `mutation startGoogleDriveConnection { startGoogleDriveConnection { url } }`,
  googleDrivePickerToken: `query googleDrivePickerToken { googleDrivePickerToken }`,
  ensureTargetAvatarImages: `mutation ensureTargetAvatarImages($productId: ID!) { ensureTargetAvatarImages(productId: $productId) { avatarId status } }`,
  targetAvatarImageStatuses: `query targetAvatarImageStatuses($productId: ID!) { targetAvatarImageStatuses(productId: $productId) { avatarId status } }`,
  targetAvatarImage: `query targetAvatarImage($avatarId: ID!) { targetAvatarImage(avatarId: $avatarId) }`,
  pexelsBanners: `query pexelsBanners($query: String, $page: Int, $perPage: Int, $orientation: String) { pexelsBanners(query: $query, page: $page, perPage: $perPage, orientation: $orientation) { configured page hasMore photos { id alt photographer photographerUrl pageUrl avgColor thumbUrl bannerUrl } } }`,
  importGoogleDriveFile: `mutation importGoogleDriveFile($fileId: ID!) { importGoogleDriveFile(fileId: $fileId) { id type label value status inspection { fetch { status failureReason httpStatus requestedUrl finalUrl renderMode } classification listingScope confidence scores { product listing rawProduct rawListing } unknownReason signals candidates { name url imageUrl price currency sku evidence { structuredProduct offer purchaseAction productHeading productDescription productGallery variantSelector } confidence } evidence classificationPolicyVersion } } }`,
  exportAdImageToGoogleDrive: `mutation exportAdImageToGoogleDrive($adId: ID!, $targetFileId: ID) { exportAdImageToGoogleDrive(adId: $adId, targetFileId: $targetFileId) { fileId webViewLink } }`,
  metaAdsPerformance: `query metaAdsPerformance($days: Int, $refresh: Boolean, $productId: ID, $scope: String) { metaAdsPerformance(days: $days, refresh: $refresh, productId: $productId, scope: $scope) { connected error accountId accountName currency accountStatus fetchedAt scope campaignCount unassigned range { since until days } totals { spend impressions reach clicks purchases revenue } previousTotals { spend impressions reach clicks purchases revenue } daily { date spend impressions clicks purchases revenue } campaigns { id name status spend impressions reach clicks purchases revenue } } }`,
  shopifySales: `query shopifySales($days: Int, $refresh: Boolean, $productId: ID, $scope: String) { shopifySales(days: $days, refresh: $refresh, productId: $productId, scope: $scope) { connected error shopName currency scope unlinked linkedTitle historyLimited truncated testOrders fetchedAt range { since until days } totals { orders units revenue } previousTotals { orders units revenue } daily { date orders revenue } recentOrders { id name createdAt status total items test } topProducts { id title units revenue } } }`,
  analyzeCsvImport: `mutation analyzeCsvImport($fileName: String!, $csv: String!) { analyzeCsvImport(fileName: $fileName, csv: $csv) { analysisId fileName kind kindLabel rows adCount dateFrom dateTo currency currencyKnown suggestedProductId warnings products { productId productName ads rows reason } unresolved { ads rows samples } } }`,
  commitCsvImport: `mutation commitCsvImport($analysisId: ID!, $decisions: CsvDecisionsInput) { commitCsvImport(analysisId: $analysisId, decisions: $decisions) { importId fileName kind currency imported updated unchanged skipped products { productId productName imported updated } } }`,
  importedAds: `query importedAds($productId: ID, $scope: String) { importedAds(productId: $productId, scope: $scope) { meta { rows currency mixedCurrency dateFrom dateTo } converty { rows currency mixedCurrency dateFrom dateTo } daily { date spend impressions linkClicks results purchases } totals { spend impressions linkClicks results purchases orders deleted confirmed delivered returned deliveredRevenue } unattributed { orders deleted confirmed delivered returned deliveredRevenue } ads { name delivery hasMeta hasConverty days spend spendInOrderWindow impressions linkClicks landingPageViews results purchases hookRate holdRate orders deleted confirmed delivered returned deliveredRevenue imageStatus imageUrl videoUrl } } }`,
  exchangeRates: `query exchangeRates { exchangeRates { source updatedAt stale rates { currency rate } } }`,
  deleteCsvImport: `mutation deleteCsvImport($id: ID!) { deleteCsvImport(id: $id) }`,
  csvCoverage: `query csvCoverage($productId: ID!) { csvCoverage(productId: $productId) { meta { rows dateFrom dateTo importedAt } converty { rows dateFrom dateTo importedAt } } }`,
  csvImports: `query csvImports($limit: Int) { csvImports(limit: $limit) { id kind fileName currency dateFrom dateTo rowsTotal rowsImported rowsUpdated rowsSkipped rowsHeld products productIds createdAt } }`,
  metaCampaigns: `query metaCampaigns($productId: ID!) { metaCampaigns(productId: $productId) { id name status assignedProductId assignedProductName } }`,
  metaPages: `query metaPages { metaPages { id name } }`,
  setProductMetaCampaigns: `mutation setProductMetaCampaigns($productId: ID!, $campaigns: [MetaCampaignInput!]!) { setProductMetaCampaigns(productId: $productId, campaigns: $campaigns) }`,
  connectMetaAds: `mutation connectMetaAds($accessToken: String!) { connectMetaAds(accessToken: $accessToken) { id connected label error expiresAt } }`,
} as const;

async function execute<T>(
  operationName: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return sendHttpRequest<T>(buildGraphQLHttpRequest({ operationName, query, variables }));
}

/** Single domain-facing GraphQL API bundle; mocks remain active in the prototype. */
export const api: GraphQLApi = {
  async session() {
    return (await execute<{ session: AuthSession | null }>("session", documents.session)).session;
  },
  async signInWithoutPassword(input) {
    return (
      await execute<{ signInWithoutPassword: AuthSession }>(
        "signInWithoutPassword",
        documents.signInWithoutPassword,
        { input },
      )
    ).signInWithoutPassword;
  },
  async signOut() {
    return (await execute<{ signOut: boolean }>("signOut", documents.signOut)).signOut;
  },
  async workspaceMembers() {
    return (
      await execute<{ workspaceMembers: WorkspaceMember[] }>(
        "workspaceMembers",
        documents.workspaceMembers,
      )
    ).workspaceMembers;
  },
  async addWorkspaceMember(input) {
    return (
      await execute<{ addWorkspaceMember: WorkspaceMember }>(
        "addWorkspaceMember",
        documents.addWorkspaceMember,
        { input },
      )
    ).addWorkspaceMember;
  },
  async products() {
    return (await execute<{ products: Product[] }>("products", documents.products)).products;
  },
  async aiModels(provider) {
    return (
      await execute<{ aiModels: AiModelOption[] }>("aiModels", documents.aiModels, { provider })
    ).aiModels;
  },
  async promptCatalog() {
    return (await execute<{ promptCatalog: PromptCatalogEntry[] }>("promptCatalog", documents.promptCatalog)).promptCatalog;
  },
  async promptCatalogContent(input) {
    return (await execute<{ promptCatalogContent: PromptCatalogContent }>("promptCatalogContent", documents.promptCatalogContent, input)).promptCatalogContent;
  },
  async savePromptCatalogContent(input) {
    return (await execute<{ savePromptCatalogContent: PromptCatalogContent }>("savePromptCatalogContent", documents.savePromptCatalogContent, input)).savePromptCatalogContent;
  },
  async dataItem(input) {
    return (await execute<{ dataItem: DataItemContent }>("dataItem", documents.dataItem, input)).dataItem;
  },
  async saveDataItem(input) {
    return (await execute<{ saveDataItem: DataItemContent }>("saveDataItem", documents.saveDataItem, { input })).saveDataItem;
  },
  async copyDataItem(input) {
    return (await execute<{ copyDataItem: DataItemContent }>("copyDataItem", documents.copyDataItem, { input })).copyDataItem;
  },
  async renameDataItem(input) {
    return (await execute<{ renameDataItem: DataItemContent }>("renameDataItem", documents.renameDataItem, input)).renameDataItem;
  },
  async duplicateDataItem(input) {
    return (await execute<{ duplicateDataItem: DataItemContent }>("duplicateDataItem", documents.duplicateDataItem, input)).duplicateDataItem;
  },
  async deleteDataItem(input) {
    return (await execute<{ deleteDataItem: boolean }>("deleteDataItem", documents.deleteDataItem, input)).deleteDataItem;
  },
  async addDataItem(input) {
    return (await execute<{ addDataItem: string }>("addDataItem", documents.addDataItem, { input })).addDataItem;
  },
  async saveDataItemPreview(input) {
    return (await execute<{ saveDataItemPreview: boolean }>("saveDataItemPreview", documents.saveDataItemPreview, { input })).saveDataItemPreview;
  },
  async csvImportTable(input) {
    return (await execute<{ csvImportTable: CsvImportTable }>("csvImportTable", documents.csvImportTable, input)).csvImportTable;
  },
  async aiPromptTemplates() {
    return (
      await execute<{ aiPromptTemplates: AiPromptTemplate[] }>(
        "aiPromptTemplates",
        documents.aiPromptTemplates,
      )
    ).aiPromptTemplates;
  },
  async updateAiPromptTemplate(input) {
    return (
      await execute<{ updateAiPromptTemplate: AiPromptTemplate }>(
        "updateAiPromptTemplate",
        documents.updateAiPromptTemplate,
        { input },
      )
    ).updateAiPromptTemplate;
  },
  async costLedger(input = {}) {
    return (
      await execute<{ costLedger: AiCostLedgerEntry[] }>("costLedger", documents.costLedger, input)
    ).costLedger;
  },
  async operationLogs(input = {}) {
    return (
      await execute<{ operationLogs: OperationLog[] }>(
        "operationLogs",
        documents.operationLogs,
        input,
      )
    ).operationLogs;
  },
  async inspectProductUrl(input) {
    const result = await execute<{ inspectProductUrl: UrlInspectionResult }>(
      "inspectProductUrl",
      documents.inspectProductUrl,
      input,
    );
    return result.inspectProductUrl;
  },
  async ingestProductSource(input) {
    return (
      await execute<{ ingestProductSource: ProductSource }>(
        "ingestProductSource",
        documents.ingestProductSource,
        input,
      )
    ).ingestProductSource;
  },
  async buildProductContext({ sources, ai }) {
    const variables = {
      sources: sources.map(({ id, type, label, value, filename, mimeType, size, status }) => ({
        id,
        type,
        label,
        value,
        filename,
        mimeType,
        size,
        status,
      })),
      ai,
    };
    return (
      await execute<{ buildProductContext: ProductContext }>(
        "buildProductContext",
        documents.buildProductContext,
        variables,
      )
    ).buildProductContext;
  },
  async createProduct(input) {
    return (
      await execute<{ createProduct: Product }>("createProduct", documents.createProduct, { input })
    ).createProduct;
  },
  async generateProductImage({ id }) {
    return (
      await execute<{ generateProductImage: Product }>("generateProductImage", documents.generateProductImage, { id })
    ).generateProductImage;
  },
  async setProductImage({ id, imageUrl }) {
    return (
      await execute<{ setProductImage: Product }>("setProductImage", documents.setProductImage, { id, imageUrl })
    ).setProductImage;
  },
  async productMedia(input) {
    return (await execute<{ productMedia: ProductMediaAsset[] }>("productMedia", documents.productMedia, input)).productMedia;
  },
  async productStrategy(input) {
    return (
      await execute<{ productStrategy: StrategyNode[] }>(
        "productStrategy",
        documents.productStrategy,
        input,
      )
    ).productStrategy;
  },
  async lineageHistory(input) { return (await execute<{ lineageHistory: LineageHistoryEvent[] }>("lineageHistory", documents.lineageHistory, input)).lineageHistory; },
  async deleteStrategySubtree(input) { return (await execute<{ deleteStrategySubtree: LineageHistoryEvent }>("deleteStrategySubtree", documents.deleteStrategySubtree, input)).deleteStrategySubtree; },
  async updateStrategyNodePosition(input) {
    return (
      await execute<{ updateStrategyNodePosition: boolean }>(
        "updateStrategyNodePosition",
        documents.updateStrategyNodePosition,
        { input },
      )
    ).updateStrategyNodePosition;
  },
  async contextSources(input) {
    return (await execute<{ contextSources: ContextSource[] }>("contextSources", documents.contextSources, input)).contextSources;
  },
  async contextSourceContent(input) {
    return (await execute<{ contextSourceContent: ContextSourceContent }>("contextSourceContent", documents.contextSourceContent, input)).contextSourceContent;
  },
  async addContextSource(input) {
    return (await execute<{ addContextSource: ContextSource }>("addContextSource", documents.addContextSource, { input })).addContextSource;
  },
  async updateContextSource(input) {
    return (await execute<{ updateContextSource: ContextSource }>("updateContextSource", documents.updateContextSource, { input })).updateContextSource;
  },
  async deleteContextSource(input) {
    return (await execute<{ deleteContextSource: boolean }>("deleteContextSource", documents.deleteContextSource, input)).deleteContextSource;
  },
  async generationContextPreview(input) {
    return (
      await execute<{ generationContextPreview: GenerationContextPreview }>("generationContextPreview", documents.generationContextPreview, {
        input: { productId: input.productId, generator: input.generator, context: input.context },
      })
    ).generationContextPreview;
  },
  async generationProvenance(input) {
    return (await execute<{ generationProvenance: GenerationProvenance | null }>("generationProvenance", documents.generationProvenance, input)).generationProvenance;
  },
  async pipelineTasks(input) {
    return (await execute<{ pipelineTasks: PipelineTask[] }>("pipelineTasks", documents.pipelineTasks, input)).pipelineTasks;
  },
  async createPipelineTask(input) {
    return (await execute<{ createPipelineTask: PipelineTask }>("createPipelineTask", documents.createPipelineTask, { input })).createPipelineTask;
  },
  async updatePipelineTask(input) {
    return (await execute<{ updatePipelineTask: PipelineTask }>("updatePipelineTask", documents.updatePipelineTask, { input })).updatePipelineTask;
  },
  async movePipelineTask(input) {
    return (await execute<{ movePipelineTask: PipelineTask }>("movePipelineTask", documents.movePipelineTask, { input })).movePipelineTask;
  },
  async deletePipelineTask(input) {
    return (await execute<{ deletePipelineTask: boolean }>("deletePipelineTask", documents.deletePipelineTask, input)).deletePipelineTask;
  },
  async generateCreativeExplorationAngles(input) {
    return (
      await execute<{ generateCreativeExplorationAngles: AngleNode[] }>(
        "generateCreativeExplorationAngles",
        documents.generateCreativeExplorationAngles,
        { input },
      )
    ).generateCreativeExplorationAngles;
  },
  async generateCreativeExplorationOffers(input) {
    return (
      await execute<{ generateCreativeExplorationOffers: StrategyNode[] }>(
        "generateCreativeExplorationOffers",
        documents.generateCreativeExplorationOffers,
        { input },
      )
    ).generateCreativeExplorationOffers;
  },
  async generateCreativeExplorationTargetAvatars(input) {
    return (
      await execute<{ generateCreativeExplorationTargetAvatars: TargetAvatar[] }>(
        "generateCreativeExplorationTargetAvatars",
        documents.generateCreativeExplorationTargetAvatars,
        { input },
      )
    ).generateCreativeExplorationTargetAvatars;
  },
  async targetAvatars(input) {
    return (
      await execute<{ targetAvatars: TargetAvatar[] }>(
        "targetAvatars",
        documents.targetAvatars,
        input,
      )
    ).targetAvatars;
  },
  async deleteTargetAvatar(input) {
    return (
      await execute<{ deleteTargetAvatar: TargetAvatar[] }>(
        "deleteTargetAvatar",
        documents.deleteTargetAvatar,
        input,
      )
    ).deleteTargetAvatar;
  },
  async resetTargetAvatars(input) {
    return (
      await execute<{ resetTargetAvatars: boolean }>(
        "resetTargetAvatars",
        documents.resetTargetAvatars,
        input,
      )
    ).resetTargetAvatars;
  },
  async avatarCanvas(input) {
    return (
      await execute<{ avatarCanvas: AvatarCanvas | null }>(
        "avatarCanvas",
        documents.avatarCanvas,
        input,
      )
    ).avatarCanvas;
  },
  async saveAvatarCanvas(input) {
    return (
      await execute<{ saveAvatarCanvas: boolean }>(
        "saveAvatarCanvas",
        documents.saveAvatarCanvas,
        input,
      )
    ).saveAvatarCanvas;
  },
  async creatives(input) {
    return (await execute<{ creatives: CreativeNode[] }>("creatives", documents.creatives, input))
      .creatives;
  },
  async performance(input) {
    return (
      await execute<{ performance: PerformanceSummary }>(
        "performance",
        documents.performance,
        input,
      )
    ).performance;
  },
  async productContext(input) {
    return (
      await execute<{ productContext: ProductContext | null }>(
        "productContext",
        documents.productContext,
        input,
      )
    ).productContext;
  },
  async creativeExplorationPromptTemplate(input) {
    return (
      await execute<{ creativeExplorationPromptTemplate: CreativeExplorationPromptTemplate }>(
        "creativeExplorationPromptTemplate",
        documents.creativeExplorationPromptTemplate,
        input,
      )
    ).creativeExplorationPromptTemplate;
  },
  async updateCreativeExplorationPromptTemplate(input) {
    return (
      await execute<{ updateCreativeExplorationPromptTemplate: CreativeExplorationPromptTemplate }>(
        "updateCreativeExplorationPromptTemplate",
        documents.updateCreativeExplorationPromptTemplate,
        { input },
      )
    ).updateCreativeExplorationPromptTemplate;
  },
  async userNotes(input = {}) {
    return (await execute<{ userNotes: UserNote[] }>("userNotes", documents.userNotes, input)).userNotes;
  },
  async submitUserNote(input) {
    return (
      await execute<{ submitUserNote: UserNote }>("submitUserNote", documents.submitUserNote, { input })
    ).submitUserNote;
  },
  async productSources() {
    return (
      await execute<{ productSources: StoredProductSource[] }>(
        "productSources",
        documents.productSources,
      )
    ).productSources;
  },
  async integrationStatus() {
    return (
      await execute<{ integrationStatus: IntegrationStatus[] }>(
        "integrationStatus",
        documents.integrationStatus,
      )
    ).integrationStatus;
  },
  async shopifyProducts(input) {
    return (
      await execute<{ shopifyProducts: ShopifyProduct[] }>("shopifyProducts", documents.shopifyProducts, {
        search: input?.search || null,
      })
    ).shopifyProducts;
  },
  async shopifyProductLink({ productId }) {
    return (
      await execute<{ shopifyProductLink: ProductLink | null }>(
        "shopifyProductLink",
        documents.shopifyProductLink,
        { productId },
      )
    ).shopifyProductLink;
  },
  async linkShopifyProduct({ productId, shopifyProductId }) {
    return (
      await execute<{ linkShopifyProduct: ProductLink }>(
        "linkShopifyProduct",
        documents.linkShopifyProduct,
        { productId, shopifyProductId },
      )
    ).linkShopifyProduct;
  },
  async campaigns({ productId }) {
    return (await execute<{ campaigns: Campaign[] }>("campaigns", documents.campaigns, { productId })).campaigns;
  },
  async createCampaign(input) {
    return (await execute<{ createCampaign: Campaign }>("createCampaign", documents.createCampaign, input)).createCampaign;
  },
  async createCampaignWithConcepts(input) {
    return (
      await execute<{ createCampaignWithConcepts: Campaign }>("createCampaignWithConcepts", documents.createCampaignWithConcepts, input)
    ).createCampaignWithConcepts;
  },
  async updateCampaign(input) {
    return (await execute<{ updateCampaign: Campaign }>("updateCampaign", documents.updateCampaign, input)).updateCampaign;
  },
  async deleteCampaign({ id }) {
    return (await execute<{ deleteCampaign: boolean }>("deleteCampaign", documents.deleteCampaign, { id })).deleteCampaign;
  },
  async addCampaignConcepts(input) {
    return (
      await execute<{ addCampaignConcepts: { created: CampaignConcept[]; skipped: number } }>(
        "addCampaignConcepts",
        documents.addCampaignConcepts,
        input,
      )
    ).addCampaignConcepts;
  },
  async relinkCampaignConcept(input) {
    return (
      await execute<{ relinkCampaignConcept: CampaignConcept }>("relinkCampaignConcept", documents.relinkCampaignConcept, input)
    ).relinkCampaignConcept;
  },
  async createEmptyCampaignConcept(input) {
    return (
      await execute<{ createEmptyCampaignConcept: CampaignConcept }>("createEmptyCampaignConcept", documents.createEmptyCampaignConcept, input)
    ).createEmptyCampaignConcept;
  },
  async unlinkCampaignConcept(input) {
    return (
      await execute<{ unlinkCampaignConcept: CampaignConcept }>("unlinkCampaignConcept", documents.unlinkCampaignConcept, input)
    ).unlinkCampaignConcept;
  },
  async updateCampaignConcept(input) {
    return (
      await execute<{ updateCampaignConcept: CampaignConcept }>("updateCampaignConcept", documents.updateCampaignConcept, input)
    ).updateCampaignConcept;
  },
  async deleteCampaignConcept({ id }) {
    return (
      await execute<{ deleteCampaignConcept: boolean }>("deleteCampaignConcept", documents.deleteCampaignConcept, { id })
    ).deleteCampaignConcept;
  },
  async addCampaignAd(input) {
    return (await execute<{ addCampaignAd: CampaignAd }>("addCampaignAd", documents.addCampaignAd, input)).addCampaignAd;
  },
  async updateCampaignAd(input) {
    return (await execute<{ updateCampaignAd: CampaignAd }>("updateCampaignAd", documents.updateCampaignAd, input)).updateCampaignAd;
  },
  async generateAdHookAlternatives(input) {
    return (await execute<{ generateAdHookAlternatives: string[] }>("generateAdHookAlternatives", documents.generateAdHookAlternatives, { input })).generateAdHookAlternatives;
  },
  async generateCampaignAdPlan(input) {
    return (await execute<{ generateCampaignAdPlan: CampaignAd[] }>("generateCampaignAdPlan", documents.generateCampaignAdPlan, { input })).generateCampaignAdPlan;
  },
  async generateCampaignAdImage({ id }) {
    return (await execute<{ generateCampaignAdImage: CampaignAd }>("generateCampaignAdImage", documents.generateCampaignAdImage, { id })).generateCampaignAdImage;
  },
  async publishConceptToMeta({ id, pageId, destinationUrl, dailyBudgetCents }) {
    return (
      await execute<{ publishConceptToMeta: MetaPublishResult }>("publishConceptToMeta", documents.publishConceptToMeta, {
        id,
        input: { pageId, destinationUrl, dailyBudgetCents },
      })
    ).publishConceptToMeta;
  },
  async deleteCampaignAd({ id }) {
    return (await execute<{ deleteCampaignAd: boolean }>("deleteCampaignAd", documents.deleteCampaignAd, { id })).deleteCampaignAd;
  },
  async unlinkShopifyProduct({ productId }) {
    return (
      await execute<{ unlinkShopifyProduct: boolean }>(
        "unlinkShopifyProduct",
        documents.unlinkShopifyProduct,
        { productId },
      )
    ).unlinkShopifyProduct;
  },
  async disconnectIntegration({ id }) {
    return (
      await execute<{ disconnectIntegration: DisconnectResult }>(
        "disconnectIntegration",
        documents.disconnectIntegration,
        { id },
      )
    ).disconnectIntegration;
  },
  async startMetaConnection() {
    return (
      await execute<{ startMetaConnection: { url: string } }>(
        "startMetaConnection",
        documents.startMetaConnection,
      )
    ).startMetaConnection;
  },
  async startShopifyConnection({ shop }) {
    return (
      await execute<{ startShopifyConnection: ShopifyConnectionStart }>(
        "startShopifyConnection",
        documents.startShopifyConnection,
        { shop: shop || null },
      )
    ).startShopifyConnection;
  },
  async metaAdsPerformance(input) {
    return (await execute<{ metaAdsPerformance: MetaAdsPerformance }>("metaAdsPerformance", documents.metaAdsPerformance, input)).metaAdsPerformance;
  },
  async shopifySales(input) {
    return (await execute<{ shopifySales: ShopifySales }>("shopifySales", documents.shopifySales, input)).shopifySales;
  },
  async analyzeCsvImport(input) {
    return (await execute<{ analyzeCsvImport: CsvAnalysis }>("analyzeCsvImport", documents.analyzeCsvImport, input)).analyzeCsvImport;
  },
  async commitCsvImport(input) {
    return (await execute<{ commitCsvImport: CsvCommitResult }>("commitCsvImport", documents.commitCsvImport, input)).commitCsvImport;
  },
  async importedAds(input) {
    return (await execute<{ importedAds: ImportedAds }>("importedAds", documents.importedAds, input)).importedAds;
  },
  async exchangeRates() {
    return (await execute<{ exchangeRates: ExchangeRates }>("exchangeRates", documents.exchangeRates)).exchangeRates;
  },
  async deleteCsvImport(input) {
    return (await execute<{ deleteCsvImport: number }>("deleteCsvImport", documents.deleteCsvImport, input)).deleteCsvImport;
  },
  async csvCoverage(input) {
    return (await execute<{ csvCoverage: CsvCoverage }>("csvCoverage", documents.csvCoverage, input)).csvCoverage;
  },
  async csvImports(input) {
    return (await execute<{ csvImports: CsvImportRecord[] }>("csvImports", documents.csvImports, { limit: input?.limit ?? 5 })).csvImports;
  },
  async metaCampaigns(input) {
    return (await execute<{ metaCampaigns: MetaAccountCampaign[] }>("metaCampaigns", documents.metaCampaigns, input)).metaCampaigns;
  },
  async metaPages() {
    return (await execute<{ metaPages: MetaPage[] }>("metaPages", documents.metaPages)).metaPages;
  },
  async setProductMetaCampaigns(input) {
    return (await execute<{ setProductMetaCampaigns: number }>("setProductMetaCampaigns", documents.setProductMetaCampaigns, input)).setProductMetaCampaigns;
  },
  async connectMetaAds({ accessToken }) {
    return (
      await execute<{ connectMetaAds: IntegrationStatus }>(
        "connectMetaAds",
        documents.connectMetaAds,
        { accessToken },
      )
    ).connectMetaAds;
  },
  async startConvertyConnection() {
    return (
      await execute<{ startConvertyConnection: { url: string } }>(
        "startConvertyConnection",
        documents.startConvertyConnection,
      )
    ).startConvertyConnection;
  },
  async startGoogleDriveConnection() {
    return (
      await execute<{ startGoogleDriveConnection: { url: string } }>(
        "startGoogleDriveConnection",
        documents.startGoogleDriveConnection,
      )
    ).startGoogleDriveConnection;
  },
  async ensureTargetAvatarImages(input) {
    return (await execute<{ ensureTargetAvatarImages: TargetAvatarImageStatus[] }>("ensureTargetAvatarImages", documents.ensureTargetAvatarImages, input)).ensureTargetAvatarImages;
  },
  async targetAvatarImageStatuses(input) {
    return (await execute<{ targetAvatarImageStatuses: TargetAvatarImageStatus[] }>("targetAvatarImageStatuses", documents.targetAvatarImageStatuses, input)).targetAvatarImageStatuses;
  },
  async targetAvatarImage(input) {
    return (await execute<{ targetAvatarImage: string | null }>("targetAvatarImage", documents.targetAvatarImage, input)).targetAvatarImage;
  },
  async pexelsBanners(input) {
    return (await execute<{ pexelsBanners: PexelsBannerPage }>("pexelsBanners", documents.pexelsBanners, input)).pexelsBanners;
  },
  async googleDrivePickerToken() {
    return (
      await execute<{ googleDrivePickerToken: string | null }>(
        "googleDrivePickerToken",
        documents.googleDrivePickerToken,
      )
    ).googleDrivePickerToken;
  },
  async importGoogleDriveFile({ fileId }) {
    return (
      await execute<{ importGoogleDriveFile: ProductSource }>(
        "importGoogleDriveFile",
        documents.importGoogleDriveFile,
        { fileId },
      )
    ).importGoogleDriveFile;
  },
  async exportAdImageToGoogleDrive({ adId, targetFileId }) {
    return (
      await execute<{ exportAdImageToGoogleDrive: GoogleDriveExportResult }>(
        "exportAdImageToGoogleDrive",
        documents.exportAdImageToGoogleDrive,
        { adId, targetFileId: targetFileId ?? null },
      )
    ).exportAdImageToGoogleDrive;
  },
};
