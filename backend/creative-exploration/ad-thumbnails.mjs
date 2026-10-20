import { callAiModel } from "../ai/canonical-caller.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import { AD_THUMBNAIL_PROMPT_TEMPLATE, resolveImagePromptTemplate } from "../ai/input-templates/prompt-overrides.mjs";

// One cover image per planned ad, fired once the ad plan is known (its format, direction and hook — see
// backend/creative-exploration/service.mjs's generateCreativeExplorationAdPlan). All of an ad set's thumbnails
// run together (Promise.allSettled), each as its own attempt under the SAME operationId as the ad-plan text
// call — no new operation, so its cost lands on the same generation without any new tracing plumbing
// (backend/ai/canonical-caller.mjs already supports several attempts per operation).
//
// A thumbnail failing never fails the ad: the caller (backend/server.mjs) persists ads first, then calls this,
// and a failed image just leaves that ad's image_status as "failed" (see setCampaignAdImage).

const FORMAT_VISUAL_BRIEF = {
  photo: "a single photo-style ad image, one clear focal subject",
  static_ad: "a static ad graphic with one clear focal subject and room for headline text",
  carousel: "the first card of a carousel ad",
  video: "a video ad's opening frame",
  ugc_video: "a UGC-style video's opening frame, shot like a handheld phone video, natural lighting",
  ai_talking_head: "a talking-head video's opening frame: one person facing the camera, upper body, plain background",
  motion_graphic: "a motion-graphic ad's key frame: bold flat shapes and short on-screen text, not a photo",
};

function buildImagePrompt({ productContext, avatar, angle, ad }) {
  return resolveImagePromptTemplate("ad-thumbnail", AD_THUMBNAIL_PROMPT_TEMPLATE, {
    visualBrief: FORMAT_VISUAL_BRIEF[ad.format] ?? "a single ad image, one clear focal subject",
    product: productContext.workingLabel || productContext.name,
    category: productContext.category,
    persona: avatar?.label,
    angle: angle?.label,
    scene: ad.direction,
  });
}

/** One ad's thumbnail. Throws on failure — callers decide how to isolate that (see generateAdSetThumbnails). */
export async function generateAdThumbnail({
  workspaceId,
  operationId,
  attempt,
  related,
  productContext,
  avatar,
  angle,
  ad,
}) {
  const prompt = buildImagePrompt({ productContext, avatar, angle, ad });
  const result = await callAiModel({
    workspaceId,
    provider: "openai_image",
    messages: [{ role: "user", content: prompt }],
    operation: AI_OPERATIONS.CREATIVE_EXPLORATION_AD_THUMBNAIL_GENERATION,
    operationId,
    parentGenerationId: operationId,
    attempt,
    related,
  });
  if (!result.imageBase64) throw new Error("The image provider returned no image.");
  return `data:image/png;base64,${result.imageBase64}`;
}

/**
 * Every ad in one "Generate ads" run, together. `ads` must already carry a real `id` (saved first) and the
 * plan fields (`format`, `direction`). Attempt numbers start after the text call's own attempts, passed in as
 * `startAttempt`, so a retried plan generation never collides with its thumbnails' attempt numbers.
 */
export async function generateAdSetThumbnails({
  workspaceId,
  operationId,
  related,
  productContext,
  avatar,
  angle,
  ads,
  startAttempt,
}) {
  const settled = await Promise.allSettled(
    ads.map((ad, index) =>
      generateAdThumbnail({
        workspaceId,
        operationId,
        attempt: startAttempt + index,
        related,
        productContext,
        avatar,
        angle,
        ad,
      }),
    ),
  );
  return settled.map((outcome, index) => {
    if (outcome.status === "fulfilled") {
      return { adId: ads[index].id, status: "ready", url: outcome.value };
    }
    console.error("[AD THUMBNAIL] Generation failed; ad is kept without an image.", outcome.reason);
    return { adId: ads[index].id, status: "failed", url: null };
  });
}
