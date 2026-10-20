import { creativeExplorationAdHooksTemplate } from "./ad-hooks.template.mjs";
import { creativeExplorationAdPlanTemplate } from "./ad-plan.template.mjs";
import { creativeExplorationAnglesTemplate } from "./angles.template.mjs";
import { creativeExplorationOffersTemplate } from "./offers.template.mjs";
import { creativeExplorationTargetAvatarsTemplate } from "./target-avatars.template.mjs";

export const creativeExplorationInputTemplates = Object.freeze({
  angles: creativeExplorationAnglesTemplate,
  targetAvatars: creativeExplorationTargetAvatarsTemplate,
  offers: creativeExplorationOffersTemplate,
  adPlan: creativeExplorationAdPlanTemplate,
  adHooks: creativeExplorationAdHooksTemplate,
});

export {
  creativeExplorationAdHooksTemplate,
  creativeExplorationAdPlanTemplate,
  creativeExplorationAnglesTemplate,
  creativeExplorationTargetAvatarsTemplate,
  creativeExplorationOffersTemplate,
};
