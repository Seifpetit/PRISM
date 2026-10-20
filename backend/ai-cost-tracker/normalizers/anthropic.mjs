function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function hasOwn(value, key) {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

/** Normalize the documented Claude Messages API usage object without guessing cache TTL. */
export function normalizeAnthropicUsage(response) {
  const providerResponse = response?.raw ?? response;
  const usage = providerResponse?.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    return { status: "missing_usage", reason: "missing_usage", rawUsage: usage ?? null, usage: null };
  }
  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  const cacheReadTokens = hasOwn(usage, "cache_read_input_tokens")
    ? tokenCount(usage.cache_read_input_tokens)
    : 0;
  const cacheCreationTokens = hasOwn(usage, "cache_creation_input_tokens")
    ? tokenCount(usage.cache_creation_input_tokens)
    : 0;
  const webSearchRequests = hasOwn(usage.server_tool_use, "web_search_requests")
    ? tokenCount(usage.server_tool_use.web_search_requests)
    : 0;
  const malformed = [
    [usage, "input_tokens", inputTokens],
    [usage, "output_tokens", outputTokens],
    [usage, "cache_read_input_tokens", cacheReadTokens],
    [usage, "cache_creation_input_tokens", cacheCreationTokens],
    [usage.server_tool_use, "web_search_requests", webSearchRequests],
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
      cachedInputTokens: cacheReadTokens,
      cacheCreationTokens,
      outputTokens,
      reasoningTokens: 0,
      totalTokens: inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens,
      webSearchRequests,
    },
  };
}
