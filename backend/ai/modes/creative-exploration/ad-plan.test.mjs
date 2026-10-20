import assert from "node:assert/strict";
import test from "node:test";
import { creativeExplorationAdPlanTemplate } from "./input-templates/ad-plan.template.mjs";
import { parseCreativeExplorationAdPlanOutput } from "./ad-plan-output.mjs";
import { creativeExplorationAdHooksTemplate } from "./input-templates/ad-hooks.template.mjs";
import { parseCreativeExplorationAdHooksOutput } from "./ad-hooks-output.mjs";
import {
  creativeExplorationPromptTemplateIds,
  generateCreativeExplorationAdHooks,
  generateCreativeExplorationAdPlan,
  readCreativeExplorationPromptTemplate,
} from "../../../creative-exploration/service.mjs";
import { AI_OPERATIONS } from "../../workflow-operations.mjs";

const angle = { label: "Before-and-After Usage Check", framing: "Compare one appliance before and after a change.", creativePotential: "Many executions." };
const offer = { label: "3 Units for the Price of 2", framing: "A multi-buy bundle.", creativePotential: "Many executions." };
const avatar = { label: "Apartment household tracking a summer cooling bill", profession: "Administrator", ageRange: "30-40" };

function validAd(index) {
  return {
    title: `Idea number ${index + 1}`,
    awareness: ["problem_aware", "solution_aware", "product_aware", "unaware"][index % 4],
    format: ["static_ad", "ugc_video", "video", "carousel"][index % 4],
    direction: `A household checks one appliance and compares readings, execution ${index + 1}.`,
    hook: `Which appliance is quietly raising your bill? Version ${index + 1}`,
    beats: ["Show the bill going up.", "Name the appliance that changed.", "Present the 3-for-2 bundle."],
    cta: "Explore the bundle",
  };
}

const planWith = (count) => ({ ads: Array.from({ length: count }, (_, index) => validAd(index)) });

test("the ad plan schema accepts 2 through 6 ads", () => {
  assert.equal(parseCreativeExplorationAdPlanOutput(planWith(2)).ads.length, 2);
  assert.equal(parseCreativeExplorationAdPlanOutput(planWith(6)).ads.length, 6);
});

test("the ad plan schema rejects a wrong count, a bad stage or format, missing fields and extras", () => {
  const code = { code: "INVALID_CREATIVE_EXPLORATION_AD_PLAN_OUTPUT" };
  assert.throws(() => parseCreativeExplorationAdPlanOutput(planWith(1)), code);
  assert.throws(() => parseCreativeExplorationAdPlanOutput(planWith(7)), code);
  const badStage = planWith(3);
  badStage.ads[0].awareness = "most_aware";
  assert.throws(() => parseCreativeExplorationAdPlanOutput(badStage), code);
  const badFormat = planWith(3);
  badFormat.ads[1].format = "hologram";
  assert.throws(() => parseCreativeExplorationAdPlanOutput(badFormat), code);
  const missing = planWith(3);
  delete missing.ads[2].cta;
  assert.throws(() => parseCreativeExplorationAdPlanOutput(missing), code);
  const untitled = planWith(3);
  delete untitled.ads[0].title;
  assert.throws(() => parseCreativeExplorationAdPlanOutput(untitled), code, "every ad names its idea");
  const extra = planWith(3);
  extra.ads[0].platform = "meta";
  assert.throws(() => parseCreativeExplorationAdPlanOutput(extra), code);
});

test("the ad plan prompt fixes the concept, defines awareness, and never opens a less-aware ad with the offer", () => {
  const template = creativeExplorationAdPlanTemplate({ productContext: {}, angle, offer, avatar, existingAds: [{ awareness: "problem_aware", format: "video" }] });
  assert.deepEqual(Object.keys(template.input).sort(), ["angle", "existingAds", "offer", "productContext", "targetAvatar", "task"]);
  assert.deepEqual(template.input.angle, angle);
  assert.deepEqual(template.input.offer, offer);
  assert.equal(template.input.existingAds.length, 1);
  assert.match(template.system, /FIXED/);
  assert.match(template.system, /unaware: does not recognize the problem/);
  assert.match(template.system, /Never open a less-aware ad with the offer/);
  assert.match(template.system, /not a grid/);
  assert.match(template.system, /title: a short name for the creative idea/);
  assert.match(template.system, /Two ads may share an awareness stage when their ideas differ/);
  assert.match(template.system, /never the same idea twice/);
  // The default system prompt is shown in Settings with no arguments at all.
  assert.match(creativeExplorationAdPlanTemplate().system, /You plan the ads inside one ad set/);
});

test("ad plan generation makes one canonical model call and returns the ads", async () => {
  let calls = 0;
  let request;
  const result = await generateCreativeExplorationAdPlan({
    workspaceId: "workspace-1",
    productContext: { name: "Acme" },
    angle,
    offer,
    avatar,
    existingAds: [],
    operationId: "operation-1",
    related: { productId: "product-1", strategyNodeId: "product-1" },
    callModel: async (value) => {
      calls += 1;
      request = value;
      return { text: JSON.stringify(planWith(3)) };
    },
  });
  assert.equal(calls, 1);
  assert.equal(request.operation, AI_OPERATIONS.CREATIVE_EXPLORATION_AD_PLAN_GENERATION);
  assert.equal(request.options.maxTokens, 5000);
  const sent = JSON.parse(request.messages[0].content);
  assert.deepEqual(sent.angle, angle);
  assert.deepEqual(sent.offer, offer);
  assert.equal(result.ads.length, 3);
});

test("ad plan generation asks again once when the first answer is unusable", async () => {
  let calls = 0;
  const result = await generateCreativeExplorationAdPlan({
    workspaceId: "workspace-1",
    productContext: {},
    angle,
    offer,
    avatar,
    operationId: "operation-2",
    callModel: async () => {
      calls += 1;
      return { text: JSON.stringify(calls === 1 ? planWith(1) : planWith(3)) };
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.ads.length, 3);
});

const ad = {
  title: "The Electricity Bill Mystery",
  awareness: "problem_aware",
  format: "ugc_video",
  direction: "A tenant holds the monthly bill and tries to work out which appliance changed.",
  hook: "My bill went up and I have no idea which appliance did it.",
  beats: ["Show the bill.", "Name the mystery.", "Present the bundle."],
  cta: "Explore the bundle",
};
const hooksWith = (count) => ({ hooks: Array.from({ length: count }, (_, index) => `A different opening ${index + 1}, a concrete kitchen scene.`) });

test("hook alternatives: the schema takes 3 to 8 hooks, trims and de-duplicates them, and rejects the rest", () => {
  const code = { code: "INVALID_CREATIVE_EXPLORATION_AD_HOOKS_OUTPUT" };
  assert.equal(parseCreativeExplorationAdHooksOutput(hooksWith(5)).length, 5);
  assert.deepEqual(
    parseCreativeExplorationAdHooksOutput({ hooks: ["  The same opening line  ", "the same opening line", "Another opening line", "A third opening line"] }),
    ["The same opening line", "Another opening line", "A third opening line"],
  );
  assert.throws(() => parseCreativeExplorationAdHooksOutput(hooksWith(2)), code);
  assert.throws(() => parseCreativeExplorationAdHooksOutput(hooksWith(9)), code);
  assert.throws(() => parseCreativeExplorationAdHooksOutput({ hooks: ["ok", "ok", "ok"] }), code);
  assert.throws(() => parseCreativeExplorationAdHooksOutput({ hooks: hooksWith(3).hooks, extra: true }), code);
});

test("the hook prompt fixes everything except the hook and keeps less-aware hooks free of the product", () => {
  const template = creativeExplorationAdHooksTemplate({ productContext: {}, angle, offer, avatar, ad });
  assert.deepEqual(Object.keys(template.input).sort(), ["ad", "angle", "offer", "productContext", "targetAvatar", "task"]);
  assert.deepEqual(template.input.ad, ad);
  assert.match(template.system, /Only the hook changes/);
  assert.match(template.system, /must not name the product or the offer/);
  assert.match(template.system, /not rewordings/);
  assert.match(creativeExplorationAdHooksTemplate().system, /You write alternative hooks for one ad/);
});

test("hook generation makes one model call on its own operation and returns the hooks", async () => {
  let request;
  const hooks = await generateCreativeExplorationAdHooks({
    workspaceId: "workspace-1",
    productContext: {},
    angle,
    offer,
    avatar,
    ad,
    operationId: "operation-3",
    callModel: async (value) => {
      request = value;
      return { text: JSON.stringify(hooksWith(5)) };
    },
  });
  assert.equal(hooks.length, 5);
  assert.equal(request.operation, AI_OPERATIONS.CREATIVE_EXPLORATION_AD_HOOKS_GENERATION);
  assert.equal(request.options.maxTokens, 2000);
  assert.deepEqual(JSON.parse(request.messages[0].content).ad, ad);
});

test("both ad prompts are editable templates, saved under their own ids", () => {
  assert.equal(creativeExplorationPromptTemplateIds.adPlan, "creative_exploration_ad_plan");
  assert.equal(creativeExplorationPromptTemplateIds.adHooks, "creative_exploration_ad_hooks");
  assert.match(readCreativeExplorationPromptTemplate(null, "creative_exploration_ad_hooks").content, /You write alternative hooks/);
});
