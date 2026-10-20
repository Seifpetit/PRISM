export const STRATEGY_TYPES = [
  "product",
  "audience",
  "angle",
  "creativeType",
  "execution",
  "creative",
] as const;

/**
 * "creativeConcept" (Angle x Avatar -> Concept) is a Creative Exploration node, kept out of
 * STRATEGY_TYPES so it never enters the legacy product -> ... -> creative chain.
 */
export type StrategyNodeType =
  | (typeof STRATEGY_TYPES)[number]
  | "creativeConcept"
  | "offer";

export interface StrategyNodeBase {
  id: string;
  parentId: string | null;
  productId: string;
  type: StrategyNodeType;
  createdAt: string;
  generated?: boolean;
  label: string;
  positionX?: number | null;
  positionY?: number | null;
}
export interface LineageHistoryEvent {
  id: string;
  productId: string;
  type: "subtree_deleted";
  summary: string;
  createdAt: string;
  rootNode: StrategyNode;
  removedNodes: StrategyNode[];
}

export interface ProductNode extends StrategyNodeBase {
  type: "product";
  parentId: null;
  name?: string | null;
  workingLabel?: string | null;
  category?: string | null;
}

export type AudienceAwarenessLevel =
  | "unaware"
  | "problem_aware"
  | "solution_aware"
  | "product_aware"
  | "most_aware";

export interface AudienceProfile {
  position: "edge_a" | "edge_b";
  label: string;
  problemExperience: string;
  currentBehavior: string;
  solutionExperience: string;
  awarenessLevel: AudienceAwarenessLevel;
  buyingState: string;
}

export interface AudienceProfileRange {
  dimension: string;
  profiles: [AudienceProfile, AudienceProfile];
}

/** An illustrative reference person, not a claim about the market. */
export interface AudienceTargetProfile {
  role: string;
  situation: string;
  goal: string;
  frustration: string;
  example: string;
}

/** An illustrative future-image brief, not product or audience evidence. */
export interface AudienceVisualReference {
  subject: string;
  environment: string;
  action: string;
  mood: string;
  imagePrompt: string;
}

export interface AudienceNode extends StrategyNodeBase {
  type: "audience";
  parentId: string;
  definingNeed?: string;
  context?: string;
  productRelevance?: string;
  supportedBy?: string[];
  awarenessLevel?: AudienceAwarenessLevel;
  awarenessRationale?: string;
  messagingImplication?: string;
  profileRange?: AudienceProfileRange;
  targetProfile?: AudienceTargetProfile;
  visualReference?: AudienceVisualReference;
}
export interface AngleNode extends StrategyNodeBase {
  type: "angle";
  parentId: string;
  framing?: string;
  audienceConnection?: string;
  creativeOpportunity?: string;
  creativePotential?: string;
  lineageMode?: "strategy_lineage" | "creative_exploration";
  productConnection?: string;
  whyItCouldWork?: string;
  supportedBy?: string[];
  profileRangeFit?: AngleProfileRangeFit;
  /** A compact positioning summary — how to talk about this angle, distinct from framing's mechanism explanation. Absent on angles generated before this field existed. */
  summary?: string;
  /** One quotable line ready to put on an ad. Absent on older angles. */
  keyMessage?: string;
  /** 2-4 short theme words, for filing this angle at a glance. Absent on older angles. */
  tags?: string[];
  /** Qualitative judgment on who this lands with and who it doesn't — never a score. Absent on older angles. */
  audienceFitNote?: string;
}

export interface AngleProfileRangeFit {
  primary: "edge_a" | "edge_b" | "broad";
  rationale: string;
}
export interface CreativeTypeNode extends StrategyNodeBase {
  type: "creativeType";
  parentId: string;
}
export interface ExecutionNode extends StrategyNodeBase {
  type: "execution";
  parentId: string;
  edit?: string;
}

export type CreativeStatus = "Draft" | "Ready" | "Live" | "Winner";

export interface CreativeNode extends StrategyNodeBase {
  type: "creative";
  parentId: string;
  title: string;
  thumbnail: string;
  duration: number;
  status: CreativeStatus;
  platform: "Meta" | "TikTok" | "YouTube";
  performance?: { ctr: number; roas: number; spend: number };
}

/** A value-proposition packaging idea (Angle x Avatar x Offer is the full combo). */
export interface OfferNode extends StrategyNodeBase {
  type: "offer";
  parentId: string;
  lineageMode?: "strategy_lineage" | "creative_exploration";
  framing?: string;
  creativePotential?: string;
}

export interface CreativeConceptNode extends StrategyNodeBase {
  type: "creativeConcept";
  parentId: string;
  lineageMode?: "strategy_lineage" | "creative_exploration";
  /** The Target Avatar this concept was generated for (one third of the combo). */
  avatarId?: string;
  /** The Offer this concept was generated for (the other third of the combo). */
  offerId?: string;
  premise?: string;
  whyItLands?: string;
  executionNote?: string;
}

export type StrategyNode =
  | ProductNode
  | AudienceNode
  | AngleNode
  | CreativeTypeNode
  | ExecutionNode
  | CreativeNode
  | CreativeConceptNode
  | OfferNode;

/** Where each placed Target Avatar sits on the map, and its many-to-many Angle links. */
export interface AvatarCanvas {
  positions: Record<string, { x: number; y: number }>;
  links: Record<string, string[]>;
}

/**
 * The combo currently armed for Creative Concept generation. avatarId + angleId
 * come from the map link; offerId is picked separately and required before
 * generation unlocks (Persona x Angle x Offer).
 */
export interface AvatarAngleCombo {
  avatarId: string;
  angleId: string;
  offerId?: string | null;
}

export interface Product {
  id: string;
  brandId: string;
  name: string;
  description: string;
  /** The preview shown while the product was brought in — an http(s) URL, not downloaded or re-hosted. */
  imageUrl: string | null;
  createdAt: string;
}

export type AudienceCandidateDecision = "selected" | "rejected";

export interface AudienceCandidateTerritory {
  label: string;
  decision: AudienceCandidateDecision;
  reason: string;
}

export interface AudienceExploration {
  generationId: string;
  productId: string;
  operation?: string;
  selectionSummary: string;
  coverageDimensions: string[];
  candidateTerritories: AudienceCandidateTerritory[];
  createdAt: string;
}

export interface AngleCandidate {
  label: string;
  decision: AudienceCandidateDecision;
  reason: string;
}

export interface AngleExploration {
  generationId: string;
  productId: string;
  parentAudienceId: string;
  operation?: string;
  selectionSummary: string;
  candidateAngles: AngleCandidate[];
  createdAt: string;
}

/** A creative-exploration hypothesis, not measured audience research. */
export interface TargetAvatar {
  id: string;
  label: string;
  gender: string;
  ageRange: string;
  profession: string;
  lifeRhythm: string;
  painPoint: string;
  productConnection: string;
  priorities: string;
  buyingContext: string;
}

export const TARGET_AVATAR_COUNT_BOUNDS = { min: 3, max: 20, default: 10 } as const;

export type ProductSourceType = "url" | "file" | "image" | "video" | "text";
export type ProductSourceStatus = "pending" | "ready" | "error";

export interface ProductSource {
  id: string;
  type: ProductSourceType;
  label: string;
  value?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  previewUrl?: string;
  status: ProductSourceStatus;
  inspection?: UrlInspectionResult | null;
}

export enum PageClassification {
  Product = "PRODUCT",
  Listing = "LISTING",
  Unknown = "UNKNOWN",
}

export enum ListingScope {
  Selectable = "SELECTABLE",
  BroadCatalog = "BROAD_CATALOG",
  Unavailable = "UNAVAILABLE",
}

export enum UrlFetchStatus {
  Success = "SUCCESS",
  Unreachable = "UNREACHABLE",
}

export enum UrlInspectionRenderMode {
  StaticHtml = "STATIC_HTML",
  RenderedDom = "RENDERED_DOM",
}

export enum UnknownReason {
  InsufficientProductEvidence = "INSUFFICIENT_PRODUCT_EVIDENCE",
  ConflictingProductAndListingEvidence = "CONFLICTING_PRODUCT_AND_LISTING_EVIDENCE",
  NoProductCandidates = "NO_PRODUCT_CANDIDATES",
  ContentTooThin = "CONTENT_TOO_THIN",
  UnsupportedPageType = "UNSUPPORTED_PAGE_TYPE",
}

export enum FetchFailureReason {
  Timeout = "TIMEOUT",
  Http4xx = "HTTP_4XX",
  Http5xx = "HTTP_5XX",
  DnsFailure = "DNS_FAILURE",
  Blocked = "BLOCKED",
  InvalidUrl = "INVALID_URL",
  UnsupportedContentType = "UNSUPPORTED_CONTENT_TYPE",
  ContentTooLarge = "CONTENT_TOO_LARGE",
}

export interface UrlInspectionFetch {
  status: UrlFetchStatus;
  failureReason?: FetchFailureReason | null;
  httpStatus?: number | null;
  requestedUrl: string;
  finalUrl?: string | null;
  renderMode?: UrlInspectionRenderMode | null;
}

export interface ProductCandidateEvidence {
  structuredProduct: boolean;
  offer: boolean;
  purchaseAction: boolean;
  productHeading: boolean;
  productDescription: boolean;
  productGallery: boolean;
  variantSelector: boolean;
}

export interface ProductCandidate {
  name?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  currency?: string | null;
  sku?: string | null;
  evidence: ProductCandidateEvidence;
  confidence: number;
}

export interface UrlInspectionScores {
  product: number;
  listing: number;
  rawProduct: number;
  rawListing: number;
}

export interface UrlInspectionResult {
  fetch: UrlInspectionFetch;
  classification?: PageClassification | null;
  listingScope?: ListingScope | null;
  confidence?: number | null;
  scores?: UrlInspectionScores | null;
  unknownReason?: UnknownReason | null;
  signals?: Record<string, unknown> | null;
  candidates: ProductCandidate[];
  evidence?: Record<string, unknown> | null;
  classificationPolicyVersion: string;
}

export interface ProductContext {
  id: string;
  name: string;
  workingLabel?: string | null;
  category?: string | null;
  summary: string;
  features: string[];
  mechanisms: string[];
  benefits: string[];
  proofPoints: string[];
  useCases: string[];
  claims: string[];
  constraints: string[];
  sourceIds: string[];
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
}

export type AppTab = "strategy" | "creatives" | "pipeline" | "performance" | "profile";

/** Sections of the personal settings page (AppTab "profile"). */
export type SettingsSectionId =
  | "profile"
  | "integrations"
  | "data"
  | "ai-prompts"
  | "cost-ledger"
  | "operations-logs"
  | "user-notes";

export const AI_PROVIDERS = ["openai", "anthropic", "deepseek", "gemini", "perplexity"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export interface AiModelOption {
  id: string;
  label: string;
  tier: "fast" | "balanced" | "powerful";
}

export const AI_MODEL_OPTIONS: Record<AiProvider, AiModelOption[]> = {
  openai: [
    { id: "gpt-5.6-sol", label: "GPT-5.6 Sol", tier: "powerful" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra", tier: "powerful" },
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna", tier: "balanced" },
    { id: "gpt-5.4", label: "GPT-5.4", tier: "powerful" },
    { id: "gpt-5.4-pro", label: "GPT-5.4 Pro", tier: "powerful" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", tier: "balanced" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 Nano", tier: "fast" },
    { id: "gpt-5.5", label: "GPT-5.5", tier: "powerful" },
    { id: "gpt-5.5-pro", label: "GPT-5.5 Pro", tier: "powerful" },
    { id: "gpt-5.3-codex", label: "GPT-5.3 Codex", tier: "powerful" },
    { id: "gpt-5.2", label: "GPT-5.2", tier: "powerful" },
    { id: "gpt-5.2-pro", label: "GPT-5.2 Pro", tier: "powerful" },
    { id: "gpt-5", label: "GPT-5", tier: "powerful" },
    { id: "gpt-5-nano", label: "GPT-5 Nano", tier: "fast" },
    { id: "gpt-5-mini", label: "GPT-5 Mini", tier: "balanced" },
    { id: "gpt-5.1", label: "GPT-5.1", tier: "powerful" },
    { id: "gpt-5-pro", label: "GPT-5 Pro", tier: "powerful" },
    { id: "o3-pro", label: "o3 Pro", tier: "powerful" },
    { id: "o3", label: "o3", tier: "powerful" },
    { id: "gpt-4.1", label: "GPT-4.1", tier: "powerful" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", tier: "balanced" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", tier: "fast" },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", tier: "fast" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", tier: "balanced" },
    { id: "claude-opus-5", label: "Claude Opus 5", tier: "powerful" },
    { id: "claude-fable-5", label: "Claude Fable 5", tier: "powerful" },
  ],
  deepseek: [
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", tier: "fast" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", tier: "powerful" },
  ],
  gemini: [{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", tier: "balanced" }],
  perplexity: [
    { id: "sonar", label: "Sonar", tier: "fast" },
    { id: "sonar-pro", label: "Sonar Pro", tier: "balanced" },
    { id: "sonar-reasoning-pro", label: "Sonar Reasoning Pro", tier: "powerful" },
    { id: "sonar-deep-research", label: "Sonar Deep Research", tier: "powerful" },
  ],
};
