-- A cover image for one ad, generated alongside its plan (backend/creative-exploration/ad-thumbnails.mjs).
-- status starts "none" (nothing requested yet, e.g. a hand-planned ad), moves to "ready" or "failed" once the
-- image call for that ad settles. A failed or missing image never blocks the ad itself from existing.
alter table campaign_ads add column image_status text not null default 'none';
alter table campaign_ads add column image_url text;
