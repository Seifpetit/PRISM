import { randomUUID } from "node:crypto";
import { getDatabasePool } from "./client.mjs";
import { decryptToken, encryptToken } from "./token-crypto.mjs";

function publicConnection(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    externalAccountId: row.external_account_id,
    label: row.label,
    scopes: row.scopes,
    expiresAt: row.expires_at ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Insert or refresh a workspace's connection to one provider account. Reconnecting overwrites the token. */
export function saveIntegrationConnection(
  workspaceId,
  { provider, externalAccountId, label = null, accessToken, scopes = "", expiresAt = null },
) {
  if (!provider || !externalAccountId || !accessToken) {
    throw new Error("provider, externalAccountId and accessToken are required.");
  }
  const now = new Date().toISOString();
  const database = getDatabasePool();
  database.query(
    `insert into integration_connections
       (id, workspace_id, provider, external_account_id, label, access_token_encrypted, scopes, expires_at, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $9, 'connected', $8, $8)
     on conflict (workspace_id, provider, external_account_id) do update set
       label = excluded.label,
       access_token_encrypted = excluded.access_token_encrypted,
       scopes = excluded.scopes,
       expires_at = excluded.expires_at,
       status = 'connected',
       updated_at = excluded.updated_at`,
    [randomUUID(), workspaceId, provider, externalAccountId, label, encryptToken(accessToken), scopes, now, expiresAt],
  );
  return getIntegrationConnection(workspaceId, provider, { externalAccountId });
}

function latestRow(workspaceId, provider, externalAccountId) {
  const scoped = externalAccountId ? " and external_account_id = $3" : "";
  return getDatabasePool().query(
    `select * from integration_connections
     where workspace_id = $1 and provider = $2${scoped}
     order by updated_at desc limit 1`,
    externalAccountId ? [workspaceId, provider, externalAccountId] : [workspaceId, provider],
  ).rows[0];
}

/** Connection metadata only — never includes the token. */
export function getIntegrationConnection(workspaceId, provider, { externalAccountId } = {}) {
  const row = latestRow(workspaceId, provider, externalAccountId);
  return row ? publicConnection(row) : null;
}

/** Connection metadata plus the decrypted token, for server-side API calls only. Never return this to a client. */
export function getIntegrationCredentials(workspaceId, provider, { externalAccountId } = {}) {
  const row = latestRow(workspaceId, provider, externalAccountId);
  if (!row) return null;
  return { ...publicConnection(row), accessToken: decryptToken(row.access_token_encrypted) };
}

export function listIntegrationConnections(workspaceId, provider) {
  const rows = provider
    ? getDatabasePool().query(
        `select * from integration_connections where workspace_id = $1 and provider = $2 order by updated_at desc`,
        [workspaceId, provider],
      ).rows
    : getDatabasePool().query(
        `select * from integration_connections where workspace_id = $1 order by updated_at desc`,
        [workspaceId],
      ).rows;
  return rows.map(publicConnection);
}

export function deleteIntegrationConnection(workspaceId, provider, externalAccountId) {
  return (
    getDatabasePool().query(
      `delete from integration_connections where workspace_id = $1 and provider = $2 and external_account_id = $3`,
      [workspaceId, provider, externalAccountId],
    ).rowCount > 0
  );
}
