-- An ad set used to be deleted, with its ads, when its angle or offer was deleted (on delete cascade). It now
-- survives: the id stays where it was, no longer points at anything, and the ad set shows that ingredient as
-- removed until another one is linked. SQLite cannot drop a foreign key, so campaign_concepts is rebuilt without
-- the two strategy_nodes keys. campaign_ads references it, so the ads are copied aside and put back after; they must
-- not be dropped with the old table's cascade.
create table campaign_ads_keep as select * from campaign_ads;
drop table campaign_ads;

create table campaign_concepts_new (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  campaign_id text not null,
  product_id text not null,
  avatar_id text not null,
  angle_id text not null,
  offer_id text not null,
  start_date text,
  end_date text,
  spend real,
  position_x real,
  position_y real,
  created_at text not null,
  updated_at text not null,
  unique (campaign_id, avatar_id, angle_id, offer_id),
  unique (workspace_id, id),
  foreign key (workspace_id, campaign_id) references campaigns(workspace_id, id) on delete cascade
);

insert into campaign_concepts_new (
  id, workspace_id, campaign_id, product_id, avatar_id, angle_id, offer_id,
  start_date, end_date, spend, position_x, position_y, created_at, updated_at
)
select
  id, workspace_id, campaign_id, product_id, avatar_id, angle_id, offer_id,
  start_date, end_date, spend, position_x, position_y, created_at, updated_at
from campaign_concepts;

drop table campaign_concepts;
alter table campaign_concepts_new rename to campaign_concepts;

create index campaign_concepts_campaign_idx on campaign_concepts (workspace_id, campaign_id, created_at);
create index campaign_concepts_avatar_idx on campaign_concepts (workspace_id, product_id, avatar_id);

create table campaign_ads (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  concept_id text not null,
  ord integer not null default 0,
  format text not null,
  awareness text not null,
  hook text,
  notes text,
  created_at text not null,
  updated_at text not null,
  direction text,
  beats text,
  cta text,
  unique (workspace_id, id),
  foreign key (workspace_id, concept_id) references campaign_concepts(workspace_id, id) on delete cascade
);

insert into campaign_ads (
  id, workspace_id, concept_id, ord, format, awareness, hook, notes, created_at, updated_at, direction, beats, cta
)
select
  id, workspace_id, concept_id, ord, format, awareness, hook, notes, created_at, updated_at, direction, beats, cta
from campaign_ads_keep;

drop table campaign_ads_keep;
create index campaign_ads_concept_idx on campaign_ads (workspace_id, concept_id, ord);
