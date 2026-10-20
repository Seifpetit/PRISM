import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { callAiModel, registerAiProvider } from "../ai/canonical-caller.mjs";
import * as realOpenAI from "../ai/providers/openai.mjs";
import * as realOpenAIImage from "../ai/providers/openai-image.mjs";
import * as realDeepSeek from "../ai/providers/deepseek.mjs";
import * as realGemini from "../ai/providers/gemini.mjs";
import * as realAnthropic from "../ai/providers/anthropic.mjs";
import * as realPerplexity from "../ai/providers/perplexity.mjs";
import { AI_OPERATIONS, operationForTemplate } from "../ai/workflow-operations.mjs";
import { buildProductContextArtifact } from "../product-context/service.mjs";
import { calculateOpenAICost } from "./calculators/openai.mjs";
import { calculateDeepSeekCost } from "./calculators/deepseek.mjs";
import { calculateGeminiCost } from "./calculators/gemini.mjs";
import { calculateAnthropicCost } from "./calculators/anthropic.mjs";
import { calculatePerplexityCost } from "./calculators/perplexity.mjs";
import { getCostLedgerEntry, trackAICallCost, readCostLedgerEntries } from "./index.mjs";
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
import { signInWithoutPassword } from "../database/auth-repository.mjs";
import { closeDatabasePool } from "../database/client.mjs";

const previousDatabasePath = process.env.DATABASE_PATH;
const costDatabaseDirectory = await mkdtemp(join(tmpdir(), "ecom-ai-cost-db-"));
process.env.DATABASE_PATH = join(costDatabaseDirectory, "prism.db");
let costTestWorkspaceId;

test.before(async () => {
  const session = await signInWithoutPassword({
    displayName: "AI Cost Test",
    email: "ai-cost-test@example.com",
  });
  costTestWorkspaceId = session.workspace.id;
});

test.after(async () => {
  await closeDatabasePool();
  if (previousDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = previousDatabasePath;
  await rm(costDatabaseDirectory, { recursive: true, force: true });
});

function responseUsage(overrides = {}) {
  return {
    id: "resp-cost-test",
    usage: {
      input_tokens: 111_000,
      input_tokens_details: { cached_tokens: 10_000, cache_write_tokens: 1_000 },
      output_tokens: 20_000,
      output_tokens_details: { reasoning_tokens: 5_000 },
      total_tokens: 131_000,
      ...overrides,
    },
  };
}

function imageResponseUsage(overrides = {}) {
  return {
    data: [{ b64_json: "not-a-real-image" }],
    usage: {
      input_tokens: 20_000,
      input_tokens_details: { text_tokens: 20_000, image_tokens: 0 },
      output_tokens: 4_000,
      total_tokens: 24_000,
      ...overrides,
    },
  };
}

async function temporaryLedger(run) {
  const directory = await mkdtemp(join(tmpdir(), "ecom-ai-cost-"));
  const filePath = join(directory, "ledger.jsonl");
  try {
    return await run(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function semanticProductContext(overrides = {}) {
  return {
    name: "Cloud Pillow",
    workingLabel: "Adjustable cooling pillow",
    category: "Pillow",
    summary: "A cooling, adjustable pillow.",
    features: ["Cooling cover"],
    mechanisms: ["Airflow"],
    benefits: ["Sleeps cooler"],
    proofPoints: ["Washable cover"],
    useCases: ["Side sleeping"],
    claims: ["Temperature-regulating"],
    constraints: ["No medical claims"],
    ...overrides,
  };
}

test("OpenAI Responses usage normalization preserves all billing dimensions", () => {
  const normalized = normalizeOpenAIUsage(responseUsage());
  assert.equal(normalized.status, "normalized");
  assert.deepEqual(normalized.usage, {
    inputTokens: 111_000,
    uncachedInputTokens: 100_000,
    cachedInputTokens: 10_000,
    cacheWriteTokens: 1_000,
    outputTokens: 20_000,
    reasoningTokens: 5_000,
    totalTokens: 131_000,
  });
  assert.equal(normalized.rawUsage.output_tokens_details.reasoning_tokens, 5_000);
});

test("DeepSeek cache-hit, cache-miss, and output usage uses the documented rates", () => {
  const response = {
    id: "deepseek-cost",
    usage: {
      prompt_tokens: 100,
      prompt_cache_hit_tokens: 20,
      prompt_cache_miss_tokens: 80,
      completion_tokens: 50,
      completion_tokens_details: { reasoning_tokens: 30 },
      total_tokens: 150,
    },
  };
  const normalized = normalizeDeepSeekUsage(response);
  const pricing = resolveDeepSeekPricing({ model: "deepseek-v4-flash", request: {}, response });
  const result = calculateDeepSeekCost({ normalizedUsage: normalized.usage, pricing });
  assert.equal(normalized.usage.reasoningTokens, 30);
  assert.equal(result.status, "priced");
  assert.equal(result.costUsd, "0.000025256");
});

test("Gemini multimodal usage bills candidate and separately reported thinking tokens once", () => {
  const response = {
    responseId: "gemini-cost",
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      thoughtsTokenCount: 20,
      totalTokenCount: 150,
      promptTokensDetails: [{ modality: "IMAGE", tokenCount: 60 }],
    },
  };
  const normalized = normalizeGeminiUsage(response);
  const pricing = resolveGeminiPricing({
    model: "gemini-2.5-flash-lite",
    request: { hasMediaInput: true, options: {} },
    response,
  });
  const result = calculateGeminiCost({ normalizedUsage: normalized.usage, pricing });
  assert.equal(normalized.usage.reasoningTokens, 20);
  assert.equal(result.status, "priced");
  assert.equal(normalized.usage.billableOutputTokens, 70);
  assert.equal(result.breakdown.output.tokens, 70);
  assert.equal(result.costUsd, "0.000038");
});

test("Anthropic Messages usage prices uncached input, cache reads, output, and reported web searches", () => {
  const response = {
    id: "anthropic-cost",
    usage: {
      input_tokens: 100_000,
      cache_read_input_tokens: 20_000,
      cache_creation_input_tokens: 0,
      output_tokens: 10_000,
      server_tool_use: { web_search_requests: 2 },
    },
  };
  const normalized = normalizeAnthropicUsage(response);
  const pricing = resolveAnthropicPricing({ model: "claude-haiku-4-5", request: { options: {} }, response });
  const result = calculateAnthropicCost({ normalizedUsage: normalized.usage, pricing });
  assert.equal(result.status, "priced");
  assert.equal(result.breakdown.webSearch.costUsd, "0.02");
  assert.equal(result.costUsd, "0.172");

  const ambiguous = resolveAnthropicPricing({
    model: "claude-haiku-4-5",
    request: { options: {} },
    response: { usage: { ...response.usage, cache_creation_input_tokens: 1 } },
  });
  assert.equal(ambiguous.reason, "ambiguous_cache_write_ttl");
});

test("Perplexity honors provider-rated total cost and reconstructs Sonar only with all dimensions", () => {
  const response = {
    id: "perplexity-cost",
    usage: {
      prompt_tokens: 9,
      completion_tokens: 402,
      total_tokens: 411,
      search_context_size: "low",
      cost: { input_tokens_cost: 0.000009, output_tokens_cost: 0.000402, request_cost: 0.005, total_cost: 0.005411 },
    },
  };
  const normalized = normalizePerplexityUsage(response);
  const pricing = resolvePerplexityPricing({ model: "sonar", request: { options: {} }, response });
  const providerRated = calculatePerplexityCost({ normalizedUsage: normalized.usage, pricing });
  assert.equal(providerRated.status, "priced");
  assert.equal(providerRated.costUsd, "0.005411");
  assert.equal(providerRated.breakdown.source, "provider_reported_usage_cost");

  const reconstructed = calculatePerplexityCost({
    normalizedUsage: { ...normalized.usage, reportedTotalCost: null, reportedCost: null },
    pricing,
  });
  assert.equal(reconstructed.costUsd, "0.005411");
  const incomplete = calculatePerplexityCost({
    normalizedUsage: { ...normalized.usage, reportedTotalCost: null, reportedCost: null, searchContextSize: null },
    pricing,
  });
  assert.equal(incomplete.status, "partial");
  assert.equal(incomplete.costUsd, null);
});

test("every application template maps to a stable semantic operation", () => {
  assert.deepEqual(
    {
      audiences: operationForTemplate("audiences"),
      angles: operationForTemplate("angles"),
      creativeTypes: operationForTemplate("creativeTypes"),
      executions: operationForTemplate("executions"),
      creatives: operationForTemplate("creatives"),
    },
    {
      audiences: AI_OPERATIONS.AUDIENCE_GENERATION,
      angles: AI_OPERATIONS.ANGLE_GENERATION,
      creativeTypes: AI_OPERATIONS.CREATIVE_TYPE_GENERATION,
      executions: AI_OPERATIONS.EXECUTION_GENERATION,
      creatives: AI_OPERATIONS.CREATIVE_GENERATION,
    },
  );
});

test("reasoning tokens are not added to output usage a second time", () => {
  const normalized = normalizeOpenAIUsage(responseUsage()).usage;
  const pricing = resolveOpenAIPricing({
    model: "gpt-5.6-terra",
    request: { options: { serviceMode: "standard", contextTier: "short_context" } },
    response: responseUsage(),
  });
  const result = calculateOpenAICost({ normalizedUsage: normalized, pricing });
  assert.equal(result.status, "priced");
  assert.equal(result.breakdown.output.tokens, 20_000);
  assert.equal(result.breakdown.output.costUsd, "0.24");
  assert.equal(result.costUsd, "0.4445");
});

test("standard pricing calculates uncached, cached, cache-write, and output lines exactly", () => {
  const normalized = normalizeOpenAIUsage(responseUsage()).usage;
  const pricing = resolveOpenAIPricing({
    model: "gpt-5.6-terra",
    request: { options: { serviceMode: "standard", contextTier: "short_context" } },
    response: responseUsage(),
  });
  const result = calculateOpenAICost({ normalizedUsage: normalized, pricing });
  assert.deepEqual(result.breakdown.uncachedInput, {
    tokens: 100_000,
    ratePerMillion: "2",
    costUsd: "0.2",
  });
  assert.deepEqual(result.breakdown.cachedInput, {
    tokens: 10_000,
    ratePerMillion: "0.2",
    costUsd: "0.002",
  });
  assert.deepEqual(result.breakdown.cacheWrite, {
    tokens: 1_000,
    ratePerMillion: "2.5",
    costUsd: "0.0025",
  });
  assert.deepEqual(result.breakdown.output, {
    tokens: 20_000,
    ratePerMillion: "12",
    costUsd: "0.24",
  });
  assert.equal(result.costUsd, "0.4445");
});

test("flex long-context pricing and regional processing use the catalog rates and multiplier", () => {
  const normalized = normalizeOpenAIUsage(responseUsage()).usage;
  const pricing = resolveOpenAIPricing({
    model: "gpt-5.6-terra",
    request: {
      options: {
        serviceMode: "flex",
        contextTier: "long_context",
        regionalProcessing: true,
      },
    },
    response: responseUsage(),
  });
  const result = calculateOpenAICost({ normalizedUsage: normalized, pricing });
  assert.equal(pricing.rates.input, 2);
  assert.deepEqual(pricing.modifiers, [{ id: "regional_processing", multiplier: 1.1 }]);
  assert.equal(result.breakdown.subtotalUsd, "0.3845");
  assert.equal(result.breakdown.modifierUsd, "0.03845");
  assert.equal(result.costUsd, "0.42295");
});

test("OpenAI image usage normalization has no caching dimension, unlike the Responses API", () => {
  const normalized = normalizeOpenAIImageUsage(imageResponseUsage());
  assert.equal(normalized.status, "normalized");
  assert.deepEqual(normalized.usage, {
    inputTokens: 20_000,
    uncachedInputTokens: 20_000,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 4_000,
    reasoningTokens: null,
    totalTokens: 24_000,
  });
});

test("OpenAI image usage normalization rejects a missing usage block", () => {
  const normalized = normalizeOpenAIImageUsage({ data: [{ b64_json: "x" }] });
  assert.equal(normalized.status, "missing_usage");
  assert.equal(normalized.usage, null);
});

test("gpt-image-2 prices the prompt at its text rate and the result at its image-output rate", () => {
  const normalized = normalizeOpenAIImageUsage(imageResponseUsage()).usage;
  const pricing = resolveOpenAIImagePricing({
    model: "gpt-image-2",
    response: imageResponseUsage(),
  });
  assert.equal(pricing.status, "resolved");
  assert.equal(pricing.modelKind, "image_generation");
  assert.deepEqual(pricing.rates, { input: 5, cachedInput: 1.25, cacheWrite: null, output: 30 });

  const result = calculateOpenAICost({ normalizedUsage: normalized, pricing });
  assert.equal(result.status, "priced");
  assert.deepEqual(result.breakdown.uncachedInput, {
    tokens: 20_000,
    ratePerMillion: "5",
    costUsd: "0.1",
  });
  assert.deepEqual(result.breakdown.output, {
    tokens: 4_000,
    ratePerMillion: "30",
    costUsd: "0.12",
  });
  assert.equal(result.costUsd, "0.22");
});

test("gpt-image-2 batch mode uses the batch rate row", () => {
  const pricing = resolveOpenAIImagePricing({
    model: "gpt-image-2",
    response: { raw: { service_tier: "batch" } },
  });
  assert.equal(pricing.serviceMode, "batch");
  assert.deepEqual(pricing.rates, { input: 2.5, cachedInput: 0.625, cacheWrite: null, output: 15 });
});

test("a text model priced through the image resolver is unsupported, not silently free", () => {
  const pricing = resolveOpenAIImagePricing({ model: "gpt-5.6-terra", response: imageResponseUsage() });
  assert.equal(pricing.status, "unpriced");
  assert.equal(pricing.reason, "unsupported_modality");
});

test("media-bearing OpenAI requests are retained but never priced with text-only rates", async () => {
  await temporaryLedger(async (filePath) => {
    const result = await trackAICallCost({
      workspaceId: costTestWorkspaceId,
      provider: "openai",
      model: "gpt-5.6-terra",
      request: { hasMediaInput: true, mediaInputTypes: ["input_image", "input_file"], options: {} },
      response: responseUsage(),
      operation: AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING,
      ledgerFilePath: filePath,
    });
    assert.equal(result.status, "unpriced");
    assert.equal(result.costUsd, null);
    assert.equal(result.reason, "unsupported_media_pricing");
    assert.deepEqual(result.ledgerEntry.requestContext.relevantBillingOptions.mediaInputTypes, [
      "input_image",
      "input_file",
    ]);
  });
});

test("unknown models and missing pricing dimensions never become zero cost", async () => {
  await temporaryLedger(async (filePath) => {
    const unknown = await trackAICallCost({
      workspaceId: costTestWorkspaceId,
      provider: "openai",
      model: "gpt-not-in-catalog",
      request: { options: {} },
      response: responseUsage(),
      operation: AI_OPERATIONS.AUDIENCE_GENERATION,
      ledgerFilePath: filePath,
    });
    assert.equal(unknown.status, "unpriced");
    assert.equal(unknown.costUsd, null);
    assert.equal(unknown.reason, "unknown_model");

    const unsupportedTier = resolveOpenAIPricing({
      model: "gpt-5.6-terra",
      request: { options: { serviceMode: "standard", contextTier: "extra_long_context" } },
      response: responseUsage(),
    });
    assert.equal(unsupportedTier.status, "unpriced");
    assert.equal(unsupportedTier.reason, "unsupported_context_tier");
  });
});

test("missing and malformed usage are explicit unpriced results", async () => {
  await temporaryLedger(async (filePath) => {
    const missing = await trackAICallCost({
      workspaceId: costTestWorkspaceId,
      provider: "openai",
      model: "gpt-5.6-terra",
      request: { options: {} },
      response: { id: "resp-no-usage" },
      operation: AI_OPERATIONS.ANGLE_GENERATION,
      ledgerFilePath: filePath,
    });
    assert.equal(missing.status, "unpriced");
    assert.equal(missing.reason, "missing_usage");

    const malformed = normalizeOpenAIUsage(responseUsage({ input_tokens_details: "invalid" }));
    assert.equal(malformed.status, "malformed_usage");
    assert.equal(malformed.reason, "malformed_usage");
  });
});

test("explicit zero usage is priced as zero while unknown dimensions remain partial", () => {
  const pricing = resolveOpenAIPricing({
    model: "gpt-5.6-terra",
    request: { options: {} },
    response: responseUsage(),
  });
  const zero = normalizeOpenAIUsage(
    responseUsage({
      input_tokens: 0,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens: 0,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 0,
    }),
  ).usage;
  assert.equal(calculateOpenAICost({ normalizedUsage: zero, pricing }).costUsd, "0");

  const unknown = normalizeOpenAIUsage(
    responseUsage({
      input_tokens_details: {},
    }),
  ).usage;
  const partial = calculateOpenAICost({ normalizedUsage: unknown, pricing });
  assert.equal(partial.status, "partial");
  assert.equal(partial.costUsd, null);
  assert.deepEqual(partial.breakdown.missingDimensions, [
    "uncachedInput",
    "cachedInput",
    "cacheWrite",
  ]);

  const noCacheWriteRate = resolveOpenAIPricing({
    model: "chat-latest",
    request: { options: {} },
    response: responseUsage(),
  });
  const zeroCacheWrite = { ...zero, inputTokens: 1, uncachedInputTokens: 1 };
  const zeroWithoutRate = calculateOpenAICost({
    normalizedUsage: zeroCacheWrite,
    pricing: noCacheWriteRate,
  });
  assert.equal(zeroWithoutRate.status, "priced");
  assert.equal(zeroWithoutRate.breakdown.cacheWrite.costUsd, "0");
});

test("the canonical OpenAI boundary persists and logs exactly one attributed row", async () => {
  await temporaryLedger(async (filePath) => {
    const oldPath = process.env.AI_COST_LEDGER_PATH;
    const oldKey = process.env.AI_API_KEY;
    const logs = [];
    const originalLog = console.log;
    process.env.AI_COST_LEDGER_PATH = filePath;
    process.env.AI_API_KEY = "test-only-key";
    console.log = (...values) => logs.push(values);
    registerAiProvider("openai", {
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: "gpt-5.6-terra",
      call: async () => ({
        text: JSON.stringify({ items: [{ label: "A" }, { label: "B" }] }),
        raw: responseUsage(),
        metadata: { providerRequestId: "resp-cost-test" },
      }),
    });

    try {
      await callAiModel({
        workspaceId: costTestWorkspaceId,
        provider: "openai",
        model: "gpt-5.6-terra",
        messages: [{ role: "user", content: "not persisted" }],
        operation: operationForTemplate("audiences"),
        operationId: "audience-operation-1",
        parentGenerationId: "generation-1",
      });
      const entries = await readCostLedgerEntries({ filePath });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].operation, AI_OPERATIONS.AUDIENCE_GENERATION);
      assert.equal(entries[0].parentGenerationId, "generation-1");
      assert.equal(entries[0].cost.status, "priced");
      assert.equal(logs.length, 1);
      assert.equal(logs[0][0], "[AI COST LEDGER]");
      assert.deepEqual(logs[0][1], entries[0]);
      assert.equal(JSON.stringify(entries[0]).includes("not persisted"), false);
      assert.equal(JSON.stringify(entries[0]).includes("test-only-key"), false);
    } finally {
      registerAiProvider("openai", realOpenAI);
      console.log = originalLog;
      if (oldPath === undefined) delete process.env.AI_COST_LEDGER_PATH;
      else process.env.AI_COST_LEDGER_PATH = oldPath;
      if (oldKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = oldKey;
    }
  });
});

test("an ad's text and thumbnail calls share one operation id as sibling attempts", async () => {
  // Mirrors how ad-plan generation fires: the ad-plan text call and its thumbnail image call run in parallel,
  // same operationId, different attempt numbers and a different "operation" label per call — not a second
  // operation. This is the mechanism the ad-thumbnail feature relies on for its cost to land on the same
  // generation without any new operation-log plumbing.
  await temporaryLedger(async (filePath) => {
    const oldPath = process.env.AI_COST_LEDGER_PATH;
    const oldKey = process.env.AI_API_KEY;
    const originalLog = console.log;
    process.env.AI_COST_LEDGER_PATH = filePath;
    process.env.AI_API_KEY = "test-only-key";
    console.log = () => undefined;
    registerAiProvider("openai", {
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: "gpt-5.6-terra",
      call: async () => ({
        text: JSON.stringify({ ads: [] }),
        raw: responseUsage(),
        metadata: { providerRequestId: "resp-ad-plan-1" },
      }),
    });
    registerAiProvider("openai_image", {
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: "gpt-image-2",
      call: async () => ({
        text: "",
        raw: imageResponseUsage(),
        imageBase64: "not-a-real-image",
        metadata: { providerRequestId: null },
      }),
    });

    try {
      const [textResult, imageResult] = await Promise.all([
        callAiModel({
          workspaceId: costTestWorkspaceId,
          provider: "openai",
          model: "gpt-5.6-terra",
          messages: [{ role: "user", content: "plan the ads" }],
          operation: AI_OPERATIONS.CREATIVE_EXPLORATION_AD_PLAN_GENERATION,
          operationId: "ad-set-operation-1",
          parentGenerationId: "generation-ad-set-1",
          attempt: 1,
        }),
        callAiModel({
          workspaceId: costTestWorkspaceId,
          provider: "openai_image",
          model: "gpt-image-2",
          messages: [{ role: "user", content: "a cover image for this ad" }],
          operation: AI_OPERATIONS.CREATIVE_EXPLORATION_AD_THUMBNAIL_GENERATION,
          operationId: "ad-set-operation-1",
          parentGenerationId: "generation-ad-set-1",
          attempt: 2,
        }),
      ]);
      assert.equal(imageResult.imageBase64, "not-a-real-image");
      assert.equal(textResult.text, JSON.stringify({ ads: [] }));

      const entries = await readCostLedgerEntries({
        filePath,
        parentGenerationId: "generation-ad-set-1",
      });
      assert.equal(entries.length, 2);
      assert.deepEqual(
        new Set(entries.map((entry) => entry.operationId)),
        new Set(["ad-set-operation-1"]),
      );
      assert.deepEqual(
        entries.map((entry) => entry.operation).sort(),
        [
          AI_OPERATIONS.CREATIVE_EXPLORATION_AD_PLAN_GENERATION,
          AI_OPERATIONS.CREATIVE_EXPLORATION_AD_THUMBNAIL_GENERATION,
        ].sort(),
      );
      const imageEntry = entries.find(
        (entry) => entry.operation === AI_OPERATIONS.CREATIVE_EXPLORATION_AD_THUMBNAIL_GENERATION,
      );
      assert.equal(imageEntry.cost.status, "priced");
      assert.equal(imageEntry.cost.usd, "0.22");
    } finally {
      registerAiProvider("openai", realOpenAI);
      registerAiProvider("openai_image", realOpenAIImage);
      console.log = originalLog;
      if (oldPath === undefined) delete process.env.AI_COST_LEDGER_PATH;
      else process.env.AI_COST_LEDGER_PATH = oldPath;
      if (oldKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = oldKey;
    }
  });
});

test("the canonical provider boundaries each persist one attributed ledger row", async () => {
  await temporaryLedger(async (filePath) => {
    const oldPath = process.env.AI_COST_LEDGER_PATH;
    const oldKey = process.env.AI_API_KEY;
    const originalLog = console.log;
    const logs = [];
    process.env.AI_COST_LEDGER_PATH = filePath;
    process.env.AI_API_KEY = "test-only-key";
    console.log = (...values) => logs.push(values);
    registerAiProvider("deepseek", {
      apiKeyEnv: "DEEPSEEK_API_KEY",
      defaultModel: "deepseek-v4-flash",
      call: async () => ({
        text: "{}",
        raw: {
          id: "deepseek-provider-request",
          usage: {
            prompt_tokens: 10,
            prompt_cache_hit_tokens: 0,
            prompt_cache_miss_tokens: 10,
            completion_tokens: 5,
          },
        },
        metadata: { providerRequestId: "deepseek-provider-request" },
      }),
    });
    registerAiProvider("gemini", {
      apiKeyEnv: "GEMINI_API_KEY",
      defaultModel: "gemini-2.5-flash-lite",
      call: async () => ({
        text: "{}",
        raw: {
          responseId: "gemini-provider-request",
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        },
        metadata: { providerRequestId: "gemini-provider-request" },
      }),
    });
    registerAiProvider("anthropic", {
      apiKeyEnv: "ANTHROPIC_API_KEY",
      defaultModel: "claude-haiku-4-5",
      call: async () => ({
        text: "{}",
        raw: {
          id: "anthropic-provider-request",
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        metadata: { providerRequestId: "anthropic-provider-request" },
      }),
    });
    registerAiProvider("perplexity", {
      apiKeyEnv: "PERPLEXITY_API_KEY",
      defaultModel: "sonar",
      call: async () => ({
        text: "{}",
        raw: {
          id: "perplexity-provider-request",
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            search_context_size: "low",
            cost: { total_cost: 0.005015 },
          },
        },
        metadata: { providerRequestId: "perplexity-provider-request" },
      }),
    });
    try {
      for (const [provider, model] of [
        ["deepseek", "deepseek-v4-flash"],
        ["gemini", "gemini-2.5-flash-lite"],
        ["anthropic", "claude-haiku-4-5"],
        ["perplexity", "sonar"],
      ]) {
        await callAiModel({
          workspaceId: costTestWorkspaceId,
          provider,
          model,
          messages: [{ role: "user", content: "not persisted" }],
          operation: AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING,
        });
      }
      const entries = await readCostLedgerEntries({ filePath });
      assert.deepEqual(
        entries.map((entry) => entry.provider),
        ["deepseek", "gemini", "anthropic", "perplexity"],
      );
      assert.equal(
        entries.every(
          (entry) =>
            entry.operation === AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING &&
            entry.cost.status === "priced",
        ),
        true,
      );
      assert.equal(logs.filter(([prefix]) => prefix === "[AI COST LEDGER]").length, 4);
    } finally {
      registerAiProvider("deepseek", realDeepSeek);
      registerAiProvider("gemini", realGemini);
      registerAiProvider("anthropic", realAnthropic);
      registerAiProvider("perplexity", realPerplexity);
      console.log = originalLog;
      if (oldPath === undefined) delete process.env.AI_COST_LEDGER_PATH;
      else process.env.AI_COST_LEDGER_PATH = oldPath;
      if (oldKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = oldKey;
    }
  });
});

test("product-context retries create separate rows with one operation and parent generation", async () => {
  await temporaryLedger(async (filePath) => {
    const oldPath = process.env.AI_COST_LEDGER_PATH;
    const oldKey = process.env.AI_API_KEY;
    const originalLog = console.log;
    const outputs = [
      JSON.stringify(semanticProductContext({ features: undefined })),
      JSON.stringify(semanticProductContext()),
    ];
    let providerCalls = 0;
    process.env.AI_COST_LEDGER_PATH = filePath;
    process.env.AI_API_KEY = "test-only-key";
    console.log = () => undefined;
    registerAiProvider("openai", {
      apiKeyEnv: "OPENAI_API_KEY",
      defaultModel: "gpt-5.6-terra",
      call: async () => {
        providerCalls += 1;
        return {
          text: outputs.shift(),
          raw: { ...responseUsage(), id: `resp-retry-${providerCalls}` },
          metadata: { providerRequestId: `resp-retry-${providerCalls}` },
        };
      },
    });

    try {
      await buildProductContextArtifact({
        workspaceId: costTestWorkspaceId,
        sources: [
          {
            id: "notes-1",
            type: "text",
            label: "Notes",
            value: "Cooling adjustable pillow",
            status: "ready",
          },
        ],
        ai: { provider: "openai", model: "gpt-5.6-terra" },
        operationId: "product-context-operation-1",
        parentGenerationId: "generation-product-1",
      });
      const entries = await readCostLedgerEntries({
        filePath,
        parentGenerationId: "generation-product-1",
      });
      assert.equal(providerCalls, 2);
      assert.equal(entries.length, 2);
      assert.deepEqual(
        entries.map((entry) => entry.attempt),
        [1, 2],
      );
      assert.deepEqual(
        new Set(entries.map((entry) => entry.operation)),
        new Set([AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING]),
      );
      assert.deepEqual(
        entries.map((entry) => entry.providerRequestId),
        ["resp-retry-1", "resp-retry-2"],
      );
    } finally {
      registerAiProvider("openai", realOpenAI);
      console.log = originalLog;
      if (oldPath === undefined) delete process.env.AI_COST_LEDGER_PATH;
      else process.env.AI_COST_LEDGER_PATH = oldPath;
      if (oldKey === undefined) delete process.env.AI_API_KEY;
      else process.env.AI_API_KEY = oldKey;
    }
  });
});

test("ledger entries can be queried by operation, operation execution, request, generation, and recent limit", async () => {
  await temporaryLedger(async (filePath) => {
    const originalLog = console.log;
    console.log = () => undefined;
    try {
      for (const [index, operation] of [
        AI_OPERATIONS.AUDIENCE_GENERATION,
        AI_OPERATIONS.ANGLE_GENERATION,
      ].entries()) {
        await trackAICallCost({
          workspaceId: costTestWorkspaceId,
          provider: "openai",
          model: "gpt-5.6-terra",
          request: { options: {} },
          response: { ...responseUsage(), id: `resp-query-${index}` },
          operation,
          operationId: `operation-${index}`,
          parentGenerationId: "generation-query",
          ledgerFilePath: filePath,
        });
      }
    } finally {
      console.log = originalLog;
    }

    const audienceEntries = await readCostLedgerEntries({
      filePath,
      operation: AI_OPERATIONS.AUDIENCE_GENERATION,
    });
    assert.equal(audienceEntries.length, 1);
    assert.deepEqual(
      await getCostLedgerEntry(audienceEntries[0].id, { filePath }),
      audienceEntries[0],
    );
    assert.equal(
      (await readCostLedgerEntries({ filePath, operationId: "operation-1" }))[0].operation,
      AI_OPERATIONS.ANGLE_GENERATION,
    );
    assert.equal(
      (await readCostLedgerEntries({ filePath, providerRequestId: "resp-query-0" })).length,
      1,
    );
    assert.equal(
      (await readCostLedgerEntries({ filePath, parentGenerationId: "generation-query" })).length,
      2,
    );
    assert.equal(
      (await readCostLedgerEntries({ filePath, limit: 1 }))[0].providerRequestId,
      "resp-query-1",
    );
  });
});
