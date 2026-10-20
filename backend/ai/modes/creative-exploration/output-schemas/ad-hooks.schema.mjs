// Bounds are loose on purpose: structured output does not enforce them, so a tight cap only rejects good output.
export const creativeExplorationAdHooksOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "creative-exploration://ai/output-schemas/ad-hooks-output",
  title: "Creative Exploration ad hook alternatives output",
  type: "object",
  additionalProperties: false,
  required: ["hooks"],
  properties: {
    hooks: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string", minLength: 6, maxLength: 500 },
    },
  },
};
