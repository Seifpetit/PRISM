import { randomUUID } from "node:crypto";
import { callAiModel } from "../ai/canonical-caller.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import { creativeExplorationInputTemplates } from "../ai/modes/creative-exploration/input-templates/index.mjs";
import { parseCreativeExplorationAdHooksOutput } from "../ai/modes/creative-exploration/ad-hooks-output.mjs";
import { parseCreativeExplorationAdPlanOutput } from "../ai/modes/creative-exploration/ad-plan-output.mjs";
import { checkAdPlanAgainstOptions } from "../ai/modes/creative-exploration/ad-plan-options.mjs";
import { parseCreativeExplorationAnglesOutput } from "../ai/modes/creative-exploration/angle-output.mjs";
import { parseCreativeExplorationOffersOutput } from "../ai/modes/creative-exploration/offer-output.mjs";
import { parseCreativeExplorationTargetAvatarsOutput } from "../ai/modes/creative-exploration/target-avatar-output.mjs";
import {
  getActiveCreativeExplorationPromptVersion,
  saveCreativeExplorationPromptVersion,
} from "../database/workspace-data-repository.mjs";

const templateOperations = Object.freeze({
  angles: AI_OPERATIONS.CREATIVE_EXPLORATION_ANGLE_GENERATION,
  targetAvatars: AI_OPERATIONS.CREATIVE_EXPLORATION_TARGET_AVATAR_GENERATION,
  offers: AI_OPERATIONS.CREATIVE_EXPLORATION_OFFER_GENERATION,
  adPlan: AI_OPERATIONS.CREATIVE_EXPLORATION_AD_PLAN_GENERATION,
  adHooks: AI_OPERATIONS.CREATIVE_EXPLORATION_AD_HOOKS_GENERATION,
});

/** Output budget per template — richer briefs need more room (reasoning tokens eat into this). */
const templateMaxTokens = Object.freeze({
  angles: 4096,
  targetAvatars: 6000,
  offers: 4096,
  adPlan: 5000,
  adHooks: 2000,
});

/** DB key each editable Creative Exploration input template is saved/looked up under. */
export const creativeExplorationPromptTemplateIds = Object.freeze({
  angles: "creative_exploration_angles",
  targetAvatars: "creative_exploration_target_avatars",
  offers: "creative_exploration_offers",
  adPlan: "creative_exploration_ad_plan",
  adHooks: "creative_exploration_ad_hooks",
});

/** The hardcoded system prompt shipped in code, before any workspace customization. */
function defaultSystemPrompt(templateName) {
  const factory = creativeExplorationInputTemplates[templateName];
  if (!factory) throw new TypeError(`Unknown Creative Exploration template: ${templateName}`);
  return factory({ productContext: {} }).system;
}

/** Returns the effective (possibly workspace-customized) template, for display/editing in Settings. Accepts either the short template name ("angles") or its DB templateId ("creative_exploration_angles"). */
export function readCreativeExplorationPromptTemplate(workspaceId, templateNameOrId) {
  const templateName = creativeExplorationInputTemplates[templateNameOrId]
    ? templateNameOrId
    : Object.entries(creativeExplorationPromptTemplateIds).find(([, id]) => id === templateNameOrId)?.[0];
  const templateId = templateName ? creativeExplorationPromptTemplateIds[templateName] : null;
  if (!templateName || !templateId) throw new TypeError(`Unknown Creative Exploration template: ${templateNameOrId}`);
  const active = getActiveCreativeExplorationPromptVersion(workspaceId, templateId);
  return {
    templateId,
    content: active?.content ?? defaultSystemPrompt(templateName),
    version: active?.version ?? 0,
    isCustom: Boolean(active),
    updatedAt: active?.created_at ?? null,
  };
}

/** Saves a new version (never overwrites) so earlier tries stay in the database as history. */
export function writeCreativeExplorationPromptTemplate(workspaceId, templateId, content, createdByUserId) {
  const entry = Object.entries(creativeExplorationPromptTemplateIds).find(([, id]) => id === templateId);
  if (!entry) throw new TypeError(`Unknown Creative Exploration prompt template id: ${templateId}`);
  const trimmed = typeof content === "string" ? content.trim() : "";
  if (!trimmed) throw new TypeError("Prompt content cannot be empty.");
  if (trimmed.length > 50_000) throw new TypeError("Prompt content must be 50,000 characters or fewer.");
  const saved = saveCreativeExplorationPromptVersion(workspaceId, templateId, trimmed, createdByUserId ?? null);
  return {
    templateId,
    content: saved.content,
    version: saved.version,
    isCustom: true,
    updatedAt: saved.createdAt,
  };
}

/** Creative Exploration workflow boundary. Downstream Talking Heads and directions stay disabled. */
export function creativeExplorationGenerationStatus() {
  return { enabled: true, operations: ["angles", "targetAvatars"] };
}

/**
 * Canonical mode runner. This is the only provider-call path the mode may use:
 * template -> provider-neutral canonical caller -> provider adapter/tracing/cost ledger.
 */
export async function runCreativeExplorationTemplate({
  workspaceId,
  templateName,
  templateArgs,
  ai,
  operationId = randomUUID(),
  related,
  signal,
  callModel = callAiModel,
  generationContext = null,
}) {
  const factory = creativeExplorationInputTemplates[templateName];
  const operation = templateOperations[templateName];
  if (!factory || !operation) throw new TypeError(`Unknown Creative Exploration template: ${templateName}`);
  const template = factory(templateArgs);
  // Selected sources and run instructions ride in the input, and the rules that keep them subordinate to the Product
  // Context ride in the output rules: both are built in code, so an edited prompt cannot remove them. With nothing
  // selected the request is exactly what the template built.
  const extraInput = generationContext?.input ?? {};
  const extraRules = generationContext?.rules ?? [];
  const input = Object.keys(extraInput).length ? { ...template.input, ...extraInput } : template.input;
  const output = extraRules.length ? { ...template.output, rules: [...(template.output.rules ?? []), ...extraRules] } : template.output;
  const templateId = creativeExplorationPromptTemplateIds[templateName];
  const activeOverride = templateId
    ? getActiveCreativeExplorationPromptVersion(workspaceId, templateId)
    : null;
  return callModel({
    workspaceId,
    provider: ai?.provider,
    model: ai?.model,
    system: activeOverride?.content ?? template.system,
    messages: [{ role: "user", content: JSON.stringify({ ...input, output }) }],
    outputSchema: template.outputSchema,
    options: {
      temperature: 0.8,
      maxTokens: templateMaxTokens[templateName] ?? 4096,
      ...(ai?.options ?? {}),
    },
    operation,
    operationId,
    parentGenerationId: operationId,
    related,
    signal,
  });
}

function parseJson(text) {
  return JSON.parse(String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
}

/**
 * OpenAI structured output does not enforce array length or string-length
 * bounds, so the model occasionally returns a set that fails schema
 * validation (wrong count, a field too short). Re-ask once with a fresh
 * operation id before surfacing the error.
 */
async function generateWithOutputRetry({ operationId, run, parse, attempts = 3 }) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response;
    try {
      response = await run(attempt === 0 ? operationId : randomUUID());
    } catch (error) {
      lastError = error;
      continue;
    }
    try {
      return parse(response);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function generateCreativeExplorationAngles({ workspaceId, productContext, generationContext, ai, operationId, related, callModel }) {
  return generateWithOutputRetry({
    operationId,
    run: (attemptOperationId) =>
      runCreativeExplorationTemplate({
        workspaceId,
        templateName: "angles",
        templateArgs: { productContext },
        generationContext,
        ai,
        operationId: attemptOperationId,
        related,
        ...(callModel ? { callModel } : {}),
      }),
    parse: (response) => parseCreativeExplorationAnglesOutput(parseJson(response.text)),
  });
}

export async function generateCreativeExplorationOffers({ workspaceId, productContext, generationContext, ai, operationId, related, callModel }) {
  return generateWithOutputRetry({
    operationId,
    run: (attemptOperationId) =>
      runCreativeExplorationTemplate({
        workspaceId,
        templateName: "offers",
        templateArgs: { productContext },
        generationContext,
        ai,
        operationId: attemptOperationId,
        related,
        ...(callModel ? { callModel } : {}),
      }),
    parse: (response) => parseCreativeExplorationOffersOutput(parseJson(response.text)),
  });
}

export async function generateCreativeExplorationTargetAvatars({
  workspaceId,
  productContext,
  generationContext,
  ai,
  count,
  operationId,
  related,
  callModel,
}) {
  return generateWithOutputRetry({
    operationId,
    run: (attemptOperationId) =>
      runCreativeExplorationTemplate({
        workspaceId,
        templateName: "targetAvatars",
        templateArgs: { productContext, count },
        generationContext,
        ai,
        operationId: attemptOperationId,
        related,
        ...(callModel ? { callModel } : {}),
      }),
    parse: (response) => parseCreativeExplorationTargetAvatarsOutput(parseJson(response.text), count),
  });
}

/** Plans the ads inside one ad set: the persona, angle and offer stay fixed, the executions vary. */
export async function generateCreativeExplorationAdPlan({
  workspaceId,
  productContext,
  angle,
  offer,
  avatar,
  existingAds,
  options = null,
  generationContext,
  ai,
  operationId,
  related,
  callModel,
}) {
  return generateWithOutputRetry({
    operationId,
    run: (attemptOperationId) =>
      runCreativeExplorationTemplate({
        workspaceId,
        templateName: "adPlan",
        templateArgs: { productContext, angle, offer, avatar, existingAds, options },
        generationContext,
        ai,
        operationId: attemptOperationId,
        related,
        ...(callModel ? { callModel } : {}),
      }),
    // A plan that ignores what was asked (wrong count, wrong format, stages repeated) is asked for again, not saved.
    parse: (response) => checkAdPlanAgainstOptions(parseCreativeExplorationAdPlanOutput(parseJson(response.text)), options),
  });
}

/** Writes alternative hooks for one ad. Everything else about the ad, and its ad set, stays fixed. */
export async function generateCreativeExplorationAdHooks({
  workspaceId,
  productContext,
  angle,
  offer,
  avatar,
  ad,
  generationContext,
  ai,
  operationId,
  related,
  callModel,
}) {
  return generateWithOutputRetry({
    operationId,
    run: (attemptOperationId) =>
      runCreativeExplorationTemplate({
        workspaceId,
        templateName: "adHooks",
        templateArgs: { productContext, angle, offer, avatar, ad },
        generationContext,
        ai,
        operationId: attemptOperationId,
        related,
        ...(callModel ? { callModel } : {}),
      }),
    parse: (response) => parseCreativeExplorationAdHooksOutput(parseJson(response.text)),
  });
}
