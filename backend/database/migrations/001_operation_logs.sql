create table if not exists operations (
  id text primary key,
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
  updated_at text not null default CURRENT_TIMESTAMP
);

create table if not exists operation_attempts (
  id text primary key,
  operation_id text not null references operations(id) on delete cascade,
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
  updated_at text not null default CURRENT_TIMESTAMP
);

create table if not exists operation_payloads (
  id text primary key,
  operation_id text not null references operations(id) on delete cascade,
  attempt_id text references operation_attempts(id) on delete cascade,
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
  check (
    (trace_status = 'captured' and (content_json is not null or content_text is not null))
    or (trace_status <> 'captured')
  )
);

create table if not exists operation_costs (
  id text primary key,
  attempt_id text not null references operation_attempts(id) on delete cascade,
  status text not null check (status in ('priced', 'partial', 'unpriced')),
  amount text,
  currency text not null default 'USD',
  raw_usage text,
  normalized_usage text,
  pricing_snapshot text,
  cost_breakdown text,
  unpriced_reason text,
  recorded_at text not null default CURRENT_TIMESTAMP,
  check ((status = 'priced' and amount is not null) or status in ('partial', 'unpriced'))
);

create index if not exists operations_recent_idx on operations (started_at desc);
create index if not exists operations_type_idx on operations (operation_type, started_at desc);
create index if not exists operations_generation_idx on operations (generation_id) where generation_id is not null;
create index if not exists operation_attempts_operation_idx on operation_attempts (operation_id, attempt_number);
create index if not exists operation_attempts_provider_model_idx on operation_attempts (provider, model, started_at desc);
create index if not exists operation_payloads_operation_idx on operation_payloads (operation_id, scope, direction);
create index if not exists operation_payloads_attempt_idx on operation_payloads (attempt_id) where attempt_id is not null;
create index if not exists operation_costs_attempt_idx on operation_costs (attempt_id);
