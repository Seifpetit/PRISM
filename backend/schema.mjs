export const typeDefs = /* GraphQL */ `
  scalar JSON

  enum WorkspaceRole {
    visitor
    admin
  }

  type User {
    id: ID!
    email: String!
    displayName: String!
  }

  type Workspace {
    id: ID!
    name: String!
    role: WorkspaceRole!
  }

  type WorkspaceMember {
    user: User!
    role: WorkspaceRole!
    createdAt: String!
  }

  type AuthSession {
    token: String!
    expiresAt: String!
    user: User!
    workspace: Workspace!
  }

  input PasswordlessSignInInput {
    displayName: String!
    email: String!
  }

  input AddWorkspaceMemberInput {
    displayName: String!
    email: String!
    role: WorkspaceRole!
  }

  type Product {
    id: ID!
    brandId: ID!
    name: String!
    description: String!
    """The preview shown while the product was brought in — an http(s) URL, not downloaded or re-hosted."""
    imageUrl: String
    createdAt: String!
  }

  type ProductSource {
    id: ID!
    type: String!
    label: String!
    value: String
    status: String!
    inspection: UrlInspectionResult
  }

  """One image or video source given as product context, with its actual image bytes for the node's media picker."""
  type ProductMediaAsset {
    id: ID!
    """"image" or "video"."""
    type: String!
    label: String!
    filename: String
    """A data: URI. For a video this is its first stored frame."""
    url: String
    """Video only: the data: URIs of every frame stored for it, in order."""
    frames: [String!]
  }

  enum PageClassification {
    PRODUCT
    LISTING
    UNKNOWN
  }
  enum ListingScope {
    SELECTABLE
    BROAD_CATALOG
    UNAVAILABLE
  }
  enum FetchStatus {
    SUCCESS
    UNREACHABLE
  }
  enum UrlInspectionRenderMode {
    STATIC_HTML
    RENDERED_DOM
  }
  enum UnknownReason {
    INSUFFICIENT_PRODUCT_EVIDENCE
    CONFLICTING_PRODUCT_AND_LISTING_EVIDENCE
    NO_PRODUCT_CANDIDATES
    CONTENT_TOO_THIN
    UNSUPPORTED_PAGE_TYPE
  }
  enum FetchFailureReason {
    TIMEOUT
    HTTP_4XX
    HTTP_5XX
    DNS_FAILURE
    BLOCKED
    INVALID_URL
    UNSUPPORTED_CONTENT_TYPE
    CONTENT_TOO_LARGE
  }

  type UrlInspectionFetch {
    status: FetchStatus!
    failureReason: FetchFailureReason
    httpStatus: Int
    requestedUrl: String!
    finalUrl: String
    renderMode: UrlInspectionRenderMode
  }

  type UrlInspectionScores {
    product: Float!
    listing: Float!
    rawProduct: Int!
    rawListing: Int!
  }

  type UrlInspectionCandidateEvidence {
    structuredProduct: Boolean!
    offer: Boolean!
    purchaseAction: Boolean!
    productHeading: Boolean!
    productDescription: Boolean!
    productGallery: Boolean!
    variantSelector: Boolean!
  }

  type UrlInspectionCandidate {
    name: String
    url: String
    imageUrl: String
    price: Float
    currency: String
    sku: String
    evidence: UrlInspectionCandidateEvidence!
    confidence: Float!
  }

  type UrlInspectionResult {
    fetch: UrlInspectionFetch!
    classification: PageClassification
    listingScope: ListingScope
    confidence: Float
    scores: UrlInspectionScores
    unknownReason: UnknownReason
    signals: JSON
    candidates: [UrlInspectionCandidate!]!
    evidence: JSON
    classificationPolicyVersion: String!
  }

  type ProductContext {
    id: ID!
    name: String!
    workingLabel: String
    category: String
    summary: String!
    features: [String!]!
    mechanisms: [String!]!
    benefits: [String!]!
    proofPoints: [String!]!
    useCases: [String!]!
    claims: [String!]!
    constraints: [String!]!
    sourceIds: [ID!]!
    createdAt: String!
  }

  type StrategyNode {
    id: ID!
    parentId: ID
    productId: ID!
    type: String!
    label: String!
    name: String
    workingLabel: String
    category: String
    definingNeed: String
    context: String
    productRelevance: String
    supportedBy: [String!]
    awarenessLevel: String
    awarenessRationale: String
    messagingImplication: String
    profileRange: AudienceProfileRange
    targetProfile: AudienceTargetProfile
    visualReference: AudienceVisualReference
    framing: String
    audienceConnection: String
    creativeOpportunity: String
    creativePotential: String
    """A compact positioning summary, distinct from framing's mechanism explanation. Absent on angles generated before this field existed."""
    summary: String
    """One quotable line ready to put on an ad. Absent on older angles."""
    keyMessage: String
    """2-4 short theme words. Absent on older angles."""
    tags: [String!]
    """Qualitative judgment on who this angle lands with and who it doesn't - never a score. Absent on older angles."""
    audienceFitNote: String
    lineageMode: String
    productConnection: String
    whyItCouldWork: String
    profileRangeFit: AngleProfileRangeFit
    premise: String
    whyItLands: String
    executionNote: String
    avatarId: ID
    offerId: ID
    createdAt: String!
    generated: Boolean
    generationId: ID
    edit: String
    title: String
    thumbnail: String
    duration: Int
    status: String
    platform: String
    positionX: Float
    positionY: Float
  }
  type LineageHistoryEvent { id: ID!, productId: ID!, type: String!, summary: String!, createdAt: String!, rootNode: StrategyNode!, removedNodes: [StrategyNode!]! }

  type AudienceProfileRange {
    dimension: String!
    profiles: [AudienceProfile!]!
  }

  type AudienceProfile {
    position: String!
    label: String!
    problemExperience: String!
    currentBehavior: String!
    solutionExperience: String!
    awarenessLevel: String!
    buyingState: String!
  }

  type AudienceTargetProfile {
    role: String!
    situation: String!
    goal: String!
    frustration: String!
    example: String!
  }

  type AudienceVisualReference {
    subject: String!
    environment: String!
    action: String!
    mood: String!
    imagePrompt: String!
  }

  type AudienceCandidateTerritory {
    label: String!
    decision: String!
    reason: String!
  }

  type AudienceExploration {
    generationId: ID!
    productId: ID!
    operation: String!
    selectionSummary: String!
    coverageDimensions: [String!]!
    candidateTerritories: [AudienceCandidateTerritory!]!
    createdAt: String!
  }

  type AngleProfileRangeFit {
    primary: String!
    rationale: String!
  }

  type AngleCandidate {
    label: String!
    decision: String!
    reason: String!
  }

  type AngleExploration {
    generationId: ID!
    productId: ID!
    parentAudienceId: ID!
    operation: String!
    selectionSummary: String!
    candidateAngles: [AngleCandidate!]!
    createdAt: String!
  }

  type TargetAvatar {
    id: ID!
    label: String!
    gender: String!
    ageRange: String!
    profession: String!
    lifeRhythm: String!
    painPoint: String!
    productConnection: String!
    priorities: String!
    buyingContext: String!
  }

  type PerformanceSummary {
    spend: Float!
    revenue: Float!
    roas: Float!
    winningCreativeId: ID!
  }

  type CostLedgerUsage {
    inputTokens: Float
    uncachedInputTokens: Float
    cachedInputTokens: Float
    cacheWriteTokens: Float
    outputTokens: Float
    reasoningTokens: Float
    totalTokens: Float
  }

  type CostLedgerCost {
    status: String!
    usd: String
    reason: String
    breakdown: JSON
  }

  type AiCostLedgerEntry {
    id: ID!
    createdAt: String!
    occurredAt: String!
    provider: String!
    model: String!
    providerRequestId: String
    operation: String!
    operationId: String
    parentGenerationId: String
    attempt: Int!
    requestContext: JSON
    rawUsage: JSON
    normalizedUsage: CostLedgerUsage
    cost: CostLedgerCost!
    pricing: JSON
  }

  type OperationPayloadLog {
    id: ID!
    traceStatus: String!
    representation: String!
    content: JSON
    redactionStatus: String!
    byteSize: Int
  }

  type OperationErrorLog {
    stage: String
    code: String
    message: String
  }

  type OperationCostLog {
    status: String!
    usd: String
    currency: String!
    reason: String
    breakdown: JSON
    pricing: JSON
  }

  type OperationAttemptLog {
    id: ID!
    attemptNumber: Int!
    costSource: String!
    provider: String
    service: String
    model: String
    status: String!
    startedAt: String!
    completedAt: String
    durationMs: Int
    providerRequestId: String
    requestOptions: JSON
    flags: JSON
    error: OperationErrorLog
    request: OperationPayloadLog
    response: OperationPayloadLog
    rawResponse: OperationPayloadLog
    usage: JSON
    cost: OperationCostLog
  }

  type OperationRelatedLog {
    productId: String
    strategyNodeId: String
    creativeId: String
    generationId: String
  }

  type OperationLogEntry {
    id: ID!
    operationType: String!
    status: String!
    startedAt: String!
    completedAt: String
    durationMs: Int
    input: OperationPayloadLog
    output: OperationPayloadLog
    attempts: [OperationAttemptLog!]!
    totalCostUsd: String
    error: OperationErrorLog
    related: OperationRelatedLog!
  }

  input CreateProductInput {
    brandId: ID!
    name: String!
    description: String!
    contextId: ID
    imageUrl: String
  }

  input ProductSourceInput {
    id: ID!
    type: String!
    label: String!
    value: String
    filename: String
    mimeType: String
    size: Int
    status: String!
  }

  input AiModelInput {
    provider: String
    model: String
    options: JSON
  }

  type AiModelOption {
    id: ID!
    label: String!
    tier: String!
  }

  input GenerateAudiencesInput {
    productId: ID!
    ai: AiModelInput
  }
  input GenerateAnglesInput {
    audienceId: ID!
    productId: ID!
    ai: AiModelInput
  }
  """What a generation is given beyond the Product Context: library sources chosen by id, and focus for this run only."""
  input GenerationContextInput {
    sourceIds: [ID!]
    instructions: String
  }
  input GenerateCreativeExplorationAnglesInput {
    productId: ID!
    ai: AiModelInput
    context: GenerationContextInput
  }
  input GenerateCreativeExplorationTargetAvatarsInput {
    productId: ID!
    ai: AiModelInput
    count: Int
    context: GenerationContextInput
  }
  input GenerateCreativeExplorationConceptsInput {
    productId: ID!
    angleId: ID!
    avatarId: ID!
    offerId: ID!
    ai: AiModelInput
  }
  input GenerateAdHooksInput {
    adId: ID!
    ai: AiModelInput
    context: GenerationContextInput
  }
  """What to optimise a generation of ads for. Every field is optional; nothing chosen means the AI decides."""
  input AdPlanOptionsInput {
    """One ad format to use for every ad (for example ai_talking_head)."""
    format: String
    """A stage every ad is at, or "spread" for each ad at a different stage."""
    awareness: String
    """How many ads, 2 to 6 (at most 4 when each is at a different stage)."""
    count: Int
    """"short" (default) or "vsl", a long-form video sales letter."""
    structure: String
    """Anything else to optimise for, in the person's words."""
    note: String
  }
  input GenerateCampaignAdPlanInput {
    conceptId: ID!
    ai: AiModelInput
    options: AdPlanOptionsInput
    context: GenerationContextInput
  }
  input GenerateCreativeExplorationOffersInput {
    productId: ID!
    ai: AiModelInput
    context: GenerationContextInput
  }

  """A note or file in a product's Context Library. Its text is never returned here; see contextSourceContent."""
  type ContextSource {
    id: ID!
    productId: ID!
    name: String!
    kind: String!
    status: String!
    statusDetail: String
    fileName: String
    mimeType: String
    sizeBytes: Int
    market: String
    version: Int!
    charCount: Int!
    summary: String
    warnings: [String!]!
    createdAt: String!
    updatedAt: String!
  }
  """One item on a production task's checklist."""
  type PipelineChecklistItem {
    id: ID!
    label: String!
    done: Boolean!
  }
  """A piece of creative work made from a Prism ad, moving across the production pipeline. One ad can have several."""
  type PipelineTask {
    id: ID!
    productId: ID!
    adId: ID!
    conceptId: ID
    adRef: String
    title: String!
    format: String!
    awareness: String
    hook: String
    variant: String
    stage: String!
    checklist: [PipelineChecklistItem!]!
    notes: String
    metaAdRef: String
    sortOrder: Float!
    """True when the ad this task was made from has since been deleted."""
    adRemoved: Boolean!
    """Read live off the ad, not copied at creation — "none" once the ad is removed."""
    imageStatus: String!
    imageUrl: String
    createdAt: String!
    updatedAt: String!
    stageChangedAt: String!
  }
  input CreatePipelineTaskInput {
    adId: ID!
    """Names another version of the same ad, e.g. "9:16" or "French"."""
    variant: String
    """The ad's reference on the board, e.g. AS-01.2, kept as a label."""
    adRef: String
  }
  input PipelineChecklistItemInput {
    id: ID
    label: String!
    done: Boolean
  }
  input UpdatePipelineTaskInput {
    id: ID!
    title: String
    variant: String
    notes: String
    metaAdRef: String
    checklist: [PipelineChecklistItemInput!]
  }
  input MovePipelineTaskInput {
    id: ID!
    stage: String!
    """Where in the stage's column; the end when left out."""
    index: Int
  }
  type ContextSourceContent {
    id: ID!
    text: String!
    structure: JSON
  }
  input AddContextSourceInput {
    productId: ID!
    """file or note"""
    kind: String!
    name: String
    fileName: String
    mimeType: String
    """The note's text, or a text / CSV file's contents."""
    text: String
    """A PDF's bytes, base64."""
    contentBase64: String
    market: String
  }
  input UpdateContextSourceInput {
    id: ID!
    name: String
    market: String
    """A note's new text; a changed text becomes a new version."""
    text: String
  }
  input GenerationContextPreviewInput {
    productId: ID!
    generator: String!
    context: GenerationContextInput
  }
  type ContextPreviewSource {
    id: ID!
    name: String!
    kind: String!
    market: String
    version: Int!
    availableChars: Int!
    includedChars: Int!
    truncated: Boolean!
    coverage: String!
    warnings: [String!]!
    text: String!
  }
  type GenerationContextPreview {
    generator: String!
    templateVersion: Int!
    productContext: String!
    instructions: String
    sources: [ContextPreviewSource!]!
    totalChars: Int!
    budgetChars: Int!
    rules: [String!]!
  }
  type ProvenanceSource {
    id: ID!
    name: String!
    kind: String!
    version: Int!
    contentHash: String
    availableChars: Int!
    includedChars: Int!
    truncated: Boolean!
    coverage: String
  }
  type GenerationProvenance {
    generationId: ID!
    productId: ID!
    generator: String!
    templateId: String!
    templateVersion: Int!
    instructions: String
    sources: [ProvenanceSource!]!
    contextChars: Int!
    createdAt: String!
  }
  input GenerateCreativeTypesInput {
    angleId: ID!
    productId: ID!
    ai: AiModelInput
  }
  input GenerateExecutionsInput {
    creativeTypeId: ID!
    productId: ID!
    ai: AiModelInput
  }
  input GenerateCreativesInput {
    executionId: ID!
    productId: ID!
    ai: AiModelInput
  }

  input UpdateStrategyNodePositionInput {
    nodeId: ID!
    x: Float!
    y: Float!
  }

  input UpdateAiPromptTemplateInput {
    id: String!
    prompt: String!
  }

  type AiPromptPlaceholder {
    token: String!
    description: String!
  }

  type AiPromptTemplate {
    id: String!
    label: String!
    prompt: String!
    placeholders: [AiPromptPlaceholder!]!
  }

  type CreativeExplorationPromptTemplate {
    templateId: String!
    content: String!
    version: Int!
    isCustom: Boolean!
    updatedAt: String
  }

  input UpdateCreativeExplorationPromptTemplateInput {
    templateId: String!
    content: String!
  }

  type UserNote {
    id: ID!
    note: String!
    createdAt: String!
  }

  input SubmitUserNoteInput {
    note: String!
  }

  type CsvProductMatch {
    productId: ID!
    productName: String!
    ads: Int!
    rows: Int!
    """Why these ads were placed in this product."""
    reason: String!
  }
  type CsvUnresolved {
    ads: Int!
    rows: Int!
    samples: [String!]!
  }
  """What a CSV file is and which product each of its ads belongs to. Nothing is saved until it is committed."""
  type CsvAnalysis {
    analysisId: ID!
    fileName: String!
    kind: String!
    kindLabel: String!
    rows: Int!
    adCount: Int!
    dateFrom: String
    dateTo: String
    currency: String
    """False when the file does not say which currency its amounts are in, so the person has to."""
    currencyKnown: Boolean!
    products: [CsvProductMatch!]!
    unresolved: CsvUnresolved!
    """The product to offer for ads that could not be placed: the one the rest of the file went to, or the one its name mentions."""
    suggestedProductId: ID
    warnings: [String!]!
  }
  input CsvDecisionsInput {
    currency: String
    assignUnresolvedTo: ID
    skipUnresolved: Boolean
    forceProductId: ID
  }
  type CsvCommitProduct {
    productId: ID!
    productName: String!
    imported: Int!
    updated: Int!
  }
  type CsvCommitResult {
    """Null when every row was already stored exactly as it is: nothing changed, so no import was recorded."""
    importId: ID
    fileName: String!
    kind: String!
    currency: String!
    imported: Int!
    updated: Int!
    """Rows that were already stored with the same numbers."""
    unchanged: Int!
    skipped: Int!
    products: [CsvCommitProduct!]!
  }
  type ImportedAd {
    name: String!
    """The ad's delivery as of its last imported day (active, inactive...), when the Meta export has it."""
    delivery: String
    hasMeta: Boolean!
    hasConverty: Boolean!
    days: Int!
    spend: Float!
    """Spend over the days the order file covers: what a cost per confirmed or delivered order divides."""
    spendInOrderWindow: Float!
    impressions: Float!
    linkClicks: Float!
    landingPageViews: Float!
    results: Float!
    """The results that are purchases, as Meta attributes them to this ad."""
    purchases: Float!
    hookRate: Float
    holdRate: Float
    orders: Int!
    deleted: Int!
    confirmed: Int!
    delivered: Int!
    returned: Int!
    deliveredRevenue: Float!
    """Meta's own live creative thumbnail when the connected account still has this ad, PRISM's own generated
       one when a pipeline task explicitly linked this name to a PRISM ad, "none" otherwise."""
    imageStatus: String!
    imageUrl: String
    """Meta's own playable source for this ad's creative, when it is a video and the connected account still has
       it. Null for image ads, and for a video Meta does not currently serve a source for."""
    videoUrl: String
  }
  type ImportedTotals {
    spend: Float!
    impressions: Float!
    linkClicks: Float!
    results: Float!
    purchases: Float!
    orders: Int!
    deleted: Int!
    confirmed: Int!
    delivered: Int!
    returned: Int!
    deliveredRevenue: Float!
  }
  type ImportedSpan {
    rows: Int!
    currency: String
    mixedCurrency: Boolean!
    dateFrom: String
    dateTo: String
  }
  type ExchangeRate {
    currency: String!
    """How many of this currency one US dollar buys."""
    rate: Float!
  }
  """Live exchange rates per one US dollar, cached on the server."""
  type ExchangeRates {
    source: String!
    updatedAt: String
    """The service could not be reached, so these are the last rates that were."""
    stale: Boolean!
    rates: [ExchangeRate!]!
  }
  type ImportedDay {
    date: String!
    spend: Float!
    impressions: Float!
    linkClicks: Float!
    results: Float!
    """The results that are purchases, as Meta attributes them."""
    purchases: Float!
  }
  type ImportedUnattributed {
    orders: Int!
    deleted: Int!
    confirmed: Int!
    delivered: Int!
    returned: Int!
    deliveredRevenue: Float!
  }
  """The imported Meta export and Converty summary, joined by ad name. Money stays in each file's own currency."""
  type ImportedAds {
    meta: ImportedSpan!
    converty: ImportedSpan!
    ads: [ImportedAd!]!
    """The Meta export by day, added up across ads."""
    daily: [ImportedDay!]!
    totals: ImportedTotals!
    """Orders Converty could not attribute to an ad."""
    unattributed: ImportedUnattributed
  }

  type CsvCoverageKind {
    rows: Int!
    dateFrom: String
    dateTo: String
    importedAt: String
  }
  """What has been imported from CSV files for one product, per template."""
  type CsvCoverage {
    meta: CsvCoverageKind!
    converty: CsvCoverageKind!
  }
  type CsvImportRecord {
    id: ID!
    kind: String!
    fileName: String!
    currency: String
    dateFrom: String
    dateTo: String
    rowsTotal: Int!
    rowsImported: Int!
    rowsUpdated: Int!
    rowsSkipped: Int!
    """How many of this file's rows are in use now: rows a later import replaced, or that were removed, are not."""
    rowsHeld: Int!
    products: [String!]!
    productIds: [ID!]!
    createdAt: String!
  }

  type MetaAccountCampaign {
    id: ID!
    name: String!
    status: String!
    """The product this campaign is already assigned to, if any."""
    assignedProductId: ID
    assignedProductName: String
  }
  input MetaCampaignInput {
    id: ID!
    name: String!
  }

  type MetaTotals {
    spend: Float!
    impressions: Float!
    reach: Float!
    clicks: Float!
    purchases: Float!
    revenue: Float!
  }
  type MetaDay {
    date: String!
    spend: Float!
    impressions: Float!
    clicks: Float!
    purchases: Float!
    revenue: Float!
  }
  type MetaCampaign {
    id: ID!
    name: String!
    status: String!
    spend: Float!
    impressions: Float!
    reach: Float!
    clicks: Float!
    purchases: Float!
    revenue: Float!
  }
  type MetaRange {
    since: String!
    until: String!
    days: Int!
  }
  """The connected ad account's numbers over a range, as Meta reports them. Read live, never stored."""
  type MetaAdsPerformance {
    connected: Boolean!
    """Why it is not connected (an expired token, no ad account), when Meta or the token said so."""
    error: String
    accountId: String
    accountName: String
    currency: String
    accountStatus: String
    range: MetaRange
    totals: MetaTotals
    previousTotals: MetaTotals
    daily: [MetaDay!]
    campaigns: [MetaCampaign!]
    fetchedAt: String
    """"account" or "product": whether the numbers are the whole ad account's or only the campaigns assigned to a product."""
    scope: String
    campaignCount: Int
    """True when the product scope was asked for and the product has no assigned campaigns yet."""
    unassigned: Boolean
  }

  type IntegrationStatus {
    id: ID!
    connected: Boolean!
    label: String
    error: String
    """When the saved token stops working, if it expires (Meta OAuth tokens last about 60 days)."""
    expiresAt: String
  }

  type OAuthStart {
    url: String!
  }

  type ShopifyOrder {
    id: ID!
    name: String!
    createdAt: String!
    financialStatus: String
    fulfillmentStatus: String
    totalAmount: String!
    currency: String!
  }

  type ShopifyTotals {
    orders: Int!
    units: Int!
    revenue: Float!
  }
  type ShopifyDay {
    date: String!
    orders: Int!
    revenue: Float!
  }
  type ShopifyRecentOrder {
    id: ID!
    name: String!
    createdAt: String!
    status: String!
    total: Float!
    items: String!
    test: Boolean!
  }
  type ShopifyTopProduct {
    id: ID
    title: String!
    units: Int!
    revenue: Float!
  }
  """The connected store's sales over a range. Read live, never stored. Only the last 60 days of orders are available."""
  type ShopifySales {
    connected: Boolean!
    error: String
    shopName: String
    currency: String
    """"store" or "product": the whole store's orders, or only the orders containing the product linked to the open PRISM product."""
    scope: String
    """The product scope was asked for and this product has no linked Shopify product yet."""
    unlinked: Boolean
    linkedTitle: String
    range: MetaRange
    totals: ShopifyTotals
    previousTotals: ShopifyTotals
    daily: [ShopifyDay!]
    recentOrders: [ShopifyRecentOrder!]
    topProducts: [ShopifyTopProduct!]
    testOrders: Int
    """The range starts before the 60 days Shopify returns, so it is cut short."""
    historyLimited: Boolean
    """The store has more orders in the range than PRISM reads; the numbers are a floor."""
    truncated: Boolean
    fetchedAt: String
  }

  type DataItemTrim {
    start: Float!
    end: Float!
  }

  """One stored item whole, for the Data library's editors."""
  type DataItemContent {
    id: ID!
    """"note", "document", "table", "link", "image", "video" or "audio"."""
    kind: String!
    label: String!
    filename: String
    mimeType: String
    productId: ID
    text: String
    dataUrl: String
    """Video added at intake: the stills kept from it (the clip itself is not stored)."""
    frames: [String!]
    url: String
    """Audio and video: a non-destructive trim, in seconds."""
    trim: DataItemTrim
    """"overwrite": Save writes over the item. "copy-only": the original is kept, edits go to a copy. "none": view only."""
    saveMode: String!
    notice: String
  }

  input DataItemTrimInput {
    start: Float!
    end: Float!
  }

  input DataItemEditInput {
    id: ID!
    text: String
    dataUrl: String
    trim: DataItemTrimInput
    """Save as copy only: the copy's file name."""
    filename: String
  }

  """Something added straight to the Data library: a file (base64 data), a link (url) or a note (text)."""
  input DataItemAddInput {
    filename: String
    mimeType: String
    data: String
    url: String
    text: String
    productId: ID
  }

  """The rows one CSV import still provides to Performance, read-only."""
  type CsvImportTable {
    id: ID!
    fileName: String!
    columns: [String!]!
    rows: [[String!]!]!
    truncated: Boolean!
  }

  """One prompt Prism sends to a model, as listed in Settings."""
  type PromptCatalogEntry {
    id: ID!
    label: String!
    """"product", "strategy" or "ads"."""
    group: String!
    """"text" or "image"."""
    modality: String!
    description: String!
    usedWhen: String
    inactiveNote: String
    chars: Int!
    isCustom: Boolean!
    version: Int
    updatedAt: String
    placeholders: [AiPromptPlaceholder!]!
  }

  type PromptCatalogContent {
    id: ID!
    content: String!
    isCustom: Boolean!
    version: Int
    updatedAt: String
    placeholders: [AiPromptPlaceholder!]!
  }

  type StoredProductSource {
    id: ID!
    productId: ID
    type: String!
    """Which editor it opens in: "note", "document", "table", "link", "image", "video" or "audio"."""
    kind: String!
    label: String!
    filename: String
    mimeType: String
    sizeBytes: Int
    storedBytes: Int!
    status: String!
    text: String
    url: String
    copies: Int!
    """Media only, once made: a small still (image, video), a waveform (audio) and its length in seconds."""
    thumbnail: String
    peaks: [Float!]
    durationSeconds: Float
    createdAt: String!
  }

  """Where one persona's portrait stands: none (not requested), pending, ready or failed."""
  type TargetAvatarImageStatus {
    avatarId: ID!
    status: String!
  }

  type PexelsBanner {
    id: ID!
    alt: String
    photographer: String!
    photographerUrl: String
    pageUrl: String
    avgColor: String!
    thumbUrl: String!
    bannerUrl: String!
  }

  type PexelsBannerPage {
    configured: Boolean!
    photos: [PexelsBanner!]!
    page: Int!
    hasMore: Boolean!
  }

  input DataItemPreviewInput {
    id: ID!
    thumbnail: String
    peaks: [Float!]
    duration: Float
  }

  """One ad in a concept: a slot with six dimensions: awareness stage, direction (the execution idea), format, hook, beats (the bridge to the product and offer) and a call to action, plus notes."""
  type CampaignAd {
    id: ID!
    conceptId: ID!
    order: Int!
    format: String!
    awareness: String!
    title: String
    hook: String
    direction: String
    beats: [String!]!
    cta: String
    notes: String
    """none (never requested, e.g. a hand-planned ad), pending, ready or failed."""
    imageStatus: String!
    """A data: URI when imageStatus is "ready"; null otherwise."""
    imageUrl: String
    """none, published or failed. An ad needs a ready imageUrl before it can be published."""
    metaPublishStatus: String!
    """The Meta Ad id, once published."""
    metaAdId: ID
    metaPublishError: String
  }

  """A concept is persona x angle x offer, and one concept is one Meta ad set."""
  type CampaignConcept {
    id: ID!
    campaignId: ID!
    productId: ID!
    avatarId: ID!
    angleId: ID!
    offerId: ID!
    startDate: String
    endDate: String
    spend: Float
    positionX: Float
    positionY: Float
    createdAt: String!
    """The Meta Ad Set this ad set (concept) was published as, once published."""
    metaAdSetId: ID
    ads: [CampaignAd!]!
  }

  """A campaign for a product. kind is what it is for: test, scaling or retargeting. testType is what a test varies: angle, offer or persona."""
  type Campaign {
    id: ID!
    productId: ID!
    name: String!
    kind: String!
    testType: String!
    positionX: Float
    positionY: Float
    createdAt: String!
    """The Meta Campaign this campaign became, the first time any of its ad sets was published."""
    metaCampaignId: ID
    concepts: [CampaignConcept!]!
  }

  """A Facebook Page the connected Meta account can run ads as."""
  type MetaPage {
    id: ID!
    name: String!
  }

  input MetaPublishInput {
    """The Facebook Page the ad is posted from."""
    pageId: ID!
    """Where the ad's link points. A full https:// URL."""
    destinationUrl: String!
    """The ad set's daily budget, in cents (e.g. 2000 = $20.00/day)."""
    dailyBudgetCents: Int!
  }

  type MetaPublishResult {
    concept: CampaignConcept!
    metaCampaignId: ID!
    metaAdSetId: ID!
    publishedCount: Int!
    """Ads skipped because they have no ready cover image yet, not because Meta refused them."""
    notReadyCount: Int!
  }

  input ConceptComboInput {
    avatarId: ID!
    angleId: ID!
    offerId: ID!
  }

  type AddConceptsResult {
    created: [CampaignConcept!]!
    skipped: Int!
  }

  type ShopifyProduct {
    id: ID!
    title: String!
    handle: String!
    status: String!
    imageUrl: String
  }

  type ProductLink {
    productId: ID!
    provider: String!
    storeDomain: String!
    externalId: ID!
    title: String!
    linkedAt: String!
  }

  type DisconnectResult {
    id: ID!
    disconnected: Boolean!
    """Shopify only: true when the app was also uninstalled on the store."""
    remoteRevoked: Boolean
    message: String!
  }

  type ShopifyConnectionStart {
    url: String!
    shop: String!
  }

  type GoogleDriveExportResult {
    fileId: ID!
    webViewLink: String
  }

  type Query {
    session: AuthSession
    integrationStatus: [IntegrationStatus!]!
    """The workspace's live (refreshed if needed) Google Drive access token, for the Picker widget. Null when not connected."""
    googleDrivePickerToken: String
    """Portrait status per persona of a product. Starts nothing."""
    targetAvatarImageStatuses(productId: ID!): [TargetAvatarImageStatus!]!
    """One persona's portrait as a data URL, or null when it has none yet."""
    targetAvatarImage(avatarId: ID!): String
    """Profile banner photos from Pexels. "configured" is false until PEXELS_API_KEY is set in .env."""
    pexelsBanners(query: String, page: Int, perPage: Int, orientation: String): PexelsBannerPage!
    productSources: [StoredProductSource!]!
    """One product's own image and video context sources, with their actual bytes, for the node's media picker."""
    productMedia(productId: ID!): [ProductMediaAsset!]!
    shopifyProducts(search: String): [ShopifyProduct!]!
    campaigns(productId: ID!): [Campaign!]!
    shopifyProductLink(productId: ID!): ProductLink
    shopifyOrders(limit: Int): [ShopifyOrder!]!
    metaAdsPerformance(days: Int, refresh: Boolean, productId: ID, scope: String): MetaAdsPerformance!
    metaCampaigns(productId: ID!): [MetaAccountCampaign!]!
    """The Facebook Pages the connected Meta account can publish ads as."""
    metaPages: [MetaPage!]!
    shopifySales(days: Int, refresh: Boolean, productId: ID, scope: String): ShopifySales!
    csvImports(limit: Int): [CsvImportRecord!]!
    contextSources(productId: ID!): [ContextSource!]!
    pipelineTasks(productId: ID!): [PipelineTask!]!
    contextSourceContent(id: ID!): ContextSourceContent!
    generationContextPreview(input: GenerationContextPreviewInput!): GenerationContextPreview!
    generationProvenance(generationId: ID!): GenerationProvenance
    csvCoverage(productId: ID!): CsvCoverage!
    importedAds(productId: ID, scope: String): ImportedAds!
    exchangeRates: ExchangeRates!
    workspaceMembers: [WorkspaceMember!]!
    products: [Product!]!
    aiModels(provider: String!): [AiModelOption!]!
    aiPromptTemplates: [AiPromptTemplate!]!
    """Every prompt Prism sends to a model, in workflow order."""
    promptCatalog: [PromptCatalogEntry!]!
    promptCatalogContent(id: ID!): PromptCatalogContent!
    """One stored data item whole (file contents included), for its editor."""
    dataItem(id: ID!): DataItemContent!
    csvImportTable(id: ID!): CsvImportTable!
    costLedger(limit: Int): [AiCostLedgerEntry!]!
    operationLogs(limit: Int): [OperationLogEntry!]!
    productStrategy(productId: ID!, lineageMode: String): [StrategyNode!]!
    lineageHistory(productId: ID!, limit: Int): [LineageHistoryEvent!]!
    creatives(productId: ID!): [StrategyNode!]!
    performance(productId: ID!): PerformanceSummary!
    productContext(productId: ID!): ProductContext
    creativeExplorationPromptTemplate(templateId: String!): CreativeExplorationPromptTemplate!
    targetAvatars(productId: ID!): [TargetAvatar!]!
    avatarCanvas(productId: ID!): JSON
    userNotes(limit: Int): [UserNote!]!
  }

  type Mutation {
    signInWithoutPassword(input: PasswordlessSignInInput!): AuthSession!
    signOut: Boolean!
    startShopifyConnection(shop: String): ShopifyConnectionStart!
    startMetaConnection: OAuthStart!
    connectMetaAds(accessToken: String!): IntegrationStatus!
    startConvertyConnection: OAuthStart!
    startGoogleDriveConnection: OAuthStart!
    """Downloads a file the person picked in the Google Drive Picker and adds it as a product source."""
    importGoogleDriveFile(fileId: ID!): ProductSource!
    """Saves a generated ad image to Google Drive, overwriting targetFileId when given."""
    exportAdImageToGoogleDrive(adId: ID!, targetFileId: ID): GoogleDriveExportResult!
    setProductMetaCampaigns(productId: ID!, campaigns: [MetaCampaignInput!]!): Int!
    analyzeCsvImport(fileName: String!, csv: String!): CsvAnalysis!
    commitCsvImport(analysisId: ID!, decisions: CsvDecisionsInput): CsvCommitResult!
    deleteCsvImport(id: ID!): Int!
    addContextSource(input: AddContextSourceInput!): ContextSource!
    createPipelineTask(input: CreatePipelineTaskInput!): PipelineTask!
    updatePipelineTask(input: UpdatePipelineTaskInput!): PipelineTask!
    movePipelineTask(input: MovePipelineTaskInput!): PipelineTask!
    deletePipelineTask(id: ID!): Boolean!
    updateContextSource(input: UpdateContextSourceInput!): ContextSource!
    deleteContextSource(id: ID!): Boolean!
    disconnectIntegration(id: ID!): DisconnectResult!
    linkShopifyProduct(productId: ID!, shopifyProductId: ID!): ProductLink!
    createCampaign(productId: ID!, name: String, kind: String, testType: String, positionX: Float, positionY: Float): Campaign!
    """Creates a campaign and its first ad sets in one step: all of it is created, or none of it."""
    createCampaignWithConcepts(productId: ID!, name: String, kind: String, testType: String, combos: [ConceptComboInput!]!): Campaign!
    updateCampaign(id: ID!, name: String, kind: String, testType: String, positionX: Float, positionY: Float): Campaign!
    deleteCampaign(id: ID!): Boolean!
    addCampaignConcepts(campaignId: ID!, combos: [ConceptComboInput!]!): AddConceptsResult!
    updateCampaignConcept(id: ID!, startDate: String, endDate: String, spend: Float, positionX: Float, positionY: Float): CampaignConcept!
    relinkCampaignConcept(id: ID!, avatarId: ID, angleId: ID, offerId: ID): CampaignConcept!
    """An ad set with no persona, angle or offer yet, placed on the canvas. Link ingredients to it afterwards."""
    createEmptyCampaignConcept(campaignId: ID!, positionX: Float, positionY: Float): CampaignConcept!
    """Cuts one ingredient link (slot: avatar, angle or offer) of an ad set. The ad set and its ads are kept."""
    unlinkCampaignConcept(id: ID!, slot: String!): CampaignConcept!
    deleteCampaignConcept(id: ID!): Boolean!
    addCampaignAd(conceptId: ID!, format: String, awareness: String, title: String, hook: String, notes: String, direction: String, beats: [String!], cta: String): CampaignAd!
    updateCampaignAd(id: ID!, format: String, awareness: String, title: String, hook: String, notes: String, direction: String, beats: [String!], cta: String): CampaignAd!
    generateCampaignAdPlan(input: GenerateCampaignAdPlanInput!): [CampaignAd!]!
    """One ad's own cover image, on demand: for an ad made before thumbnails existed, or a retry after imageStatus is "failed"."""
    generateCampaignAdImage(id: ID!): CampaignAd!
    """Publishes an ad set to Meta as a (paused) Campaign / Ad Set / Ads. See MetaPublishResult."""
    publishConceptToMeta(id: ID!, input: MetaPublishInput!): MetaPublishResult!
    generateAdHookAlternatives(input: GenerateAdHooksInput!): [String!]!
    deleteCampaignAd(id: ID!): Boolean!
    unlinkShopifyProduct(productId: ID!): Boolean!
    updateAiPromptTemplate(input: UpdateAiPromptTemplateInput!): AiPromptTemplate!
    savePromptCatalogContent(id: ID!, content: String!): PromptCatalogContent!
    """Writes an edit over a data item."""
    saveDataItem(input: DataItemEditInput!): DataItemContent!
    """Stores an edit as a new item beside the original."""
    copyDataItem(input: DataItemEditInput!): DataItemContent!
    """Renames a data item. Its stored contents are untouched."""
    renameDataItem(id: ID!, label: String!): DataItemContent!
    """An exact copy of a data item's stored contents, beside the original."""
    duplicateDataItem(id: ID!): DataItemContent!
    """Permanently removes a data item."""
    deleteDataItem(id: ID!): Boolean!
    """Makes sure every persona of a product has a portrait or one on the way; only missing ones are generated, in the background. Returns each persona's status."""
    ensureTargetAvatarImages(productId: ID!): [TargetAvatarImageStatus!]!
    """Adds a file of any format, a link or a note to the Data library. Returns the new item's id."""
    addDataItem(input: DataItemAddInput!): ID!
    """Stores a media item's card preview (still, waveform, length). Its contents are untouched."""
    saveDataItemPreview(input: DataItemPreviewInput!): Boolean!
    addWorkspaceMember(input: AddWorkspaceMemberInput!): WorkspaceMember!
    switchWorkspace(workspaceId: ID!): AuthSession!
    inspectProductUrl(url: String!): UrlInspectionResult!
    ingestProductSource(url: String!): ProductSource!
    buildProductContext(sources: [ProductSourceInput!]!, ai: AiModelInput): ProductContext!
    createProduct(input: CreateProductInput!): Product!
    """The product's own representative image, generated from its context on demand. Never fired automatically."""
    generateProductImage(id: ID!): Product!
    """Sets the product's own image directly, from a context source or a captured video frame. Not AI-generated."""
    setProductImage(id: ID!, imageUrl: String!): Product!
    updateStrategyNodePosition(input: UpdateStrategyNodePositionInput!): Boolean!
    deleteStrategySubtree(nodeId: ID!): LineageHistoryEvent!
    generateCreativeExplorationAngles(input: GenerateCreativeExplorationAnglesInput!): [StrategyNode!]!
    generateCreativeExplorationOffers(input: GenerateCreativeExplorationOffersInput!): [StrategyNode!]!
    generateCreativeExplorationTargetAvatars(input: GenerateCreativeExplorationTargetAvatarsInput!): [TargetAvatar!]!
    deleteTargetAvatar(productId: ID!, avatarId: ID!): [TargetAvatar!]!
    resetTargetAvatars(productId: ID!): Boolean!
    saveAvatarCanvas(productId: ID!, canvas: JSON!): Boolean!
    updateCreativeExplorationPromptTemplate(input: UpdateCreativeExplorationPromptTemplateInput!): CreativeExplorationPromptTemplate!
    submitUserNote(input: SubmitUserNoteInput!): UserNote!
  }
`;
