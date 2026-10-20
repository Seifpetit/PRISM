import assert from "node:assert/strict";
import test from "node:test";
import { MERGE_MIN_OUTPUTS, planMergers } from "./merger-rule.ts";

const set = (id, p, a, o) => ({ id, avatarId: p, angleId: a, offerId: o });

test("three ad sets sharing persona and offer, differing on the angle, make one merger", () => {
  const plans = planMergers([set("s1", "P", "A1", "O"), set("s2", "P", "A2", "O"), set("s3", "P", "A3", "O")]);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].axes, ["persona", "offer"]);
  assert.deepEqual(plans[0].sharedIds, ["P", "O"]);
  assert.equal(plans[0].freeAxis, "angle");
  assert.deepEqual(plans[0].conceptIds, ["s1", "s2", "s3"]);
});

test("the rule holds on every pair of axes, not just persona and offer", () => {
  const sharedAngleOffer = planMergers([set("s1", "P1", "A", "O"), set("s2", "P2", "A", "O")]);
  assert.deepEqual(sharedAngleOffer.map((plan) => [plan.axes, plan.freeAxis]), [[["angle", "offer"], "persona"]]);
  const sharedPersonaAngle = planMergers([set("s1", "P", "A", "O1"), set("s2", "P", "A", "O2")]);
  assert.deepEqual(sharedPersonaAngle.map((plan) => [plan.axes, plan.freeAxis]), [[["persona", "angle"], "offer"]]);
});

test("a single ad set, or ad sets that share only one ingredient, make no merger", () => {
  assert.equal(planMergers([set("s1", "P", "A", "O")]).length, 0);
  assert.equal(planMergers([set("s1", "P", "A1", "O1"), set("s2", "P", "A2", "O2")]).length, 0);
});

test("the minimum group size is a threshold, not a magic number", () => {
  const two = [set("s1", "P", "A1", "O"), set("s2", "P", "A2", "O")];
  assert.equal(MERGE_MIN_OUTPUTS, 2);
  assert.equal(planMergers(two).length, 1);
  assert.equal(planMergers(two, () => true, 3).length, 0);
});

test("an ad set joins at most one merger; the largest group wins and the rest are regrouped", () => {
  // s1..s3 share P+O (3). s3 also shares P+A with s4 (2). s3 must go to the larger group only.
  const plans = planMergers([
    set("s1", "P", "A1", "O"),
    set("s2", "P", "A2", "O"),
    set("s3", "P", "A3", "O"),
    set("s4", "P", "A3", "O2"),
  ]);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].conceptIds, ["s1", "s2", "s3"]);
  const seen = plans.flatMap((plan) => plan.conceptIds);
  assert.equal(new Set(seen).size, seen.length);
});

test("ties break by pair order: persona+offer before persona+angle before angle+offer", () => {
  const plans = planMergers([set("s1", "P", "A", "O1"), set("s2", "P", "A", "O2"), set("s3", "P1", "A1", "O"), set("s4", "P1", "A2", "O")]);
  assert.deepEqual(plans.map((plan) => plan.axes), [["persona", "offer"], ["persona", "angle"]]);
});

test("ingredients that cannot be drawn are never merged", () => {
  const sets = [set("s1", "P", "A1", "O"), set("s2", "P", "A2", "O")];
  assert.equal(planMergers(sets, (axis, id) => !(axis === "persona" && id === "P")).length, 0);
  assert.equal(planMergers(sets, (axis, id) => !(axis === "offer" && id === "O")).length, 0);
});

test("the plan is stable: the same ad sets in any order give the same mergers", () => {
  const sets = [set("s1", "P", "A1", "O"), set("s2", "P", "A2", "O"), set("s3", "P", "A3", "O")];
  const forward = planMergers(sets);
  const backward = planMergers([...sets].reverse());
  assert.equal(forward[0].id, backward[0].id);
  assert.deepEqual([...forward[0].conceptIds].sort(), [...backward[0].conceptIds].sort());
});
