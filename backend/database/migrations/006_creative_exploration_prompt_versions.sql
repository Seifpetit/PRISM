-- Editable, versioned input templates for Creative Exploration AI operations
-- (e.g. angle generation). Every save inserts a new version rather than
-- overwriting one; the highest version per (workspace_id, template_id) is
-- the active template used on the next run. Earlier versions are kept for
-- future surfacing in the UI and are never deleted here.
create table creative_exploration_prompt_versions (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  template_id text not null,
  version integer not null,
  content text not null,
  created_by_user_id text references users(id) on delete set null,
  created_at text not null,
  unique (workspace_id, template_id, version)
);

create index creative_exploration_prompt_versions_active_idx
  on creative_exploration_prompt_versions (workspace_id, template_id, version desc);
