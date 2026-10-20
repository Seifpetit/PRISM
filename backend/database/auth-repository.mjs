import { randomBytes, randomUUID } from "node:crypto";
import { getDatabasePool, withDatabaseTransaction } from "./client.mjs";
import { runDatabaseMigrations } from "./migrate.mjs";

const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function cleanEmail(email) {
  return email.trim().toLowerCase();
}

function sessionToken() {
  return randomBytes(32).toString("hex");
}

function sessionView(row, token) {
  if (!row) return null;
  return {
    token,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      role: row.role,
    },
  };
}

function findSession(client, token) {
  return client.query(
    `
    select
      s.user_id,
      s.workspace_id,
      s.expires_at,
      u.email,
      u.display_name,
      w.name as workspace_name,
      wm.role
    from sessions s
    join users u on u.id = s.user_id
    join workspaces w on w.id = s.workspace_id
    join workspace_members wm
      on wm.workspace_id = s.workspace_id and wm.user_id = s.user_id
    where s.token = $1 and s.revoked_at is null and s.expires_at > $2
  `,
    [token, new Date().toISOString()],
  ).rows[0];
}

export async function signInWithoutPassword({ displayName, email }) {
  await runDatabaseMigrations();
  const normalizedEmail = cleanEmail(email);
  const normalizedName = displayName.trim();
  if (!normalizedEmail || !normalizedName) throw new Error("Name and email are required.");

  return withDatabaseTransaction(async (client) => {
    let user = client.query("select * from users where email = $1", [normalizedEmail]).rows[0];
    if (!user) {
      user = { id: randomUUID(), email: normalizedEmail, display_name: normalizedName };
      client.query(
        "insert into users (id, email, display_name) values ($1, $2, $3)",
        [user.id, user.email, user.display_name],
      );
    } else if (user.display_name !== normalizedName) {
      client.query(
        "update users set display_name = $2, updated_at = now() where id = $1",
        [user.id, normalizedName],
      );
      user.display_name = normalizedName;
    }

    let membership = client.query(
      `
      select wm.workspace_id, wm.role, w.name as workspace_name
      from workspace_members wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = $1
      order by case wm.role when 'admin' then 0 else 1 end, wm.created_at
      limit 1
    `,
      [user.id],
    ).rows[0];

    if (!membership) {
      const workspaceId = randomUUID();
      const workspaceName = `${normalizedName}'s workspace`;
      client.query(
        "insert into workspaces (id, name, created_by_user_id) values ($1, $2, $3)",
        [workspaceId, workspaceName, user.id],
      );
      client.query(
        `insert into workspace_members (workspace_id, user_id, role)
         values ($1, $2, 'admin')`,
        [workspaceId, user.id],
      );
      membership = { workspace_id: workspaceId, role: "admin", workspace_name: workspaceName };
    }

    const token = sessionToken();
    const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();
    client.query(
      `insert into sessions (id, token, user_id, workspace_id, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), token, user.id, membership.workspace_id, expiresAt],
    );
    return {
      token,
      expiresAt,
      user: { id: user.id, email: user.email, displayName: user.display_name },
      workspace: {
        id: membership.workspace_id,
        name: membership.workspace_name,
        role: membership.role,
      },
    };
  });
}

export async function getSessionByToken(token) {
  if (!token) return null;
  await runDatabaseMigrations();
  const client = getDatabasePool();
  const row = findSession(client, token);
  if (!row) return null;
  client.query("update sessions set last_seen_at = now() where token = $1", [token]);
  return sessionView(row, token);
}

export async function revokeSession(token) {
  if (!token) return false;
  await runDatabaseMigrations();
  const result = getDatabasePool().query(
    "update sessions set revoked_at = now() where token = $1 and revoked_at is null",
    [token],
  );
  return result.rowCount > 0;
}

export async function listWorkspaceMembers(session) {
  const rows = getDatabasePool().query(
    `
    select u.id, u.email, u.display_name, wm.role, wm.created_at
    from workspace_members wm
    join users u on u.id = wm.user_id
    where wm.workspace_id = $1
    order by case wm.role when 'admin' then 0 else 1 end, u.display_name
  `,
    [session.workspace.id],
  ).rows;
  return rows.map((row) => ({
    user: { id: row.id, email: row.email, displayName: row.display_name },
    role: row.role,
    createdAt: row.created_at,
  }));
}

export async function addWorkspaceMember(session, { displayName, email, role }) {
  if (session.workspace.role !== "admin") throw new Error("Admin access is required.");
  const normalizedEmail = cleanEmail(email);
  const normalizedName = displayName.trim();
  if (!normalizedEmail || !normalizedName) throw new Error("Name and email are required.");

  return withDatabaseTransaction(async (client) => {
    let user = client.query("select * from users where email = $1", [normalizedEmail]).rows[0];
    if (!user) {
      user = { id: randomUUID(), email: normalizedEmail, display_name: normalizedName };
      client.query(
        "insert into users (id, email, display_name) values ($1, $2, $3)",
        [user.id, user.email, user.display_name],
      );
    }
    client.query(
      `insert into workspace_members (workspace_id, user_id, role)
       values ($1, $2, $3)
       on conflict (workspace_id, user_id) do update set
         role = excluded.role, updated_at = now()`,
      [session.workspace.id, user.id, role],
    );
    return {
      user: { id: user.id, email: user.email, displayName: user.display_name },
      role,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function switchSessionWorkspace(session, workspaceId) {
  const client = getDatabasePool();
  const membership = client.query(
    `select wm.role, w.name
     from workspace_members wm
     join workspaces w on w.id = wm.workspace_id
     where wm.user_id = $1 and wm.workspace_id = $2`,
    [session.user.id, workspaceId],
  ).rows[0];
  if (!membership) throw new Error("Workspace membership not found.");
  client.query("update sessions set workspace_id = $2 where token = $1", [
    session.token,
    workspaceId,
  ]);
  return {
    ...session,
    workspace: { id: workspaceId, name: membership.name, role: membership.role },
  };
}
