import { productContextTemplate } from "./product-context.template.mjs";

export const inputTemplates = Object.freeze({
  productContext: productContextTemplate,
});

// Compatibility alias for callers that still use the old registry name.
export const generationTemplates = inputTemplates;
export const inputTemplateNames = Object.freeze(Object.keys(inputTemplates));
