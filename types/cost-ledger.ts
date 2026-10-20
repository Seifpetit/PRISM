export interface CostLedgerRecord {
  id: string;
  source: {
    kind: string;
    label: string;
  };
  provider: {
    id: string;
    label: string;
  };
  service: {
    id: string;
    label: string;
  };
  operation: string;
  occurredAt: string;
  usage: {
    total: number | null;
    unit: string;
  };
  cost: {
    status: "priced" | "partial" | "unpriced" | string;
    usd: string | null;
    reason: string | null;
  };
}

/** Existing backend AI-ledger fields used by the frontend presentation adapter. */
export interface AiCostLedgerEntry {
  id: string;
  createdAt: string;
  occurredAt: string;
  provider: string;
  model: string;
  providerRequestId: string | null;
  operation: string;
  operationId: string | null;
  parentGenerationId: string | null;
  attempt: number;
  requestContext: {
    serviceMode?: string | null;
    contextTier?: string | null;
    region?: string | null;
    relevantBillingOptions?: {
      maxTokens?: number | null;
      serviceMode?: string | null;
      contextTier?: string | null;
      region?: string | null;
      regionalProcessing?: boolean;
      hasMediaInput?: boolean;
      mediaInputTypes?: string[];
    };
  } | null;
  rawUsage: unknown;
  normalizedUsage: {
    inputTokens?: number | null;
    uncachedInputTokens?: number | null;
    cachedInputTokens?: number | null;
    cacheWriteTokens?: number | null;
    outputTokens?: number | null;
    reasoningTokens?: number | null;
    totalTokens: number | null;
  } | null;
  cost: {
    status: "priced" | "partial" | "unpriced" | string;
    usd: string | null;
    reason: string | null;
    breakdown?: unknown;
  };
  pricing?: unknown;
}
