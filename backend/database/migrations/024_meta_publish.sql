-- Publishing a PRISM ad set to Meta (backend/integrations/meta-ads-write.mjs, backend/integrations/meta-publish.mjs).
-- A campaign becomes a Meta Campaign the first time any of its ad sets is published; a concept (ad set, migration
-- 013) becomes a Meta Ad Set; each ad becomes a Meta Ad Creative + Ad. Everything Meta-side is created PAUSED, so
-- publishing never turns on real spend by itself.
alter table campaigns add column meta_campaign_id text;

alter table campaign_concepts add column meta_adset_id text;
alter table campaign_concepts add column meta_page_id text;
alter table campaign_concepts add column meta_destination_url text;
alter table campaign_concepts add column meta_daily_budget_cents integer;

-- none (never published), published, or failed. A failed publish never blocks the ad itself from existing.
alter table campaign_ads add column meta_publish_status text not null default 'none';
alter table campaign_ads add column meta_creative_id text;
alter table campaign_ads add column meta_ad_id text;
alter table campaign_ads add column meta_publish_error text;
