export const AI_OPERATIONS = Object.freeze({
  PRODUCT_CONTEXT_BUILDING: "product_context_building",
  AUDIENCE_GENERATION: "audience_generation",
  ANGLE_GENERATION: "angle_generation",
  CREATIVE_TYPE_GENERATION: "creative_type_generation",
  EXECUTION_GENERATION: "execution_generation",
  CREATIVE_GENERATION: "creative_generation",
  CREATIVE_EXPLORATION_ANGLE_GENERATION: "creative_exploration_angle_generation",
  CREATIVE_EXPLORATION_TARGET_AVATAR_GENERATION: "creative_exploration_target_avatar_generation",
  CREATIVE_EXPLORATION_CONCEPT_GENERATION: "creative_exploration_concept_generation",
  CREATIVE_EXPLORATION_OFFER_GENERATION: "creative_exploration_offer_generation",
  CREATIVE_EXPLORATION_AD_PLAN_GENERATION: "creative_exploration_ad_plan_generation",
  CREATIVE_EXPLORATION_AD_HOOKS_GENERATION: "creative_exploration_ad_hooks_generation",
  /** One image-generation attempt per ad, fired alongside the ad-plan text call under the same operation id
      (see backend/creative-exploration/ad-plan-thumbnails.mjs) — a sibling attempt, not a separate operation. */
  CREATIVE_EXPLORATION_AD_THUMBNAIL_GENERATION: "creative_exploration_ad_thumbnail_generation",
  /** One portrait per Target Avatar, made in the background right after avatars are generated (or later, for
      avatars that predate portraits). Its own operation per portrait, parented to the avatar generation when known. */
  CREATIVE_EXPLORATION_TARGET_AVATAR_IMAGE_GENERATION: "creative_exploration_target_avatar_image_generation",
  /** On demand only, from the product node itself — never fired automatically at product creation. */
  PRODUCT_IMAGE_GENERATION: "product_image_generation",
});

const templateOperations = Object.freeze({
  audiences: AI_OPERATIONS.AUDIENCE_GENERATION,
  angles: AI_OPERATIONS.ANGLE_GENERATION,
  creativeTypes: AI_OPERATIONS.CREATIVE_TYPE_GENERATION,
  executions: AI_OPERATIONS.EXECUTION_GENERATION,
  creatives: AI_OPERATIONS.CREATIVE_GENERATION,
});

export function operationForTemplate(templateName) {
  const operation = templateOperations[templateName];
  if (!operation) throw new TypeError(`No stable AI operation for template: ${templateName}`);
  return operation;
}
