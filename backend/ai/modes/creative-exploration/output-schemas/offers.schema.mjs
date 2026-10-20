export const creativeExplorationOffersOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "creative-exploration://ai/output-schemas/offers-output",
  title: "Creative Exploration offer output",
  type: "object",
  additionalProperties: false,
  required: ["offers"],
  properties: {
    offers: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "framing", "creativePotential"],
        properties: {
          // maxLength is not enforced by OpenAI structured output — keep caps generous.
          label: { type: "string", minLength: 4, maxLength: 120 },
          framing: { type: "string", minLength: 20, maxLength: 420 },
          creativePotential: { type: "string", minLength: 15, maxLength: 320 },
        },
      },
    },
  },
};
