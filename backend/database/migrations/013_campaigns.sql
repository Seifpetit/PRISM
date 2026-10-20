-- Creative Exploration test campaigns.
--
-- Model (docs/creative-strategy/framework.md): a CONCEPT is persona x angle x offer, and one concept is
-- one Meta ad set. A campaign is a test plan for a product; its concepts are its ad sets; each concept
-- holds ad slots (ads) that vary format / awareness stage / hook inside that one idea.
--
-- The angle and the offer are strategy nodes, so deleting either removes the concepts built on it. The
-- persona (target avatar) lives in a JSON document (creative_exploration_target_avatars), so it cannot
-- be a foreign key; the repository prunes concepts when their avatar is removed.
create table campaigns (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  name text not null,
  -- What this campaign varies, in the framework's priority order: angle first, then offer, then persona.
  test_type text not null default 'angle' check (test_type in ('angle', 'offer', 'persona')),
  position_x real,
  position_y real,
  created_at text not null,
  updated_at text not null,
  unique (workspace_id, id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index campaigns_product_idx on campaigns (workspace_id, product_id, created_at);

create table campaign_concepts (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  campaign_id text not null,
  product_id text not null,
  avatar_id text not null,
  angle_id text not null,
  offer_id text not null,
  -- When this ad set ran and what it spent (typed for now; synced from Meta later).
  start_date text,
  end_date text,
  spend real,
  position_x real,
  position_y real,
  created_at text not null,
  updated_at text not null,
  -- The same persona x angle x offer twice in one campaign would only compete with itself.
  unique (campaign_id, avatar_id, angle_id, offer_id),
  unique (workspace_id, id),
  foreign key (workspace_id, campaign_id) references campaigns(workspace_id, id) on delete cascade,
  foreign key (workspace_id, angle_id) references strategy_nodes(workspace_id, id) on delete cascade,
  foreign key (workspace_id, offer_id) references strategy_nodes(workspace_id, id) on delete cascade
);

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
  unique (workspace_id, id),
  foreign key (workspace_id, concept_id) references campaign_concepts(workspace_id, id) on delete cascade
);

create index campaign_ads_concept_idx on campaign_ads (workspace_id, concept_id, ord);
