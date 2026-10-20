import { callAiModel } from "../ai/canonical-caller.mjs";
import { AI_OPERATIONS } from "../ai/workflow-operations.mjs";
import { PRODUCT_IMAGE_PROMPT_TEMPLATE, resolveImagePromptTemplate } from "../ai/input-templates/prompt-overrides.mjs";

// The product node's own representative image, on demand only — never fired automatically at product creation
// or at Product Context build time. One attempt, one operation; a failure is the caller's to report (see
// generateProductImage in backend/server.mjs), not retried here.

function buildImagePrompt({ product, productContext }) {
  return resolveImagePromptTemplate("product-image", PRODUCT_IMAGE_PROMPT_TEMPLATE, {
    product: productContext?.workingLabel || productContext?.name || product.name,
    category: productContext?.category,
    summary: productContext?.summary || product.description,
    features: (productContext?.features ?? []).slice(0, 4).join(", "),
  });
}

/**
 * One product's own image. Throws on failure — the caller decides how to report that (see
 * generateProductImage in backend/server.mjs, which leaves the product without an image rather than inventing
 * a broken-looking state: there is no image_status column on products, so "never generated" and "generation
 * failed" read the same, the same quiet-placeholder rule used everywhere else a cover image can be missing).
 */
export async function generateProductImage({ workspaceId, operationId, related, product, productContext }) {
  const prompt = buildImagePrompt({ product, productContext });
  const result = await callAiModel({
    workspaceId,
    provider: "openai_image",
    messages: [{ role: "user", content: prompt }],
    operation: AI_OPERATIONS.PRODUCT_IMAGE_GENERATION,
    operationId,
    parentGenerationId: operationId,
    attempt: 1,
    related,
  });
  if (!result.imageBase64) throw new Error("The image provider returned no image.");
  return `data:image/png;base64,${result.imageBase64}`;
}
