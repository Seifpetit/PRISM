import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CHOICES, PRESETS, activePreset, countLimits, tidy, toRequest } from "./ad-plan-options.ts";

test("choosing nothing sends nothing, so the default generation is exactly what it was", () => {
  assert.equal(toRequest(DEFAULT_CHOICES), undefined);
  assert.equal(toRequest({ ...DEFAULT_CHOICES, note: "   " }), undefined);
});

test("what was chosen is sent, and the note is tidied", () => {
  assert.deepEqual(toRequest({ format: "ai_talking_head", awareness: "spread", count: 4, structure: "vsl", note: "  handle   the installation\nobjection " }), {
    format: "ai_talking_head", awareness: "spread", count: 4, structure: "vsl", note: "handle the installation objection",
  });
  assert.equal(toRequest({ ...DEFAULT_CHOICES, count: 3 })?.count, 3);
});

test("the presets are the requests people make most, and any hand change makes the choice custom", () => {
  for (const preset of PRESETS) assert.equal(activePreset(preset.choices), preset.id);
  const stages = PRESETS.find((preset) => preset.id === "stages").choices;
  assert.equal(activePreset({ ...stages, count: 3 }), "custom");
  assert.equal(activePreset({ ...DEFAULT_CHOICES, note: "focus on price objections" }), "custom");
  assert.deepEqual([stages.awareness, stages.count], ["spread", 4]);
  const vsl = PRESETS.find((preset) => preset.id === "vsl").choices;
  assert.deepEqual([vsl.format, vsl.structure], ["ai_talking_head", "vsl"]);
});

test("how many ads may be asked for depends on the room left and on one-per-stage", () => {
  assert.deepEqual(countLimits(DEFAULT_CHOICES, 20), { min: 2, max: 6 });
  assert.deepEqual(countLimits(DEFAULT_CHOICES, 3), { min: 2, max: 3 });
  assert.deepEqual(countLimits({ ...DEFAULT_CHOICES, awareness: "spread" }, 20), { min: 2, max: 4 });
  assert.equal(countLimits(DEFAULT_CHOICES, 0).max, 0);
});

test("choices that contradict each other are resolved so the request can always be done", () => {
  assert.equal(tidy({ ...DEFAULT_CHOICES, format: "photo", structure: "vsl" }, 20).format, null, "a VSL is a video");
  assert.equal(tidy({ ...DEFAULT_CHOICES, format: "ugc_video", structure: "vsl" }, 20).format, "ugc_video");
  assert.equal(tidy({ ...DEFAULT_CHOICES, awareness: "spread", count: 6 }, 20).count, 4, "one per stage is at most four");
  assert.equal(tidy({ ...DEFAULT_CHOICES, count: 6 }, 3).count, 3, "no more than the ad set has room for");
  assert.equal(tidy({ ...DEFAULT_CHOICES, count: 3 }, 1).count, null, "no room for a plan at all");
  assert.equal(tidy({ ...DEFAULT_CHOICES, note: "x".repeat(400) }, 20).note.length, 300);
});
