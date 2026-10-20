import { createHash, randomUUID } from "node:crypto";
import { getDatabasePool, withDatabaseTransaction } from "./client.mjs";

function nodeFromRow(row) {
  return {
    ...row.node_json,
    id: row.id,
    productId: row.product_id,
    parentId: row.parent_id,
    type: row.node_type,
    label: row.label,
    createdAt: row.created_at,
    positionX: row.position_x,
    positionY: row.position_y,
  };
}

export function listWorkspaceProducts(workspaceId) {
  return getDatabasePool()
    .query(
      `select id, brand_id, name, description, image_url, created_at
       from products where workspace_id = $1 order by created_at`,
      [workspaceId],
    )
    .rows.map((row) => ({
      id: row.id,
      brandId: row.brand_id,
      name: row.name,
      description: row.description,
      imageUrl: row.image_url ?? null,
      createdAt: row.created_at,
    }));
}

export function getWorkspaceProduct(workspaceId, productId) {
  const row = getDatabasePool().query(
    `select id, brand_id, name, description, context_id, image_url, created_at
     from products where workspace_id = $1 and id = $2`,
    [workspaceId, productId],
  ).rows[0];
  if (!row) return null;
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    description: row.description,
    contextId: row.context_id,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
  };
}

/** Sets the product's own image to a data: URI returned directly from the image model — not the untrusted,
    scraped-page URL sanitizeImageUrl guards against, so it is stored as-is, the same as an ad's generated cover
    image (see setCampaignAdImage in campaigns-repository.mjs). */
export function updateWorkspaceProductImage(workspaceId, productId, imageUrl) {
  const result = getDatabasePool().query(
    "update products set image_url = $3, updated_at = now() where workspace_id = $1 and id = $2",
    [workspaceId, productId, imageUrl],
  );
  return result.rowCount > 0 ? getWorkspaceProduct(workspaceId, productId) : null;
}

export function getWorkspaceProductContext(workspaceId, productId) {
  return getDatabasePool().query(
    `select pc.context_json
     from products p
     join product_contexts pc
       on pc.workspace_id = p.workspace_id and pc.id = p.context_id
     where p.workspace_id = $1 and p.id = $2`,
    [workspaceId, productId],
  ).rows[0]?.context_json ?? null;
}

export async function persistProductContext(workspaceId, context) {
  getDatabasePool().query(
    `insert into product_contexts (id, workspace_id, context_json, created_at)
     values ($1, $2, $3, $4)
     on conflict (id) do update set
       context_json = excluded.context_json, updated_at = now()
     where product_contexts.workspace_id = excluded.workspace_id`,
    [context.id, workspaceId, context, context.createdAt],
  );
  return context;
}

/** Only an http(s) URL is kept — this rides in from a scraped page during onboarding, not a trusted upload. */
function sanitizeImageUrl(value) {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function createWorkspaceProduct(workspaceId, input) {
  let context = null;
  if (input.contextId) {
    context = getDatabasePool().query(
      "select context_json from product_contexts where workspace_id = $1 and id = $2",
      [workspaceId, input.contextId],
    ).rows[0]?.context_json;
    if (!context) throw new Error("Product context not found in the active workspace.");
  }
  const product = {
    id: input.id ?? randomUUID(),
    brandId: input.brandId,
    name: input.name,
    description: input.description,
    imageUrl: sanitizeImageUrl(input.imageUrl),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const root = {
    id: product.id,
    parentId: null,
    productId: product.id,
    type: "product",
    label: product.name,
    createdAt: product.createdAt,
    generated: true,
    positionX: 0,
    positionY: 0,
  };
  await withDatabaseTransaction(async (database) => {
    database.query(
      `insert into products (
         id, workspace_id, brand_id, name, description, context_id, image_url, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        product.id,
        workspaceId,
        product.brandId,
        product.name,
        product.description,
        input.contextId ?? null,
        product.imageUrl,
        product.createdAt,
      ],
    );
    insertNode(database, workspaceId, root);
    for (const sourceId of context?.sourceIds ?? []) {
      database.query(
        `update product_sources set product_id = $3, updated_at = now()
         where workspace_id = $1 and id = $2`,
        [workspaceId, sourceId, product.id],
      );
    }
  });
  return product;
}

function insertNode(database, workspaceId, node) {
  database.query(
    `insert into strategy_nodes (
       id, workspace_id, product_id, parent_id, node_type, label,
       position_x, position_y, node_json, created_at
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update set
       label = excluded.label,
       node_json = excluded.node_json,
       updated_at = now()
     where strategy_nodes.workspace_id = excluded.workspace_id`,
    [
      node.id,
      workspaceId,
      node.productId,
      node.parentId ?? null,
      node.type,
      node.label,
      node.positionX ?? null,
      node.positionY ?? null,
      node,
      node.createdAt,
    ],
  );
  if (!node.parentId) return;
  database.query(
    `insert into strategy_edges (
       id, workspace_id, product_id, source_node_id, target_node_id, edge_json
     ) values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do nothing`,
    [
      `${node.parentId}-${node.id}`,
      workspaceId,
      node.productId,
      node.parentId,
      node.id,
      { source: node.parentId, target: node.id, type: "lineage" },
    ],
  );
}

export async function persistStrategyNodes(workspaceId, nodes) {
  await withDatabaseTransaction(async (database) => {
    nodes.forEach((node) => insertNode(database, workspaceId, node));
  });
  return nodes;
}

export function listProductStrategy(workspaceId, productId, lineageMode = "strategy_lineage") {
  return getDatabasePool()
    .query(
      `select * from strategy_nodes
       where workspace_id = $1 and product_id = $2
         and (node_type = 'product' or coalesce(json_extract(node_json, '$.lineageMode'), 'strategy_lineage') = $3)
       order by created_at`,
      [workspaceId, productId, lineageMode],
    )
    .rows.map(nodeFromRow);
}

export function getWorkspaceStrategyNode(workspaceId, nodeId) {
  const row = getDatabasePool().query(
    "select * from strategy_nodes where workspace_id = $1 and id = $2",
    [workspaceId, nodeId],
  ).rows[0];
  return row ? nodeFromRow(row) : null;
}

export function updateStrategyNodePosition(workspaceId, nodeId, position) {
  const result = getDatabasePool().query(
    `update strategy_nodes set position_x = $3, position_y = $4, updated_at = now()
     where workspace_id = $1 and id = $2`,
    [workspaceId, nodeId, position.x, position.y],
  );
  return result.rowCount > 0;
}

export async function deleteStrategySubtree(workspaceId, nodeId) {
  return withDatabaseTransaction(async (database) => {
    const root = getWorkspaceStrategyNode(workspaceId, nodeId);
    if (!root) throw new Error("Strategy node not found in the active workspace.");
    if (root.type === "product") throw new Error("The product root cannot be deleted.");
    const nodes = listProductStrategy(workspaceId, root.productId, root.lineageMode ?? "strategy_lineage");
    const ids = new Set([nodeId]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const node of nodes) if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id); changed = true;
      }
    }
    const removed = nodes.filter((node) => ids.has(node.id));
    database.query(`delete from strategy_edges where workspace_id = $1 and (source_node_id in (${removed.map((_, index) => `$${index + 2}`).join(",")}) or target_node_id in (${removed.map((_, index) => `$${index + 2}`).join(",")}))`, [workspaceId, ...removed.map((node) => node.id)]);
    database.query(`delete from strategy_nodes where workspace_id = $1 and id in (${removed.map((_, index) => `$${index + 2}`).join(",")})`, [workspaceId, ...removed.map((node) => node.id)]);
    const summary = `Deleted ${removed.length} ${removed.length === 1 ? "lineage item" : "lineage items"}`;
    const event = { id: randomUUID(), productId: root.productId, type: "subtree_deleted", summary, rootNode: root, removedNodes: removed, createdAt: new Date().toISOString() };
    database.query("insert into lineage_history (id, workspace_id, product_id, event_type, summary, event_json, created_at) values ($1, $2, $3, $4, $5, $6, $7)", [event.id, workspaceId, root.productId, event.type, summary, event, event.createdAt]);
    return event;
  });
}

export function listLineageHistory(workspaceId, productId, limit = 20) {
  return getDatabasePool().query("select summary, event_json from lineage_history where workspace_id = $1 and product_id = $2 order by created_at desc limit $3", [workspaceId, productId, Math.min(Math.max(limit, 1), 100)]).rows.map((row) => ({ ...row.event_json, summary: row.event_json?.summary ?? row.summary }));
}

export function persistProductSources(workspaceId, sources, productId = null) {
  const database = getDatabasePool();
  sources.forEach((source) => {
    database.query(
      `insert into product_sources (
         id, workspace_id, product_id, source_type, label, status, source_json
       ) values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (id) do update set
         product_id = coalesce(excluded.product_id, product_sources.product_id),
         label = excluded.label,
         status = excluded.status,
         source_json = excluded.source_json,
         updated_at = now()
       where product_sources.workspace_id = excluded.workspace_id`,
      [
        source.id,
        workspaceId,
        productId,
        source.type,
        source.label,
        source.status,
        source,
      ],
    );
  });
  return sources;
}

/**
 * Metadata for everything the workspace has given Prism as product context (notes, links, files),
 * newest first. Never returns file contents: uploaded files are stored inline as base64 inside
 * `source_json`, so this reports their size and how many identical copies exist instead.
 */
const TABLE_EXTENSIONS = new Set(["csv", "tsv", "xlsx", "xls"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "oga", "aac", "flac", "weba"]);

/**
 * What a stored source is to a person browsing their data — which editor it opens in — as opposed to its storage
 * type. A Google Drive import or an uploaded file is stored as "file" whatever it holds, so the file's own type
 * decides: document, table, image, video or audio.
 */
export function classifySource(type, filename, mimeType) {
  if (type === "url") return "link";
  if (type === "text") return "note";
  if (type === "image") return "image";
  if (type === "video") return "video";
  const extension = /\.([a-z0-9]+)$/i.exec(String(filename ?? ""))?.[1]?.toLowerCase() ?? "";
  const mime = String(mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (TABLE_EXTENSIONS.has(extension) || mime === "text/csv" || mime === "text/tab-separated-values" || mime.includes("spreadsheet") || mime === "application/vnd.ms-excel") return "table";
  return "document";
}

export function listWorkspaceSources(workspaceId) {
  const rows = getDatabasePool().query(
    `select id, product_id, source_type, label, status, source_json, created_at
     from product_sources where workspace_id = $1 order by created_at desc, id`,
    [workspaceId],
  ).rows;
  const copiesByHash = new Map();
  const entries = rows.map((row) => {
    const source = row.source_json ?? {};
    let fileData = null;
    if (row.source_type === "file" && typeof source.value === "string") {
      try {
        fileData = JSON.parse(source.value)?.data ?? null;
      } catch {
        fileData = null;
      }
    }
    const hash = fileData ? createHash("sha1").update(fileData).digest("hex") : null;
    if (hash) copiesByHash.set(hash, (copiesByHash.get(hash) ?? 0) + 1);
    return { row, source, fileData, hash };
  });
  return entries.map(({ row, source, fileData, hash }) => ({
    id: row.id,
    productId: row.product_id ?? null,
    type: row.source_type,
    kind: classifySource(row.source_type, source.filename, source.mimeType),
    label: row.label,
    filename: source.filename ?? null,
    mimeType: source.mimeType ?? null,
    sizeBytes: Number.isFinite(source.size)
      ? source.size
      : fileData
        ? Math.floor((fileData.length * 3) / 4)
        : null,
    storedBytes: Buffer.byteLength(JSON.stringify(source)),
    status: row.status,
    text: row.source_type === "text" ? String(source.value ?? "").slice(0, 2_000) : null,
    url: row.source_type === "url" ? (source.value ?? null) : null,
    copies: hash ? copiesByHash.get(hash) : 1,
    // A media item's small card preview, made once in the browser (saveDataItemPreview) so listing never ships
    // the file itself.
    thumbnail: typeof source.preview?.thumbnail === "string" ? source.preview.thumbnail : null,
    peaks: Array.isArray(source.preview?.peaks) ? source.preview.peaks : null,
    durationSeconds: Number.isFinite(source.preview?.duration) ? source.preview.duration : null,
    createdAt: `${String(row.created_at).replace(" ", "T")}Z`,
  }));
}

// The same points in a video's duration that empty-product.tsx samples at intake (videoFrameTimes), so a video's
// stored frames can be labelled by roughly where in the clip they came from.
export const VIDEO_FRAME_LABELS = ["15%", "50%", "85%"];

/**
 * The actual image bytes (data: URIs) for one product's image and video sources — for the product node's media
 * picker, where they are shown and one is chosen as the node's thumbnail. Unlike listWorkspaceSources, this does
 * return file contents, but only for one product's own image/video sources, never the whole workspace.
 */
export function listProductMedia(workspaceId, productId) {
  const rows = getDatabasePool()
    .query(
      `select id, source_type, label, source_json from product_sources
       where workspace_id = $1 and product_id = $2 and source_type in ('image', 'video') and status = 'ready'
       order by created_at desc`,
      [workspaceId, productId],
    )
    .rows;
  return rows
    .map((row) => {
      const source = row.source_json ?? {};
      let asset = null;
      try {
        asset = typeof source.value === "string" ? JSON.parse(source.value) : null;
      } catch {
        asset = null;
      }
      if (!asset || asset.version !== 1) return null;
      if (row.source_type === "image" && asset.kind === "image" && typeof asset.dataUrl === "string") {
        return { id: row.id, type: "image", label: row.label, filename: source.filename ?? null, url: asset.dataUrl, frames: null };
      }
      if (row.source_type === "video" && asset.kind === "video_frames" && Array.isArray(asset.frames) && asset.frames.length) {
        const frames = asset.frames.filter((frame) => typeof frame === "string");
        return { id: row.id, type: "video", label: row.label, filename: source.filename ?? null, url: frames[0] ?? null, frames };
      }
      return null;
    })
    .filter(Boolean);
}

/** One stored source with its row metadata, for the Data library's editors. */
export function getWorkspaceSourceRow(workspaceId, sourceId) {
  const row = getDatabasePool().query(
    `select id, product_id, source_type, label, status, source_json, created_at
     from product_sources where workspace_id = $1 and id = $2`,
    [workspaceId, sourceId],
  ).rows[0];
  if (!row) return null;
  return { id: row.id, productId: row.product_id ?? null, type: row.source_type, label: row.label, status: row.status, source: row.source_json ?? {} };
}

export function getWorkspaceSource(workspaceId, sourceId) {
  return getDatabasePool().query(
    "select source_json from product_sources where workspace_id = $1 and id = $2",
    [workspaceId, sourceId],
  ).rows[0]?.source_json ?? null;
}

export function renameWorkspaceSource(workspaceId, sourceId, label) {
  return getDatabasePool().query(
    "update product_sources set label = $1, updated_at = now() where workspace_id = $2 and id = $3",
    [label, workspaceId, sourceId],
  ).rowCount > 0;
}

export function deleteWorkspaceSource(workspaceId, sourceId) {
  return getDatabasePool().query(
    "delete from product_sources where workspace_id = $1 and id = $2",
    [workspaceId, sourceId],
  ).rowCount > 0;
}

export function persistWorkspaceAudienceExploration(workspaceId, artifact) {
  getDatabasePool().query(
    `insert into audience_explorations (
       generation_id, workspace_id, product_id, exploration_json, created_at
     ) values ($1, $2, $3, $4, $5)
     on conflict (generation_id) do update set exploration_json = excluded.exploration_json
     where audience_explorations.workspace_id = excluded.workspace_id`,
    [artifact.generationId, workspaceId, artifact.productId, artifact, artifact.createdAt],
  );
  return artifact;
}

export function getWorkspaceAudienceExploration(workspaceId, { productId, generationId } = {}) {
  if (generationId) {
    return getDatabasePool().query(
      `select exploration_json from audience_explorations
       where workspace_id = $1 and generation_id = $2`,
      [workspaceId, generationId],
    ).rows[0]?.exploration_json ?? null;
  }
  return getDatabasePool().query(
    `select exploration_json from audience_explorations
     where workspace_id = $1 and product_id = $2 order by created_at desc limit 1`,
    [workspaceId, productId],
  ).rows[0]?.exploration_json ?? null;
}

export function persistWorkspaceAngleExploration(workspaceId, artifact) {
  getDatabasePool().query(
    `insert into angle_explorations (
       generation_id, workspace_id, product_id, parent_audience_id, exploration_json, created_at
     ) values ($1, $2, $3, $4, $5, $6)
     on conflict (generation_id) do update set exploration_json = excluded.exploration_json
     where angle_explorations.workspace_id = excluded.workspace_id`,
    [
      artifact.generationId,
      workspaceId,
      artifact.productId,
      artifact.parentAudienceId,
      artifact,
      artifact.createdAt,
    ],
  );
  return artifact;
}

export function getWorkspaceAngleExploration(workspaceId, { parentAudienceId, generationId } = {}) {
  if (generationId) {
    return getDatabasePool().query(
      `select exploration_json from angle_explorations
       where workspace_id = $1 and generation_id = $2`,
      [workspaceId, generationId],
    ).rows[0]?.exploration_json ?? null;
  }
  if (!parentAudienceId) return null;
  return getDatabasePool().query(
    `select exploration_json from angle_explorations
     where workspace_id = $1 and parent_audience_id = $2 order by created_at desc limit 1`,
    [workspaceId, parentAudienceId],
  ).rows[0]?.exploration_json ?? null;
}

/** The persisted Target Avatar set for a product, or [] if none were ever generated/kept. */
export function listTargetAvatars(workspaceId, productId) {
  const row = getDatabasePool().query(
    `select avatars_json from creative_exploration_target_avatars
     where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  ).rows[0];
  return row ? row.avatars_json : [];
}

/**
 * Replaces the whole persisted Target Avatar set for a product (upsert).
 * Pass generationId from a fresh generation; edits such as per-avatar
 * delete pass null and the existing generation_id is kept.
 */
export function persistTargetAvatars(workspaceId, productId, avatars, generationId = null) {
  const timestamp = new Date().toISOString();
  const existing = getDatabasePool().query(
    `select generation_id from creative_exploration_target_avatars
     where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  ).rows[0];
  getDatabasePool().query(
    `insert into creative_exploration_target_avatars (
       workspace_id, product_id, generation_id, avatars_json, created_at, updated_at
     ) values ($1, $2, $3, $4, $5, $5)
     on conflict (workspace_id, product_id) do update set
       generation_id = excluded.generation_id,
       avatars_json = excluded.avatars_json,
       updated_at = excluded.updated_at
     where creative_exploration_target_avatars.workspace_id = excluded.workspace_id`,
    [
      workspaceId,
      productId,
      generationId ?? existing?.generation_id ?? randomUUID(),
      avatars,
      timestamp,
    ],
  );
  // Ad sets keep their persona id when it leaves the set; the ad set then shows it as removed until it is relinked.
  return avatars;
}

/** The persisted avatar canvas ({ positions, links }) for a product, or null if none saved. */
export function getAvatarCanvas(workspaceId, productId) {
  const row = getDatabasePool().query(
    `select canvas_json from creative_exploration_avatar_canvas
     where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  ).rows[0];
  return row ? row.canvas_json : null;
}

/** Replaces the persisted avatar canvas for a product (upsert). */
export function persistAvatarCanvas(workspaceId, productId, canvas) {
  const timestamp = new Date().toISOString();
  const normalized = {
    positions: canvas?.positions ?? {},
    links: canvas?.links ?? {},
  };
  getDatabasePool().query(
    `insert into creative_exploration_avatar_canvas (
       workspace_id, product_id, canvas_json, created_at, updated_at
     ) values ($1, $2, $3, $4, $4)
     on conflict (workspace_id, product_id) do update set
       canvas_json = excluded.canvas_json,
       updated_at = excluded.updated_at
     where creative_exploration_avatar_canvas.workspace_id = excluded.workspace_id`,
    [workspaceId, productId, normalized, timestamp],
  );
  return normalized;
}

/** Removes the persisted Target Avatar set for a product entirely. */
export function deleteTargetAvatars(workspaceId, productId) {
  const result = getDatabasePool().query(
    `delete from creative_exploration_target_avatars
     where workspace_id = $1 and product_id = $2`,
    [workspaceId, productId],
  );
  return result.rowCount > 0;
}

/** The active (highest-version) saved input template for a Creative Exploration operation, or null if never customized. */
export function getActiveCreativeExplorationPromptVersion(workspaceId, templateId) {
  return getDatabasePool().query(
    `select id, version, content, created_at
     from creative_exploration_prompt_versions
     where workspace_id = $1 and template_id = $2
     order by version desc limit 1`,
    [workspaceId, templateId],
  ).rows[0] ?? null;
}

export function listCreativeExplorationPromptVersions(workspaceId, templateId) {
  return getDatabasePool().query(
    `select id, version, content, created_at
     from creative_exploration_prompt_versions
     where workspace_id = $1 and template_id = $2
     order by version desc`,
    [workspaceId, templateId],
  ).rows;
}

/** Inserts a new version rather than overwriting; earlier versions are kept as history. */
export function saveCreativeExplorationPromptVersion(workspaceId, templateId, content, createdByUserId = null) {
  const nextVersion = getDatabasePool().query(
    `select coalesce(max(version), 0) + 1 as next_version
     from creative_exploration_prompt_versions
     where workspace_id = $1 and template_id = $2`,
    [workspaceId, templateId],
  ).rows[0].next_version;
  const row = {
    id: randomUUID(),
    version: nextVersion,
    content,
    createdAt: new Date().toISOString(),
  };
  getDatabasePool().query(
    `insert into creative_exploration_prompt_versions (
       id, workspace_id, template_id, version, content, created_by_user_id, created_at
     ) values ($1, $2, $3, $4, $5, $6, $7)`,
    [row.id, workspaceId, templateId, row.version, content, createdByUserId, row.createdAt],
  );
  return row;
}
