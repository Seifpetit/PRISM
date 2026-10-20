-- A short name for the idea an ad expresses ("The Electricity Bill Mystery"), so cards can lead with it and
-- sibling ads that share an idea can be told apart from ads that do not.
alter table campaign_ads add column title text;
