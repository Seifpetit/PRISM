create table lineage_history (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  event_type text not null check (event_type in ('subtree_deleted')),
  summary text not null,
  event_json text not null,
  created_at text not null default CURRENT_TIMESTAMP
);
create index lineage_history_product_idx on lineage_history (workspace_id, product_id, created_at desc);
