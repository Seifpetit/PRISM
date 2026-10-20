import { randomUUID } from "node:crypto";
import { getCampaignAd, getCampaignConcept } from "../database/campaigns-repository.mjs";
import {
  deletePipelineTaskRow,
  getPipelineTaskRow,
  insertPipelineTask,
  listPipelineTaskRows,
  reorderStage,
  updatePipelineTaskRow,
} from "../database/pipeline-repository.mjs";
import { getWorkspaceProduct } from "../database/workspace-data-repository.mjs";

// The production pipeline. A task is created from a Prism ad and carries a snapshot of it; what is fixed here is the
// set of stages, and the checklist each format starts with.

export class PipelineError extends Error {
  constructor(message, code = "PIPELINE_INVALID") {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

/** Left to right on the board. "Script / Brief" is one stage for every format: a static ad has a design brief, not a script. */
export const STAGES = Object.freeze(["planned", "script_brief", "approved", "in_production", "in_editing", "in_review", "ready_to_launch", "launched"]);

/** What each format needs, in order: the same board for all of them, a different checklist inside the card. */
const FORMAT_STEPS = Object.freeze({
  ugc_video: ["Script", "Creator assigned", "Footage received", "Edit", "Captions"],
  video: ["Script / storyboard", "Footage / assets", "Edit", "Sound and captions"],
  static_ad: ["Design brief", "Visual and copy", "Design", "Export"],
  carousel: ["Card-by-card outline", "Designs", "Sequence review", "Export"],
  photo: ["Shot brief", "Photo shoot", "Retouch", "Export"],
  ai_talking_head: ["Script", "Presenter and voice chosen", "Generate video", "Edit", "Captions"],
  motion_graphic: ["Storyboard", "Assets", "Animate", "Sound and captions"],
});

/** Every task ends the same way, whatever the format: what "ready to launch" actually needs. */
const LAUNCH_STEPS = Object.freeze(["Primary text and headline", "CTA and destination"]);

const MAX = Object.freeze({ title: 120, variant: 60, notes: 4000, metaAdRef: 200, checklist: 30, item: 120, adRef: 30 });

const fail = (message, code) => {
  throw new PipelineError(message, code);
};

/** The checklist a new task of this format starts with. */
export function checklistFor(format) {
  const steps = FORMAT_STEPS[format] ?? FORMAT_STEPS.video;
  return [...steps, ...LAUNCH_STEPS].map((label, index) => ({ id: `step-${index + 1}`, label, done: false }));
}

const clean = (value, max, what) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length > max) fail(`${what} can be up to ${max} characters.`);
  return text;
};

function cleanChecklist(value) {
  if (!Array.isArray(value)) fail("The checklist must be a list.");
  if (value.length > MAX.checklist) fail(`A checklist can have up to ${MAX.checklist} items.`);
  const seen = new Set();
  return value.map((item) => {
    const label = clean(item?.label, MAX.item, "A checklist item");
    if (!label) fail("A checklist item can't be empty.");
    const id = typeof item?.id === "string" && item.id && item.id.length <= 60 ? item.id : `x-${randomUUID().slice(0, 8)}`;
    if (seen.has(id)) fail("Checklist items must be different.");
    seen.add(id);
    return { id, label, done: item?.done === true };
  });
}

function requireProduct(workspaceId, productId) {
  if (typeof productId !== "string" || !getWorkspaceProduct(workspaceId, productId)) fail("That product wasn't found.", "PIPELINE_PRODUCT_NOT_FOUND");
}

/** How a stored row is shown: the checklist as a list, and whether the ad it came from still exists. */
function shape(row) {
  const items = Array.isArray(row.checklist_json) ? row.checklist_json : [];
  return {
    id: row.id,
    productId: row.product_id,
    adId: row.ad_id,
    conceptId: row.concept_id ?? null,
    adRef: row.ad_ref ?? null,
    title: row.title,
    format: row.format,
    awareness: row.awareness ?? null,
    hook: row.hook ?? null,
    variant: row.variant ?? null,
    stage: row.stage,
    checklist: items,
    notes: row.notes ?? null,
    metaAdRef: row.meta_ad_ref ?? null,
    sortOrder: row.sort_order,
    adRemoved: !row.ad_present,
    imageStatus: row.ad_present ? (row.ad_image_status ?? "none") : "none",
    imageUrl: row.ad_present && row.ad_image_status === "ready" ? row.ad_image_url : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stageChangedAt: row.stage_changed_at,
  };
}

export function listPipelineTasks(workspaceId, productId) {
  requireProduct(workspaceId, productId);
  return listPipelineTaskRows(workspaceId, productId).map(shape);
}

/**
 * Sends an ad to the pipeline: a new task linked to that ad, in Planned. The ad itself is not moved or copied. The same
 * ad can be sent again for another version (a different aspect ratio, a translation); `variant` names it.
 */
export function createPipelineTask(workspaceId, { adId, variant, adRef }) {
  const ad = typeof adId === "string" ? getCampaignAd(workspaceId, adId) : null;
  if (!ad) fail("That ad wasn't found.", "PIPELINE_AD_NOT_FOUND");
  const concept = getCampaignConcept(workspaceId, ad.conceptId);
  if (!concept) fail("That ad's ad set wasn't found.", "PIPELINE_AD_NOT_FOUND");
  const ref = clean(adRef, MAX.adRef, "The ad reference");
  const name = clean(variant, MAX.variant, "A version name");
  // A title the person never wrote is taken from the ad's hook, which can be long: shorten it rather than refuse the ad.
  const derived = String(ad.title || ad.hook || ref || "Untitled ad").replace(/\s+/g, " ").trim();
  const title = derived.length > MAX.title ? `${derived.slice(0, MAX.title - 1).trimEnd()}…` : derived;
  const row = insertPipelineTask(workspaceId, {
    productId: concept.productId,
    adId: ad.id,
    conceptId: concept.id,
    adRef: ref || null,
    title,
    format: ad.format,
    awareness: ad.awareness ?? null,
    hook: ad.hook ?? null,
    variant: name || null,
    stage: "planned",
    checklist: checklistFor(ad.format),
  });
  return shape(row);
}

/** Edits what a person writes on a task: its name, version, notes, live Meta ad and checklist. The stage moves separately. */
export function updatePipelineTask(workspaceId, { id, title, variant, notes, metaAdRef, checklist }) {
  const existing = getPipelineTaskRow(workspaceId, id);
  if (!existing) fail("That task wasn't found.", "PIPELINE_TASK_NOT_FOUND");
  const patch = {};
  if (title !== undefined && title !== null) {
    patch.title = clean(title, MAX.title, "The title");
    if (!patch.title) fail("A task needs a title.");
  }
  if (variant !== undefined) patch.variant = variant === null ? null : clean(variant, MAX.variant, "A version name") || null;
  if (notes !== undefined) {
    const text = notes === null ? "" : String(notes).replace(/\r\n?/g, "\n").trim();
    if (text.length > MAX.notes) fail(`Notes can be up to ${MAX.notes} characters.`);
    patch.notes = text || null;
  }
  if (metaAdRef !== undefined) patch.metaAdRef = metaAdRef === null ? null : clean(metaAdRef, MAX.metaAdRef, "The Meta ad") || null;
  if (checklist !== undefined && checklist !== null) patch.checklist = cleanChecklist(checklist);
  return shape(updatePipelineTaskRow(workspaceId, id, patch));
}

/** Moves a task to a stage, at a position in that column (the end when none is given). */
export function movePipelineTask(workspaceId, { id, stage, index }) {
  if (!STAGES.includes(stage)) fail(`Stage must be one of: ${STAGES.join(", ")}.`);
  const existing = getPipelineTaskRow(workspaceId, id);
  if (!existing) fail("That task wasn't found.", "PIPELINE_TASK_NOT_FOUND");
  if (index !== undefined && index !== null && (!Number.isInteger(index) || index < 0)) fail("The position must be a whole number, zero or more.");
  reorderStage(workspaceId, existing, stage, index ?? null);
  return shape(getPipelineTaskRow(workspaceId, id));
}

export function deletePipelineTask(workspaceId, id) {
  return deletePipelineTaskRow(workspaceId, id);
}
