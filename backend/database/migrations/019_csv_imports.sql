-- Data brought in from CSV files: a Meta Ads Manager export (one row per ad per day) and a Converty "Ad Summary"
-- (one row per ad: the order pipeline behind it). Each row belongs to one PRISM product, which the import works out
-- and, when it cannot, asks the person. Re-importing an overlapping export replaces the same rows instead of
-- doubling them: an ad-day is unique per product, an ad id is unique per product.
create table csv_imports (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  kind text not null,
  file_name text not null,
  currency text,
  date_from text,
  date_to text,
  rows_total integer not null,
  rows_imported integer not null,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  summary_json text,
  created_at text not null
);

create index csv_imports_workspace_idx on csv_imports (workspace_id, created_at);

create table meta_ad_daily (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  ad_name text not null,
  day text not null,
  ad_delivery text,
  spend real not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  link_clicks integer not null default 0,
  clicks_all integer not null default 0,
  landing_page_views integer not null default 0,
  results real not null default 0,
  result_indicator text,
  hook_rate real,
  hold_rate real,
  quality_ranking text,
  engagement_ranking text,
  conversion_ranking text,
  date_created text,
  currency text not null,
  import_id text not null,
  updated_at text not null,
  unique (workspace_id, product_id, ad_name, day),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index meta_ad_daily_product_idx on meta_ad_daily (workspace_id, product_id, day);
create index meta_ad_daily_name_idx on meta_ad_daily (workspace_id, ad_name);

create table converty_ad_summary (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  product_id text not null,
  ad_id text not null,
  ad_name text not null,
  campaign text,
  orders integer not null default 0,
  deleted integer not null default 0,
  confirmed integer not null default 0,
  delivered integer not null default 0,
  returned integer not null default 0,
  delivered_revenue real not null default 0,
  first_order text,
  last_order text,
  statuses_json text,
  currency text not null,
  import_id text not null,
  updated_at text not null,
  unique (workspace_id, product_id, ad_id),
  foreign key (workspace_id, product_id) references products(workspace_id, id) on delete cascade
);

create index converty_ad_summary_product_idx on converty_ad_summary (workspace_id, product_id);
create index converty_ad_summary_name_idx on converty_ad_summary (workspace_id, ad_name);
