export const AD_PLAN_FORMATS = ["photo", "static_ad", "carousel", "video", "ugc_video", "ai_talking_head", "motion_graphic"];
export const AD_PLAN_AWARENESS = ["unaware", "problem_aware", "solution_aware", "product_aware"];

// OpenAI structured output does not enforce array or string bounds, so these caps only reject clearly broken
// output; a too-tight cap silently fails every otherwise-good generation.
export const creativeExplorationAdPlanOutputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "creative-exploration://ai/output-schemas/ad-plan-output",
  title: "Creative Exploration ad plan output",
  type: "object",
  additionalProperties: false,
  required: ["ads"],
  properties: {
    ads: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "awareness", "format", "direction", "hook", "beats", "cta"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 120 },
          awareness: { type: "string", enum: AD_PLAN_AWARENESS },
          format: { type: "string", enum: AD_PLAN_FORMATS },
          direction: { type: "string", minLength: 10, maxLength: 1200 },
          hook: { type: "string", minLength: 10, maxLength: 500 },
          beats: {
            type: "array",
            minItems: 2,
            maxItems: 8,
            items: { type: "string", minLength: 6, maxLength: 600 },
          },
          cta: { type: "string", minLength: 2, maxLength: 200 },
        },
      },
    },
  },
};
