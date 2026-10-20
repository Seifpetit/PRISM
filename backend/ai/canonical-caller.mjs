import { randomUUID } from "node:crypto";
import { builtInProviders } from "./providers/index.mjs";
import { trackAICallCost } from "../ai-cost-tracker/index.mjs";
import {
  beginAiOperationAttempt,
  completeAiOperationAttempt,
  failAiOperationAttempt,
  operationAttemptId,
} from "../database/operation-log-repository.mjs";

const providerAliases = {
  gpt: "openai",
  claude: "anthropic",
  google: "gemini",
};

const providerKeys = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GEMINI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const providers = new Map(builtInProviders);

export class AiConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AiConfigurationError";
    this.code = "AI_NOT_CONFIGURED";
  }
}

function normalizeProvider(provider) {
  return providerAliases[provider] ?? provider;
}

function providerModelEnv(provider) {
  return `${provider.toUpperCase()}_MODEL`;
}

function finiteNumber(value, { min, max, integer = false }) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < min || value > max || (integer && !Number.isInteger(value))) return undefined;
  return value;
}

/**
 * Frontend options are intentionally reduced to a small provider-neutral set.
 * Provider adapters map these values to their own request payloads; arbitrary
 * caller-owned objects never reach a provider request.
 */
function normalizeOptions(options = {}) {
  const normalized = {};
  const temperature = finiteNumber(options.temperature, { min: 0, max: 2 });
  const topP = finiteNumber(options.topP, { min: 0, max: 1 });
  const maxTokens = finiteNumber(options.maxTokens, {
    min: 1,
    max: 16_000,
    integer: true,
  });
  if (temperature !== undefined) normalized.temperature = temperature;
  if (topP !== undefined) normalized.topP = topP;
  if (maxTokens !== undefined) normalized.maxTokens = maxTokens;
  if (["standard", "flex", "fast"].includes(options.serviceMode)) {
    normalized.serviceMode = options.serviceMode;
  }
  if (["short_context", "long_context"].includes(options.contextTier)) {
    normalized.contextTier = options.contextTier;
  }
  return normalized;
}

function mediaRequestDetails(messages) {
  const contentTypes = messages.flatMap((message) =>
    Array.isArray(message?.content)
      ? message.content.map((part) => part?.type).filter(Boolean)
      : [],
  );
  const mediaInputTypes = [
    ...new Set(
      contentTypes.filter(
        (type) =>
          type === "input_image" ||
          type === "input_file" ||
          type === "product_image" ||
          type === "product_document",
      ),
    ),
  ];
  return {
    hasMediaInput: mediaInputTypes.length > 0,
    mediaInputTypes,
  };
}

export function registerAiProvider(name, adapter) {
  if (!name || !adapter || typeof adapter.call !== "function") {
    throw new TypeError("An AI provider requires a name and a call adapter.");
  }
  providers.set(name, adapter);
}

export function listAiProviders() {
  return [...providers.keys()];
}

export async function listAiModels({
  provider = process.env.AI_PROVIDER ?? "openai",
  signal,
} = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const adapter = providers.get(normalizedProvider);
  if (!adapter) throw new AiConfigurationError(`Unsupported AI provider: ${provider}`);
  if (typeof adapter.listModels !== "function") {
    throw new AiConfigurationError(`Provider ${normalizedProvider} does not expose a model list.`);
  }
  const apiKey =
    process.env.AI_API_KEY ?? process.env[adapter.apiKeyEnv ?? providerKeys[normalizedProvider]];
  if (!apiKey) {
    throw new AiConfigurationError(
      `Missing API key for ${normalizedProvider}. Set ${adapter.apiKeyEnv ?? providerKeys[normalizedProvider] ?? "AI_API_KEY"}.`,
    );
  }
  return adapter.listModels({ apiKey, signal });
}

export function isAiConfigured(provider = process.env.AI_PROVIDER ?? "openai") {
  const normalizedProvider = normalizeProvider(provider);
  return Boolean(process.env.AI_API_KEY ?? process.env[providerKeys[normalizedProvider]]);
}

/**
 * Canonical model caller.
 *
 * The rest of the backend deals in this provider-neutral contract. A provider
 * adapter owns the vendor URL, authentication, payload shape, and response
 * extraction. The returned shape is normalized to { text, provider, model,
 * raw } for the generation pipeline.
 */
export async function callAiModel({
  provider = process.env.AI_PROVIDER ?? "openai",
  model,
  messages = [],
  system,
  options = {},
  outputSchema,
  signal,
  operation,
  workspaceId,
  operationId,
  parentGenerationId,
  attempt = 1,
  related,
}) {
  const normalizedProvider = normalizeProvider(provider);
  const adapter = providers.get(normalizedProvider);
  if (!adapter) throw new AiConfigurationError(`Unsupported AI provider: ${provider}`);

  const apiKey =
    process.env.AI_API_KEY ?? process.env[adapter.apiKeyEnv ?? providerKeys[normalizedProvider]];
  if (!apiKey) {
    throw new AiConfigurationError(
      `Missing API key for ${normalizedProvider}. Set ${adapter.apiKeyEnv ?? providerKeys[normalizedProvider] ?? "AI_API_KEY"}.`,
    );
  }

  // AI_MODEL names a text model for the app's default text provider; an adapter of a different kind (e.g. the
  // image provider) never treats it as its own default, since it would virtually never be a valid model there.
  const resolvedModel =
    model ??
    process.env[providerModelEnv(normalizedProvider)] ??
    (adapter.kind ? undefined : process.env.AI_MODEL) ??
    adapter.defaultModel;
  if (!resolvedModel)
    throw new AiConfigurationError(`No model configured for ${normalizedProvider}.`);
  if (!operation || typeof operation !== "string") {
    throw new TypeError("AI model calls require a stable workflow operation.");
  }
  if (!workspaceId) throw new TypeError("AI model calls require a workspace ID.");

  const normalizedOptions = normalizeOptions(options);
  const media = mediaRequestDetails(messages);
  const occurredAt = new Date().toISOString();
  const traceOperationId = operationId ?? parentGenerationId ?? randomUUID();
  const traceAttemptId = operationAttemptId(traceOperationId, attempt);
  try {
    await beginAiOperationAttempt({
      workspaceId,
      operationId: traceOperationId,
      operationType: operation,
      generationId: parentGenerationId ?? traceOperationId,
      attempt,
      provider: normalizedProvider,
      model: resolvedModel,
      startedAt: occurredAt,
      requestOptions: { options: normalizedOptions, ...media },
      request: {
        system: system ?? null,
        messages,
        options: normalizedOptions,
        outputSchema: outputSchema ?? null,
        media,
      },
      related,
    });
  } catch (error) {
    console.error(
      "[OPERATION DATABASE] Request tracing failed; provider call will continue.",
      error,
    );
  }

  const providerStartedAt = Date.now();
  let result;
  try {
    result = await adapter.call({
      apiKey,
      model: resolvedModel,
      messages,
      system,
      options: normalizedOptions,
      outputSchema,
      signal,
    });
  } catch (error) {
    try {
      await failAiOperationAttempt({
        workspaceId,
        operationId: traceOperationId,
        attemptId: traceAttemptId,
        error,
        durationMs: Date.now() - providerStartedAt,
      });
    } catch (traceError) {
      console.error(
        "[OPERATION DATABASE] Error tracing failed; original provider error is preserved.",
        traceError,
      );
    }
    throw error;
  }

  try {
    await completeAiOperationAttempt({
      workspaceId,
      operationId: traceOperationId,
      attemptId: traceAttemptId,
      response: result,
      providerRequestId: result?.metadata?.providerRequestId ?? result?.raw?.id ?? null,
      durationMs: Date.now() - providerStartedAt,
    });
  } catch (error) {
    console.error(
      "[OPERATION DATABASE] Response tracing failed; cost tracking will continue.",
      error,
    );
  }
  if (
    ["openai", "openai_image", "anthropic", "deepseek", "gemini", "perplexity"].includes(
      normalizedProvider,
    )
  ) {
    await trackAICallCost({
      workspaceId,
      provider: normalizedProvider,
      model: resolvedModel,
      request: { options: normalizedOptions, ...media },
      response: result,
      operation,
      operationId: traceOperationId,
      parentGenerationId,
      attempt,
      occurredAt,
    });
  }
  return { ...result, provider: normalizedProvider, model: resolvedModel };
}
