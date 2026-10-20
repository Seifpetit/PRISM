import { inputTemplates } from "./input-templates/index.mjs";
import {
  AD_THUMBNAIL_PROMPT_TEMPLATE,
  PERSONA_IMAGE_PROMPT_TEMPLATE,
  PRODUCT_IMAGE_PROMPT_TEMPLATE,
  editablePromptTemplate,
  hasPromptOverride,
  savePromptTemplate,
  templatePlaceholders,
} from "./input-templates/prompt-overrides.mjs";
import {
  readCreativeExplorationPromptTemplate,
  writeCreativeExplorationPromptTemplate,
} from "../creative-exploration/service.mjs";

// Every prompt Prism sends to a model, in workflow order, behind one read/write surface for Settings. Two storage
// mechanisms sit underneath and stay as they are: Product Context and the two image briefs are file-backed
// overrides (data/ai-prompt-overrides.json, placeholder tokens resolved at call time); the Creative Exploration
// templates are workspace-scoped, versioned rows. The catalog only routes to the right one.

function productContextDefault() {
  return inputTemplates.productContext({
    sources: [],
    product: {},
    productContext: {},
    lineage: [],
    parent: { id: "preview", label: "Preview" },
  }).system;
}

const ENTRIES = Object.freeze([
  {
    id: "product-context",
    label: "Product Context",
    group: "product",
    modality: "text",
    storage: "file",
    description: "Turns the material you bring in (links, files, notes) into the structured Product Context everything else builds on.",
    usedWhen: "When you build or update a product's context.",
    defaultContent: productContextDefault,
  },
  {
    id: "product-image",
    label: "Product image",
    group: "product",
    modality: "image",
    storage: "file",
    description: "The brief sent to the image model for a product node's own hero picture.",
    usedWhen: "When you generate a product's image.",
    defaultContent: () => PRODUCT_IMAGE_PROMPT_TEMPLATE,
  },
  {
    id: "creative_exploration_target_avatars",
    label: "Personas",
    group: "strategy",
    modality: "text",
    storage: "versioned",
    description: "Writes the target avatars (personas) an ad set can speak to, grounded in Product Context.",
    usedWhen: "Every persona generation.",
  },
  {
    id: "persona-image",
    label: "Persona portrait",
    group: "strategy",
    modality: "image",
    storage: "file",
    description: "The brief sent to the image model for each persona's portrait, made when personas are generated.",
    usedWhen: "Whenever a persona needs its portrait: right after personas are generated, and for older personas that don't have one yet.",
    defaultContent: () => PERSONA_IMAGE_PROMPT_TEMPLATE,
  },
  {
    id: "creative_exploration_angles",
    label: "Angles",
    group: "strategy",
    modality: "text",
    storage: "versioned",
    description: "Finds the distinct reasons someone would buy, each one a separate angle to test.",
    usedWhen: "Every angle generation.",
  },
  {
    id: "creative_exploration_offers",
    label: "Offers",
    group: "strategy",
    modality: "text",
    storage: "versioned",
    description: "Frames the commercial offer — price, delivery, guarantees — as testable variants.",
    usedWhen: "Every offer generation.",
  },
  {
    id: "creative_exploration_ad_plan",
    label: "Creative plan",
    group: "ads",
    modality: "text",
    storage: "versioned",
    description: "Plans the ads inside one ad set: format, awareness stage, direction, hook, beats and call to action.",
    usedWhen: "When you press Generate ads on an ad set.",
  },
  {
    id: "creative_exploration_ad_hooks",
    label: "Hook alternatives",
    group: "ads",
    modality: "text",
    storage: "versioned",
    description: "Writes other ways to open one ad, keeping its direction and promise.",
    usedWhen: "When you ask for hook alternatives on an ad.",
  },
  {
    id: "ad-thumbnail",
    label: "Ad thumbnails",
    group: "ads",
    modality: "image",
    storage: "file",
    description: "The brief sent to the image model for each planned ad's cover image.",
    usedWhen: "Right after an ad plan is generated, once per ad.",
    defaultContent: () => AD_THUMBNAIL_PROMPT_TEMPLATE,
  },
]);

const byId = new Map(ENTRIES.map((entry) => [entry.id, entry]));

function requireEntry(id) {
  const entry = byId.get(id);
  if (!entry) throw new TypeError(`Unknown prompt: ${id}`);
  return entry;
}

function placeholdersFor(entry) {
  if (entry.storage !== "file") return [];
  return templatePlaceholders(entry.id).map(({ token, description }) => ({ token, description }));
}

function readContent(workspaceId, entry) {
  if (entry.storage === "versioned") {
    const template = readCreativeExplorationPromptTemplate(workspaceId, entry.id);
    return { content: template.content, isCustom: template.isCustom, version: template.version || null, updatedAt: template.updatedAt };
  }
  return {
    content: editablePromptTemplate(entry.id, entry.defaultContent()),
    isCustom: hasPromptOverride(entry.id),
    version: null,
    updatedAt: null,
  };
}

function view(workspaceId, entry) {
  const { content, ...state } = readContent(workspaceId, entry);
  return {
    id: entry.id,
    label: entry.label,
    group: entry.group,
    modality: entry.modality,
    description: entry.description,
    usedWhen: entry.usedWhen ?? null,
    inactiveNote: entry.inactiveNote ?? null,
    chars: content.length,
    placeholders: placeholdersFor(entry),
    ...state,
  };
}

export function listPromptCatalog(workspaceId) {
  return ENTRIES.map((entry) => view(workspaceId, entry));
}

export function readPromptCatalogContent(workspaceId, id) {
  const entry = requireEntry(id);
  return { id, ...readContent(workspaceId, entry), placeholders: placeholdersFor(entry) };
}

export function savePromptCatalogContent(workspaceId, id, content, userId) {
  const entry = requireEntry(id);
  if (entry.storage === "versioned") writeCreativeExplorationPromptTemplate(workspaceId, id, content, userId);
  else savePromptTemplate(id, content);
  return readPromptCatalogContent(workspaceId, id);
}
