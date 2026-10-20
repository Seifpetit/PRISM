import { randomUUID } from "node:crypto";
import { callAiModel } from "../ai/canonical-caller.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import { PERSONA_IMAGE_PROMPT_TEMPLATE, resolveImagePromptTemplate } from "../ai/input-templates/prompt-overrides.mjs";
import {
  finishAvatarImage,
  listAvatarImageStatuses,
  markAvatarImagePending,
} from "../database/avatar-images-repository.mjs";
import { listTargetAvatars } from "../database/workspace-data-repository.mjs";

// One portrait per Target Avatar. It is made in the background, right after avatars are generated, and again
// (only for the ones missing) whenever a product's avatars are opened, which is how avatars that predate portraits
// are covered. Generation never blocks or fails the avatars themselves: the caller returns at once, the app polls
// the status, and a failed portrait just leaves that persona on its fallback (stock photo, then initials).

/** How many portraits are requested from the image provider at once. One: the operation tracing wraps each call in
 * a database transaction that awaits, and two calls interleaving would collide on it ("cannot start a transaction
 * within a transaction"), silently dropping one call's tracing. Portraits are made in the background, so a
 * queue is fine. */
const CONCURRENCY = 1;
/** A failed attempt is retried after this long; a "pending" one older than STUCK is treated as lost (a restart). */
const RETRY_FAILED_MS = 10 * 60 * 1000;
const STUCK_PENDING_MS = 15 * 60 * 1000;

function buildImagePrompt(avatar) {
  return resolveImagePromptTemplate("persona-image", PERSONA_IMAGE_PROMPT_TEMPLATE, {
    gender: avatar.gender,
    age: avatar.ageRange,
    profession: avatar.profession,
    persona: avatar.label,
  });
}

/** One avatar's portrait as a data URL. Throws on failure; the job below records it. */
export async function generateAvatarImage({ workspaceId, productId, avatar, parentGenerationId = null }) {
  const operationId = randomUUID();
  const result = await callAiModel({
    workspaceId,
    provider: "openai_image",
    messages: [{ role: "user", content: buildImagePrompt(avatar) }],
    operation: AI_OPERATIONS.CREATIVE_EXPLORATION_TARGET_AVATAR_IMAGE_GENERATION,
    operationId,
    parentGenerationId: parentGenerationId ?? operationId,
    attempt: 1,
    related: { productId, strategyNodeId: productId },
  });
  if (!result.imageBase64) throw new Error("The image provider returned no image.");
  return `data:image/png;base64,${result.imageBase64}`;
}

const running = new Set();

async function runLimited(items, work) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) await work(queue.shift());
    }),
  );
}

/**
 * Makes sure every avatar of a product has a portrait, or one on the way. Returns each avatar's status right away;
 * the missing portraits are generated in the background. Avatars that already have a ready portrait, or one being
 * made, are left alone, so calling this repeatedly costs nothing extra.
 */
export function ensureAvatarImages({ workspaceId, productId, parentGenerationId = null }) {
  const avatars = listTargetAvatars(workspaceId, productId);
  const known = new Map(listAvatarImageStatuses(workspaceId, productId).map((row) => [row.avatarId, row]));
  const nowMs = Date.now();
  const missing = avatars.filter((avatar) => {
    if (running.has(avatar.id)) return false;
    const row = known.get(avatar.id);
    if (!row) return true;
    const age = nowMs - new Date(row.updatedAt).getTime();
    if (row.status === "failed") return age > RETRY_FAILED_MS;
    if (row.status === "pending") return age > STUCK_PENDING_MS;
    return false;
  });

  for (const avatar of missing) {
    running.add(avatar.id);
    markAvatarImagePending(workspaceId, productId, avatar.id);
  }
  if (missing.length) {
    void runLimited(missing, async (avatar) => {
      try {
        const imageUrl = await generateAvatarImage({ workspaceId, productId, avatar, parentGenerationId });
        finishAvatarImage(workspaceId, avatar.id, { imageUrl });
      } catch (error) {
        console.error("[AVATAR IMAGE] Generation failed; the persona keeps its fallback.", error);
        finishAvatarImage(workspaceId, avatar.id, { error: String(error?.message ?? error).slice(0, 300) });
      } finally {
        running.delete(avatar.id);
      }
    });
  }

  const statuses = new Map(listAvatarImageStatuses(workspaceId, productId).map((row) => [row.avatarId, row.status]));
  return avatars.map((avatar) => ({ avatarId: avatar.id, status: statuses.get(avatar.id) ?? "none" }));
}

/** Statuses only, without starting anything: what the app polls while portraits are being made. */
export function avatarImageStatuses({ workspaceId, productId }) {
  const avatars = listTargetAvatars(workspaceId, productId);
  const statuses = new Map(listAvatarImageStatuses(workspaceId, productId).map((row) => [row.avatarId, row.status]));
  return avatars.map((avatar) => ({ avatarId: avatar.id, status: statuses.get(avatar.id) ?? "none" }));
}
