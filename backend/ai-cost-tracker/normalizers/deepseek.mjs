function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/** Normalize DeepSeek's cache-aware Chat Completions usage without guessing. */
export function normalizeDeepSeekUsage(response) {
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

  const inputTokens = tokenCount(usage.prompt_tokens);
  const cachedInputTokens = hasOwn(usage, "prompt_cache_hit_tokens")
    ? tokenCount(usage.prompt_cache_hit_tokens)
    : null;
  const uncachedInputTokens = hasOwn(usage, "prompt_cache_miss_tokens")
    ? tokenCount(usage.prompt_cache_miss_tokens)
    : null;
  const outputTokens = tokenCount(usage.completion_tokens);
  const totalTokens = hasOwn(usage, "total_tokens") ? tokenCount(usage.total_tokens) : null;
  const reasoningTokens = hasOwn(usage.completion_tokens_details, "reasoning_tokens")
    ? tokenCount(usage.completion_tokens_details.reasoning_tokens)
    : null;
  const malformed = [
    [usage, "prompt_tokens", inputTokens],
    [usage, "prompt_cache_hit_tokens", cachedInputTokens],
    [usage, "prompt_cache_miss_tokens", uncachedInputTokens],
    [usage, "completion_tokens", outputTokens],
    [usage, "total_tokens", totalTokens],
    [usage.completion_tokens_details, "reasoning_tokens", reasoningTokens],
  ].some(([container, key, value]) => hasOwn(container, key) && value === null);
  if (
    malformed ||
    (inputTokens !== null &&
      cachedInputTokens !== null &&
      uncachedInputTokens !== null &&
      inputTokens !== cachedInputTokens + uncachedInputTokens)
  ) {
    return {
      status: "malformed_usage",
      reason: malformed ? "malformed_usage" : "categorized_input_does_not_match_prompt",
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
      totalTokens,
    },
  };
}
