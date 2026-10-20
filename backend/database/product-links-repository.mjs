import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";

function linkView(row) {
  return {
    productId: row.product_id,
    provider: row.provider,
    storeDomain: row.external_account_id,
    externalId: row.external_id,
    title: row.external_title,
    linkedAt: row.updated_at,
  };
}

/** Links (or re-links) a PRISM product to an external product. The PRISM product must belong to the workspace. */
export function saveProductLink(
  workspaceId,
  { productId, provider, externalAccountId, externalId, externalTitle },
) {
  const now = new Date().toISOString();
  getDatabasePool().query(
    `insert into product_external_links
       (id, workspace_id, product_id, provider, external_account_id, external_id, external_title, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     on conflict (workspace_id, product_id, provider) do update set
       external_account_id = excluded.external_account_id,
       external_id = excluded.external_id,
       external_title = excluded.external_title,
       updated_at = excluded.updated_at`,
    [randomUUID(), workspaceId, productId, provider, externalAccountId, externalId, externalTitle, now],
  );
  return getProductLink(workspaceId, productId, provider);
}

export function getProductLink(workspaceId, productId, provider) {
  const row = getDatabasePool().query(
    `select * from product_external_links where workspace_id = $1 and product_id = $2 and provider = $3`,
    [workspaceId, productId, provider],
  ).rows[0];
  return row ? linkView(row) : null;
}

export function deleteProductLink(workspaceId, productId, provider) {
  return (
    getDatabasePool().query(
      `delete from product_external_links where workspace_id = $1 and product_id = $2 and provider = $3`,
      [workspaceId, productId, provider],
    ).rowCount > 0
  );
}
