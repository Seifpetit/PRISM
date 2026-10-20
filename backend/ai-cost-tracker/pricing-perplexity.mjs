import { readFileSync } from "node:fs";

const catalog = Object.freeze(
  JSON.parse(readFileSync(new URL("../../docs/provider-pricing/providers/perplexity.json", import.meta.url), "utf8")),
);

export function resolvePerplexityPricing({ model }) {
  const metadata = { provider: catalog.provider, catalogVersion: `${catalog.catalog_schema}@${catalog.retrieved_at}`, retrievedAt: catalog.retrieved_at, currency: catalog.currency, model };
  const entry = catalog.models.find((candidate) => candidate.id === model);
  if (!entry) return { status: "unpriced", reason: "unknown_model", ...metadata };
  return { status: "resolved", reason: null, ...metadata, modelKind: "search", modelStatus: entry.status, serviceMode: "standard", contextTier: null, contextTierSource: "provider_reported_search_context", rates: entry.rates, modifiers: [] };
}
