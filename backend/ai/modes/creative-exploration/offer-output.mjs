import Ajv2020 from "ajv/dist/2020.js";
import { creativeExplorationOffersOutputSchema } from "./output-schemas/offers.schema.mjs";

const validate = new Ajv2020({ allErrors: true, strict: false }).compile(creativeExplorationOffersOutputSchema);

export function parseCreativeExplorationOffersOutput(value) {
  if (!validate(value)) {
    const error = new Error("AI Creative Exploration Offer generation returned invalid output.");
    error.code = "INVALID_CREATIVE_EXPLORATION_OFFER_OUTPUT";
    error.details = validate.errors ?? [];
    throw error;
  }
  return value;
}
