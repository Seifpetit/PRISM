import assert from "node:assert/strict";
import test from "node:test";
import { creativeExplorationTargetAvatarsTemplate } from "./input-templates/target-avatars.template.mjs";
import { parseCreativeExplorationTargetAvatarsOutput } from "./target-avatar-output.mjs";
import {
  creativeExplorationGenerationStatus,
  generateCreativeExplorationTargetAvatars,
} from "../../../creative-exploration/service.mjs";
import { AI_OPERATIONS } from "../../workflow-operations.mjs";

const productContext = {
  id: "context-cloud-pillow",
  name: "Cloud Pillow",
  workingLabel: "Temperature-regulating ergonomic pillow",
  category: "Sleep accessories",
  summary: "A pillow designed to support a cooler, more comfortable sleep experience.",
  features: ["Temperature-regulating surface", "Ergonomic shape"],
  mechanisms: ["Temperature-regulating construction"],
  benefits: ["More consistent nighttime comfort"],
  proofPoints: [],
  useCases: ["Nighttime sleep"],
  claims: [],
  constraints: ["Do not claim medical outcomes"],
  sourceIds: ["source-1"],
  createdAt: "2026-08-28T00:00:00.000Z",
};

function validTargetAvatar(index) {
  return {
    label: `Night Routine Profile ${index + 1}`,
    gender: index % 2 ? "male" : "female",
    ageRange: `${28 + index}-${34 + index}`,
    profession: `Plausible profession ${index + 1}`,
    lifeRhythm: "Long workdays, regular screen use, and limited time to wind down before bed.",
    painPoint: "Small recurring discomforts make already-limited rest feel less restorative.",
    productConnection: "The temperature-regulating surface is positioned to reduce that nightly discomfort.",
    priorities: "Convenience, credible comfort, and feeling functional the next morning.",
    buyingContext: "Compares practical comfort products online when the benefit feels immediate and believable.",
  };
}

function outputWithCount(count) {
  return {
    targetAvatars: Array.from({ length: count }, (_, index) => validTargetAvatar(index)),
  };
}

test("Target Avatar schema accepts the requested count and rejects any other count", () => {
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(10), 10).targetAvatars.length, 10);
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(3), 3).targetAvatars.length, 3);
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(20), 20).targetAvatars.length, 20);

  assert.throws(() => parseCreativeExplorationTargetAvatarsOutput(outputWithCount(9), 10), {
    code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT",
  });
  assert.throws(() => parseCreativeExplorationTargetAvatarsOutput(outputWithCount(11), 10), {
    code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT",
  });
});

test("Target Avatar count is clamped to the supported 3-20 range", () => {
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(3), 0).targetAvatars.length, 3);
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(20), 999).targetAvatars.length, 20);
  assert.equal(parseCreativeExplorationTargetAvatarsOutput(outputWithCount(10), undefined).targetAvatars.length, 10);
});

test("Target Avatar schema enforces every field and rejects additional properties", () => {
  const missingField = outputWithCount(10);
  delete missingField.targetAvatars[0].buyingContext;
  assert.throws(() => parseCreativeExplorationTargetAvatarsOutput(missingField, 10), {
    code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT",
  });

  const extraItemField = outputWithCount(10);
  extraItemField.targetAvatars[0].talkingHead = "creator";
  assert.throws(() => parseCreativeExplorationTargetAvatarsOutput(extraItemField, 10), {
    code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT",
  });

  assert.throws(
    () => parseCreativeExplorationTargetAvatarsOutput({ ...outputWithCount(10), selected: true }, 10),
    { code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT" },
  );

  const oldFieldShape = outputWithCount(10);
  delete oldFieldShape.targetAvatars[0].painPoint;
  oldFieldShape.targetAvatars[0].frustrations = "Old field name should no longer validate.";
  assert.throws(() => parseCreativeExplorationTargetAvatarsOutput(oldFieldShape, 10), {
    code: "INVALID_CREATIVE_EXPLORATION_TARGET_AVATAR_OUTPUT",
  });
});

test("Target Avatar input uses Product Context and the requested count, and excludes downstream generation", () => {
  const template = creativeExplorationTargetAvatarsTemplate({ productContext, count: 12 });
  assert.deepEqual(Object.keys(template.input).sort(), ["productContext", "task"]);
  assert.deepEqual(template.input.productContext, productContext);
  assert.match(template.input.task, /exactly 12/);
  assert.equal("angle" in template.input, false);
  assert.match(template.system, /exactly 12/);
  assert.match(template.system, /pain point/i);
  assert.match(template.system, /product's actual solution|product connection|productConnection/i);
  assert.match(template.system, /not a research finding/i);
  assert.match(template.system, /Do not generate Talking Heads/i);
  assert.doesNotMatch(JSON.stringify(template.output.shape), /talkingHead/i);
  assert.equal(template.outputSchema.properties.targetAvatars.minItems, 12);
  assert.equal(template.outputSchema.properties.targetAvatars.maxItems, 12);
});

test("Target Avatar generation makes one canonical, cost-attributed model call for the requested count", async () => {
  let calls = 0;
  let request;
  const result = await generateCreativeExplorationTargetAvatars({
    workspaceId: "workspace-1",
    productContext,
    count: 7,
    operationId: "operation-1",
    related: { productId: "product-1", strategyNodeId: "product-1" },
    callModel: async (value) => {
      calls += 1;
      request = value;
      return { text: JSON.stringify(outputWithCount(7)) };
    },
  });

  assert.equal(calls, 1);
  assert.equal(request.operation, AI_OPERATIONS.CREATIVE_EXPLORATION_TARGET_AVATAR_GENERATION);
  assert.equal(request.parentGenerationId, "operation-1");
  assert.equal(request.options.maxTokens, 4096);
  assert.deepEqual(JSON.parse(request.messages[0].content).productContext, productContext);
  assert.equal(result.targetAvatars.length, 7);
});

test("Creative Exploration enables no downstream Talking Head or direction operation", () => {
  const status = creativeExplorationGenerationStatus();
  assert.deepEqual(status.operations, ["angles", "targetAvatars"]);
  assert.equal(status.operations.some((operation) => /talking|head|direction/i.test(operation)), false);
});
