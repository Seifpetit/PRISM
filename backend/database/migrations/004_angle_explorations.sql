create table angle_explorations (
  generation_id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  parent_audience_id text not null,
  exploration_json text not null,
  created_at text not null,
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade,
  foreign key (workspace_id, parent_audience_id) references strategy_nodes(workspace_id, id) on delete cascade
);

create index angle_explorations_parent_idx
  on angle_explorations (workspace_id, parent_audience_id, created_at desc);
