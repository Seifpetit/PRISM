import Ajv2020 from "ajv/dist/2020.js";
import { creativeExplorationAdHooksOutputSchema } from "./output-schemas/ad-hooks.schema.mjs";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(creativeExplorationAdHooksOutputSchema);

/** Returns the hook alternatives as a list of distinct strings, or throws the same coded error as the other outputs. */
export function parseCreativeExplorationAdHooksOutput(value) {
  if (!validate(value)) {
    const error = new Error("AI Creative Exploration hook alternatives returned invalid output.");
    error.code = "INVALID_CREATIVE_EXPLORATION_AD_HOOKS_OUTPUT";
    error.details = validate.errors ?? [];
    throw error;
  }
  const seen = new Set();
  return value.hooks
    .map((hook) => hook.trim())
    .filter((hook) => {
      const key = hook.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
