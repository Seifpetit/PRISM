import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignToCsv,
  campaignWarnings,
  conceptBadges,
  csvCell,
  DEFAULT_VARYING,
  differingAxes,
  expandFreePick,
  expandPick,
  MAX_COMBOS_PER_ACTION,
  resolveComposerPick,
  resolveFreePick,
  testDrift,
} from "./campaign-rules.ts";

const key = (avatarId, angleId, offerId) => ({ avatarId, angleId, offerId });
const pick = (avatarIds, angleIds, offerIds) => ({ avatarIds, angleIds, offerIds });

test("an angle test needs one persona, one offer and any number of angles", () => {
  const ok = expandPick(pick(["nurse"], ["a1", "a2", "a3"], ["o1"]), "angle");
  assert.equal(ok.error, null);
  assert.deepEqual(ok.combos, [key("nurse", "a1", "o1"), key("nurse", "a2", "o1"), key("nurse", "a3", "o1")]);

  assert.match(expandPick(pick(["nurse", "student"], ["a1"], ["o1"]), "angle").error, /Angle test: pick one persona and one offer.*You picked 2 personas/);
  assert.match(expandPick(pick([], ["a1"], ["o1"]), "angle").error, /You picked 0 personas/);
  assert.match(expandPick(pick(["nurse"], ["a1"], ["o1", "o2"]), "angle").error, /You picked 2 offers/);
  assert.match(expandPick(pick(["nurse"], [], ["o1"]), "angle").error, /pick at least one angle/);
});

test("offer and persona tests fix the other two axes", () => {
  assert.deepEqual(expandPick(pick(["nurse"], ["a1"], ["o1", "o2"]), "offer").combos, [key("nurse", "a1", "o1"), key("nurse", "a1", "o2")]);
  assert.deepEqual(expandPick(pick(["nurse", "student"], ["a1"], ["o1"]), "persona").combos, [key("nurse", "a1", "o1"), key("student", "a1", "o1")]);
  assert.match(expandPick(pick(["nurse"], ["a1", "a2"], ["o1"]), "offer").error, /Offer test: pick one persona and one angle/);
});

test("adding to a campaign keeps its fixed axes, so every ad set stays comparable", () => {
  const existing = [key("nurse", "a1", "o1")];
  assert.equal(expandPick(pick(["nurse"], ["a2"], ["o1"]), "angle", existing).error, null);
  assert.match(expandPick(pick(["student"], ["a2"], ["o1"]), "angle", existing).error, /already fixes its persona/);
  assert.match(expandPick(pick(["nurse"], ["a2"], ["o2"]), "angle", existing).error, /already fixes its offer/);
});

test("one action cannot create an unbounded number of ad sets", () => {
  const many = Array.from({ length: MAX_COMBOS_PER_ACTION + 1 }, (_, i) => `a${i}`);
  assert.match(expandPick(pick(["nurse"], many, ["o1"]), "angle").error, /at most 24/);
  assert.equal(expandPick(pick(["nurse"], many.slice(0, MAX_COMBOS_PER_ACTION), ["o1"]), "angle").error, null);
});

test("badges say which axis each ad set changes relative to the baseline", () => {
  assert.deepEqual(differingAxes(key("n", "a1", "o1"), key("n", "a2", "o2")), ["angle", "offer"]);
  const concepts = [key("n", "a1", "o1"), key("n", "a2", "o1"), key("s", "a3", "o1")];
  const badges = conceptBadges(concepts, "angle");
  assert.equal(badges[0].kind, "baseline");
  assert.deepEqual([badges[1].kind, badges[1].label], ["variant", "Angle variant"]);
  assert.deepEqual([badges[2].kind, badges[2].label], ["off-test", "Also changes persona"]);
  assert.equal(conceptBadges([key("n", "a1", "o1"), key("n", "a1", "o2")], "offer")[1].label, "Offer variant");
});

test("warnings explain what would spoil the test", () => {
  assert.match(campaignWarnings([key("n", "a1", "o1")], "angle")[0], /Add at least 2 ad sets/);
  assert.deepEqual(campaignWarnings([key("n", "a1", "o1"), key("n", "a2", "o1")], "angle"), []);
  const dirty = campaignWarnings([key("n", "a1", "o1"), key("s", "a2", "o1"), key("n", "a3", "o2")], "angle");
  assert.match(dirty[0], /2 ad sets change more than the angle/);
});

test("CSV cells are quoted and spreadsheet formulas are neutralised", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), '"\'=HYPERLINK(""http://evil"")"', "a leading = becomes text, not a formula");
  assert.equal(csvCell("+1 hook"), "'+1 hook");
  assert.equal(csvCell(-5), "-5", "real negative numbers stay numbers");
  assert.equal(csvCell(null), "");
});

test("the campaign export has one row per ad and one per empty ad set", () => {
  const csv = campaignToCsv(
    {
      name: "Test 1",
      testType: "angle",
      concepts: [
        { ...key("n", "a1", "o1"), startDate: "2026-09-01", endDate: null, spend: 50, ads: [{ format: "video", awareness: "unaware", hook: "Why, though?", notes: null }, { format: "static_ad", awareness: "problem_aware", hook: null, notes: "v2" }] },
        { ...key("n", "a2", "o1"), startDate: null, endDate: null, spend: null, ads: [] },
      ],
    },
    { avatar: () => "Night nurse", angle: (id) => `Angle ${id}`, offer: () => "Buy 2 get 1" },
  );
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4, "header + 2 ads + 1 empty ad set");
  assert.match(lines[0], /^Campaign,Test type,Ad set,Persona,Angle,Offer/);
  assert.match(lines[1], /"Why, though\?"/);
  assert.match(lines[3], /Angle a2/);
});

const pool = {
  avatar: ["p1", "p2", "p3", "p4", "p5"],
  angle: ["a1", "a2", "a3", "a4"],
  offer: ["o1", "o2", "o3"],
};
const untouched = { single: {}, multi: {} };

test("a fresh composer is already a valid campaign: first fixed picks, and the varying axis pre-ticked", () => {
  const angle = resolveComposerPick(pool, "angle", untouched);
  assert.deepEqual(angle, pick(["p1"], ["a1", "a2", "a3", "a4"], ["o1"]));
  assert.equal(expandPick(angle, "angle").error, null, "the defaults satisfy the angle test's own rules");
  assert.equal(expandPick(angle, "angle").combos.length, 4);

  assert.equal(expandPick(resolveComposerPick(pool, "offer", untouched), "offer").error, null);
  const persona = resolveComposerPick(pool, "persona", untouched);
  assert.equal(persona.avatarIds.length, DEFAULT_VARYING, "only the first few personas start ticked, not all five");
  assert.equal(expandPick(persona, "persona").error, null);
});

test("the composer keeps what the user chose, drops what no longer exists, and falls back to defaults", () => {
  const chosen = { single: { avatar: "p3", offer: "o2" }, multi: { angle: ["a2", "a4"] } };
  assert.deepEqual(resolveComposerPick(pool, "angle", chosen), pick(["p3"], ["a2", "a4"], ["o2"]));

  // An id that was deleted, and a varying axis the user emptied, are respected rather than silently refilled.
  const stale = { single: { avatar: "gone" }, multi: { angle: ["a1", "gone"] } };
  assert.deepEqual(resolveComposerPick(pool, "angle", stale), pick(["p1"], ["a1"], ["o1"]));
  assert.deepEqual(resolveComposerPick(pool, "angle", { single: {}, multi: { angle: [] } }).angleIds, [], "unticking everything leaves it empty");
  assert.match(expandPick(resolveComposerPick(pool, "angle", { single: {}, multi: { angle: [] } }), "angle").error, /pick at least one angle/);
});

test("switching the test type hands a varying axis's first tick to the fixed one", () => {
  const ticked = { single: {}, multi: { angle: ["a3", "a2"] } };
  // Angle was varying with a3 first; now the offer varies and the angle becomes fixed on a3, not a1.
  assert.deepEqual(resolveComposerPick(pool, "offer", ticked), pick(["p1"], ["a3"], ["o1", "o2", "o3"]));
});

test("an axis with nothing to pick from yields an empty pick, which the rules then refuse", () => {
  const empty = resolveComposerPick({ ...pool, offer: [] }, "angle", untouched);
  assert.deepEqual(empty.offerIds, []);
  assert.match(expandPick(empty, "angle").error, /You picked 0 offers/);
});

// ── the free composer: the testing order guides, nothing blocks

test("free selection combines everything ticked and skips ad sets the campaign already has", () => {
  const existing = [key("p1", "a1", "o1"), key("p1", "a2", "o1")];
  // Same angles, a different offer and persona: the case a locked composer refused.
  const free = expandFreePick(pick(["p2"], ["a1", "a2"], ["o2"]), existing);
  assert.equal(free.error, null);
  assert.deepEqual(free.combos, [key("p2", "a1", "o2"), key("p2", "a2", "o2")]);

  // Ticking what already exists is not an error until nothing new is left.
  const overlap = expandFreePick(pick(["p1"], ["a1", "a2", "a3"], ["o1"]), existing);
  assert.deepEqual(overlap.combos, [key("p1", "a3", "o1")]);
  assert.equal(overlap.skipped, 2);
  assert.match(expandFreePick(pick(["p1"], ["a1", "a2"], ["o1"]), existing).error, /already an ad set in this campaign/);
});

test("free selection needs one of each and caps a batch", () => {
  assert.match(expandFreePick(pick([], ["a1"], ["o1"])).error, /Tick at least one persona/);
  assert.match(expandFreePick(pick(["p1"], [], ["o1"])).error, /Tick at least one angle/);
  const many = Array.from({ length: MAX_COMBOS_PER_ACTION + 1 }, (_, index) => `a${index}`);
  assert.match(expandFreePick(pick(["p1"], many, ["o1"])).error, /at most 24/);
  assert.match(expandFreePick(pick(Array(30).fill("p"), Array(30).fill("a"), Array(30).fill("o"))).error, /27000 combinations/);
});

test("free defaults keep the campaign's baseline and tick everything on the tested axis", () => {
  const baseline = key("p2", "a1", "o3");
  const fresh = resolveFreePick(pool, "angle", {}, baseline);
  assert.deepEqual(fresh, pick(["p2"], pool.angle, ["o3"]), "the baseline persona and offer, every angle");
  assert.deepEqual(expandFreePick(fresh, [baseline]).combos.length, 3, "so the default adds every angle not used yet");
  // No baseline: the first few of the tested axis, and the first of the others.
  assert.deepEqual(resolveFreePick(pool, "angle", {}), pick(["p1"], pool.angle.slice(0, DEFAULT_VARYING), ["o1"]));
  // What the user touched stays, minus ids that no longer exist.
  assert.deepEqual(resolveFreePick(pool, "angle", { offer: ["o2", "gone"], avatar: [] }, baseline), pick([], pool.angle, ["o2"]));
});

test("testDrift names what else changes, so the composer can say the test is no longer clean", () => {
  const baseline = key("p1", "a1", "o1");
  assert.deepEqual(testDrift(pick(["p1"], ["a1", "a2", "a3"], ["o1"]), "angle", baseline), [], "only the angle changes");
  assert.deepEqual(testDrift(pick(["p1"], ["a1"], ["o2"]), "angle", baseline), ["offer"]);
  assert.deepEqual(testDrift(pick(["p2", "p3"], ["a1", "a2"], ["o2"]), "angle", baseline), ["avatar", "offer"]);
  // Without a baseline, a fixed axis drifts only when more than one value is ticked.
  assert.deepEqual(testDrift(pick(["p1"], ["a1", "a2"], ["o1"]), "angle"), []);
  assert.deepEqual(testDrift(pick(["p1", "p2"], ["a1", "a2"], ["o1"]), "angle"), ["avatar"]);
});
