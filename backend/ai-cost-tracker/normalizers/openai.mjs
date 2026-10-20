function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/** Normalize billing-relevant usage from an OpenAI Responses API payload. */
export function normalizeOpenAIUsage(response) {
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

  const inputDetails = usage.input_tokens_details;
  const outputDetails = usage.output_tokens_details;
  const malformedDetails =
    (hasOwn(usage, "input_tokens_details") &&
      (!inputDetails || typeof inputDetails !== "object" || Array.isArray(inputDetails))) ||
    (hasOwn(usage, "output_tokens_details") &&
      (!outputDetails || typeof outputDetails !== "object" || Array.isArray(outputDetails)));
  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  const totalTokens = tokenCount(usage.total_tokens);
  const cachedInputTokens = hasOwn(inputDetails, "cached_tokens")
    ? tokenCount(inputDetails.cached_tokens)
    : null;
  const cacheWriteTokens = hasOwn(inputDetails, "cache_write_tokens")
    ? tokenCount(inputDetails.cache_write_tokens)
    : null;
  const reasoningTokens = hasOwn(outputDetails, "reasoning_tokens")
    ? tokenCount(outputDetails.reasoning_tokens)
    : null;

  const malformed =
    malformedDetails ||
    [
      [usage, "input_tokens", inputTokens],
      [usage, "output_tokens", outputTokens],
      [usage, "total_tokens", totalTokens],
      [inputDetails, "cached_tokens", cachedInputTokens],
      [inputDetails, "cache_write_tokens", cacheWriteTokens],
      [outputDetails, "reasoning_tokens", reasoningTokens],
    ].some(([container, key, normalized]) => hasOwn(container, key) && normalized === null);

  if (malformed) {
    return {
      status: "malformed_usage",
      reason: "malformed_usage",
      rawUsage: structuredClone(usage),
      usage: null,
    };
  }

  const uncachedInputTokens =
    inputTokens !== null && cachedInputTokens !== null && cacheWriteTokens !== null
      ? inputTokens - cachedInputTokens - cacheWriteTokens
      : null;
  if (uncachedInputTokens !== null && uncachedInputTokens < 0) {
    return {
      status: "malformed_usage",
      reason: "categorized_input_exceeds_input",
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
      cacheWriteTokens,
      outputTokens,
      // OpenAI includes reasoning tokens inside output_tokens. This field is
      // retained for audit only and is never added to outputTokens for cost.
      reasoningTokens,
      totalTokens,
    },
  };
}
