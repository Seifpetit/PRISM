import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { baseSystem } from "./shared.mjs";

const overridesPath = join(process.cwd(), "data", "ai-prompt-overrides.json");

export const promptPlaceholders = Object.freeze([
  { token: "{{baseSystem}}", description: "Prism's shared safety and lineage instruction." },
  { token: "{{product}}", description: "The selected product record." },
  { token: "{{productContext}}", description: "Validated product facts and constraints." },
  { token: "{{sources}}", description: "Normalized material supplied for Product Context." },
  { token: "{{lineage}}", description: "The selected branch's upstream strategy lineage." },
  { token: "{{parent}}", description: "The currently selected parent node." },
]);

export const promptTemplateMetadata = Object.freeze({
  "product-context": { label: "Product Context" },
  "product-image": { label: "Product image" },
  "ad-thumbnail": { label: "Ad thumbnail" },
  "persona-image": { label: "Persona portrait" },
});

// Image prompts are plain line-by-line briefs. A line whose placeholder resolves to nothing is dropped, so an
// optional fact (a category, a persona) never leaves a dangling "Category: ." behind — the same behaviour the
// hardcoded builders had before these became editable.
export const PRODUCT_IMAGE_PROMPT_TEMPLATE = [
  "A single hero product photo, studio quality: one clear focal subject, centered, on a plain or softly lit background.",
  "Product: {{product}}.",
  "Category: {{category}}.",
  "What it is: {{summary}}",
  "Notable features: {{features}}.",
  "No text, letters, numbers or logos in the image. Photorealistic, natural lighting, no surreal or fantasy elements, no people.",
].join("\n");

export const AD_THUMBNAIL_PROMPT_TEMPLATE = [
  "Cover image for a Meta ad. {{visualBrief}}.",
  "Product: {{product}}.",
  "Category: {{category}}.",
  "Shown from the point of view of: {{persona}}.",
  "Creative angle: {{angle}}.",
  "Scene: {{scene}}",
  "No text, letters, numbers or logos in the image. Photorealistic, natural lighting, no surreal or fantasy elements.",
].join("\n");

export const PERSONA_IMAGE_PROMPT_TEMPLATE = [
  "A friendly head-and-shoulders portrait of a fictional person: {{gender}}, about {{age}} years old.",
  "Works as: {{profession}}.",
  "Their situation: {{persona}}.",
  "Looking toward the camera with a natural, warm expression. Soft natural light, a simple softly blurred background, upper body centered with a little room above the head.",
  "Semi-realistic digital portrait illustration in one clean, consistent style. No text, letters, numbers, logos or watermarks.",
].join("\n");

const imagePromptPlaceholders = Object.freeze({
  "persona-image": Object.freeze([
    { token: "{{gender}}", description: "The persona's gender." },
    { token: "{{age}}", description: "The persona's age range." },
    { token: "{{profession}}", description: "The persona's profession." },
    { token: "{{persona}}", description: "The persona's one-line description." },
  ]),
  "product-image": Object.freeze([
    { token: "{{product}}", description: "The product's working label, or its name." },
    { token: "{{category}}", description: "The product category from Product Context." },
    { token: "{{summary}}", description: "Product Context's one-line summary, or the product description." },
    { token: "{{features}}", description: "Up to four features from Product Context, comma separated." },
  ]),
  "ad-thumbnail": Object.freeze([
    { token: "{{visualBrief}}", description: "What kind of frame the ad's format calls for (photo, UGC opening frame, …)." },
    { token: "{{product}}", description: "The product's working label, or its name." },
    { token: "{{category}}", description: "The product category from Product Context." },
    { token: "{{persona}}", description: "The ad set's persona." },
    { token: "{{angle}}", description: "The ad set's angle." },
    { token: "{{scene}}", description: "The ad's planned direction." },
  ]),
});

/** The tokens an editor can use in one template. */
export function templatePlaceholders(templateId) {
  return imagePromptPlaceholders[templateId] ?? promptPlaceholders;
}

/** True when a saved override replaces this template's shipped default. */
export function hasPromptOverride(templateId) {
  const override = readOverrides()[templateId];
  return typeof override === "string" && Boolean(override.trim());
}

/** Resolves an image prompt: plain string values per token, lines with an empty value dropped. */
export function resolveImagePromptTemplate(templateId, defaultPrompt, values) {
  const prompt = editablePromptTemplate(templateId, defaultPrompt);
  return prompt
    .split("\n")
    .map((line) => {
      let empty = false;
      const resolved = line.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, name) => {
        if (!(name in values)) return match;
        const value = String(values[name] ?? "").trim();
        if (!value) empty = true;
        return value;
      });
      return empty ? null : resolved;
    })
    .filter((line) => line !== null && line.trim())
    .join("\n");
}

function readOverrides() {
  if (!existsSync(overridesPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(overridesPath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function placeholderValues(args) {
  return {
    "{{baseSystem}}": baseSystem,
    "{{product}}": JSON.stringify(args.product ?? null, null, 2),
    "{{productContext}}": JSON.stringify(args.productContext ?? null, null, 2),
    "{{sources}}": JSON.stringify(args.sources ?? [], null, 2),
    "{{lineage}}": JSON.stringify(args.lineage ?? [], null, 2),
    "{{parent}}": JSON.stringify(args.parent ?? null, null, 2),
  };
}

/** Resolves a saved prompt at the last possible boundary before an AI call. */
export function resolvePromptTemplate(templateId, defaultPrompt, args = {}) {
  const prompt = editablePromptTemplate(templateId, defaultPrompt);
  return Object.entries(placeholderValues(args)).reduce(
    (resolved, [token, value]) => resolved.split(token).join(value),
    prompt,
  );
}

/** Returns the unexpanded source shown in Settings, preserving placeholder tokens. */
export function editablePromptTemplate(templateId, defaultPrompt) {
  const override = readOverrides()[templateId];
  return typeof override === "string" && override.trim() ? override : defaultPrompt;
}

export function savePromptTemplate(templateId, prompt) {
  if (!promptTemplateMetadata[templateId]) throw new Error("Unknown prompt template.");
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("Prompt cannot be empty.");
  if (prompt.length > 100_000) throw new Error("Prompt must be 100,000 characters or fewer.");
  const overrides = readOverrides();
  overrides[templateId] = prompt;
  mkdirSync(dirname(overridesPath), { recursive: true });
  writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");
  return prompt;
}
