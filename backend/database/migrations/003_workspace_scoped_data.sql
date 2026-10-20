alter table operation_costs rename to legacy_unscoped_operation_costs;
alter table operation_payloads rename to legacy_unscoped_operation_payloads;
alter table operation_attempts rename to legacy_unscoped_operation_attempts;
alter table operations rename to legacy_unscoped_operations;

create table products (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  brand_id text not null,
  name text not null,
  description text not null,
  context_id text,
  created_at text not null,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id)
);

create table product_sources (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text,
  source_type text not null,
  label text not null,
  status text not null,
  source_json text not null,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id)
);

create table product_contexts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  context_json text not null,
  created_at text not null,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id)
);

create table strategy_nodes (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  parent_id text,
  node_type text not null,
  label text not null,
  position_x real,
  position_y real,
  node_json text not null,
  created_at text not null,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade,
  foreign key (workspace_id, parent_id) references strategy_nodes(workspace_id, id)
);

create table strategy_edges (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  source_node_id text not null,
  target_node_id text not null,
  edge_type text not null default 'lineage',
  edge_json text not null default '{}',
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade,
  foreign key (workspace_id, source_node_id) references strategy_nodes(workspace_id, id),
  foreign key (workspace_id, target_node_id) references strategy_nodes(workspace_id, id)
);

create table audience_explorations (
  generation_id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  exploration_json text not null,
  created_at text not null,
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create table operations (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  operation_type text not null,
  status text not null check (status in ('running', 'success', 'error', 'cancelled', 'untraced')),
  started_at text not null,
  completed_at text,
  product_id text,
  strategy_node_id text,
  creative_id text,
  generation_id text,
  error_stage text,
  error_code text,
  error_message text,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id)
);

create table operation_attempts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  operation_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  cost_source text not null default 'ai',
  provider text,
  service text,
  model text,
  status text not null check (status in ('running', 'success', 'error', 'cancelled', 'untraced')),
  started_at text not null,
  completed_at text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  provider_request_id text,
  request_options text,
  error_stage text,
  error_code text,
  error_message text,
  flags text not null default '[]',
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, operation_id) references operations(workspace_id, id) on delete cascade
);

create table operation_payloads (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  operation_id text not null,
  attempt_id text,
  scope text not null check (scope in ('operation', 'attempt')),
  direction text not null check (direction in ('input', 'output')),
  representation text not null check (representation in ('normalized', 'raw', 'reference')),
  trace_status text not null check (trace_status in ('captured', 'untraced', 'redacted', 'blocked')),
  content_json text,
  content_text text,
  mime_type text,
  schema_version text,
  redaction_status text not null check (redaction_status in ('not_required', 'redacted', 'blocked')),
  byte_size integer check (byte_size is null or byte_size >= 0),
  content_hash text,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, operation_id) references operations(workspace_id, id) on delete cascade,
  foreign key (workspace_id, attempt_id) references operation_attempts(workspace_id, id),
  check (
    (trace_status = 'captured' and (content_json is not null or content_text is not null))
    or trace_status <> 'captured'
  )
);

create table operation_costs (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  attempt_id text not null,
  status text not null check (status in ('priced', 'partial', 'unpriced')),
  amount text,
  currency text not null default 'USD',
  raw_usage text,
  normalized_usage text,
  pricing_snapshot text,
  cost_breakdown text,
  unpriced_reason text,
  recorded_at text not null default CURRENT_TIMESTAMP,
  unique (workspace_id, id),
  foreign key (workspace_id, attempt_id)
    references operation_attempts(workspace_id, id) on delete cascade,
  check ((status = 'priced' and amount is not null) or status in ('partial', 'unpriced'))
);

create index products_workspace_idx on products (workspace_id, created_at desc);
create index product_sources_workspace_idx on product_sources (workspace_id, product_id);
create index strategy_nodes_product_idx on strategy_nodes (workspace_id, product_id);
create index strategy_edges_product_idx on strategy_edges (workspace_id, product_id);
create index audience_explorations_product_idx
  on audience_explorations (workspace_id, product_id, created_at desc);
create index scoped_operations_recent_idx on operations (workspace_id, started_at desc);
create index scoped_attempts_operation_idx
  on operation_attempts (workspace_id, operation_id, attempt_number);
create index scoped_payloads_operation_idx
  on operation_payloads (workspace_id, operation_id, scope, direction);
create index scoped_costs_attempt_idx on operation_costs (workspace_id, attempt_id);
