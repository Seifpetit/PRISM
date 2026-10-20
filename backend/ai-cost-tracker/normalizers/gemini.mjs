function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/** Gemini reports candidate output and thinking output separately. */
export function normalizeGeminiUsage(response) {
  const providerResponse = response?.raw ?? response;
  const usage = providerResponse?.usageMetadata;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return {
      status: "missing_usage",
      reason: "missing_usage",
      rawUsage: usage ?? null,
      usage: null,
    };
  }
  const inputTokens = tokenCount(usage.promptTokenCount);
  const outputTokens = tokenCount(usage.candidatesTokenCount);
  const totalTokens = hasOwn(usage, "totalTokenCount") ? tokenCount(usage.totalTokenCount) : null;
  const cachedInputTokens = hasOwn(usage, "cachedContentTokenCount")
    ? tokenCount(usage.cachedContentTokenCount)
    : 0;
  // Gemini only returns this field when thinking is used; an omitted field is
  // therefore a documented zero, not an unknown billing dimension.
  const reasoningTokens = hasOwn(usage, "thoughtsTokenCount")
    ? tokenCount(usage.thoughtsTokenCount)
    : 0;
  const malformed = [
    [usage, "promptTokenCount", inputTokens],
    [usage, "candidatesTokenCount", outputTokens],
    [usage, "totalTokenCount", totalTokens],
    [usage, "cachedContentTokenCount", cachedInputTokens],
    [usage, "thoughtsTokenCount", reasoningTokens],
  ].some(([container, key, value]) => hasOwn(container, key) && value === null);
  const uncachedInputTokens = inputTokens !== null ? inputTokens - cachedInputTokens : null;
  if (malformed || (uncachedInputTokens !== null && uncachedInputTokens < 0)) {
    return {
      status: "malformed_usage",
      reason: malformed ? "malformed_usage" : "categorized_input_exceeds_input",
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
      uncachedInputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      billableOutputTokens: outputTokens === null ? null : outputTokens + reasoningTokens,
      totalTokens,
    },
  };
}
