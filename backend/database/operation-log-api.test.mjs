import assert from "node:assert/strict";
import test from "node:test";
import { legacyOperationLogs } from "./operation-log-api.mjs";

function entry({ id, attempt, usd }) {
  return {
    id,
    createdAt: `2026-08-14T12:00:0${attempt}.000Z`,
    occurredAt: `2026-08-14T12:00:0${attempt}.000Z`,
    provider: "openai",
    model: "gpt-5.6-terra",
    providerRequestId: `response-${attempt}`,
    operation: "product_context_building",
    operationId: "operation-1",
    parentGenerationId: "generation-1",
    attempt,
    requestContext: { serviceMode: "standard" },
    normalizedUsage: { totalTokens: 100 * attempt },
    cost: { status: "priced", usd, reason: null, breakdown: null },
    pricing: { catalogVersion: "test" },
  };
}

test("historical retry rows become one untraced operation with attributable attempts and total cost", () => {
  const [operation] = legacyOperationLogs([
    entry({ id: "cost-1", attempt: 1, usd: "0.01" }),
    entry({ id: "cost-2", attempt: 2, usd: "0.02" }),
  ]);
  assert.equal(operation.status, "untraced");
  assert.equal(operation.input.traceStatus, "untraced");
  assert.equal(operation.output.content, null);
  assert.equal(operation.attempts.length, 2);
  assert.equal(operation.attempts[1].flags[0].id, "retry");
  assert.equal(operation.totalCostUsd, "0.03");
});
