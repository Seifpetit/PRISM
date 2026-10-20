import { getDatabasePool } from "./client.mjs";

// The portraits behind Target Avatars. Every read and write is scoped by the workspace.

const now = () => new Date().toISOString();

/** Which avatars of a product have a portrait, and how far along it is. Never returns the pictures themselves. */
export function listAvatarImageStatuses(workspaceId, productId) {
  return getDatabasePool()
    .query(
      `select avatar_id, status, updated_at from target_avatar_images
       where workspace_id = $1 and product_id = $2`,
      [workspaceId, productId],
    )
    .rows.map((row) => ({ avatarId: row.avatar_id, status: row.status, updatedAt: row.updated_at }));
}

/** One avatar's portrait as a data URL, or null when it has none (yet). */
export function getAvatarImageUrl(workspaceId, avatarId) {
  const row = getDatabasePool().query(
    `select image_url from target_avatar_images
     where workspace_id = $1 and avatar_id = $2 and status = 'ready'`,
    [workspaceId, avatarId],
  ).rows[0];
  return row?.image_url ?? null;
}

/** Marks an avatar's portrait as requested. Replaces a failed or stuck attempt; never touches a ready one. */
export function markAvatarImagePending(workspaceId, productId, avatarId) {
  getDatabasePool().query(
    `insert into target_avatar_images (avatar_id, workspace_id, product_id, status, image_url, error, created_at, updated_at)
     values ($1, $2, $3, 'pending', null, null, $4, $4)
     on conflict (avatar_id) do update set
       status = 'pending', error = null, updated_at = excluded.updated_at
     where target_avatar_images.workspace_id = excluded.workspace_id and target_avatar_images.status <> 'ready'`,
    [avatarId, workspaceId, productId, now()],
  );
}

/** Records the outcome. Updates only: an avatar deleted while its portrait was being made stays gone. */
export function finishAvatarImage(workspaceId, avatarId, { imageUrl = null, error = null }) {
  getDatabasePool().query(
    `update target_avatar_images
     set status = $3, image_url = $4, error = $5, updated_at = $6
     where workspace_id = $1 and avatar_id = $2`,
    [workspaceId, avatarId, imageUrl ? "ready" : "failed", imageUrl, error, now()],
  );
}

/** Removes portraits: the given avatars', or every one of the product's when no ids are given. */
export function deleteAvatarImages(workspaceId, productId, avatarIds = null) {
  const database = getDatabasePool();
  if (!avatarIds) {
    database.query(`delete from target_avatar_images where workspace_id = $1 and product_id = $2`, [workspaceId, productId]);
    return;
  }
  for (const avatarId of avatarIds) {
    database.query(`delete from target_avatar_images where workspace_id = $1 and avatar_id = $2`, [workspaceId, avatarId]);
  }
}
