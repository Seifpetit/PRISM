import { readCreativeExplorationPromptTemplate, creativeExplorationPromptTemplateIds } from "../creative-exploration/service.mjs";
import {
  countContextSources,
  deleteContextSourceRow,
  findContextSourceByHash,
  getContextSource,
  getContextSourceText,
  getContextSourcesWithText,
  getGenerationContextRun,
  insertContextSource,
  listContextSources as listContextSourceRows,
  recordGenerationContextRun,
  updateContextSourceRow,
} from "../database/context-sources-repository.mjs";
import { getWorkspaceProduct } from "../database/workspace-data-repository.mjs";
import { assembleGenerationContext, BUDGET, generatorInfo } from "./assemble.mjs";
import { ContextSourceError, describeStructure, extractFile, extractNote, fileKind, LIMITS, sha256 } from "./extract.mjs";

export const MAX_SOURCES_PER_PRODUCT = 30;

const fail = (message, code) => {
  throw new ContextSourceError(message, code);
};

function requireProduct(workspaceId, productId) {
  if (typeof productId !== "string" || !getWorkspaceProduct(workspaceId, productId)) fail("That product wasn't found.", "CONTEXT_PRODUCT_NOT_FOUND");
}

const cleanName = (value, fallback) => {
  const name = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxNameChars);
  return name || fallback;
};
const cleanMarket = (value) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, LIMITS.maxMarketChars) || null;

/** A source as the API shows it: what it is and whether it can be used, never its text. */
function shape(source) {
  return {
    id: source.id,
    productId: source.productId,
    name: source.name,
    kind: source.kind,
    status: source.status,
    statusDetail: source.statusDetail,
    fileName: source.fileName,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes,
    market: source.market,
    version: source.version,
    charCount: source.charCount,
    summary: describeStructure(source.kind, source.structure, source.charCount),
    warnings: source.structure?.warnings ?? [],
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

export function listContextSources(workspaceId, productId) {
  requireProduct(workspaceId, productId);
  return listContextSourceRows(workspaceId, productId).map(shape);
}

/** The stored text of one source, for reading it in the library. */
export function contextSourceContent(workspaceId, sourceId) {
  const source = getContextSource(workspaceId, sourceId);
  if (!source) fail("That source wasn't found.", "CONTEXT_SOURCE_NOT_FOUND");
  return { id: source.id, text: getContextSourceText(workspaceId, sourceId) ?? "", structure: source.structure ?? null };
}

function bytesOf(input) {
  if (typeof input.contentBase64 === "string" && input.contentBase64) {
    const payload = input.contentBase64.replace(/^data:[^;]*;base64,/, "");
    if (!/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(payload)) fail("The file's contents couldn't be read.");
    return Buffer.from(payload, "base64");
  }
  if (typeof input.text === "string") return Buffer.from(input.text, "utf8");
  return fail("There is no file content to read.");
}

/**
 * Adds a note or a file to a product's library. A file that cannot be read is kept as a failed source with the reason,
 * so the person sees it in the library and can remove it; a source is only "ready" when real text came out of it.
 */
export async function addContextSource(workspaceId, input) {
  requireProduct(workspaceId, input.productId);
  if (countContextSources(workspaceId, input.productId) >= MAX_SOURCES_PER_PRODUCT) fail(`A product's library holds up to ${MAX_SOURCES_PER_PRODUCT} sources. Remove one first.`, "CONTEXT_LIBRARY_FULL");
  const market = cleanMarket(input.market);

  let source;
  if (input.kind === "note") {
    const { text, structure } = extractNote(input.text);
    source = { kind: "note", name: cleanName(input.name, text.slice(0, 40).replace(/\s+\S*$/, "") || "Note"), text, structure, fileName: null, mimeType: null, sizeBytes: Buffer.byteLength(text) };
  } else if (input.kind === "file") {
    const fileName = cleanName(input.fileName, "");
    if (!fileName) fail("The file has no name.");
    const kind = fileKind(fileName, input.mimeType);
    const bytes = bytesOf(input);
    // The same file added again after a failure replaces the failed entry instead of stacking up next to it.
    for (const existing of listContextSourceRows(workspaceId, input.productId)) {
      if (existing.status === "failed" && existing.fileName === fileName) deleteContextSourceRow(workspaceId, existing.id);
    }
    try {
      const { text, structure } = await extractFile(kind, bytes, fileName);
      source = { kind, name: cleanName(input.name, fileName), text, structure, fileName, mimeType: input.mimeType ?? null, sizeBytes: bytes.byteLength };
    } catch (error) {
      if (!(error instanceof ContextSourceError)) throw error;
      return shape(insertContextSource(workspaceId, { productId: input.productId, name: cleanName(input.name, fileName), kind, status: "failed", statusDetail: error.message, fileName, mimeType: input.mimeType ?? null, sizeBytes: bytes.byteLength, market }));
    }
  } else {
    fail("Add a file or a note.");
  }

  const contentHash = sha256(source.text);
  const duplicate = findContextSourceByHash(workspaceId, input.productId, contentHash);
  if (duplicate) fail(`This is already in the library as “${duplicate.name}”.`, "CONTEXT_SOURCE_DUPLICATE");
  return shape(insertContextSource(workspaceId, { productId: input.productId, name: source.name, kind: source.kind, status: "ready", fileName: source.fileName, mimeType: source.mimeType, sizeBytes: source.sizeBytes, market, contentHash, text: source.text, structure: source.structure }));
}

/** Renames, relabels or (a note only) rewrites a source; a changed text becomes a new version. */
export function updateContextSource(workspaceId, input) {
  const existing = getContextSource(workspaceId, input.id);
  if (!existing) fail("That source wasn't found.", "CONTEXT_SOURCE_NOT_FOUND");
  const patch = {};
  if (input.name !== undefined && input.name !== null) patch.name = cleanName(input.name, existing.name);
  if (input.market !== undefined) patch.market = cleanMarket(input.market);
  if (input.text !== undefined && input.text !== null) {
    if (existing.kind !== "note") fail("Only a note can be edited. Add the corrected file as a new source instead.", "CONTEXT_SOURCE_NOT_EDITABLE");
    const { text, structure } = extractNote(input.text);
    Object.assign(patch, { text, structure, contentHash: sha256(text) });
  }
  return shape(updateContextSourceRow(workspaceId, input.id, patch));
}

export function deleteContextSource(workspaceId, sourceId) {
  return deleteContextSourceRow(workspaceId, sourceId);
}

// ---------------------------------------------------------------------------------------------------------------------
// From the request to the model

function selectedIds(context) {
  const raw = context?.sourceIds ?? [];
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || !id)) fail("The selected sources weren't understood.");
  const ids = [...new Set(raw)];
  if (ids.length > BUDGET.maxSources) fail(`Select up to ${BUDGET.maxSources} sources for one generation.`, "CONTEXT_TOO_MANY_SOURCES");
  return ids;
}

/**
 * Resolves what the request asked for into what the model will get. The request names sources by id only: each is
 * looked up in this workspace and this product, must be ready, and is read from the library, never from the client.
 */
export function resolveGenerationContext(workspaceId, { productId, generator, productContext, context }) {
  const info = generatorInfo(generator);
  requireProduct(workspaceId, productId);
  const ids = selectedIds(context);
  const found = getContextSourcesWithText(workspaceId, productId, ids);
  if (found.length !== ids.length) fail("A selected source isn't in this product's Context Library any more. Open Generation Setup and choose again.", "CONTEXT_SOURCE_NOT_FOUND");
  const byId = new Map(found.map((source) => [source.id, source]));
  const sources = ids.map((id) => byId.get(id));
  for (const source of sources) {
    if (source.status !== "ready" || !source.text.trim()) {
      const why = source.status === "failed" ? `it couldn't be read: ${source.statusDetail ?? "no text was extracted"}` : source.status === "processing" ? "it is still being processed" : "it has no text";
      fail(`“${source.name}” can't be used yet: ${why}. Deselect it, or remove it and add it again.`, "CONTEXT_SOURCE_NOT_READY");
    }
  }
  const assembled = assembleGenerationContext({ generator, productContext, sources, instructions: context?.instructions });
  const template = readCreativeExplorationPromptTemplate(workspaceId, info.templateName);
  return { ...assembled, productId, templateId: creativeExplorationPromptTemplateIds[info.templateName], templateVersion: template.version };
}

/** Writes down what a finished generation was given. A failure to record it never fails the generation. */
export function recordGenerationProvenance(workspaceId, generationId, setup) {
  try {
    recordGenerationContextRun(workspaceId, {
      generationId,
      productId: setup.productId,
      generator: setup.generator,
      templateId: setup.templateId,
      templateVersion: setup.templateVersion,
      instructions: setup.instructions,
      sources: setup.sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        version: source.version,
        contentHash: source.contentHash,
        availableChars: source.availableChars,
        includedChars: source.includedChars,
        truncated: source.truncated,
        coverage: source.coverage,
      })),
      contextChars: setup.totalChars,
    });
  } catch (error) {
    console.error("[CONTEXT LIBRARY] Generation provenance could not be recorded.", error);
  }
}

export function generationProvenance(workspaceId, generationId) {
  return getGenerationContextRun(workspaceId, generationId);
}

/** What a generation would be given right now, in the shape the drawer shows: the same assembly a real run does. */
export function previewGenerationContext(workspaceId, { productId, generator, productContext, context }) {
  const setup = resolveGenerationContext(workspaceId, { productId, generator, productContext, context });
  return {
    generator,
    templateVersion: setup.templateVersion,
    productContext: JSON.stringify(productContext ?? null, null, 2),
    instructions: setup.instructions,
    sources: setup.sources.map(({ id, name, kind, market, version, availableChars, includedChars, truncated, coverage, warnings, text }) => ({ id, name, kind, market, version, availableChars, includedChars, truncated, coverage, warnings, text })),
    totalChars: setup.totalChars,
    budgetChars: setup.budgetChars,
    rules: setup.modelContext.rules,
  };
}
