-- A generated portrait for each Target Avatar (backend/creative-exploration/avatar-images.mjs). Kept apart from the
-- avatar set itself (creative_exploration_target_avatars.avatars_json) so listing avatars never carries pictures.
-- status is pending (requested, not back yet), ready or failed. A failed or missing portrait never blocks the
-- avatar from existing; the app falls back to a stock photo, then to the persona's initials.
create table if not exists target_avatar_images (
  avatar_id text primary key,
  workspace_id text not null,
  product_id text not null,
  status text not null default 'pending',
  image_url text,
  error text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create index if not exists target_avatar_images_product
  on target_avatar_images (workspace_id, product_id);
