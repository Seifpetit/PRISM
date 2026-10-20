-- Freeform development feedback. Deliberately NOT scoped to any workspace or
-- user: this is a shared dev-notes box, not per-account data, so it carries
-- no workspace_id/user_id column and no foreign keys.
create table user_notes (
  id text primary key,
  note text not null,
  created_at text not null
);

create index user_notes_created_at_idx on user_notes (created_at desc);
