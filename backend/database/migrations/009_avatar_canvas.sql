-- Persisted Creative Exploration avatar canvas: where each Target Avatar sits
-- on the map and which Angles it is linked to (many-to-many). One row per
-- (workspace_id, product_id); the whole {positions, links} document is
-- rewritten on any placement, move, link, or unlink.
create table creative_exploration_avatar_canvas (
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  canvas_json text not null,
  created_at text not null,
  updated_at text,
  primary key (workspace_id, product_id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);
