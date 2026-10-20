export const targetAvatarCountBounds = { min: 3, max: 20, default: 10 };

export function clampTargetAvatarCount(value) {
  const { min, max, default: fallback } = targetAvatarCountBounds;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

/**
 * A Target Avatar is a specific profile of society (who they are, their daily
 * rhythm) paired with one concrete pain point inside that rhythm, and an
 * explicit, evidence-bound connection to how the product's real solution
 * addresses that pain point. Schema is built per-request so the model must
 * return exactly the requested count.
 */
export function buildTargetAvatarsOutputSchema(count) {
  const exact = clampTargetAvatarCount(count);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `creative-exploration://ai/output-schemas/target-avatars-output/${exact}`,
    title: "Creative Exploration Target Avatar output",
    type: "object",
    additionalProperties: false,
    required: ["targetAvatars"],
    properties: {
      targetAvatars: {
        type: "array",
        minItems: exact,
        maxItems: exact,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "label",
            "gender",
            "ageRange",
            "profession",
            "lifeRhythm",
            "painPoint",
            "productConnection",
            "priorities",
            "buyingContext",
          ],
          properties: {
            label: { type: "string", minLength: 3, maxLength: 100 },
            gender: { type: "string", minLength: 2, maxLength: 40 },
            ageRange: { type: "string", minLength: 2, maxLength: 40 },
            profession: { type: "string", minLength: 2, maxLength: 100 },
            lifeRhythm: { type: "string", minLength: 20, maxLength: 320 },
            painPoint: { type: "string", minLength: 15, maxLength: 360 },
            productConnection: { type: "string", minLength: 15, maxLength: 420 },
            priorities: { type: "string", minLength: 10, maxLength: 260 },
            buyingContext: { type: "string", minLength: 15, maxLength: 320 },
          },
        },
      },
    },
  };
}
