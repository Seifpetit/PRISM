-- Persisted Target Avatars for Creative Exploration.
-- One row per (workspace_id, product_id): regenerating replaces the row,
-- and per-avatar delete / reset rewrites the stored list. Avatars are
-- generated together as a set, so the whole list is kept as one JSON
-- document rather than a row per avatar.
create table creative_exploration_target_avatars (
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  generation_id text not null,
  avatars_json text not null,
  created_at text not null,
  updated_at text,
  primary key (workspace_id, product_id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);
