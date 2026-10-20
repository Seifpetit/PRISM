import { readFileSync } from "node:fs";

const catalog = Object.freeze(
  JSON.parse(readFileSync(new URL("../../docs/provider-pricing/providers/anthropic.json", import.meta.url), "utf8")),
);

function compact(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function modelEntry(model) {
  const normalizedModel = compact(model);
  return catalog.models.find((entry) => {
    const name = compact(entry.name);
    return normalizedModel === name || normalizedModel.startsWith(`${name}20`);
  });
}

export function resolveAnthropicPricing({ model, request, response }) {
  const metadata = {
    provider: catalog.provider,
    catalogVersion: `${catalog.catalog_schema}@${catalog.retrieved_at}`,
    retrievedAt: catalog.retrieved_at,
    currency: catalog.currency,
    model,
  };
  const entry = modelEntry(model);
  if (!entry) return { status: "unpriced", reason: "unknown_model", ...metadata };
  const serviceMode = request?.options?.serviceMode ?? "standard";
  if (serviceMode !== "standard") {
    return { status: "unpriced", reason: "unsupported_service_mode", ...metadata, serviceMode };
  }
  const usage = (response?.raw ?? response)?.usage ?? {};
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  if (cacheCreationTokens > 0) {
    return {
      status: "unpriced",
      reason: "ambiguous_cache_write_ttl",
      ...metadata,
      modelKind: "text",
      modelStatus: entry.status,
      serviceMode,
    };
  }
  return {
    status: "resolved",
    reason: null,
    ...metadata,
    modelKind: "text",
    modelStatus: entry.status,
    serviceMode,
    contextTier: null,
    contextTierSource: null,
    rates: {
      input: entry.input,
      cachedInput: entry.cache_read,
      output: entry.output,
      webSearchPerThousand: catalog.charges.find((charge) => charge.id === "web_search")?.amount ?? null,
    },
    modifiers: [],
  };
}
