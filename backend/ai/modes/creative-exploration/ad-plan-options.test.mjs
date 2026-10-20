import assert from "node:assert/strict";
import test from "node:test";
import { adPlanConstraints, checkAdPlanAgainstOptions, normalizeAdPlanOptions } from "./ad-plan-options.mjs";
import { creativeExplorationAdPlanTemplate } from "./input-templates/ad-plan.template.mjs";
import { generateCreativeExplorationAdPlan } from "../../../creative-exploration/service.mjs";

const angle = { label: "Before-and-After Usage Check", framing: "Compare one appliance before and after a change.", creativePotential: "Many executions." };
const offer = { label: "3 Units for the Price of 2", framing: "A multi-buy bundle.", creativePotential: "Many executions." };
const avatar = { label: "Apartment household tracking a summer cooling bill", profession: "Administrator", ageRange: "30-40" };

const STAGES = ["unaware", "problem_aware", "solution_aware", "product_aware"];
const ad = (index, over = {}) => ({
  title: `Idea number ${index + 1}`,
  awareness: STAGES[index % 4],
  format: "ai_talking_head",
  direction: `A household checks one appliance and compares readings, execution ${index + 1}.`,
  hook: `Which appliance is quietly raising your bill? Version ${index + 1}`,
  beats: ["Show the bill going up.", "Name the appliance that changed.", "Explain why it happens.", "Show the mechanism.", "Present the 3-for-2 bundle.", "Explore the bundle."],
  cta: "Explore the bundle",
  ...over,
});
const plan = (count, over = () => ({})) => ({ ads: Array.from({ length: count }, (_, index) => ad(index, over(index))) });

test("nothing asked for is no options at all, so the default plan is untouched", () => {
  assert.equal(normalizeAdPlanOptions(null), null);
  assert.equal(normalizeAdPlanOptions(undefined), null);
  assert.equal(normalizeAdPlanOptions({}), null);
  assert.equal(normalizeAdPlanOptions({ format: "", awareness: null, count: null, structure: "short", note: "   " }), null);
});

test("options are checked: unknown formats, stages and structures, and counts outside 2 to 6, are refused", () => {
  const code = { code: "INVALID_AD_PLAN_OPTIONS" };
  assert.throws(() => normalizeAdPlanOptions({ format: "hologram" }), code);
  assert.throws(() => normalizeAdPlanOptions({ awareness: "most_aware" }), code);
  assert.throws(() => normalizeAdPlanOptions({ structure: "epic" }), code);
  assert.throws(() => normalizeAdPlanOptions({ count: 1 }), code);
  assert.throws(() => normalizeAdPlanOptions({ count: 7 }), code);
  assert.throws(() => normalizeAdPlanOptions({ count: 2.5 }), code);
  assert.throws(() => normalizeAdPlanOptions({ structure: "vsl", format: "photo" }), code, "a VSL is a video");
});

test("one ad per stage means at most four ads, and four when no number is given", () => {
  assert.deepEqual(normalizeAdPlanOptions({ awareness: "spread" }), { format: null, awareness: "spread", count: 4, structure: "short", note: null });
  assert.equal(normalizeAdPlanOptions({ awareness: "spread", count: 3 }).count, 3);
  assert.throws(() => normalizeAdPlanOptions({ awareness: "spread", count: 5 }), { code: "INVALID_AD_PLAN_OPTIONS" });
});

test("the note is tidied and capped, and a fixed format with VSLs is accepted", () => {
  const options = normalizeAdPlanOptions({ format: "ai_talking_head", structure: "vsl", note: `  answer   the installation\nobjection ${"x".repeat(400)}` });
  assert.equal(options.format, "ai_talking_head");
  assert.equal(options.structure, "vsl");
  assert.ok(options.note.startsWith("answer the installation objection") && options.note.length === 300);
});

test("each thing asked for becomes a sentence the model must follow", () => {
  const sentences = adPlanConstraints(normalizeAdPlanOptions({ format: "ai_talking_head", structure: "vsl", count: 3, awareness: "spread", note: "handle installation" }));
  const text = sentences.join("\n");
  assert.match(text, /exactly 3 ads/);
  assert.match(text, /format must be "ai_talking_head"/);
  assert.match(text, /different awareness stage/);
  assert.match(text, /overrides the guidance about not spreading/);
  assert.match(text, /VSL: a long-form video sales letter/);
  assert.match(text, /handle installation/);
  assert.deepEqual(adPlanConstraints(null), []);
  assert.match(adPlanConstraints(normalizeAdPlanOptions({ awareness: "problem_aware" })).join(" "), /"problem_aware" awareness stage/);
});

test("the template carries the request in its input, and stays exactly as it was without one", () => {
  const plain = creativeExplorationAdPlanTemplate({ productContext: {}, angle, offer, avatar, existingAds: [] });
  assert.deepEqual(Object.keys(plain.input).sort(), ["angle", "existingAds", "offer", "productContext", "targetAvatar", "task"]);
  assert.match(plain.input.task, /Plan 3-4 ads/);
  assert.match(plain.output.rules[0], /Return 3-4 ads/);

  const options = normalizeAdPlanOptions({ format: "ai_talking_head", count: 2 });
  const asked = creativeExplorationAdPlanTemplate({ productContext: {}, angle, offer, avatar, existingAds: [], options });
  assert.match(asked.input.task, /Plan 2 ads/);
  assert.ok(asked.input.personRequest.length === 2);
  assert.match(asked.output.rules[0], /Follow personRequest exactly/);
  assert.equal(asked.system, plain.system, "the editable system prompt is not touched");
});

test("a plan that ignores the request is refused, one that follows it passes", () => {
  const code = { code: "AD_PLAN_OPTIONS_NOT_MET" };
  assert.equal(checkAdPlanAgainstOptions(plan(3), null).ads.length, 3);
  assert.doesNotThrow(() => checkAdPlanAgainstOptions(plan(3), normalizeAdPlanOptions({ count: 3, format: "ai_talking_head" })));
  assert.throws(() => checkAdPlanAgainstOptions(plan(3), normalizeAdPlanOptions({ count: 4 })), code);
  assert.throws(() => checkAdPlanAgainstOptions(plan(3, (i) => (i === 1 ? { format: "photo" } : {})), normalizeAdPlanOptions({ format: "ai_talking_head" })), code);
  assert.doesNotThrow(() => checkAdPlanAgainstOptions(plan(4), normalizeAdPlanOptions({ awareness: "spread" })));
  assert.throws(() => checkAdPlanAgainstOptions(plan(4, () => ({ awareness: "unaware" })), normalizeAdPlanOptions({ awareness: "spread" })), code, "stages repeated");
  assert.doesNotThrow(() => checkAdPlanAgainstOptions(plan(3, () => ({ awareness: "product_aware" })), normalizeAdPlanOptions({ awareness: "product_aware" })));
  assert.throws(() => checkAdPlanAgainstOptions(plan(3), normalizeAdPlanOptions({ awareness: "product_aware" })), code);
  assert.doesNotThrow(() => checkAdPlanAgainstOptions(plan(2), normalizeAdPlanOptions({ structure: "vsl" })));
  assert.throws(() => checkAdPlanAgainstOptions(plan(2, () => ({ beats: ["One beat only.", "Two beats only."] })), normalizeAdPlanOptions({ structure: "vsl" })), code, "a VSL has a long script");
  assert.throws(() => checkAdPlanAgainstOptions(plan(2, () => ({ format: "static_ad" })), normalizeAdPlanOptions({ structure: "vsl" })), code, "a VSL is a video");
});

test("generation with options asks the (fake) model again when it ignores them, then returns the plan that follows them", async () => {
  let calls = 0;
  const sent = [];
  const result = await generateCreativeExplorationAdPlan({
    workspaceId: "workspace-1",
    productContext: {},
    angle,
    offer,
    avatar,
    existingAds: [],
    options: normalizeAdPlanOptions({ format: "ai_talking_head", awareness: "spread", count: 4 }),
    operationId: "operation-options",
    callModel: async (request) => {
      calls += 1;
      sent.push(JSON.parse(request.messages[0].content));
      // First answer: three ads in the wrong format. Second: four, in the right format, one per stage.
      return { text: JSON.stringify(calls === 1 ? plan(3, () => ({ format: "video" })) : plan(4)) };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.ads.length, 4);
  assert.ok(result.ads.every((item) => item.format === "ai_talking_head"));
  assert.equal(new Set(result.ads.map((item) => item.awareness)).size, 4);
  assert.match(sent[0].personRequest.join(" "), /exactly 4 ads/);
});
