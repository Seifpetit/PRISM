import Ajv2020 from "ajv/dist/2020.js";
import { buildTargetAvatarsOutputSchema, clampTargetAvatarCount } from "./output-schemas/target-avatars.schema.mjs";

const validatorCache = new Map();

function validatorFor(count) {
  const exact = clampTargetAvatarCount(count);
  if (!validatorCache.has(exact)) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    validatorCache.set(exact, ajv.compile(buildTargetAvatarsOutputSchema(exact)));
  }
  return validatorCache.get(exact);
}

export function parseCreativeExplorationTargetAvatarsOutput(value, count) {
  const validate = validatorFor(count);
  if (!validate(value)) {
    const error = new Error("AI Creative Exploration Target Avatar generation returned invalid output.");
    error.code = "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT";
    error.details = validate.errors ?? [];
    throw error;
  }
  return value;
}
