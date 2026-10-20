-- The Context Library: material a person adds to a product so a generator knows more than the confirmed Product
-- Context does (customer interviews, sales-objection CSVs, a market-research PDF, their own notes). A source is
-- uploaded once, belongs to one product, and is selected per generation; nothing here is sent to a model unless it is
-- selected. The text is extracted when the source is added and stored here, so a generation never depends on what the
-- browser says a file contains. `version` goes up whenever the content changes, so a generation can name exactly what it
-- read; `content_hash` is the hash of that content.
create table context_sources (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  name text not null,
  kind text not null check (kind in ('pdf', 'text', 'csv', 'note')),
  status text not null check (status in ('processing', 'ready', 'failed')),
  status_detail text,
  file_name text,
  mime_type text,
  size_bytes integer,
  market text,
  content_hash text,
  version integer not null default 1,
  content_text text,
  structure_json text,
  created_at text not null,
  updated_at text not null,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index context_sources_product_idx on context_sources (workspace_id, product_id, created_at);

-- Why a generation came out as it did: which template version, which sources at which versions, and what the person
-- asked for that run. Keyed by the generation id that the avatars / angles / offers themselves carry. The sources are
-- copied by name and version, so the record stays readable after a source is renamed, edited or deleted.
create table generation_context_runs (
  generation_id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  generator text not null,
  template_id text not null,
  template_version integer not null,
  run_instructions text,
  sources_json text not null,
  context_chars integer not null default 0,
  created_at text not null,
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index generation_context_runs_product_idx on generation_context_runs (workspace_id, product_id, created_at);
