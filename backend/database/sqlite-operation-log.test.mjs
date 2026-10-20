import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("SQLite persists and reads a fully traced operation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-sqlite-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");

  const client = await import("./client.mjs");
  const migrations = await import("./migrate.mjs");
  const repository = await import("./operation-log-repository.mjs");
  const auth = await import("./auth-repository.mjs");

  try {
    await migrations.runDatabaseMigrations();
    const session = await auth.signInWithoutPassword({
      displayName: "Operation Test",
      email: "operation-test@example.com",
    });
    const workspaceId = session.workspace.id;
    const identifiers = await repository.beginAiOperationAttempt({
      workspaceId,
      operationId: "sqlite-operation",
      operationType: "audience_generation",
      provider: "openai",
      model: "gpt-5-mini",
      request: { prompt: "Generate audiences" },
      requestOptions: { temperature: 0.2 },
    });
    await repository.completeAiOperationAttempt({
      workspaceId,
      ...identifiers,
      response: { text: '{"items":[]}', provider: "openai", model: "gpt-5-mini" },
      providerRequestId: "response-sqlite-test",
      durationMs: 42,
    });
    await repository.completeOperationOutput({
      workspaceId,
      operationId: identifiers.operationId,
      output: { items: [] },
      related: { productId: "product-sqlite-test" },
    });

    const [operation] = await repository.readDatabaseOperationLogs({ workspaceId, limit: 1 });
    assert.equal(operation.id, identifiers.operationId);
    assert.equal(operation.input.content.prompt, "Generate audiences");
    assert.equal(operation.output.content.items.length, 0);
    assert.equal(operation.attempts[0].durationMs, 42);
    assert.equal(operation.related.productId, "product-sqlite-test");
  } finally {
    await client.closeDatabasePool();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
