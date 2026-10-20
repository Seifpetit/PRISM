import { randomUUID } from "node:crypto";
import { callAiModel } from "../ai/canonical-caller.mjs";
import { productContextTemplate } from "../ai/input-templates/product-context.template.mjs";
import { resolvePromptTemplate } from "../ai/input-templates/prompt-overrides.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import { inspectProductUrl } from "../url-inspection/index.mjs";
import { ProductContextDomainError, ProductContextValidationError } from "./errors.mjs";
import { normalizeProductContextSources } from "./source-normalization.mjs";
import { supportsProductContextContract, unsupportedMediaInputs } from "./media-capabilities.mjs";
import { parseProductContextJson, validateProductContextOutput } from "./schema.mjs";
import { completeOperationOutput, failOperation } from "../database/operation-log-repository.mjs";

const operation = AI_OPERATIONS.PRODUCT_CONTEXT_BUILDING;
const maxValidationAttempts = 2;
const timeoutMs = 45_000;

function now() {
  return new Date().toISOString();
}

function responseMetadata(response) {
  const metadata = response?.metadata ?? {};
  return {
    inputTokens: metadata.inputTokens ?? null,
    outputTokens: metadata.outputTokens ?? null,
    providerRequestId: metadata.providerRequestId ?? null,
    structuredOutput: metadata.structuredOutput ?? {
      requested: true,
      applied: false,
      reason: "provider_did_not_report_structured_output",
    },
  };
}

function traceFor({
  ai,
  template,
  startedAt,
  response,
  status,
  attempts,
  failureCode,
  operationId,
  parentGenerationId,
}) {
  const metadata = responseMetadata(response);
  return {
    operation,
    operationId,
    parentGenerationId,
    provider: response?.provider ?? ai?.provider ?? null,
    model: response?.model ?? ai?.model ?? null,
    promptVersion: template.version,
    startedAt,
    completedAt: now(),
    status,
    attempts,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    providerRequestId: metadata.providerRequestId,
    structuredOutput: metadata.structuredOutput,
    failureCode: failureCode ?? null,
  };
}

function requestBody(template) {
  return JSON.stringify(
    {
      ...template.input,
      output: template.output,
      outputSchema: template.outputSchema,
    },
    null,
    2,
  );
}

function resolvedProvider(ai) {
  const provider = ai?.provider ?? process.env.AI_PROVIDER ?? "openai";
  return provider === "gpt" ? "openai" : provider;
}

function requestContent(template, mediaInputs) {
  if (!mediaInputs.length) return requestBody(template);
  return [
    { type: "input_text", text: requestBody(template) },
    ...mediaInputs.map((input) =>
      input.kind === "document"
        ? { type: "product_document", ...input }
        : { type: "product_image", ...input },
    ),
  ];
}

function retrySystemInstruction(template, attempt) {
  if (attempt === 1) return template.system;
  return `${template.system}

Your previous response did not match the required ProductContext JSON contract.
Return exactly one complete JSON object matching the schema. Do not add prose,
markdown, IDs, source IDs, or extra fields.`;
}

function providerError(error) {
  if (error?.code === "AI_NOT_CONFIGURED") {
    return new ProductContextDomainError(
      "AI_CONFIGURATION_REQUIRED",
      "Configure an AI provider and model before building product context.",
      { cause: error },
    );
  }

  const isTimeout =
    error?.name === "TimeoutError" || error?.name === "AbortError" || error?.code === "ABORT_ERR";
  return new ProductContextDomainError(
    isTimeout ? "AI_MODEL_TIMEOUT" : "AI_PROVIDER_REQUEST_FAILED",
    isTimeout
      ? "The AI model took too long to build product context. Try again."
      : "The AI provider could not build product context. Try again.",
    { cause: error },
  );
}

function validationFailure(error) {
  return new ProductContextDomainError(
    "PRODUCT_CONTEXT_VALIDATION_FAILED",
    "The AI response could not be validated as product context. Try again.",
    {
      cause: error,
      details: { issues: error.issues },
    },
  );
}

function requestSignal() {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
}

/**
 * The trustworthy ProductContext artifact boundary. It accepts raw intake
 * records, normalizes source evidence, requests a provider-neutral schema,
 * validates model output, then delegates server-owned persistence metadata.
 */
export async function buildProductContextArtifact({
  workspaceId,
  sources,
  ai,
  operationId = randomUUID(),
  parentGenerationId = operationId,
  dependencies = {},
}) {
  const services = {
    callAiModel: dependencies.callAiModel ?? callAiModel,
    inspectProductUrl: dependencies.inspectProductUrl ?? inspectProductUrl,
    getStoredSource: dependencies.getStoredSource,
    updateStoredSource: dependencies.updateStoredSource,
    persist: dependencies.persist ?? ((artifact) => artifact),
    recordGeneration: dependencies.recordGeneration ?? (() => undefined),
  };
  const normalized = await normalizeProductContextSources(sources, services);
  const provider = resolvedProvider(ai);
  if (!supportsProductContextContract(provider, ai?.model)) {
    throw new ProductContextDomainError(
      "AI_PROVIDER_UNSUPPORTED_PRODUCT_CONTEXT_CONTRACT",
      `The selected ${provider} model does not support the structured output required to build product context.`,
      { details: { provider, model: ai?.model ?? null } },
    );
  }
  const unsupportedMedia = unsupportedMediaInputs(provider, ai?.model, normalized.mediaInputs);
  if (unsupportedMedia.length) {
    throw new ProductContextDomainError(
      "AI_PROVIDER_UNSUPPORTED_MEDIA",
      `The selected ${provider} model cannot use: ${[...new Set(unsupportedMedia.map((input) => input.filename))].join(", ")}.`,
      { details: { provider, unsupportedFiles: unsupportedMedia.map((input) => input.filename) } },
    );
  }
  const templateArgs = { sources: normalized.usableSources };
  const template = productContextTemplate(templateArgs);
  template.system = resolvePromptTemplate(template.id, template.system, templateArgs);
  const startedAt = now();
  let response = null;
  let validationError = null;

  for (let attempt = 1; attempt <= maxValidationAttempts; attempt += 1) {
    try {
      response = await services.callAiModel({
        workspaceId,
        provider: ai?.provider,
        model: ai?.model,
        system: retrySystemInstruction(template, attempt),
        messages: [{ role: "user", content: requestContent(template, normalized.mediaInputs) }],
        options: { temperature: 0.2, maxTokens: 2000, ...(ai?.options ?? {}) },
        outputSchema: template.outputSchema,
        signal: requestSignal(),
        operation,
        operationId,
        parentGenerationId,
        attempt,
      });
    } catch (error) {
      const domainError = providerError(error);
      await services.recordGeneration(
        traceFor({
          ai,
          template,
          startedAt,
          response,
          status: "FAILED",
          attempts: attempt,
          failureCode: domainError.code,
          operationId,
          parentGenerationId,
        }),
      );
      throw domainError;
    }

    try {
      const semanticContext = validateProductContextOutput(parseProductContextJson(response.text));
      // TODO: attach field-level evidence provenance once normalized evidence IDs are stable.
      const trace = traceFor({
        ai,
        template,
        startedAt,
        response,
        status: "SUCCEEDED",
        attempts: attempt,
        operationId,
        parentGenerationId,
      });
      const artifact = await services.persist({
        ...semanticContext,
        sourceIds: normalized.usableSources.map((source) => source.id),
        generation: trace,
      });
      if (workspaceId) {
        try {
          await completeOperationOutput({ workspaceId, operationId, output: artifact });
        } catch (error) {
          console.error(
            "[OPERATION DATABASE] Product context output tracing failed; persistence will continue.",
            error,
          );
        }
      }
      await services.recordGeneration(trace);
      return artifact;
    } catch (error) {
      if (!(error instanceof ProductContextValidationError)) throw error;
      validationError = error;
    }
  }

  const domainError = validationFailure(validationError);
  if (workspaceId) {
    try {
      await failOperation({ workspaceId, operationId, stage: "validation", error: domainError });
    } catch (error) {
      console.error(
        "[OPERATION DATABASE] Product context validation tracing failed; original error is preserved.",
        error,
      );
    }
  }
  await services.recordGeneration(
    traceFor({
      ai,
      template,
      startedAt,
      response,
      status: "FAILED",
      attempts: maxValidationAttempts,
      failureCode: domainError.code,
      operationId,
      parentGenerationId,
    }),
  );
  throw domainError;
}
