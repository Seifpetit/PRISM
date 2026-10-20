import { randomUUID } from "node:crypto";
import { calculateOpenAICost } from "./calculators/openai.mjs";
import { calculateDeepSeekCost } from "./calculators/deepseek.mjs";
import { calculateGeminiCost } from "./calculators/gemini.mjs";
import { calculateAnthropicCost } from "./calculators/anthropic.mjs";
import { calculatePerplexityCost } from "./calculators/perplexity.mjs";
import {
  appendCostLedgerRecord,
  getCostLedgerEntry,
  readCostLedgerEntries,
} from "./ledger/file-ledger.mjs";
import { normalizeOpenAIUsage } from "./normalizers/openai.mjs";
import { normalizeOpenAIImageUsage } from "./normalizers/openai-image.mjs";
import { normalizeDeepSeekUsage } from "./normalizers/deepseek.mjs";
import { normalizeGeminiUsage } from "./normalizers/gemini.mjs";
import { normalizeAnthropicUsage } from "./normalizers/anthropic.mjs";
import { normalizePerplexityUsage } from "./normalizers/perplexity.mjs";
import { resolveOpenAIPricing } from "./pricing.mjs";
import { resolveOpenAIImagePricing } from "./pricing-openai-image.mjs";
import { resolveDeepSeekPricing } from "./pricing-deepseek.mjs";
import { resolveGeminiPricing } from "./pricing-gemini.mjs";
import { resolveAnthropicPricing } from "./pricing-anthropic.mjs";
import { resolvePerplexityPricing } from "./pricing-perplexity.mjs";
import { isDatabaseConfigured } from "../database/client.mjs";
import { readDatabaseCostLedgerEntries } from "../database/operation-log-repository.mjs";

const providerTracking = {
  openai: {
    normalize: normalizeOpenAIUsage,
    resolvePricing: resolveOpenAIPricing,
    calculate: calculateOpenAICost,
    supportsRequestChargeDetection: true,
  },
  // Image generation (gpt-image-*): its own normalizer and pricing resolver (different usage shape, different
  // catalog rates), reusing the same token-cost formula since the math is identical once usage is normalized.
  openai_image: {
    normalize: normalizeOpenAIImageUsage,
    resolvePricing: resolveOpenAIImagePricing,
    calculate: calculateOpenAICost,
    supportsRequestChargeDetection: false,
  },
  deepseek: {
    normalize: normalizeDeepSeekUsage,
    resolvePricing: resolveDeepSeekPricing,
    calculate: calculateDeepSeekCost,
    supportsRequestChargeDetection: false,
  },
  gemini: {
    normalize: normalizeGeminiUsage,
    resolvePricing: resolveGeminiPricing,
    calculate: calculateGeminiCost,
    supportsRequestChargeDetection: false,
  },
  anthropic: {
    normalize: normalizeAnthropicUsage,
    resolvePricing: resolveAnthropicPricing,
    calculate: calculateAnthropicCost,
    supportsRequestChargeDetection: false,
  },
  perplexity: {
    normalize: normalizePerplexityUsage,
    resolvePricing: resolvePerplexityPricing,
    calculate: calculatePerplexityCost,
    supportsRequestChargeDetection: false,
  },
};

function billingOptions(request = {}) {
  const options = request.options ?? {};
  return {
    maxTokens: options.maxTokens ?? null,
    serviceMode: options.serviceMode ?? "standard",
    contextTier: options.contextTier ?? "short_context",
    region: options.region ?? null,
    regionalProcessing: options.regionalProcessing === true,
    hasMediaInput: request.hasMediaInput === true,
    mediaInputTypes: Array.isArray(request.mediaInputTypes) ? request.mediaInputTypes : [],
  };
}

function unsupportedRequestCharges(request, response) {
  const tools = request?.tools ?? request?.options?.tools;
  const toolNames = Array.isArray(tools)
    ? tools.map((tool) => tool?.type ?? tool?.name ?? "unidentified_tool")
    : [];
  const output = (response?.raw ?? response)?.output;
  const responseToolTypes = Array.isArray(output)
    ? output
        .filter(
          (item) =>
            typeof item?.type === "string" && /search|tool|computer|code|container/.test(item.type),
        )
        .map((item) => item.type)
    : [];
  return [...new Set([...toolNames, ...responseToolTypes])];
}

function publicPricing(pricing) {
  return {
    catalogVersion: pricing.catalogVersion,
    retrievedAt: pricing.retrievedAt,
    provider: pricing.provider,
    model: pricing.model,
    modelKind: pricing.modelKind ?? null,
    serviceMode: pricing.serviceMode ?? null,
    contextTier: pricing.contextTier ?? null,
    contextTierSource: pricing.contextTierSource ?? null,
    applicableRates: pricing.rates ?? null,
    applicableModifiers: pricing.modifiers ?? [],
  };
}

/**
 * Public atomic cost boundary. It never persists prompts, model output, API
 * keys, headers, or other request contents.
 */
export async function trackAICallCost({
  provider,
  model,
  request,
  response,
  operation,
  workspaceId = null,
  operationId = null,
  parentGenerationId = null,
  attempt = 1,
  occurredAt = new Date().toISOString(),
  ledgerFilePath,
}) {
  if (!operation || typeof operation !== "string") {
    throw new TypeError("AI cost tracking requires a stable operation.");
  }
  if (!workspaceId) throw new TypeError("AI cost tracking requires a workspace ID.");
  const tracker = providerTracking[provider];
  if (!tracker) {
    throw new TypeError(`AI cost tracking is not implemented for provider: ${provider}`);
  }

  const normalized = tracker.normalize(response);
  const pricingResolution = tracker.resolvePricing({ model, request, response });
  const unsupportedCharges = tracker.supportsRequestChargeDetection
    ? unsupportedRequestCharges(request, response)
    : [];
  const calculation =
    normalized.status === "normalized"
      ? tracker.calculate({
          normalizedUsage: normalized.usage,
          pricing: pricingResolution,
          unsupportedCharges,
        })
      : {
          status: "unpriced",
          costUsd: null,
          reason: normalized.reason,
          breakdown: null,
        };
  const requestBillingOptions = billingOptions(request);
  const createdAt = new Date().toISOString();
  const entry = {
    id: randomUUID(),
    createdAt,
    occurredAt,
    provider,
    model,
    providerRequestId:
      response?.metadata?.providerRequestId ?? (response?.raw ?? response)?.id ?? null,
    operation,
    workspaceId,
    operationId,
    parentGenerationId,
    attempt,
    requestContext: {
      serviceMode: pricingResolution.serviceMode ?? requestBillingOptions.serviceMode,
      contextTier: pricingResolution.contextTier ?? requestBillingOptions.contextTier,
      region: requestBillingOptions.region,
      relevantBillingOptions: requestBillingOptions,
    },
    rawUsage: normalized.rawUsage,
    normalizedUsage: normalized.usage,
    cost: {
      status: calculation.status,
      usd: calculation.costUsd,
      reason: calculation.reason,
      breakdown: calculation.breakdown,
    },
    pricing: publicPricing(pricingResolution),
  };

  await appendCostLedgerRecord(entry, { filePath: ledgerFilePath });
  return {
    status: calculation.status,
    costUsd: calculation.costUsd,
    reason: calculation.reason,
    breakdown: calculation.breakdown,
    pricing: entry.pricing,
    ledgerEntry: entry,
  };
}

export { getCostLedgerEntry, readCostLedgerEntries };

export async function readCostLedgerEntriesForApi(options = {}) {
  if (!options.workspaceId) throw new TypeError("Cost reads require a workspace ID.");
  if (!isDatabaseConfigured()) return readCostLedgerEntries(options);
  try {
    return await readDatabaseCostLedgerEntries(options);
  } catch (error) {
    console.error("[OPERATION DATABASE] Read failed; serving the JSONL ledger fallback.", error);
    return readCostLedgerEntries(options);
  }
}
