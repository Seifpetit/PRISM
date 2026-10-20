import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";

export const MAX_ASSIGNED_CAMPAIGNS = 200;

const view = (row) => ({ campaignId: row.campaign_id, name: row.campaign_name, productId: row.product_id });

/** The Meta campaigns assigned to one product, oldest first. */
export function listProductMetaCampaigns(workspaceId, productId) {
  return getDatabasePool()
    .query(
      `select * from product_meta_campaigns where workspace_id = $1 and product_id = $2 order by created_at, campaign_id`,
      [workspaceId, productId],
    )
    .rows.map(view);
}

/** Every assignment in the workspace with its product's name, so a campaign can show which product already has it. */
export function listMetaCampaignAssignments(workspaceId) {
  return getDatabasePool()
    .query(
      `select a.campaign_id, a.campaign_name, a.product_id, p.name as product_name
       from product_meta_campaigns a join products p on p.workspace_id = a.workspace_id and p.id = a.product_id
       where a.workspace_id = $1`,
      [workspaceId],
    )
    .rows.map((row) => ({ campaignId: row.campaign_id, campaignName: row.campaign_name, productId: row.product_id, productName: row.product_name }));
}

/**
 * Replaces the set of Meta campaigns assigned to a product, all or nothing. A campaign already assigned to another
 * product is refused rather than taken over: unassign it there first. The caller has checked the product exists in
 * the workspace.
 */
export function setProductMetaCampaigns(workspaceId, productId, campaigns) {
  if (!Array.isArray(campaigns)) throw new Error("Choose the campaigns to assign.");
  const unique = new Map();
  for (const campaign of campaigns) {
    const id = typeof campaign?.id === "string" ? campaign.id.trim() : "";
    const name = typeof campaign?.name === "string" ? campaign.name.trim() : "";
    if (!id || id.length > 40) throw new Error("A campaign is missing its Meta id.");
    if (!name) throw new Error("A campaign is missing its name.");
    unique.set(id, name.slice(0, 200));
  }
  if (unique.size > MAX_ASSIGNED_CAMPAIGNS) throw new Error(`Assign at most ${MAX_ASSIGNED_CAMPAIGNS} campaigns to a product.`);

  const db = getDatabasePool();
  const taken = listMetaCampaignAssignments(workspaceId).filter((row) => row.productId !== productId && unique.has(row.campaignId));
  if (taken.length) {
    const first = taken[0];
    throw new Error(`"${unique.get(first.campaignId)}" is already assigned to ${first.productName}. Unassign it there first.`);
  }

  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.query(`delete from product_meta_campaigns where workspace_id = $1 and product_id = $2`, [workspaceId, productId]);
    for (const [campaignId, name] of unique) {
      db.query(
        `insert into product_meta_campaigns (id, workspace_id, product_id, campaign_id, campaign_name, created_at) values ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), workspaceId, productId, campaignId, name, now],
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return listProductMetaCampaigns(workspaceId, productId);
}
