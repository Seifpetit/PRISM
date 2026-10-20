import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Drives the real GraphQL server (started on a throwaway database) so the resolver-level rules are
// tested end to end: sign-in required, workspace isolation, and "only this product's own persona,
// angle and offer".

const serverFile = fileURLToPath(new URL("../server.mjs", import.meta.url));

function freePort() {
  return new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function withServer(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-campaigns-gql-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");

  const alphaSession = await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" });
  const betaSession = await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" });
  const alpha = alphaSession.workspace.id;
  const product = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
  const otherProduct = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Other", description: "d" });
  const node = (id, type, productId = product.id) => ({
    id,
    parentId: productId,
    productId,
    type,
    label: id,
    lineageMode: "creative_exploration",
    createdAt: new Date().toISOString(),
  });
  await data.persistStrategyNodes(alpha, [node("angle-1", "angle"), node("angle-2", "angle"), node("offer-1", "offer"), node("foreign-angle", "angle", otherProduct.id)]);
  data.persistTargetAvatars(alpha, product.id, [{ id: "av-1", label: "Nurse" }, { id: "av-2", label: "Student" }]);
  await client.closeDatabasePool();

  const port = await freePort();
  const child = spawn(process.execPath, ["--no-warnings", serverFile], {
    env: { ...process.env, BACKEND_PORT: String(port), DATABASE_PATH: process.env.DATABASE_PATH },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start:\n${output}`)), 20_000);
    const poll = setInterval(() => {
      if (output.includes("GraphQL backend running")) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });

  const call = async (token, query, variables = {}) => {
    const response = await fetch(`http://localhost:${port}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  };
  try {
    await run({ call, alphaToken: alphaSession.token, betaToken: betaSession.token, product, otherProduct });
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

const CAMPAIGN = "id name kind testType concepts { id avatarId angleId offerId ads { id format awareness } }";

test("campaign GraphQL: sign-in, ownership and validation rules hold end to end", { timeout: 60_000 }, async () => {
  await withServer(async ({ call, alphaToken, betaToken, product, otherProduct }) => {
    const create = `mutation($p: ID!, $t: String) { createCampaign(productId: $p, testType: $t) { ${CAMPAIGN} } }`;

    assert.match((await call(null, create, { p: product.id })).errors[0].message, /Sign in is required/);
    assert.match((await call(betaToken, create, { p: product.id })).errors[0].message, /Product not found\./, "another workspace can't create a campaign on this product");

    const bad = await call(alphaToken, create, { p: product.id, t: "format" });
    assert.match(bad.errors[0].message, /Test type must be one of/, "validation reasons reach the client, not 'Unexpected error'");

    const created = (await call(alphaToken, create, { p: product.id, t: "angle" })).data.createCampaign;
    assert.equal(created.name, "Test 1");
    assert.equal(created.kind, "test", "a campaign is a test unless it says otherwise");

    const createKind = `mutation($p: ID!, $k: String) { createCampaign(productId: $p, kind: $k) { ${CAMPAIGN} } }`;
    assert.match((await call(alphaToken, createKind, { p: product.id, k: "branding" })).errors[0].message, /Campaign kind must be one of/);
    const scaling = (await call(alphaToken, createKind, { p: product.id, k: "scaling" })).data.createCampaign;
    assert.equal(scaling.kind, "scaling");
    assert.equal(scaling.name, "Scaling 1");
    const retitled = (await call(alphaToken, `mutation($id: ID!) { updateCampaign(id: $id, kind: "retargeting") { id kind } }`, { id: scaling.id })).data.updateCampaign;
    assert.equal(retitled.kind, "retargeting");
    assert.equal((await call(alphaToken, `mutation($id: ID!) { deleteCampaign(id: $id) }`, { id: scaling.id })).data.deleteCampaign, true);

    const add = `mutation($c: ID!, $combos: [ConceptComboInput!]!) { addCampaignConcepts(campaignId: $c, combos: $combos) { skipped created { id avatarId angleId offerId } } }`;
    const combo = (avatarId, angleId, offerId) => ({ avatarId, angleId, offerId });

    assert.match((await call(betaToken, add, { c: created.id, combos: [combo("av-1", "angle-1", "offer-1")] })).errors[0].message, /Campaign not found/);
    assert.match((await call(alphaToken, add, { c: created.id, combos: [combo("ghost", "angle-1", "offer-1")] })).errors[0].message, /persona.*doesn't belong/);
    assert.match((await call(alphaToken, add, { c: created.id, combos: [combo("av-1", "foreign-angle", "offer-1")] })).errors[0].message, /angle.*doesn't belong/, "an angle from another product is refused");
    assert.match((await call(alphaToken, add, { c: created.id, combos: [combo("av-1", "offer-1", "angle-1")] })).errors[0].message, /angle.*doesn't belong/, "an offer can't stand in for an angle");
    assert.match((await call(alphaToken, add, { c: created.id, combos: [] })).errors[0].message, /at least one/);

    const good = (await call(alphaToken, add, { c: created.id, combos: [combo("av-1", "angle-1", "offer-1"), combo("av-1", "angle-2", "offer-1"), combo("av-1", "angle-2", "offer-1")] })).data.addCampaignConcepts;
    assert.equal(good.created.length, 2);
    assert.equal(good.skipped, 1, "the repeated combination is skipped");

    const listed = (await call(alphaToken, `query($p: ID!) { campaigns(productId: $p) { ${CAMPAIGN} } }`, { p: product.id })).data.campaigns;
    assert.equal(listed[0].concepts.length, 2);
    assert.equal((await call(betaToken, `query($p: ID!) { campaigns(productId: $p) { id } }`, { p: product.id })).errors[0].message, "Product not found.");
    assert.deepEqual((await call(alphaToken, `query($p: ID!) { campaigns(productId: $p) { id } }`, { p: otherProduct.id })).data.campaigns, [], "campaigns are per product");

    const conceptId = listed[0].concepts[0].id;
    const addAd = `mutation($c: ID!, $f: String, $a: String) { addCampaignAd(conceptId: $c, format: $f, awareness: $a) { id format awareness } }`;
    assert.match((await call(betaToken, addAd, { c: conceptId })).errors[0].message, /Concept not found/);
    assert.match((await call(alphaToken, addAd, { c: conceptId, f: "hologram" })).errors[0].message, /Format must be one of/);
    const ad = (await call(alphaToken, addAd, { c: conceptId, f: "ugc_video", a: "unaware" })).data.addCampaignAd;
    assert.deepEqual([ad.format, ad.awareness], ["ugc_video", "unaware"]);

    const upd = `mutation($id: ID!, $s: String, $e: String) { updateCampaignConcept(id: $id, startDate: $s, endDate: $e) { startDate endDate } }`;
    assert.match((await call(alphaToken, upd, { id: conceptId, s: "2026-09-10", e: "2026-09-01" })).errors[0].message, /can't be before/);
    assert.deepEqual((await call(alphaToken, upd, { id: conceptId, s: "2026-09-01", e: "2026-09-10" })).data.updateCampaignConcept, { startDate: "2026-09-01", endDate: "2026-09-10" });

    assert.equal((await call(betaToken, `mutation($id: ID!) { deleteCampaign(id: $id) }`, { id: created.id })).data.deleteCampaign, false, "another workspace can't delete it");
    assert.equal((await call(alphaToken, `mutation($id: ID!) { deleteCampaign(id: $id) }`, { id: created.id })).data.deleteCampaign, true);
  });
});

test("createCampaignWithConcepts: ownership is checked first, so a rejected request creates nothing", { timeout: 60_000 }, async () => {
  await withServer(async ({ call, alphaToken, betaToken, product, otherProduct }) => {
    const create = `mutation($p: ID!, $k: String, $t: String, $combos: [ConceptComboInput!]!) { createCampaignWithConcepts(productId: $p, kind: $k, testType: $t, combos: $combos) { ${CAMPAIGN} } }`;
    const combo = (avatarId, angleId, offerId) => ({ avatarId, angleId, offerId });
    const good = [combo("av-1", "angle-1", "offer-1"), combo("av-1", "angle-2", "offer-1")];

    assert.match((await call(null, create, { p: product.id, combos: good })).errors[0].message, /Sign in is required/);
    assert.match((await call(betaToken, create, { p: product.id, combos: good })).errors[0].message, /Product not found\./, "another workspace can't create on this product");
    assert.match((await call(alphaToken, create, { p: product.id, combos: [combo("ghost", "angle-1", "offer-1")] })).errors[0].message, /persona.*doesn't belong/);
    assert.match((await call(alphaToken, create, { p: product.id, combos: [combo("av-1", "foreign-angle", "offer-1")] })).errors[0].message, /angle.*doesn't belong/);
    assert.match((await call(alphaToken, create, { p: product.id, combos: [] })).errors[0].message, /at least one/);
    assert.match((await call(alphaToken, create, { p: product.id, k: "branding", combos: good })).errors[0].message, /Campaign kind must be one of/);

    const list = `query($p: ID!) { campaigns(productId: $p) { id } }`;
    assert.deepEqual((await call(alphaToken, list, { p: product.id })).data.campaigns, [], "none of the rejected requests left a campaign behind");

    const made = (await call(alphaToken, create, { p: product.id, k: "test", t: "angle", combos: good })).data.createCampaignWithConcepts;
    assert.equal(made.name, "Test 1");
    assert.equal(made.kind, "test");
    assert.equal(made.concepts.length, 2);
    assert.deepEqual((await call(alphaToken, list, { p: otherProduct.id })).data.campaigns, [], "the other product is untouched");
  });
});
