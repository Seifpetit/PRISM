import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("passwordless sign-in persists an admin membership and revocable session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-auth-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");

  try {
    const signedIn = await auth.signInWithoutPassword({
      displayName: "Prism Admin",
      email: "ADMIN@example.com",
    });
    assert.equal(signedIn.user.email, "admin@example.com");
    assert.equal(signedIn.workspace.role, "admin");
    assert.equal((await auth.getSessionByToken(signedIn.token))?.user.id, signedIn.user.id);

    const database = client.getDatabasePool();
    assert.equal(database.query("select count(*) as count from users").rows[0].count, 1);
    assert.equal(database.query("select role from workspace_members").rows[0].role, "admin");

    const visitor = await auth.addWorkspaceMember(signedIn, {
      displayName: "Prism Visitor",
      email: "visitor@example.com",
      role: "visitor",
    });
    assert.equal(visitor.role, "visitor");
    const visitorSession = await auth.signInWithoutPassword({
      displayName: "Prism Visitor",
      email: "visitor@example.com",
    });
    assert.equal(visitorSession.workspace.id, signedIn.workspace.id);
    assert.equal(visitorSession.workspace.role, "visitor");
    await assert.rejects(
      auth.addWorkspaceMember(visitorSession, {
        displayName: "Not Allowed",
        email: "blocked@example.com",
        role: "admin",
      }),
      /Admin access is required/,
    );

    assert.equal(await auth.revokeSession(signedIn.token), true);
    assert.equal(await auth.getSessionByToken(signedIn.token), null);
  } finally {
    await client.closeDatabasePool();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
