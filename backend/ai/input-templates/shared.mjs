export const baseSystem = `You are the strategy-generation engine for a lineage-first ecommerce creative system.
Every output must be grounded in the supplied product context and preserve strategic ancestry.
Never make medical, guaranteed-outcome, or unsupported claims.`;

export function listOutputGuidance(itemName, requiredFields, rules = []) {
  return {
    format: "json",
    shape: { items: `array of exactly 2 ${itemName} objects` },
    requiredFields: ["items", ...requiredFields],
    rules: [
      "Return valid JSON only.",
      "Return exactly two items.",
      "Do not include markdown, commentary, or invented evidence.",
      "Respect every product constraint.",
      ...rules,
    ],
  };
}
