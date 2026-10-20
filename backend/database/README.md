# Prism operation database

SQLite stores logical operations, provider attempts, sanitized payloads, and exact costs in a local
database file. No database service, port, or password is required.

## Configure

The default database location is `data/prism.db`. To use another local path, add this to `.env`:

```env
DATABASE_PATH=data/prism.db
```

The database file, write-ahead log, and shared-memory sidecar are ignored by Git.

## Create, migrate, and import

```powershell
npm.cmd run db:create
npm.cmd run db:migrate
```

`db:create` creates the SQLite file and applies outstanding migrations.

Historical JSONL rows have no truthful workspace owner, so migration `003` does not assign them to
an account. The old database tables are preserved as `legacy_unscoped_*`, and the old file is kept
at `data/legacy-unscoped-ai-cost-ledger.jsonl`. An intentional import requires
`PRISM_IMPORT_WORKSPACE_ID`; without it, `db:import-cost-ledger` refuses to assign the rows.

## Runtime behavior

New canonical AI calls persist sanitized inputs, provider responses, duration, errors, retries, and
costs to SQLite with the authenticated workspace ID. Cost rows also append a workspace-tagged JSONL
record as a reconciliation fallback. Fallback reads remain constrained to the active workspace.

The existing `costLedger(limit:)` and `operationLogs(limit:)` GraphQL contracts are unchanged.

## Identity and sessions

Migration `002_identity_and_sessions.sql` adds persisted `users`, `workspaces`,
`workspace_members`, and `sessions` tables. Workspace membership roles are deliberately limited to
`visitor` and `admin`.

The current development flow is passwordless. `signInWithoutPassword` finds or creates a user,
creates a personal workspace with an admin membership when needed, and returns an opaque 30-day
session token. The browser stores only that token and restores the user, workspace, and role from
the backend. `signOut` revokes the database session.

This is scaffolding, not production authentication. Email ownership is not verified and the token
is stored in browser local storage. Add verified credentials and hardened cookie/session handling
before exposing the application to untrusted users.

## Workspace data and workflow maps

Migration `003_workspace_scoped_data.sql` requires `workspace_id` on products, product sources,
product contexts, strategy nodes, strategy edges, audience explorations, operations, attempts,
payloads, and costs. GraphQL resolvers derive this value from the authenticated session rather than
accepting it from client input.

Products and complete strategy graphs are loaded from SQLite when the frontend restores a session.
Generated nodes and lineage edges are persisted at creation time. Non-product node coordinates are
saved on drag-stop and restored on reload.

## Integration connections

Migration `010_integration_connections.sql` adds `integration_connections`: one row per
(workspace, provider, external account), e.g. a workspace's Shopify store. Access tokens are stored
AES-256-GCM encrypted (`token-crypto.mjs`) using `INTEGRATION_ENCRYPTION_KEY`, because the database
file is committed. Saving a token without that key set is refused. Use `getIntegrationConnection`
for metadata; `getIntegrationCredentials` returns the decrypted token and is for server-side
provider calls only.
