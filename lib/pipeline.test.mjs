import assert from "node:assert/strict";
import test from "node:test";
import { badgeFor, groupByStage, moveInList, progressOf, stageAge, stageInfo, STAGE_IDS, STAGES, tasksForAd } from "./pipeline.ts";

const task = (id, stage, sortOrder, extra = {}) => ({ id, adId: "ad-1", stage, sortOrder, createdAt: `2026-09-0${sortOrder}T00:00:00.000Z`, stageChangedAt: "2026-09-01T00:00:00.000Z", checklist: [], ...extra });

test("the pipeline has the eight stages in the agreed order, each with a meaning", () => {
  assert.deepEqual(STAGES.map((stage) => stage.label), ["Planned", "Script / Brief", "Approved for production", "In production", "In editing", "In review", "Ready to launch", "Launched"]);
  assert.ok(STAGES.every((stage) => stage.meaning.length > 10 && stage.color));
  assert.equal(stageInfo("in_editing").label, "In editing");
  assert.equal(stageInfo("nonsense").id, "planned", "an unknown stage reads as Planned rather than breaking the board");
});

test("tasks are grouped into every column in their order, and an empty stage still has its column", () => {
  const columns = groupByStage([task("b", "planned", 2), task("a", "planned", 1), task("c", "launched", 1)]);
  assert.deepEqual(Object.keys(columns), STAGE_IDS);
  assert.deepEqual(columns.planned.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(columns.in_review, []);
  assert.equal(columns.launched[0].id, "c");
});

test("an optimistic move renumbers the target column like the server, and only a stage change refreshes the stage time", () => {
  const tasks = [task("a", "planned", 1), task("b", "planned", 2), task("c", "planned", 3), task("d", "in_editing", 1)];
  const moved = moveInList(tasks, "c", "planned", 0, "2026-09-10T00:00:00.000Z");
  assert.deepEqual(groupByStage(moved).planned.map((t) => [t.id, t.sortOrder]), [["c", 1], ["a", 2], ["b", 3]]);
  assert.equal(moved.find((t) => t.id === "c").stageChangedAt, "2026-09-01T00:00:00.000Z", "the same stage keeps its time");

  const across = moveInList(tasks, "a", "in_editing", 0, "2026-09-10T00:00:00.000Z");
  assert.deepEqual(groupByStage(across).in_editing.map((t) => t.id), ["a", "d"]);
  assert.equal(across.find((t) => t.id === "a").stageChangedAt, "2026-09-10T00:00:00.000Z");
  assert.deepEqual(groupByStage(across).planned.map((t) => t.id), ["b", "c"]);

  assert.deepEqual(groupByStage(moveInList(tasks, "a", "in_editing", null)).in_editing.map((t) => t.id), ["d", "a"], "no position means the end");
  assert.deepEqual(groupByStage(moveInList(tasks, "a", "in_editing", 99)).in_editing.map((t) => t.id), ["d", "a"], "past the end means the end");
  assert.equal(moveInList(tasks, "ghost", "launched", 0), tasks, "an unknown task changes nothing");
});

test("an ad's badge shows its furthest task and how many more it has", () => {
  const tasks = [task("a", "in_editing", 1), task("b", "planned", 2), task("c", "in_review", 3), task("x", "launched", 4, { adId: "ad-2" })];
  const forAd = tasksForAd(tasks, "ad-1");
  assert.deepEqual(forAd.map((t) => t.id), ["c", "a", "b"]);
  const badge = badgeFor(forAd);
  assert.deepEqual([badge.label, badge.more, badge.task.id], ["Review", 2, "c"], "the badge uses the short name");
  assert.equal(badgeFor([]), null);
});

test("checklist progress and how long a task has been in its stage", () => {
  assert.deepEqual(progressOf({ checklist: [{ done: true }, { done: false }, { done: true }] }), { done: 2, total: 3 });
  const now = new Date("2026-09-10T12:00:00.000Z").getTime();
  assert.equal(stageAge("2026-09-10T01:00:00.000Z", now), "today");
  assert.equal(stageAge("2026-09-09T01:00:00.000Z", now), "1 day");
  assert.equal(stageAge("2026-09-05T00:00:00.000Z", now), "5 days");
});
