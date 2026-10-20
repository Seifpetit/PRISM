import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-meta-campaigns-"));
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");
  const repo = await import("./product-meta-campaigns-repository.mjs");
  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const acme = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
    const other = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Other", description: "d" });
    await run({ client, data, repo, alpha, beta, acme, other });
  } finally {
    await client.closeDatabasePool();
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

const c = (id, name = `Campaign ${id}`) => ({ id, name });

test("a product holds the Meta campaigns assigned to it, replaced as a set", async () => {
  await withFixture(async ({ repo, alpha, acme }) => {
    assert.deepEqual(repo.listProductMetaCampaigns(alpha, acme.id), []);
    const first = repo.setProductMetaCampaigns(alpha, acme.id, [c("111", "  Acme main  "), c("222"), c("111", "duplicate id")]);
    assert.deepEqual(first.map((row) => [row.campaignId, row.name]), [["111", "duplicate id"], ["222", "Campaign 222"]], "a repeated id is one campaign");

    const replaced = repo.setProductMetaCampaigns(alpha, acme.id, [c("222"), c("333")]);
    assert.deepEqual(replaced.map((row) => row.campaignId).sort(), ["222", "333"], "the new set replaces the old one");
    assert.deepEqual(repo.setProductMetaCampaigns(alpha, acme.id, []), [], "an empty set unassigns everything");
  });
});

test("a campaign belongs to one product at most, and refusing leaves the assignment untouched", async () => {
  await withFixture(async ({ repo, alpha, acme, other }) => {
    repo.setProductMetaCampaigns(alpha, acme.id, [c("111", "Acme main"), c("222")]);
    assert.throws(() => repo.setProductMetaCampaigns(alpha, other.id, [c("333"), c("111", "Acme main")]), /already assigned to Acme/);
    assert.deepEqual(repo.listProductMetaCampaigns(alpha, other.id), [], "the refused request assigned nothing, not even the free campaign");
    assert.deepEqual(repo.listProductMetaCampaigns(alpha, acme.id).map((row) => row.campaignId).sort(), ["111", "222"]);

    const assignments = repo.listMetaCampaignAssignments(alpha);
    assert.deepEqual(assignments.map((row) => [row.campaignId, row.productName]).sort(), [["111", "Acme"], ["222", "Acme"]], "assignments carry the product's name");

    repo.setProductMetaCampaigns(alpha, acme.id, [c("222")]);
    assert.equal(repo.setProductMetaCampaigns(alpha, other.id, [c("111")]).length, 1, "once released it can go to another product");
  });
});

test("assignments are validated, scoped to the workspace, and go with the product", async () => {
  await withFixture(async ({ client, repo, alpha, beta, acme }) => {
    assert.throws(() => repo.setProductMetaCampaigns(alpha, acme.id, "nope"), /Choose the campaigns/);
    assert.throws(() => repo.setProductMetaCampaigns(alpha, acme.id, [{ id: "", name: "x" }]), /missing its Meta id/);
    assert.throws(() => repo.setProductMetaCampaigns(alpha, acme.id, [{ id: "1", name: " " }]), /missing its name/);
    assert.throws(
      () => repo.setProductMetaCampaigns(alpha, acme.id, Array.from({ length: repo.MAX_ASSIGNED_CAMPAIGNS + 1 }, (_, i) => c(String(i + 1)))),
      /at most 200/,
    );
    assert.deepEqual(repo.listProductMetaCampaigns(alpha, acme.id), []);

    repo.setProductMetaCampaigns(alpha, acme.id, [c("111")]);
    assert.deepEqual(repo.listProductMetaCampaigns(beta, acme.id), [], "another workspace sees nothing");
    assert.deepEqual(repo.listMetaCampaignAssignments(beta), []);

    client.getDatabasePool().query("delete from products where workspace_id = $1 and id = $2", [alpha, acme.id]);
    assert.deepEqual(repo.listMetaCampaignAssignments(alpha), [], "deleting the product removes its assignments");
  });
});
