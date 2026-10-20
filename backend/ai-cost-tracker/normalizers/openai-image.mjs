function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Normalize billing-relevant usage from an OpenAI Images API payload (gpt-image-*). This shape has no prompt
 * caching and no reasoning tokens — unlike the Responses API (normalizers/openai.mjs), so there is nothing to
 * read out of input_tokens_details/output_tokens_details for billing; the whole input is always "uncached".
 */
export function normalizeOpenAIImageUsage(response) {
  const providerResponse = response?.raw ?? response;
  const usage = providerResponse?.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return {
      status: "missing_usage",
      reason: "missing_usage",
      rawUsage: usage ?? null,
      usage: null,
    };
  }

  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  const totalTokens = tokenCount(usage.total_tokens);

  const malformed = [
    [usage, "input_tokens", inputTokens],
    [usage, "output_tokens", outputTokens],
    [usage, "total_tokens", totalTokens],
  ].some(([container, key, normalized]) => Object.hasOwn(container, key) && normalized === null);

  if (malformed) {
    return {
      status: "malformed_usage",
      reason: "malformed_usage",
      rawUsage: structuredClone(usage),
      usage: null,
    };
  }

  return {
    status: "normalized",
    reason: null,
    rawUsage: structuredClone(usage),
    usage: {
      inputTokens,
      uncachedInputTokens: inputTokens,
      cachedInputTokens: inputTokens === null ? null : 0,
      cacheWriteTokens: inputTokens === null ? null : 0,
      outputTokens,
      reasoningTokens: null,
      totalTokens,
    },
  };
}
