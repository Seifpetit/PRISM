/**
 * Canonical AI output contract for Product Context.
 *
 * Product Context is evidence-aware product knowledge used as the factual root
 * for downstream strategy generation.
 *
 * `name` preserves the factual/source-supported product identity.
 *
 * `workingLabel` is a concise internal marketing/strategy shorthand that makes
 * the product easier for humans and downstream strategy stages to reason about.
 * It is not required to match the official/store product name.
 *
 * `category` captures the simplest supported product category.
 *
 * Every evidence category is required structurally, but every array may be
 * empty when the supplied evidence does not support an item for that category.
 *
 * Empty evidence is preferable to invented evidence.
 */
export const productContextOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "prism://ai/output-schemas/product-context-output",
  title: "Product context output",

  type: "object",
  additionalProperties: false,

  required: [
    "name",
    "workingLabel",
    "category",
    "summary",
    "features",
    "mechanisms",
    "benefits",
    "proofPoints",
    "useCases",
    "claims",
    "constraints",
  ],

  properties: {
    name: {
      type: "string",
      minLength: 1,
      maxLength: 200,
    },

    workingLabel: {
      type: "string",
      minLength: 2,
      maxLength: 80,
    },

    category: {
      type: "string",
      minLength: 2,
      maxLength: 80,
    },

    summary: {
      type: "string",
      minLength: 1,
      maxLength: 600,
    },

    features: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 240,
      },
    },

    mechanisms: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 240,
      },
    },

    benefits: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 240,
      },
    },

    proofPoints: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 300,
      },
    },

    useCases: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 240,
      },
    },

    claims: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 300,
      },
    },

    constraints: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      uniqueItems: true,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 300,
      },
    },
  },
};
