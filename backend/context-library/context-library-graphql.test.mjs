import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { makePdf } from "./pdf-fixture.mjs";

// Drives the real GraphQL server on a throwaway database, with the OpenAI endpoint pointed at a local stand-in that
// records what it is sent. So the whole path is exercised — the mutation, the server-side resolution of source ids, the
// assembled model input, the output validation, the provenance — without a real AI call.

const serverFile = fileURLToPath(new URL("../server.mjs", import.meta.url));

const freePort = () =>
  new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const avatars = (count) => ({ targetAvatars: Array.from({ length: count }, (_, i) => ({ label: `Profile ${i + 1}`, gender: "female", ageRange: "30-40", profession: "Teacher", lifeRhythm: "Long days and errands.", painPoint: "The summer bill keeps rising.", productConnection: "Smooths voltage.", priorities: "Price and trust.", buyingContext: "Compares online." })) });
const angles = {
  angles: [1, 2, 3].map((i) => ({
    label: `Angle number ${i}`,
    framing: `A framing of the mechanism that is long enough number ${i}.`,
    creativePotential: "Supports several distinct executions later.",
    summary: `A compact summary of angle number ${i} and how to talk about it.`,
    keyMessage: `A quotable line for angle number ${i}.`,
    tags: ["Convenience", "Trust"],
    audienceFitNote: `Lands hardest with practical, price-aware buyers for angle number ${i}.`,
  })),
};
const productContext = { id: "context-acme", name: "Acme", workingLabel: "Energy saver", category: "Home energy", summary: "A plug-in energy saver.", features: ["Plug-in"], mechanisms: ["Smooths voltage"], benefits: ["Lower bill"], proofPoints: [], useCases: ["Apartments"], claims: [], constraints: [], sourceIds: [], createdAt: "2026-09-01T00:00:00.000Z" };

async function withServer(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-context-gql-"));
  const previousPath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("../database/client.mjs");
  const auth = await import("../database/auth-repository.mjs");
  const data = await import("../database/workspace-data-repository.mjs");
  const alphaSession = await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" });
  const betaSession = await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" });
  const alpha = alphaSession.workspace.id;
  await data.persistProductContext(alpha, productContext);
  const product = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d", contextId: productContext.id });
  const bare = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "No context", description: "d" });
  const betaContext = { ...productContext, id: "context-beta" };
  await data.persistProductContext(betaSession.workspace.id, betaContext);
  const foreign = await data.createWorkspaceProduct(betaSession.workspace.id, { brandId: "brand-b", name: "Beta product", description: "d", contextId: betaContext.id });
  await client.closeDatabasePool();

  // The stand-in for the model: records every request, answers with a valid set for whichever generator asked.
  const modelRequests = [];
  const model = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const parsed = JSON.parse(body);
      modelRequests.push(parsed);
      const sent = JSON.parse(parsed.input[0].content);
      const reply = sent.output.shape.angles ? angles : avatars(3);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ id: "resp-1", output_text: JSON.stringify(reply), usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise((resolve) => model.listen(0, "127.0.0.1", resolve));

  const port = await freePort();
  const child = spawn(process.execPath, ["--no-warnings", serverFile], {
    env: { ...process.env, BACKEND_PORT: String(port), DATABASE_PATH: process.env.DATABASE_PATH, AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: `http://127.0.0.1:${model.address().port}/v1/responses` },
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
    const response = await fetch(`http://localhost:${port}/graphql`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }) });
    return response.json();
  };
  try {
    await run({ call, alphaToken: alphaSession.token, betaToken: betaSession.token, product, bare, foreign, modelRequests });
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    await new Promise((resolve) => model.close(resolve));
    if (previousPath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previousPath;
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

const ADD = "mutation($input: AddContextSourceInput!) { addContextSource(input: $input) { id name kind status statusDetail summary version market } }";
const AVATARS = "mutation($input: GenerateCreativeExplorationTargetAvatarsInput!) { generateCreativeExplorationTargetAvatars(input: $input) { id label } }";
const ANGLES = "mutation($input: GenerateCreativeExplorationAnglesInput!) { generateCreativeExplorationAngles(input: $input) { id label } }";

test("Context Library over GraphQL: upload once, select in Target Avatars and Angles, and the server builds what the model sees", { timeout: 90_000 }, async () => {
  await withServer(async ({ call, alphaToken, betaToken, product, bare, foreign, modelRequests }) => {
    assert.match((await call(null, ADD, { input: { productId: product.id, kind: "note", text: "x" } })).errors[0].message, /Sign in is required/);

    const pdf = (await call(alphaToken, ADD, { input: { productId: product.id, kind: "file", fileName: "Spain study.pdf", mimeType: "application/pdf", contentBase64: Buffer.from(makePdf([["Renters in Madrid say the July electricity bill is the hardest bill of the year."]])).toString("base64"), market: "Spain" } })).data.addContextSource;
    const csv = (await call(alphaToken, ADD, { input: { productId: product.id, kind: "file", fileName: "objections.csv", mimeType: "text/csv", text: "objection,city\nprice too high,Seville\nneeds an electrician,Valencia" } })).data.addContextSource;
    const unused = (await call(alphaToken, ADD, { input: { productId: product.id, kind: "note", name: "Competitor", text: "UNSELECTED-COMPETITOR-CLAIM Brand X saves 90%." } })).data.addContextSource;
    assert.deepEqual([pdf.status, csv.status, pdf.market, pdf.summary], ["ready", "ready", "Spain", "1 page · " + pdf.summary.split("· ")[1]]);

    const listed = (await call(alphaToken, "query($p: ID!) { contextSources(productId: $p) { id status kind } }", { p: product.id })).data.contextSources;
    assert.equal(listed.length, 3);
    assert.match((await call(betaToken, "query($p: ID!) { contextSources(productId: $p) { id } }", { p: product.id })).errors[0].message, /product wasn't found/);
    assert.match((await call(betaToken, "query($id: ID!) { contextSourceContent(id: $id) { text } }", { id: pdf.id })).errors[0].message, /source wasn't found/);

    // Preview: the same assembly a run uses.
    const preview = (await call(alphaToken, "query($input: GenerationContextPreviewInput!) { generationContextPreview(input: $input) { templateVersion instructions totalChars budgetChars rules productContext sources { name kind coverage truncated text } } }", { input: { productId: product.id, generator: "targetAvatars", context: { sourceIds: [pdf.id, csv.id], instructions: "Focus on apartments." } } })).data.generationContextPreview;
    assert.deepEqual(preview.sources.map((source) => source.name), ["Spain study.pdf", "objections.csv"]);
    assert.match(preview.sources[0].text, /\[p\.1\] Renters in Madrid/);
    assert.equal(JSON.parse(preview.productContext).name, "Acme");
    assert.equal(preview.instructions, "Focus on apartments.");

    // Target Avatars with two sources and run instructions.
    const generated = await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { sourceIds: [pdf.id, csv.id], instructions: "Focus on apartments." } } });
    assert.equal(generated.errors, undefined, JSON.stringify(generated.errors));
    assert.equal(generated.data.generateCreativeExplorationTargetAvatars.length, 3);
    const first = JSON.parse(modelRequests.at(-1).input[0].content);
    assert.deepEqual(first.marketEvidence.sources.map((source) => source.name), ["Spain study.pdf", "objections.csv"]);
    assert.equal(first.runInstructions.text, "Focus on apartments.");
    assert.doesNotMatch(JSON.stringify(first), /UNSELECTED-COMPETITOR-CLAIM/);
    assert.deepEqual(first.productContext.name, "Acme");
    assert.ok(first.output.shape.targetAvatars, "the generator's output shape is still the application's");

    // The same uploaded source, reused for Angles without another upload.
    const reused = await call(alphaToken, ANGLES, { input: { productId: product.id, context: { sourceIds: [pdf.id] } } });
    assert.equal(reused.errors, undefined, JSON.stringify(reused.errors));
    const second = JSON.parse(modelRequests.at(-1).input[0].content);
    assert.deepEqual(second.marketEvidence.sources.map((source) => source.id), [pdf.id]);
    assert.match(second.marketEvidence.about, /reasons to buy/);

    // Nothing selected: the request has no evidence and no instructions.
    const plain = await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3 } });
    assert.equal(plain.errors, undefined, JSON.stringify(plain.errors));
    const third = JSON.parse(modelRequests.at(-1).input[0].content);
    assert.deepEqual(Object.keys(third).sort(), ["output", "productContext", "task"]);
    const empty = await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { sourceIds: [] } } });
    assert.equal(empty.errors, undefined);
    assert.equal(JSON.parse(modelRequests.at(-1).input[0].content).output.rules.length, third.output.rules.length);

    // Refusals happen before any model call.
    const before = modelRequests.length;
    assert.match((await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { sourceIds: ["nope"] } } })).errors[0].message, /isn't in this product's Context Library/);
    assert.match((await call(betaToken, AVATARS, { input: { productId: foreign.id, count: 3, context: { sourceIds: [pdf.id] } } })).errors[0].message, /isn't in this product's Context Library/, "another workspace's source id can't be used, even on its own product");
    assert.match((await call(alphaToken, ANGLES, { input: { productId: bare.id, context: { sourceIds: [pdf.id] } } })).errors[0].message, /Product Context is required/);
    const foreignSource = (await call(betaToken, ADD, { input: { productId: foreign.id, kind: "note", text: "Beta's private note." } })).data.addContextSource;
    assert.match((await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { sourceIds: [foreignSource.id] } } })).errors[0].message, /isn't in this product's Context Library/);
    const scan = (await call(alphaToken, ADD, { input: { productId: product.id, kind: "file", fileName: "scan.pdf", mimeType: "application/pdf", contentBase64: Buffer.from(makePdf([null])).toString("base64") } })).data.addContextSource;
    assert.equal(scan.status, "failed");
    assert.match(scan.statusDetail, /no readable text/);
    const refused = await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { sourceIds: [scan.id] } } });
    assert.equal(refused.errors[0].extensions.code, "CONTEXT_SOURCE_NOT_READY");
    assert.match((await call(alphaToken, AVATARS, { input: { productId: product.id, count: 3, context: { instructions: "x".repeat(1600) } } })).errors[0].message, /up to 1,500 characters/);
    assert.equal(modelRequests.length, before, "no refused request reached the model");

    // Provenance was written for the runs that succeeded; read one back through the API.
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(process.env.DATABASE_PATH);
    const runs = db.prepare("select generation_id, generator, template_version, run_instructions, sources_json from generation_context_runs order by created_at").all();
    db.close();
    assert.deepEqual(runs.map((run) => run.generator), ["targetAvatars", "angles", "targetAvatars", "targetAvatars"]);
    assert.deepEqual(JSON.parse(runs[0].sources_json).map((source) => [source.name, source.version]), [["Spain study.pdf", 1], ["objections.csv", 1]]);
    assert.equal(runs[0].run_instructions, "Focus on apartments.");
    assert.equal(JSON.parse(runs[2].sources_json).length, 0, "a run with nothing selected is recorded as such");
    const viaApi = (await call(alphaToken, "query($id: ID!) { generationProvenance(generationId: $id) { generator templateVersion instructions sources { name version truncated } } }", { id: runs[0].generation_id })).data.generationProvenance;
    assert.deepEqual(viaApi.sources.map((source) => source.name), ["Spain study.pdf", "objections.csv"]);
    assert.equal((await call(betaToken, "query($id: ID!) { generationProvenance(generationId: $id) { generator } }", { id: runs[0].generation_id })).data.generationProvenance, null);

    // Editing and deleting.
    const note = unused;
    const edited = (await call(alphaToken, "mutation($input: UpdateContextSourceInput!) { updateContextSource(input: $input) { version name } }", { input: { id: note.id, text: "Now different text.", name: "Renamed" } })).data.updateContextSource;
    assert.deepEqual([edited.version, edited.name], [2, "Renamed"]);
    assert.equal((await call(betaToken, "mutation($id: ID!) { deleteContextSource(id: $id) }", { id: note.id })).data.deleteContextSource, false);
    assert.equal((await call(alphaToken, "mutation($id: ID!) { deleteContextSource(id: $id) }", { id: note.id })).data.deleteContextSource, true);
  });
});
