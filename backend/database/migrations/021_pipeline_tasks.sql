-- The production pipeline: one task per piece of creative work that comes out of a Prism ad. An ad is the plan
-- (awareness, direction, format, hook, bridge, call to action); a task is the work of turning it into a finished asset,
-- and it moves across the pipeline's stages on a board. One ad can have several tasks (a 9:16 cut, a 1:1 adaptation, a
-- French version): they share the ad but progress on their own, told apart by `variant`.
--
-- ad_id points at campaign_ads but is deliberately not a foreign key: deleting an ad must not silently delete work that
-- is already under way. The task keeps a snapshot of what the ad was (title, format, awareness, hook, reference) and is
-- shown as "ad removed" when the ad is gone.
create table pipeline_tasks (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  ad_id text not null,
  concept_id text,
  ad_ref text,
  title text not null,
  format text not null,
  awareness text,
  hook text,
  variant text,
  stage text not null check (stage in ('planned', 'script_brief', 'approved', 'in_production', 'in_editing', 'in_review', 'ready_to_launch', 'launched')),
  checklist_json text not null,
  notes text,
  meta_ad_ref text,
  sort_order real not null default 0,
  created_at text not null,
  updated_at text not null,
  stage_changed_at text not null,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index pipeline_tasks_board_idx on pipeline_tasks (workspace_id, product_id, stage, sort_order);
create index pipeline_tasks_ad_idx on pipeline_tasks (workspace_id, ad_id);
