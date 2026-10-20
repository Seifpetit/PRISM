import { randomUUID } from "node:crypto";
import { squash } from "../csv-import/resolve.mjs";
import { getDatabasePool } from "./client.mjs";

// The rows behind the production pipeline board. Every read and write is scoped by the workspace.

const now = () => new Date().toISOString();

// A task's ad may have been deleted since; `ad_present` says whether it still exists. Its cover image is read
// live off the ad (not copied into the task at creation) so a task always shows the ad's current image,
// including one generated after the task was already sent to the pipeline; a removed ad just has no image.
const SELECT = `select t.*, exists (select 1 from campaign_ads a where a.workspace_id = t.workspace_id and a.id = t.ad_id) as ad_present,
  a.image_status as ad_image_status, a.image_url as ad_image_url
  from pipeline_tasks t left join campaign_ads a on a.workspace_id = t.workspace_id and a.id = t.ad_id`;

export function listPipelineTaskRows(workspaceId, productId) {
  return getDatabasePool().query(`${SELECT} where t.workspace_id = $1 and t.product_id = $2 order by t.stage, t.sort_order, t.created_at`, [workspaceId, productId]).rows;
}

export function getPipelineTaskRow(workspaceId, id) {
  return getDatabasePool().query(`${SELECT} where t.workspace_id = $1 and t.id = $2`, [workspaceId, id]).rows[0] ?? null;
}

/**
 * A ready image for a launched ad, keyed by the Meta ad name someone typed into a task's "the live Meta ad"
 * field (pipeline_tasks.meta_ad_ref) — the one place PRISM already records "this ad is that Meta ad". Used as
 * the fallback when the live Meta account itself no longer has the ad (paused, archived, deleted there) but the
 * ad still has a cover image in PRISM. Two different tasks that were typed with the same ad name are ambiguous
 * on purpose left out: guessing the wrong ad's photo onto a real performance row is worse than showing none.
 */
export function metaAdRefImageMap(workspaceId, productId) {
  const rows = getDatabasePool().query(
    `select t.meta_ad_ref, a.image_status, a.image_url
     from pipeline_tasks t
     join campaign_ads a on a.workspace_id = t.workspace_id and a.id = t.ad_id
     where t.workspace_id = $1 and t.product_id = $2 and t.meta_ad_ref is not null and a.image_status = 'ready'`,
    [workspaceId, productId],
  ).rows;
  const byKey = new Map();
  const ambiguous = new Set();
  for (const row of rows) {
    const key = squash(row.meta_ad_ref);
    if (!key) continue;
    if (byKey.has(key) && byKey.get(key) !== row.image_url) ambiguous.add(key);
    byKey.set(key, row.image_url);
  }
  for (const key of ambiguous) byKey.delete(key);
  return byKey;
}

/** Puts a new task at the end of its stage. */
export function insertPipelineTask(workspaceId, task) {
  const id = `task-${randomUUID()}`;
  const stamp = now();
  const last = getDatabasePool().query("select coalesce(max(sort_order), 0) as m from pipeline_tasks where workspace_id = $1 and product_id = $2 and stage = $3", [workspaceId, task.productId, task.stage]).rows[0].m;
  getDatabasePool().query(
    `insert into pipeline_tasks (id, workspace_id, product_id, ad_id, concept_id, ad_ref, title, format, awareness, hook, variant, stage, checklist_json,
       sort_order, created_at, updated_at, stage_changed_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $15)`,
    [id, workspaceId, task.productId, task.adId, task.conceptId ?? null, task.adRef ?? null, task.title, task.format, task.awareness ?? null, task.hook ?? null, task.variant ?? null, task.stage, task.checklist, last + 1, stamp],
  );
  return getPipelineTaskRow(workspaceId, id);
}

export function updatePipelineTaskRow(workspaceId, id, patch) {
  const existing = getPipelineTaskRow(workspaceId, id);
  const next = {
    title: patch.title ?? existing.title,
    variant: patch.variant === undefined ? existing.variant : patch.variant,
    notes: patch.notes === undefined ? existing.notes : patch.notes,
    metaAdRef: patch.metaAdRef === undefined ? existing.meta_ad_ref : patch.metaAdRef,
    checklist: patch.checklist ?? existing.checklist_json,
  };
  getDatabasePool().query(
    "update pipeline_tasks set title = $3, variant = $4, notes = $5, meta_ad_ref = $6, checklist_json = $7, updated_at = $8 where workspace_id = $1 and id = $2",
    [workspaceId, id, next.title, next.variant, next.notes, next.metaAdRef, next.checklist, now()],
  );
  return getPipelineTaskRow(workspaceId, id);
}

/**
 * Moves a task into a stage at a position (the end when null) and renumbers that column 1, 2, 3…, so the order is exact.
 * A move within the same stage only reorders; the time the stage was entered changes only when the stage does.
 */
export function reorderStage(workspaceId, task, stage, index) {
  const database = getDatabasePool();
  const others = database
    .query("select id from pipeline_tasks where workspace_id = $1 and product_id = $2 and stage = $3 and id <> $4 order by sort_order, created_at", [workspaceId, task.product_id, stage, task.id])
    .rows.map((row) => row.id);
  const at = index === null ? others.length : Math.min(index, others.length);
  others.splice(at, 0, task.id);
  const stamp = now();
  others.forEach((id, position) => {
    if (id === task.id) {
      database.query(
        "update pipeline_tasks set stage = $3, sort_order = $4, updated_at = $5, stage_changed_at = case when stage = $3 then stage_changed_at else $5 end where workspace_id = $1 and id = $2",
        [workspaceId, id, stage, position + 1, stamp],
      );
    } else database.query("update pipeline_tasks set sort_order = $3 where workspace_id = $1 and id = $2", [workspaceId, id, position + 1]);
  });
}

export function deletePipelineTaskRow(workspaceId, id) {
  return getDatabasePool().query("delete from pipeline_tasks where workspace_id = $1 and id = $2", [workspaceId, id]).rowCount > 0;
}
