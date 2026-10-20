import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checklistFor, STAGES } from "./service.mjs";

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-pipeline-"));
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("../database/client.mjs");
  const auth = await import("../database/auth-repository.mjs");
  const data = await import("../database/workspace-data-repository.mjs");
  const campaigns = await import("../database/campaigns-repository.mjs");
  const pipeline = await import("./service.mjs");
  const pipelineRepo = await import("../database/pipeline-repository.mjs");
  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const product = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
    const other = await data.createWorkspaceProduct(beta, { brandId: "brand-b", name: "Other", description: "d" });
    const node = (id, type) => ({ id, parentId: product.id, productId: product.id, type, label: id, lineageMode: "creative_exploration", createdAt: new Date().toISOString() });
    await data.persistStrategyNodes(alpha, [node("angle-1", "angle"), node("offer-1", "offer")]);
    data.persistTargetAvatars(alpha, product.id, [{ id: "av-1", label: "Nurse" }]);
    const campaign = campaigns.createCampaign(alpha, { productId: product.id });
    const concept = campaigns.addCampaignConcepts(alpha, campaign.id, [{ avatarId: "av-1", angleId: "angle-1", offerId: "offer-1" }]).created[0];
    const ad = (fields) => campaigns.addCampaignAd(alpha, concept.id, { format: "ugc_video", awareness: "problem_aware", title: "The July bill", hook: "Which appliance?", ...fields });
    await run({ client, campaigns, pipeline, pipelineRepo, alpha, beta, product, other, concept, ad });
  } finally {
    await client.closeDatabasePool();
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

test("the pipeline has the eight stages, in order, and each format starts with its own checklist plus what launching needs", () => {
  assert.deepEqual(STAGES, ["planned", "script_brief", "approved", "in_production", "in_editing", "in_review", "ready_to_launch", "launched"]);
  const labels = (format) => checklistFor(format).map((item) => item.label);
  assert.deepEqual(labels("ugc_video").slice(0, 5), ["Script", "Creator assigned", "Footage received", "Edit", "Captions"]);
  assert.deepEqual(labels("video").slice(0, 4), ["Script / storyboard", "Footage / assets", "Edit", "Sound and captions"]);
  assert.deepEqual(labels("static_ad").slice(0, 4), ["Design brief", "Visual and copy", "Design", "Export"]);
  assert.deepEqual(labels("carousel").slice(0, 4), ["Card-by-card outline", "Designs", "Sequence review", "Export"]);
  assert.ok(!labels("static_ad").some((label) => /script/i.test(label)), "a static ad has a design brief, not a script");
  for (const format of ["ugc_video", "video", "static_ad", "carousel", "photo", "ai_talking_head", "motion_graphic"]) {
    assert.deepEqual(labels(format).slice(-2), ["Primary text and headline", "CTA and destination"], format);
    assert.ok(checklistFor(format).every((item) => item.done === false && item.id));
  }
  assert.ok(checklistFor("hologram").length > 2, "an unknown format still gets a usable checklist");
});

test("sending an ad creates a linked task in Planned with a snapshot of the ad; the ad itself is untouched", async () => {
  await withFixture(async ({ campaigns, pipeline, alpha, product, ad }) => {
    const source = ad();
    const task = pipeline.createPipelineTask(alpha, { adId: source.id, adRef: "AS-01.1" });
    assert.deepEqual([task.adId, task.productId, task.stage, task.adRef, task.adRemoved], [source.id, product.id, "planned", "AS-01.1", false]);
    assert.deepEqual([task.title, task.format, task.awareness, task.hook, task.variant], ["The July bill", "ugc_video", "problem_aware", "Which appliance?", null]);
    assert.equal(task.checklist[0].label, "Script");
    assert.deepEqual(campaigns.getCampaignAd(alpha, source.id).hook, "Which appliance?", "the ad is not moved or changed");
    assert.equal(pipeline.listPipelineTasks(alpha, product.id).length, 1);
    assert.throws(() => pipeline.createPipelineTask(alpha, { adId: "nope" }), { code: "PIPELINE_AD_NOT_FOUND" });
  });
});

test("an ad with no title and a long hook can still be sent: the task's title is the hook, shortened", async () => {
  await withFixture(async ({ pipeline, alpha, ad }) => {
    const long = "A refrigerator hums in an empty kitchen as the on-screen clock jumps from 7:10 a.m. to 5:40 p.m.; cut to the air conditioner switching on at full blast while the bill keeps quietly climbing.";
    const source = ad({ title: null, hook: long });
    const task = pipeline.createPipelineTask(alpha, { adId: source.id, adRef: "AS-02.1" });
    assert.ok(long.length > 120 && task.title.length <= 120, "shortened to fit");
    assert.ok(task.title.endsWith("…") && long.startsWith(task.title.slice(0, -1)));
    assert.equal(task.hook, long, "the full hook is kept on the task");
    const bare = pipeline.createPipelineTask(alpha, { adId: ad({ title: null, hook: null }).id, adRef: "AS-02.2" });
    assert.equal(bare.title, "AS-02.2", "with neither, the reference names it");
  });
});

test("one ad can have several tasks that share it and progress independently", async () => {
  await withFixture(async ({ pipeline, alpha, product, ad }) => {
    const source = ad({ format: "video" });
    const wide = pipeline.createPipelineTask(alpha, { adId: source.id });
    const vertical = pipeline.createPipelineTask(alpha, { adId: source.id, variant: "  9:16   cut " });
    const french = pipeline.createPipelineTask(alpha, { adId: source.id, variant: "French" });
    assert.equal(vertical.variant, "9:16 cut", "a version name is tidied");
    assert.notEqual(wide.id, vertical.id);
    pipeline.movePipelineTask(alpha, { id: vertical.id, stage: "in_editing" });
    const tasks = pipeline.listPipelineTasks(alpha, product.id);
    assert.deepEqual(tasks.map((task) => task.adId), [source.id, source.id, source.id]);
    assert.deepEqual(Object.fromEntries(tasks.map((task) => [task.id, task.stage])), { [wide.id]: "planned", [vertical.id]: "in_editing", [french.id]: "planned" });
    assert.throws(() => pipeline.createPipelineTask(alpha, { adId: source.id, variant: "x".repeat(61) }), /up to 60 characters/);
  });
});

test("moving a task changes its stage and position; the column keeps an exact order and the stage time changes only with the stage", async () => {
  await withFixture(async ({ pipeline, alpha, product, ad }) => {
    const ids = [1, 2, 3].map((n) => pipeline.createPipelineTask(alpha, { adId: ad({ title: `Idea ${n}` }).id }).id);
    const inStage = (stage) => pipeline.listPipelineTasks(alpha, product.id).filter((task) => task.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder).map((task) => task.title);
    assert.deepEqual(inStage("planned"), ["Idea 1", "Idea 2", "Idea 3"], "new tasks go to the end of the column");

    const before = pipeline.listPipelineTasks(alpha, product.id).find((task) => task.id === ids[2]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    pipeline.movePipelineTask(alpha, { id: ids[2], stage: "planned", index: 0 });
    assert.deepEqual(inStage("planned"), ["Idea 3", "Idea 1", "Idea 2"], "dropping at the top of the same column reorders it");
    assert.equal(pipeline.listPipelineTasks(alpha, product.id).find((task) => task.id === ids[2]).stageChangedAt, before.stageChangedAt, "no stage change, no new stage time");

    await new Promise((resolve) => setTimeout(resolve, 5));
    const moved = pipeline.movePipelineTask(alpha, { id: ids[0], stage: "script_brief" });
    assert.notEqual(moved.stageChangedAt, before.stageChangedAt);
    assert.deepEqual([inStage("planned"), inStage("script_brief")], [["Idea 3", "Idea 2"], ["Idea 1"]]);
    pipeline.movePipelineTask(alpha, { id: ids[1], stage: "script_brief", index: 0 });
    assert.deepEqual(inStage("script_brief"), ["Idea 2", "Idea 1"]);
    assert.deepEqual(pipeline.listPipelineTasks(alpha, product.id).filter((task) => task.stage === "script_brief").map((task) => task.sortOrder).sort(), [1, 2]);

    assert.throws(() => pipeline.movePipelineTask(alpha, { id: ids[0], stage: "shipped" }), /Stage must be one of/);
    assert.throws(() => pipeline.movePipelineTask(alpha, { id: ids[0], stage: "planned", index: -1 }), /whole number/);
    assert.throws(() => pipeline.movePipelineTask(alpha, { id: "nope", stage: "planned" }), { code: "PIPELINE_TASK_NOT_FOUND" });
    assert.equal(pipeline.movePipelineTask(alpha, { id: ids[0], stage: "launched", index: 99 }).stage, "launched", "a position past the end means the end");
  });
});

test("a task's name, version, notes, live Meta ad and checklist can be edited, with limits", async () => {
  await withFixture(async ({ pipeline, alpha, ad }) => {
    const task = pipeline.createPipelineTask(alpha, { adId: ad().id });
    const checklist = task.checklist.map((item, index) => ({ ...item, done: index < 2 }));
    const edited = pipeline.updatePipelineTask(alpha, { id: task.id, title: "  Renamed  idea ", variant: "1:1", notes: "Ask the creator for a retake.\r\nSecond line", metaAdRef: "120 abc", checklist: [...checklist, { label: "Legal review" }] });
    assert.deepEqual([edited.title, edited.variant, edited.metaAdRef], ["Renamed idea", "1:1", "120 abc"]);
    assert.equal(edited.notes, "Ask the creator for a retake.\nSecond line");
    assert.deepEqual(edited.checklist.filter((item) => item.done).length, 2);
    const custom = edited.checklist.at(-1);
    assert.deepEqual([custom.label, custom.done, typeof custom.id], ["Legal review", false, "string"], "a new item gets an id");

    const cleared = pipeline.updatePipelineTask(alpha, { id: task.id, variant: null, notes: "  ", metaAdRef: null });
    assert.deepEqual([cleared.variant, cleared.notes, cleared.metaAdRef], [null, null, null]);
    assert.equal(cleared.checklist.length, edited.checklist.length, "fields left out are left alone");
    assert.throws(() => pipeline.updatePipelineTask(alpha, { id: task.id, title: "  " }), /needs a title/);
    assert.throws(() => pipeline.updatePipelineTask(alpha, { id: task.id, notes: "x".repeat(4001) }), /up to 4000/);
    assert.throws(() => pipeline.updatePipelineTask(alpha, { id: task.id, checklist: [{ label: "" }] }), /can't be empty/);
    assert.throws(() => pipeline.updatePipelineTask(alpha, { id: task.id, checklist: Array.from({ length: 31 }, (_, i) => ({ label: `s${i}` })) }), /up to 30/);
    assert.throws(() => pipeline.updatePipelineTask(alpha, { id: task.id, checklist: [{ id: "a", label: "x" }, { id: "a", label: "y" }] }), /must be different/);
  });
});

test("tasks are scoped to the workspace, and a deleted ad leaves its task, marked as removed", async () => {
  await withFixture(async ({ campaigns, pipeline, alpha, beta, product, other, ad }) => {
    const source = ad();
    const task = pipeline.createPipelineTask(alpha, { adId: source.id });
    assert.throws(() => pipeline.listPipelineTasks(beta, product.id), { code: "PIPELINE_PRODUCT_NOT_FOUND" });
    assert.deepEqual(pipeline.listPipelineTasks(beta, other.id), []);
    assert.throws(() => pipeline.createPipelineTask(beta, { adId: source.id }), { code: "PIPELINE_AD_NOT_FOUND" }, "another workspace can't send this ad");
    assert.throws(() => pipeline.updatePipelineTask(beta, { id: task.id, title: "x" }), { code: "PIPELINE_TASK_NOT_FOUND" });
    assert.throws(() => pipeline.movePipelineTask(beta, { id: task.id, stage: "launched" }), { code: "PIPELINE_TASK_NOT_FOUND" });
    assert.equal(pipeline.deletePipelineTask(beta, task.id), false);

    campaigns.deleteCampaignAd(alpha, source.id);
    const [left] = pipeline.listPipelineTasks(alpha, product.id);
    assert.deepEqual([left.id, left.adRemoved, left.title], [task.id, true, "The July bill"], "the work stays, with what the ad was");
    assert.equal(pipeline.deletePipelineTask(alpha, task.id), true);
    assert.deepEqual(pipeline.listPipelineTasks(alpha, product.id), []);
  });
});

test("deleting a product removes its pipeline tasks", async () => {
  await withFixture(async ({ client, pipeline, alpha, product, ad }) => {
    pipeline.createPipelineTask(alpha, { adId: ad().id });
    client.getDatabasePool().query("delete from products where workspace_id = $1 and id = $2", [alpha, product.id]);
    assert.equal(client.getDatabasePool().query("select count(*) as n from pipeline_tasks").rows[0].n, 0);
  });
});

test("metaAdRefImageMap resolves a launched task's typed-in Meta ad name to its ad's ready image", async () => {
  await withFixture(async ({ campaigns, pipeline, pipelineRepo, alpha, product, ad }) => {
    const source = ad();
    const task = pipeline.createPipelineTask(alpha, { adId: source.id });
    pipeline.updatePipelineTask(alpha, { id: task.id, metaAdRef: "ACME01Hook1" });
    // No image yet: not resolved even though the name is linked.
    assert.equal(pipelineRepo.metaAdRefImageMap(alpha, product.id).size, 0);

    campaigns.setCampaignAdImage(alpha, source.id, { status: "ready", url: "data:image/png;base64,abc" });
    const map = pipelineRepo.metaAdRefImageMap(alpha, product.id);
    assert.equal(map.get("acme01hook1"), "data:image/png;base64,abc", "matched squashed, case/punctuation-insensitive");
    assert.equal(map.has("acme01hook2"), false);
  });
});

test("metaAdRefImageMap leaves out a name two different ads were typed in under, rather than guessing", async () => {
  await withFixture(async ({ campaigns, pipeline, pipelineRepo, alpha, product, ad }) => {
    const first = ad();
    const second = ad({ title: "A different idea" });
    campaigns.setCampaignAdImage(alpha, first.id, { status: "ready", url: "data:image/png;base64,first" });
    campaigns.setCampaignAdImage(alpha, second.id, { status: "ready", url: "data:image/png;base64,second" });
    const taskA = pipeline.createPipelineTask(alpha, { adId: first.id });
    const taskB = pipeline.createPipelineTask(alpha, { adId: second.id });
    pipeline.updatePipelineTask(alpha, { id: taskA.id, metaAdRef: "Acme Ad 1" });
    pipeline.updatePipelineTask(alpha, { id: taskB.id, metaAdRef: "acme-ad-1" });
    assert.equal(pipelineRepo.metaAdRefImageMap(alpha, product.id).has("acmead1"), false, "ambiguous name, left out rather than picking one");
  });
});

test("metaAdRefImageMap ignores a task whose ad's image isn't ready (failed, none, or pending)", async () => {
  await withFixture(async ({ campaigns, pipeline, pipelineRepo, alpha, product, ad }) => {
    const source = ad();
    const task = pipeline.createPipelineTask(alpha, { adId: source.id });
    pipeline.updatePipelineTask(alpha, { id: task.id, metaAdRef: "Acme Ad 2" });
    assert.equal(pipelineRepo.metaAdRefImageMap(alpha, product.id).size, 0, "no image at all yet");
    campaigns.setCampaignAdImage(alpha, source.id, { status: "failed" });
    assert.equal(pipelineRepo.metaAdRefImageMap(alpha, product.id).size, 0, "a failed generation is not shown as a link");
  });
});
