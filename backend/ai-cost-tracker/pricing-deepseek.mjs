import { readFileSync } from "node:fs";

const catalog = Object.freeze(
  JSON.parse(
    readFileSync(
      new URL("../../docs/provider-pricing/providers/deepseek.json", import.meta.url),
      "utf8",
    ),
  ),
);

export function resolveDeepSeekPricing({ model, request }) {
  const metadata = {
    provider: catalog.provider,
    catalogVersion: `${catalog.catalog_schema}@${catalog.retrieved_at}`,
    retrievedAt: catalog.retrieved_at,
    currency: catalog.currency,
    model,
  };
  if (request?.hasMediaInput)
    return { status: "unpriced", reason: "unsupported_media_pricing", ...metadata };
  const entry = catalog.models.find((candidate) => candidate.id === model);
  if (!entry) return { status: "unpriced", reason: "unknown_model", ...metadata };
  return {
    status: "resolved",
    reason: null,
    ...metadata,
    modelKind: "text_reasoning",
    modelStatus: entry.status,
    serviceMode: "standard",
    contextTier: null,
    contextTierSource: null,
    rates: {
      uncachedInput: entry.rates.input_cache_miss,
      cachedInput: entry.rates.input_cache_hit,
      output: entry.rates.output,
    },
    modifiers: [],
  };
}
