import { creativeExplorationAdHooksOutputSchema } from "./ad-hooks.schema.mjs";
import { creativeExplorationAdPlanOutputSchema } from "./ad-plan.schema.mjs";
import { creativeExplorationAnglesOutputSchema } from "./angles.schema.mjs";
import { creativeExplorationOffersOutputSchema } from "./offers.schema.mjs";
import { creativeExplorationTargetAvatarsOutputSchema } from "./target-avatars.schema.mjs";

export const creativeExplorationOutputSchemas = Object.freeze({
  angles: creativeExplorationAnglesOutputSchema,
  targetAvatars: creativeExplorationTargetAvatarsOutputSchema,
  offers: creativeExplorationOffersOutputSchema,
  adPlan: creativeExplorationAdPlanOutputSchema,
  adHooks: creativeExplorationAdHooksOutputSchema,
});

export {
  creativeExplorationAdHooksOutputSchema,
  creativeExplorationAdPlanOutputSchema,
  creativeExplorationAnglesOutputSchema,
  creativeExplorationTargetAvatarsOutputSchema,
  creativeExplorationOffersOutputSchema,
};
