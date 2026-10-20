function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function money(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? String(value) : null;
}
function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/** Perplexity returns token usage, search context, and (for Sonar) provider-rated cost. */
export function normalizePerplexityUsage(response) {
  const providerResponse = response?.raw ?? response;
  const usage = providerResponse?.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { status: "missing_usage", reason: "missing_usage", rawUsage: usage ?? null, usage: null };
  }
  const inputTokens = tokenCount(usage.prompt_tokens);
  const outputTokens = tokenCount(usage.completion_tokens);
  const totalTokens = hasOwn(usage, "total_tokens") ? tokenCount(usage.total_tokens) : null;
  const reportedTotalCost = hasOwn(usage.cost, "total_cost") ? money(usage.cost.total_cost) : null;
  const malformed = [
    [usage, "prompt_tokens", inputTokens],
    [usage, "completion_tokens", outputTokens],
    [usage, "total_tokens", totalTokens],
    [usage.cost, "total_cost", reportedTotalCost],
  ].some(([container, key, value]) => hasOwn(container, key) && value === null);
  if (malformed) {
    return { status: "malformed_usage", reason: "malformed_usage", rawUsage: structuredClone(usage), usage: null };
  }
  return {
    status: "normalized",
    reason: null,
    rawUsage: structuredClone(usage),
    usage: {
      inputTokens,
      uncachedInputTokens: inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      reasoningTokens: 0,
      totalTokens,
      searchContextSize: usage.search_context_size ?? null,
      reportedTotalCost,
      reportedCost: usage.cost ?? null,
    },
  };
}
