import { getOpenAIPricingCatalogMetadata, openAICatalog } from "./pricing.mjs";

function normalizedServiceMode(response) {
  const reported = (response?.raw ?? response)?.service_tier;
  return reported === "batch" ? "batch" : "standard";
}

/**
 * Resolve one gpt-image-* rate row from the same canonical snapshot as the text models
 * (docs/provider-pricing/providers/openai.json). Text-to-image only (see providers/openai-image.mjs — this
 * call never sends image input), so the prompt is always billed at the model's text rate and the result at
 * its image-output rate; there is no cache-write dimension for this call shape.
 */
export function resolveOpenAIImagePricing({ model, response }) {
  const catalog = getOpenAIPricingCatalogMetadata();
  const modelEntry = openAICatalog.models.find((candidate) => candidate.id === model);
  if (!modelEntry) {
    return { status: "unpriced", reason: "unknown_model", ...catalog, model };
  }

  if (modelEntry.kind !== "image_generation") {
    return {
      status: "unpriced",
      reason: "unsupported_modality",
      ...catalog,
      model,
      modelKind: modelEntry.kind,
    };
  }

  const serviceMode = normalizedServiceMode(response);
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

  return {
    status: "resolved",
    reason: null,
    ...catalog,
    model,
    modelKind: modelEntry.kind,
    modelStatus: modelEntry.status,
    serviceMode,
    contextTier: null,
    contextTierSource: null,
    rates: {
      input: modeRates.text_input ?? null,
      cachedInput: modeRates.text_cached_input ?? null,
      cacheWrite: null,
      output: modeRates.image_output ?? null,
    },
    modifiers: [],
  };
}
