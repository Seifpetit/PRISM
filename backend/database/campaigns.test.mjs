import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

async function withFixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "prism-campaigns-"));
  const previous = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = path.join(directory, "prism.db");
  const client = await import("./client.mjs");
  const auth = await import("./auth-repository.mjs");
  const data = await import("./workspace-data-repository.mjs");
  const repo = await import("./campaigns-repository.mjs");
  try {
    const alpha = (await auth.signInWithoutPassword({ displayName: "A", email: "a@example.com" })).workspace.id;
    const beta = (await auth.signInWithoutPassword({ displayName: "B", email: "b@example.com" })).workspace.id;
    const product = await data.createWorkspaceProduct(alpha, { brandId: "brand-a", name: "Acme", description: "d" });
    const node = (id, type) => ({ id, parentId: product.id, productId: product.id, type, label: id, lineageMode: "creative_exploration", createdAt: new Date().toISOString() });
    await data.persistStrategyNodes(alpha, [node("angle-1", "angle"), node("angle-2", "angle"), node("angle-3", "angle"), node("offer-1", "offer"), node("offer-2", "offer")]);
    data.persistTargetAvatars(alpha, product.id, [{ id: "av-1", label: "Night nurse" }, { id: "av-2", label: "Student" }]);
    await run({ client, data, repo, alpha, beta, product });
  } finally {
    await client.closeDatabasePool();
    if (previous === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

const combo = (avatarId, angleId, offerId) => ({ avatarId, angleId, offerId });

test("a campaign holds concepts (ad sets) built from persona x angle x offer, and skips duplicates", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    assert.equal(campaign.name, "Test 1");
    assert.equal(campaign.testType, "angle", "angle is the highest-leverage test, so it is the default");

    const first = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1"), combo("av-1", "angle-2", "offer-1")]);
    assert.equal(first.created.length, 2);
    assert.equal(first.skipped, 0);

    const again = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-2", "offer-1"), combo("av-1", "angle-3", "offer-1")]);
    assert.equal(again.created.length, 1, "only the new combination is added");
    assert.equal(again.skipped, 1, "the identical concept is skipped, not duplicated");
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.length, 3);

    // The first concept is the campaign's baseline, so ties within one batch must follow insertion (click) order.
    assert.deepEqual(
      repo.getCampaign(alpha, campaign.id).concepts.slice(0, 3).map((concept) => concept.angleId),
      ["angle-1", "angle-2", "angle-3"],
      "concepts keep the order they were added in",
    );

    // Same request twice in one call is also collapsed.
    const dup = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-2", "angle-1", "offer-2"), combo("av-2", "angle-1", "offer-2")]);
    assert.equal(dup.created.length, 1);
    assert.equal(dup.skipped, 1);
  });
});

test("a campaign has a kind (test, scaling or retargeting) that defaults to test and can be changed", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    assert.equal(repo.createCampaign(alpha, { productId: product.id }).kind, "test", "a campaign is a test unless it says otherwise");

    // Default names are numbered per kind, so the first scaling campaign is "Scaling 1", not "Scaling 2".
    const scaling = repo.createCampaign(alpha, { productId: product.id, kind: "scaling" });
    assert.equal(scaling.kind, "scaling");
    assert.equal(scaling.name, "Scaling 1");
    assert.equal(repo.createCampaign(alpha, { productId: product.id, kind: "retargeting" }).name, "Retargeting 1");
    assert.equal(repo.createCampaign(alpha, { productId: product.id }).name, "Test 2");

    const changed = repo.updateCampaign(alpha, scaling.id, { kind: "retargeting" });
    assert.equal(changed.kind, "retargeting");
    assert.equal(changed.name, "Scaling 1", "changing the kind does not rename it");
    assert.equal(repo.updateCampaign(alpha, scaling.id, { name: "Winners" }).kind, "retargeting", "other edits leave the kind alone");
    assert.equal(repo.listCampaigns(alpha, product.id).find((campaign) => campaign.id === scaling.id).kind, "retargeting");

    assert.throws(() => repo.createCampaign(alpha, { productId: product.id, kind: "branding" }), /Campaign kind must be one of/);
    assert.throws(() => repo.updateCampaign(alpha, scaling.id, { kind: "branding" }), /Campaign kind must be one of/);
  });
});

test("a campaign and its ad sets are created together, or not at all", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const created = repo.createCampaignWithConcepts(alpha, {
      productId: product.id,
      kind: "test",
      testType: "angle",
      combos: [combo("av-1", "angle-1", "offer-1"), combo("av-1", "angle-2", "offer-1"), combo("av-1", "angle-3", "offer-1")],
    });
    assert.equal(created.name, "Test 1");
    assert.equal(created.testType, "angle");
    assert.deepEqual(created.concepts.map((concept) => concept.angleId), ["angle-1", "angle-2", "angle-3"], "ad sets keep the order they were chosen in");
    assert.equal(repo.listCampaigns(alpha, product.id).length, 1);

    // The campaign row is written before its ad sets. Too many ad sets must roll the whole thing back, campaign included.
    assert.throws(
      () =>
        repo.createCampaignWithConcepts(alpha, {
          productId: product.id,
          combos: Array.from({ length: 60 }, (_, i) => combo("av-1", `angle-${i}`, "offer-1")),
        }),
      /at most 50 concepts/,
    );
    assert.equal(repo.listCampaigns(alpha, product.id).length, 1, "the failed request left no campaign behind");

    assert.throws(() => repo.createCampaignWithConcepts(alpha, { productId: product.id, combos: [] }), /at least one ad set/);
    assert.throws(
      () => repo.createCampaignWithConcepts(alpha, { productId: product.id, kind: "branding", combos: [combo("av-1", "angle-1", "offer-1")] }),
      /Campaign kind must be one of/,
    );
    assert.equal(repo.listCampaigns(alpha, product.id).length, 1);

    // Duplicates inside one request collapse instead of creating twice.
    const deduped = repo.createCampaignWithConcepts(alpha, {
      productId: product.id,
      combos: [combo("av-2", "angle-1", "offer-2"), combo("av-2", "angle-1", "offer-2")],
    });
    assert.equal(deduped.concepts.length, 1);
    assert.equal(deduped.name, "Test 2");
  });
});

test("ads are slots on a concept with a format and an awareness stage, and inputs are validated", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id, testType: "offer" });
    const [concept] = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]).created;

    const ad = repo.addCampaignAd(alpha, concept.id);
    assert.equal(ad.format, "video");
    assert.equal(ad.awareness, "problem_aware");
    const updated = repo.updateCampaignAd(alpha, ad.id, { format: "static_ad", awareness: "unaware", hook: "  Why is your bill so high?  " });
    assert.equal(updated.format, "static_ad");
    assert.equal(updated.awareness, "unaware");
    assert.equal(updated.hook, "Why is your bill so high?", "text is trimmed");

    assert.throws(() => repo.addCampaignAd(alpha, concept.id, { format: "hologram" }), /Format must be one of/);
    assert.throws(() => repo.addCampaignAd(alpha, concept.id, { awareness: "vibes" }), /Awareness must be one of/);
    assert.throws(() => repo.createCampaign(alpha, { productId: product.id, testType: "format" }), /Test type must be one of/);

    for (let i = 0; i < 19; i += 1) repo.addCampaignAd(alpha, concept.id);
    assert.throws(() => repo.addCampaignAd(alpha, concept.id), /at most 20 ads/);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts[0].ads.length, 20);
  });
});

test("an ad carries six dimensions: awareness, direction, format, hook, beats and a call to action", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const [concept] = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]).created;

    const blank = repo.addCampaignAd(alpha, concept.id);
    assert.deepEqual([blank.direction, blank.beats, blank.cta], [null, [], null], "a new ad starts empty on the new fields");

    const ad = repo.updateCampaignAd(alpha, blank.id, {
      direction: "  A household compares one appliance before and after a change.  ",
      beats: ["Show the bill", "  Name the appliance  ", "", "Present the 3-for-2 offer"],
      cta: "Explore the bundle",
    });
    assert.equal(ad.direction, "A household compares one appliance before and after a change.");
    assert.deepEqual(ad.beats, ["Show the bill", "Name the appliance", "Present the 3-for-2 offer"], "beats are trimmed and blanks dropped");
    assert.equal(ad.cta, "Explore the bundle");
    assert.deepEqual(repo.getCampaign(alpha, campaign.id).concepts[0].ads[0].beats, ad.beats, "and they survive a reload");

    assert.equal(repo.updateCampaignAd(alpha, ad.id, { hook: "New hook" }).direction, ad.direction, "a patch leaves the other fields alone");
    assert.deepEqual(repo.updateCampaignAd(alpha, ad.id, { beats: null }).beats, [], "clearing the beats empties them");
    assert.throws(() => repo.updateCampaignAd(alpha, ad.id, { beats: "one step" }), /list of steps/);
    assert.throws(() => repo.updateCampaignAd(alpha, ad.id, { beats: Array(11).fill("x") }), /at most 10 beats/);
    assert.throws(() => repo.updateCampaignAd(alpha, ad.id, { cta: "x".repeat(201) }), /200 characters/);
  });
});

test("an ad has a short title that can be set, changed and cleared", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]);
    const conceptId = repo.getCampaign(alpha, campaign.id).concepts[0].id;
    const ad = repo.addCampaignAd(alpha, conceptId, { title: "  The Electricity Bill Mystery  " });
    assert.equal(ad.title, "The Electricity Bill Mystery");
    assert.equal(repo.addCampaignAd(alpha, conceptId).title, null, "an ad without a title has none");
    assert.equal(repo.updateCampaignAd(alpha, ad.id, { title: "No-Rewiring Demonstration" }).title, "No-Rewiring Demonstration");
    assert.equal(repo.updateCampaignAd(alpha, ad.id, { hook: "Other" }).title, "No-Rewiring Demonstration", "editing another field keeps it");
    assert.equal(repo.updateCampaignAd(alpha, ad.id, { title: "" }).title, null);
    assert.throws(() => repo.updateCampaignAd(alpha, ad.id, { title: "x".repeat(121) }), /Title/);
    assert.equal(repo.getCampaignAd(alpha, ad.id).id, ad.id);
    assert.equal(repo.getCampaignAd(alpha, "nope"), null);
    const [planned] = repo.addCampaignAds(alpha, conceptId, [{ title: "Planned idea", format: "video" }]);
    assert.equal(planned.title, "Planned idea");
  });
});

test("a generated plan is added in one step, all or nothing, and stops at the ad limit", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const [concept] = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]).created;
    const plan = [
      { awareness: "problem_aware", format: "static_ad", direction: "A bill next to an appliance.", hook: "Which appliance raised it?", beats: ["a", "b"], cta: "Learn more" },
      { awareness: "solution_aware", format: "ugc_video", direction: "A creator compares readings.", hook: "What changes when you compare?", beats: ["c", "d"], cta: "See how" },
    ];
    const added = repo.addCampaignAds(alpha, concept.id, plan);
    assert.deepEqual(added.map((ad) => [ad.awareness, ad.format]), [["problem_aware", "static_ad"], ["solution_aware", "ugc_video"]]);
    assert.deepEqual(added.map((ad) => ad.order), [0, 1]);

    // One invalid ad saves none of them.
    assert.throws(() => repo.addCampaignAds(alpha, concept.id, [plan[0], { ...plan[1], format: "hologram" }]), /Format must be one of/);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts[0].ads.length, 2);

    // A plan that would pass the limit keeps what fits.
    for (let i = 0; i < 16; i += 1) repo.addCampaignAd(alpha, concept.id);
    assert.equal(repo.addCampaignAds(alpha, concept.id, [plan[0], plan[1], plan[0], plan[1]]).length, 2, "only the room that is left");
    assert.throws(() => repo.addCampaignAds(alpha, concept.id, [plan[0]]), /at most 20 ads/);
    assert.throws(() => repo.addCampaignAds(alpha, concept.id, []), /no ads to add/);
  });
});

test("dates and spend are validated, and a cleared field stays cleared", async () => {
  await withFixture(async ({ repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const [concept] = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]).created;

    const set = repo.updateCampaignConcept(alpha, concept.id, { startDate: "2026-09-01", endDate: "2026-09-07", spend: 120.5 });
    assert.deepEqual([set.startDate, set.endDate, set.spend], ["2026-09-01", "2026-09-07", 120.5]);
    assert.throws(() => repo.updateCampaignConcept(alpha, concept.id, { endDate: "2026-08-01" }), /can't be before/);
    assert.throws(() => repo.updateCampaignConcept(alpha, concept.id, { startDate: "tomorrow" }), /must be a date/);
    assert.throws(() => repo.updateCampaignConcept(alpha, concept.id, { spend: -5 }), /Spend must be/);

    const partial = repo.updateCampaignConcept(alpha, concept.id, { endDate: null });
    assert.equal(partial.endDate, null, "null clears a field");
    assert.equal(partial.startDate, "2026-09-01", "fields not in the patch are left alone");
  });
});

test("everything is scoped to the workspace", async () => {
  await withFixture(async ({ repo, alpha, beta, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const [concept] = repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1")]).created;
    const ad = repo.addCampaignAd(alpha, concept.id);

    assert.equal(repo.getCampaign(beta, campaign.id), null);
    assert.deepEqual(repo.listCampaigns(beta, product.id), []);
    assert.equal(repo.updateCampaign(beta, campaign.id, { name: "hijack" }), null);
    assert.equal(repo.deleteCampaign(beta, campaign.id), false);
    assert.equal(repo.updateCampaignConcept(beta, concept.id, { spend: 1 }), null);
    assert.equal(repo.deleteCampaignConcept(beta, concept.id), false);
    assert.equal(repo.updateCampaignAd(beta, ad.id, { hook: "x" }), null);
    assert.equal(repo.deleteCampaignAd(beta, ad.id), false);
    assert.throws(() => repo.addCampaignConcepts(beta, campaign.id, [combo("av-1", "angle-1", "offer-1")]), /Campaign not found/);
    assert.throws(() => repo.addCampaignAd(beta, concept.id), /Concept not found/);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.length, 1, "alpha's data is intact");
  });
});

test("deleting an angle, an offer or a persona leaves the ad set and its ads; only deleting the campaign removes them", async () => {
  await withFixture(async ({ client, data, repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    repo.addCampaignConcepts(alpha, campaign.id, [
      combo("av-1", "angle-1", "offer-1"),
      combo("av-1", "angle-2", "offer-1"),
      combo("av-2", "angle-3", "offer-2"),
    ]);
    const concepts = () => repo.getCampaign(alpha, campaign.id).concepts;
    repo.addCampaignAd(alpha, concepts()[0].id, { hook: "kept" });
    assert.equal(concepts().length, 3);

    // The app's real delete path (it removes the node's edges first, then the node).
    await data.deleteStrategySubtree(alpha, "angle-1");
    await data.deleteStrategySubtree(alpha, "offer-2");
    data.persistTargetAvatars(alpha, product.id, [{ id: "av-9", label: "Someone new" }]);
    assert.equal(concepts().length, 3, "no ad set is removed by deleting what it was built from");
    assert.equal(concepts()[0].angleId, "angle-1", "the ad set keeps the id it pointed at");
    assert.equal(concepts()[0].ads[0].hook, "kept", "and its ads");

    data.deleteTargetAvatars(alpha, product.id);
    assert.equal(concepts().length, 3);

    assert.equal(repo.deleteCampaign(alpha, campaign.id), true);
    const leftover = client.getDatabasePool().query("select (select count(*) from campaign_concepts) c, (select count(*) from campaign_ads) a").rows[0];
    assert.deepEqual([leftover.c, leftover.a], [0, 0], "deleting the campaign removes its concepts and ads");
  });
});

test("a removed angle, offer or persona is relinked to another one, keeping the ad set and its ads", async () => {
  await withFixture(async ({ data, repo, alpha, beta, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    repo.addCampaignConcepts(alpha, campaign.id, [combo("av-1", "angle-1", "offer-1"), combo("av-1", "angle-2", "offer-2")]);
    const [first, second] = repo.getCampaign(alpha, campaign.id).concepts;
    repo.addCampaignAd(alpha, first.id, { hook: "still here" });

    await data.deleteStrategySubtree(alpha, "offer-1");
    const relinked = repo.relinkCampaignConcept(alpha, first.id, { offerId: "offer-2" });
    assert.equal(relinked.offerId, "offer-2");
    assert.equal(relinked.angleId, "angle-1", "the other ingredients are untouched");
    assert.equal(relinked.ads[0].hook, "still here", "the ads stay with the ad set");
    assert.equal(relinked.id, first.id);

    // Linking would make it identical to another ad set in the same campaign.
    assert.throws(() => repo.relinkCampaignConcept(alpha, first.id, { angleId: "angle-2" }), /already has an ad set/);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.find((c) => c.id === first.id).angleId, "angle-1");

    data.persistTargetAvatars(alpha, product.id, [{ id: "av-7", label: "New persona" }]);
    assert.equal(repo.relinkCampaignConcept(alpha, first.id, { avatarId: "av-7" }).avatarId, "av-7");

    assert.equal(repo.relinkCampaignConcept(beta, second.id, { offerId: "offer-1" }), null, "another workspace cannot relink it");
  });
});

test("a campaign is capped so one click cannot create hundreds of ad sets", async () => {
  await withFixture(async ({ client, data, repo, alpha, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const avatars = Array.from({ length: 6 }, (_, i) => ({ id: `bulk-av-${i}`, label: `P${i}` }));
    data.persistTargetAvatars(alpha, product.id, avatars);
    const combos = avatars.flatMap((a) => ["angle-1", "angle-2", "angle-3"].flatMap((angle) => ["offer-1", "offer-2"].map((offer) => combo(a.id, angle, offer))));
    assert.equal(combos.length, 36);
    assert.equal(repo.addCampaignConcepts(alpha, campaign.id, combos).created.length, 36);
    assert.throws(
      () => repo.addCampaignConcepts(alpha, campaign.id, Array.from({ length: 20 }, (_, i) => combo(`ghost-${i}`, "angle-1", "offer-1"))),
      /at most 50 concepts/,
    );
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.length, 36, "a rejected batch adds nothing");
    assert.ok(client);
  });
});

test("an empty ad set holds placeholders, takes ingredients one at a time, and any ingredient link can be cut again", async () => {
  await withFixture(async ({ repo, alpha, beta, product }) => {
    const campaign = repo.createCampaign(alpha, { productId: product.id });
    const first = repo.createEmptyCampaignConcept(alpha, campaign.id, { positionX: 40, positionY: 60 });
    const second = repo.createEmptyCampaignConcept(alpha, campaign.id);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.length, 2, "any number of empty ad sets can exist side by side");
    for (const id of [first.avatarId, first.angleId, first.offerId]) assert.ok(id.startsWith("~"), "an empty slot holds a placeholder id");
    assert.equal(first.positionX, 40);
    assert.equal(first.positionY, 60);

    // Linking is the existing relink: the placeholder counts as a removed ingredient.
    const linked = repo.relinkCampaignConcept(alpha, first.id, { avatarId: "av-1", offerId: "offer-1" });
    assert.equal(linked.avatarId, "av-1");
    assert.equal(linked.offerId, "offer-1");
    assert.ok(linked.angleId.startsWith("~"), "the slot that was not linked stays empty");

    // Cutting a link sends the slot back to a fresh placeholder; the ad set stays.
    const cut = repo.unlinkCampaignConceptSlot(alpha, first.id, "avatar");
    assert.ok(cut.avatarId.startsWith("~"));
    assert.equal(cut.offerId, "offer-1", "the other links are untouched");
    assert.throws(() => repo.unlinkCampaignConceptSlot(alpha, first.id, "colour"), /persona, angle or offer/);
    assert.equal(repo.unlinkCampaignConceptSlot(alpha, "no-such-id", "angle"), null);
    assert.equal(repo.getCampaign(alpha, campaign.id).concepts.length, 2);
    assert.ok(second.id !== first.id);

    assert.throws(() => repo.createEmptyCampaignConcept(beta, campaign.id), /Campaign not found/, "another workspace cannot add to it");
  });
});
