import { readFileSync } from "node:fs";

const catalog = Object.freeze(
  JSON.parse(
    readFileSync(
      new URL("../../docs/provider-pricing/providers/gemini.json", import.meta.url),
      "utf8",
    ),
  ),
);

function rate(rates, names) {
  return names.map((name) => rates?.[name]).find((value) => typeof value === "number") ?? null;
}

export function resolveGeminiPricing({ model, request, response }) {
  const metadata = {
    provider: "gemini",
    catalogVersion: `${catalog.catalog_schema}@${catalog.retrieved_at}`,
    retrievedAt: catalog.retrieved_at,
    currency: catalog.currency,
    model,
  };
  const entry = catalog.model_groups.find((candidate) => candidate.ids.includes(model));
  if (!entry) return { status: "unpriced", reason: "unknown_model", ...metadata };
  const serviceMode = request?.options?.serviceMode ?? "standard";
  const rates = entry.modes?.[serviceMode];
  if (!rates)
    return {
      status: "unpriced",
      reason: "unsupported_service_mode",
      ...metadata,
      modelKind: "multimodal",
      serviceMode,
    };
  const inputTokens = (response?.raw ?? response)?.usageMetadata?.promptTokenCount ?? 0;
  const longContext = inputTokens > 200_000;
  const inputRate = rate(
    rates,
    longContext
      ? ["input_over_200k", "input_text_image_video", "input_all_modalities", "input"]
      : ["input_at_or_under_200k", "input_text_image_video", "input_all_modalities", "input"],
  );
  const outputRate = rate(
    rates,
    longContext
      ? [
          "output_over_200k",
          "output_including_thinking",
          "text_output_including_thinking",
          "output",
        ]
      : [
          "output_at_or_under_200k",
          "output_including_thinking",
          "text_output_including_thinking",
          "output",
        ],
  );
  const cachedInputRate = rate(rates, [
    "cache_read_text_image_video",
    "cache_read",
    "cache_read_at_or_under_200k",
  ]);
  return {
    status: "resolved",
    reason: null,
    ...metadata,
    modelKind: "multimodal",
    modelStatus: entry.status,
    serviceMode,
    contextTier: longContext ? "over_200k" : "at_or_under_200k",
    contextTierSource: "reported_prompt_tokens",
    rates: { input: inputRate, cachedInput: cachedInputRate, output: outputRate },
    modifiers: [],
  };
}
