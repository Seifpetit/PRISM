import Ajv2020 from "ajv/dist/2020.js";
import { creativeExplorationAdPlanOutputSchema } from "./output-schemas/ad-plan.schema.mjs";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(creativeExplorationAdPlanOutputSchema);

export function parseCreativeExplorationAdPlanOutput(value) {
  if (!validate(value)) {
    const error = new Error("AI Creative Exploration ad plan generation returned invalid output.");
    error.code = "INVALID_CREATIVE_EXPLORATION_AD_PLAN_OUTPUT";
    error.details = validate.errors ?? [];
    throw error;
  }
  return value;
}
