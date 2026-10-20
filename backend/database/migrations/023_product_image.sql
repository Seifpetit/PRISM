-- The product's own photo, captured once at product creation (the same preview shown during "Bring the
-- product in") and never touched again. It is stored as the external URL that was already being shown on
-- screen during onboarding, not downloaded — the same trust already placed in that URL to render there.
alter table products add column image_url text;
