import Ajv2020 from "ajv/dist/2020.js";
import { creativeExplorationAnglesOutputSchema } from "./output-schemas/angles.schema.mjs";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(creativeExplorationAnglesOutputSchema);

export function parseCreativeExplorationAnglesOutput(value) {
  if (!validate(value)) {
    const error = new Error("AI Creative Exploration Angle generation returned invalid output.");
    error.code = "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT";
    error.details = validate.errors ?? [];
    throw error;
  }
  return value;
}
