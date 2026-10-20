create table if not exists users (
  id text primary key,
  email text not null unique collate nocase,
  display_name text not null,
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP
);

create table if not exists workspaces (
  id text primary key,
  name text not null,
  created_by_user_id text not null references users(id),
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null check (role in ('visitor', 'admin')),
  created_at text not null default CURRENT_TIMESTAMP,
  updated_at text not null default CURRENT_TIMESTAMP,
  primary key (workspace_id, user_id)
);

create table if not exists sessions (
  id text primary key,
  token text not null unique,
  user_id text not null references users(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  created_at text not null default CURRENT_TIMESTAMP,
  expires_at text not null,
  last_seen_at text not null default CURRENT_TIMESTAMP,
  revoked_at text
);

create index if not exists workspace_members_user_idx
  on workspace_members (user_id, workspace_id);
create index if not exists sessions_token_idx on sessions (token);
create index if not exists sessions_user_idx on sessions (user_id, expires_at desc);
