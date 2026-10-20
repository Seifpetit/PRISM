export const creativeExplorationAnglesOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "creative-exploration://ai/output-schemas/angles-output",
  title: "Creative Exploration angle output",
  type: "object",
  additionalProperties: false,
  required: ["angles"],
  properties: {
    angles: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "framing", "creativePotential", "summary", "keyMessage", "tags", "audienceFitNote"],
        properties: {
          label: { type: "string", minLength: 4, maxLength: 120 },
          framing: { type: "string", minLength: 20, maxLength: 420 },
          creativePotential: { type: "string", minLength: 15, maxLength: 320 },
          summary: { type: "string", minLength: 15, maxLength: 220 },
          keyMessage: { type: "string", minLength: 10, maxLength: 140 },
          tags: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string", minLength: 2, maxLength: 24 },
          },
          audienceFitNote: { type: "string", minLength: 20, maxLength: 260 },
        },
      },
    },
  },
};
