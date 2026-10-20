import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";

// The Context Library's rows and the record of what each generation read. Every read and write is scoped by the
// workspace, and a source is only ever found through the product it belongs to.

const LIST_COLUMNS = `id, product_id, name, kind, status, status_detail, file_name, mime_type, size_bytes, market, content_hash,
  version, structure_json, created_at, updated_at, length(content_text) as char_count`;

const now = () => new Date().toISOString();

function asStructure(value) {
  if (value && typeof value === "object") return value;
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function metadata(row) {
  const structure = asStructure(row.structure_json);
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    statusDetail: row.status_detail ?? null,
    fileName: row.file_name ?? null,
    mimeType: row.mime_type ?? null,
    sizeBytes: row.size_bytes ?? null,
    market: row.market ?? null,
    contentHash: row.content_hash ?? null,
    version: row.version,
    charCount: row.char_count ?? 0,
    structure,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The sources of one product, oldest first, without their text. */
export function listContextSources(workspaceId, productId) {
  return getDatabasePool()
    .query(`select ${LIST_COLUMNS} from context_sources where workspace_id = $1 and product_id = $2 order by created_at, id`, [workspaceId, productId])
    .rows.map(metadata);
}

/** One source of the workspace (without its text), or null. */
export function getContextSource(workspaceId, sourceId) {
  const row = getDatabasePool().query(`select ${LIST_COLUMNS} from context_sources where workspace_id = $1 and id = $2`, [workspaceId, sourceId]).rows[0];
  return row ? metadata(row) : null;
}

/** The sources with the given ids that belong to this product, with their text. Ids that are not the product's are absent. */
export function getContextSourcesWithText(workspaceId, productId, ids) {
  if (!ids.length) return [];
  const marks = ids.map((_, index) => `$${index + 3}`).join(", ");
  return getDatabasePool()
    .query(`select ${LIST_COLUMNS}, content_text from context_sources where workspace_id = $1 and product_id = $2 and id in (${marks})`, [workspaceId, productId, ...ids])
    .rows.map((row) => ({ ...metadata(row), text: row.content_text ?? "" }));
}

export function getContextSourceText(workspaceId, sourceId) {
  const row = getDatabasePool().query("select content_text from context_sources where workspace_id = $1 and id = $2", [workspaceId, sourceId]).rows[0];
  return row ? (row.content_text ?? "") : null;
}

export function findContextSourceByHash(workspaceId, productId, hash) {
  const row = getDatabasePool().query(`select ${LIST_COLUMNS} from context_sources where workspace_id = $1 and product_id = $2 and content_hash = $3 and status = 'ready'`, [workspaceId, productId, hash]).rows[0];
  return row ? metadata(row) : null;
}

export function countContextSources(workspaceId, productId) {
  return getDatabasePool().query("select count(*) as n from context_sources where workspace_id = $1 and product_id = $2", [workspaceId, productId]).rows[0].n;
}

/** A new source, stored as it is: the caller has already done the extraction (or recorded why it failed). */
export function insertContextSource(workspaceId, source) {
  const id = source.id ?? `ctx-${randomUUID()}`;
  const stamp = now();
  getDatabasePool().query(
    `insert into context_sources (id, workspace_id, product_id, name, kind, status, status_detail, file_name, mime_type, size_bytes, market,
       content_hash, version, content_text, structure_json, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, $14, $15, $15)`,
    [id, workspaceId, source.productId, source.name, source.kind, source.status, source.statusDetail ?? null, source.fileName ?? null, source.mimeType ?? null, source.sizeBytes ?? null, source.market ?? null, source.contentHash ?? null, source.text ?? null, source.structure ?? null, stamp],
  );
  return getContextSource(workspaceId, id);
}

/**
 * Renames, relabels or (for a note) rewrites a source. The version goes up only when the content itself changed, so a
 * rename never makes a generation's record look stale.
 */
export function updateContextSourceRow(workspaceId, sourceId, patch) {
  const existing = getContextSource(workspaceId, sourceId);
  if (!existing) return null;
  const contentChanged = patch.contentHash !== undefined && patch.contentHash !== existing.contentHash;
  getDatabasePool().query(
    `update context_sources set
       name = $3, market = $4,
       content_hash = case when $5 = 1 then $6 else content_hash end,
       content_text = case when $5 = 1 then $7 else content_text end,
       structure_json = case when $5 = 1 then $8 else structure_json end,
       status = case when $5 = 1 then $9 else status end,
       status_detail = case when $5 = 1 then null else status_detail end,
       version = version + $5,
       updated_at = $10
     where workspace_id = $1 and id = $2`,
    [workspaceId, sourceId, patch.name ?? existing.name, patch.market === undefined ? existing.market : patch.market, contentChanged ? 1 : 0, patch.contentHash ?? null, patch.text ?? null, patch.structure ?? null, "ready", now()],
  );
  return getContextSource(workspaceId, sourceId);
}

export function deleteContextSourceRow(workspaceId, sourceId) {
  return getDatabasePool().query("delete from context_sources where workspace_id = $1 and id = $2", [workspaceId, sourceId]).rowCount > 0;
}

/** What one generation was given. Written once, when the generation has produced its output. */
export function recordGenerationContextRun(workspaceId, run) {
  getDatabasePool().query(
    `insert into generation_context_runs (generation_id, workspace_id, product_id, generator, template_id, template_version, run_instructions,
       sources_json, context_chars, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (generation_id) do nothing`,
    [run.generationId, workspaceId, run.productId, run.generator, run.templateId, run.templateVersion, run.instructions ?? null, run.sources ?? [], run.contextChars ?? 0, now()],
  );
}

export function getGenerationContextRun(workspaceId, generationId) {
  const row = getDatabasePool().query("select * from generation_context_runs where workspace_id = $1 and generation_id = $2", [workspaceId, generationId]).rows[0];
  if (!row) return null;
  return {
    generationId: row.generation_id,
    productId: row.product_id,
    generator: row.generator,
    templateId: row.template_id,
    templateVersion: row.template_version,
    instructions: row.run_instructions ?? null,
    sources: asStructure(row.sources_json) ?? [],
    contextChars: row.context_chars,
    createdAt: row.created_at,
  };
}
