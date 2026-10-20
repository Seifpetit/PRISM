-- Per-workspace connections to external providers (Shopify first). Replaces the
-- single global env token: each workspace owns its own connection(s), so one
-- workspace can never read another's store. A workspace may connect several
-- accounts for the same provider (e.g. one Shopify store per brand); the
-- unique key is (workspace, provider, external account).
--
-- access_token is stored encrypted (AES-256-GCM, see token-crypto.mjs) because
-- data/prism.db is committed to Git. Never write a plaintext token here.
create table integration_connections (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  provider text not null,
  external_account_id text not null,
  label text,
  access_token_encrypted text not null,
  scopes text not null default '',
  status text not null default 'connected',
  created_at text not null,
  updated_at text not null,
  unique (workspace_id, provider, external_account_id)
);

create index integration_connections_workspace_provider_idx
  on integration_connections (workspace_id, provider, updated_at desc);
