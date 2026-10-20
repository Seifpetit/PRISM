import { readFileSync } from "node:fs";

const catalogUrl = new URL("../../docs/provider-pricing/providers/openai.json", import.meta.url);
const openAICatalog = Object.freeze(JSON.parse(readFileSync(catalogUrl, "utf8")));

function normalizedServiceMode(request, response) {
  const reported = (response?.raw ?? response)?.service_tier;
  if (reported === "flex") return "flex";
  if (reported === "priority") return "fast";
  if (reported === "default" || reported === "auto") return "standard";
  const requested = request?.options?.serviceMode ?? request?.serviceMode;
  if (requested) return requested;
  return "standard";
}

function isTieredRates(rates) {
  return Boolean(rates?.short_context || rates?.long_context);
}

export function getOpenAIPricingCatalogMetadata() {
  return {
    provider: openAICatalog.provider,
    catalogVersion: `${openAICatalog.catalog_schema}@${openAICatalog.retrieved_at}`,
    retrievedAt: openAICatalog.retrieved_at,
    currency: openAICatalog.currency,
  };
}

/** Resolve one exact text/reasoning rate row from the canonical JSON snapshot. */
export function resolveOpenAIPricing({ model, request, response }) {
  const catalog = getOpenAIPricingCatalogMetadata();
  if (request?.hasMediaInput) {
    return {
      status: "unpriced",
      reason: "unsupported_media_pricing",
      ...catalog,
      model,
      mediaInputTypes: request.mediaInputTypes ?? [],
    };
  }
  const modelEntry = openAICatalog.models.find((candidate) => candidate.id === model);
  if (!modelEntry) {
    return { status: "unpriced", reason: "unknown_model", ...catalog, model };
  }

  if (!["text_reasoning", "chat", "codex"].includes(modelEntry.kind)) {
    return {
      status: "unpriced",
      reason: "unsupported_modality",
      ...catalog,
      model,
      modelKind: modelEntry.kind,
    };
  }

  const serviceMode = normalizedServiceMode(request, response);
  const modeRates = modelEntry.rates?.[serviceMode];
  if (!modeRates) {
    return {
      status: "unpriced",
      reason: "unsupported_service_mode",
      ...catalog,
      model,
      modelKind: modelEntry.kind,
      serviceMode,
    };
  }

  const requestedContextTier = request?.options?.contextTier ?? request?.contextTier;
  const contextTier = isTieredRates(modeRates) ? (requestedContextTier ?? "short_context") : null;
  const rates = contextTier ? modeRates[contextTier] : modeRates;
  if (!rates) {
    return {
      status: "unpriced",
      reason: "unsupported_context_tier",
      ...catalog,
      model,
      modelKind: modelEntry.kind,
      serviceMode,
      contextTier,
    };
  }

  const regionalProcessing =
    request?.options?.regionalProcessing === true || request?.regionalProcessing === true;
  const regionalModifier = regionalProcessing
    ? openAICatalog.modifiers.find((modifier) => modifier.id === "regional_processing")
    : null;
  if (regionalProcessing && !regionalModifier?.multiplier) {
    return {
      status: "unpriced",
      reason: "missing_regional_modifier",
      ...catalog,
      model,
      modelKind: modelEntry.kind,
      serviceMode,
      contextTier,
    };
  }

  return {
    status: "resolved",
    reason: null,
    ...catalog,
    model,
    modelKind: modelEntry.kind,
    modelStatus: modelEntry.status,
    serviceMode,
    contextTier,
    contextTierSource: requestedContextTier
      ? "request"
      : contextTier
        ? "application_short_context_default"
        : null,
    rates: {
      input: rates.input ?? null,
      cachedInput: rates.cached_input ?? null,
      cacheWrite: rates.cache_write ?? null,
      output: rates.output ?? null,
    },
    modifiers: regionalModifier
      ? [
          {
            id: regionalModifier.id,
            multiplier: regionalModifier.multiplier,
          },
        ]
      : [],
  };
}

export { openAICatalog };
