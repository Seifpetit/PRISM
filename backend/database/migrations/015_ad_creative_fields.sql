-- An ad is one slot inside an ad set with six dimensions: awareness, direction (the concrete execution idea),
-- format, hook, beats (the bridge from hook to product and offer) and a call to action. awareness, format and
-- hook already existed. beats is a JSON array of strings.
alter table campaign_ads add column direction text;
alter table campaign_ads add column beats text;
alter table campaign_ads add column cta text;
