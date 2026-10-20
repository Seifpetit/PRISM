import assert from "node:assert/strict";
import test from "node:test";
import { creativeExplorationAnglesTemplate } from "./input-templates/angles.template.mjs";
import { parseCreativeExplorationAnglesOutput } from "./angle-output.mjs";
import {
  creativeExplorationGenerationStatus,
  generateCreativeExplorationAngles,
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

function validAngle(index) {
  return {
    label: `Night Comfort Reframed ${index + 1}`,
    framing: `This is a supported framing territory number ${index + 1} that gives nighttime comfort a specific and useful perspective.`,
    creativePotential: "The thought is broad enough to support several distinct future advertisements without fixing an execution.",
    summary: `A compact positioning summary for territory number ${index + 1}.`,
    keyMessage: `A quotable headline line for territory number ${index + 1}.`,
    tags: ["Comfort", "Routine"],
    audienceFitNote: "Lands hardest with people who already track their sleep quality; weaker for occasional or guest use.",
  };
}

function outputWithCount(count) {
  return { angles: Array.from({ length: count }, (_, index) => validAngle(index)) };
}

test("Creative Exploration Angle schema accepts 3 through 8 items", () => {
  assert.equal(parseCreativeExplorationAnglesOutput(outputWithCount(3)).angles.length, 3);
  assert.equal(parseCreativeExplorationAnglesOutput(outputWithCount(8)).angles.length, 8);
});

test("Creative Exploration Angle schema rejects fewer than 3 and more than 8 items", () => {
  assert.throws(() => parseCreativeExplorationAnglesOutput(outputWithCount(2)), {
    code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT",
  });
  assert.throws(() => parseCreativeExplorationAnglesOutput(outputWithCount(9)), {
    code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT",
  });
});

test("Creative Exploration Angle schema enforces required fields and rejects additions", () => {
  const missingField = outputWithCount(3);
  delete missingField.angles[0].creativePotential;
  assert.throws(() => parseCreativeExplorationAnglesOutput(missingField), {
    code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT",
  });

  const extraField = outputWithCount(3);
  extraField.angles[0].platform = "social";
  assert.throws(() => parseCreativeExplorationAnglesOutput(extraField), {
    code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT",
  });

  assert.throws(
    () => parseCreativeExplorationAnglesOutput({ ...outputWithCount(3), audience: "anyone" }),
    { code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT" },
  );
});

test("Creative Exploration Angle schema requires summary, keyMessage, tags, and audienceFitNote", () => {
  for (const field of ["summary", "keyMessage", "tags", "audienceFitNote"]) {
    const missing = outputWithCount(3);
    delete missing.angles[0][field];
    assert.throws(() => parseCreativeExplorationAnglesOutput(missing), {
      code: "INVALID_CREATIVE_EXPLORATION_ANGLE_OUTPUT",
    }, `missing ${field} should be rejected`);
  }
});

test("Creative Exploration Angle prompt tells the model audience fit is qualitative, never a score", () => {
  const template = creativeExplorationAnglesTemplate({ productContext });
  assert.match(template.system, /never state or imply a percentage, score, or numeric confidence/i);
  assert.ok(
    template.output.rules.some((rule) => /never a percentage, score, or numeric confidence/i.test(rule)),
  );
});

test("Creative Exploration Angle input is Product Context and has no Audience contrast dependency", () => {
  const template = creativeExplorationAnglesTemplate({ productContext });
  assert.deepEqual(Object.keys(template.input).sort(), ["productContext", "task"]);
  assert.deepEqual(template.input.productContext, productContext);
  assert.equal("parentAudience" in template.input, false);
  assert.equal("siblingAudiences" in template.input, false);
  assert.match(template.system, /solution mechanism/);
  assert.match(template.system, /Never pad the count/);
});

test("Creative Exploration Angle generation makes one canonical model call", async () => {
  let calls = 0;
  let request;
  const result = await generateCreativeExplorationAngles({
    workspaceId: "workspace-1",
    productContext,
    operationId: "operation-1",
    related: { productId: "product-1", strategyNodeId: "product-1" },
    callModel: async (value) => {
      calls += 1;
      request = value;
      return { text: JSON.stringify(outputWithCount(3)) };
    },
  });

  assert.equal(calls, 1);
  assert.equal(request.operation, AI_OPERATIONS.CREATIVE_EXPLORATION_ANGLE_GENERATION);
  assert.equal(request.options.maxTokens, 4096);
  assert.deepEqual(JSON.parse(request.messages[0].content).productContext, productContext);
  assert.equal(result.angles.length, 3);
});

test("Creative Exploration Angle generation remains enabled alongside the Target Avatar slice", () => {
  assert.deepEqual(creativeExplorationGenerationStatus(), {
    enabled: true,
    operations: ["angles", "targetAvatars"],
  });
});
