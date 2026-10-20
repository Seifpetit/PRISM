import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("persisted workflow and observability records are isolated by workspace", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-workspaces-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");
  const operations = await import("./operation-log-repository.mjs");

  try {
    const alpha = await auth.signInWithoutPassword({
      displayName: "Alpha Admin",
      email: "alpha@example.com",
    });
    const beta = await auth.signInWithoutPassword({
      displayName: "Beta Admin",
      email: "beta@example.com",
    });
    const alphaWorkspace = alpha.workspace.id;
    const betaWorkspace = beta.workspace.id;
    const product = await data.createWorkspaceProduct(alphaWorkspace, {
      brandId: "brand-alpha",
      name: "Alpha Product",
      description: "Only Alpha can read this.",
    });
    const child = {
      id: "alpha-audience",
      parentId: product.id,
      productId: product.id,
      type: "audience",
      label: "Alpha audience",
      createdAt: new Date().toISOString(),
    };
    await data.persistStrategyNodes(alphaWorkspace, [child]);
    data.persistProductSources(alphaWorkspace, [
      {
        id: "alpha-source",
        type: "text",
        label: "Alpha notes",
        value: "Workspace-private source material",
        status: "ready",
      },
    ]);

    assert.equal(data.listWorkspaceProducts(alphaWorkspace).length, 1);
    assert.equal(data.listWorkspaceProducts(betaWorkspace).length, 0);
    assert.equal(data.getWorkspaceProduct(betaWorkspace, product.id), null);
    assert.equal(data.listProductStrategy(betaWorkspace, product.id).length, 0);
    assert.equal(data.getWorkspaceSource(betaWorkspace, "alpha-source"), null);
    assert.equal(
      data.updateStrategyNodePosition(betaWorkspace, child.id, { x: 10, y: 20 }),
      false,
    );
    assert.equal(
      data.updateStrategyNodePosition(alphaWorkspace, child.id, { x: 10, y: 20 }),
      true,
    );

    await operations.beginAiOperationAttempt({
      workspaceId: alphaWorkspace,
      operationId: "alpha-operation",
      operationType: "audience_generation",
      provider: "openai",
      model: "test-model",
      request: { prompt: "Alpha only" },
    });
    assert.equal(
      (await operations.readDatabaseOperationLogs({ workspaceId: alphaWorkspace })).length,
      1,
    );
    assert.equal(
      (await operations.readDatabaseOperationLogs({ workspaceId: betaWorkspace })).length,
      0,
    );

    await client.withDatabaseTransaction((database) =>
      operations.importCostLedgerEntry(database, {
        id: "alpha-cost",
        workspaceId: alphaWorkspace,
        operation: "audience_generation",
        operationId: "alpha-cost-operation",
        parentGenerationId: "alpha-generation",
        provider: "openai",
        model: "test-model",
        attempt: 1,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        cost: { status: "priced", usd: "0.01", breakdown: {}, reason: null },
      }),
    );
    assert.equal(
      (await operations.readDatabaseCostLedgerEntries({ workspaceId: alphaWorkspace })).length,
      1,
    );
    assert.equal(
      (await operations.readDatabaseCostLedgerEntries({ workspaceId: betaWorkspace })).length,
      0,
    );

    const database = client.getDatabasePool();
    assert.equal(
      database.query(
        "select count(*) as count from strategy_edges where workspace_id = $1",
        [alphaWorkspace],
      ).rows[0].count,
      1,
    );
    assert.equal(
      database.query(
        "select count(*) as count from product_sources where workspace_id = $1",
        [betaWorkspace],
      ).rows[0].count,
      0,
    );
  } finally {
    await client.closeDatabasePool();
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
