import { isDatabaseConfigured } from "./client.mjs";
import { readDatabaseOperationLogs } from "./operation-log-repository.mjs";
import { readCostLedgerEntries } from "../ai-cost-tracker/ledger/file-ledger.mjs";

function untracedPayload(id) {
  return {
    id,
    traceStatus: "untraced",
    representation: "normalized",
    content: null,
    redactionStatus: "not_required",
    byteSize: null,
  };
}

export function legacyOperationLogs(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const operationId = entry.operationId ?? entry.parentGenerationId ?? `untraced:${entry.id}`;
    const group = groups.get(operationId) ?? {
      id: operationId,
      operationType: entry.operation,
      status: "untraced",
      startedAt: entry.occurredAt ?? entry.createdAt,
      completedAt: null,
      durationMs: null,
      input: untracedPayload(`${operationId}:input`),
      output: untracedPayload(`${operationId}:output`),
      attempts: [],
      totalCostUsd: null,
      error: null,
      related: {
        productId: null,
        strategyNodeId: null,
        creativeId: null,
        generationId: entry.parentGenerationId ?? null,
      },
    };
    group.startedAt =
      new Date(entry.occurredAt ?? entry.createdAt) < new Date(group.startedAt)
        ? (entry.occurredAt ?? entry.createdAt)
        : group.startedAt;
    group.attempts.push({
      id: `${operationId}:attempt:${entry.attempt ?? 1}`,
      attemptNumber: entry.attempt ?? 1,
      costSource: "ai",
      provider: entry.provider,
      service: "ai_model",
      model: entry.model,
      status: "success",
      startedAt: entry.occurredAt ?? entry.createdAt,
      completedAt: entry.createdAt,
      durationMs: null,
      providerRequestId: entry.providerRequestId ?? null,
      requestOptions: entry.requestContext ?? null,
      flags:
        entry.attempt > 1
          ? [
              {
                id: "retry",
                label: "Retry attempt",
                detail: `Attempt ${entry.attempt}`,
                tone: "warning",
              },
            ]
          : [],
      error: null,
      request: untracedPayload(`${operationId}:attempt:${entry.attempt ?? 1}:input`),
      response: untracedPayload(`${operationId}:attempt:${entry.attempt ?? 1}:output`),
      rawResponse: null,
      usage: entry.normalizedUsage ?? null,
      cost: {
        status: entry.cost.status,
        usd: entry.cost.usd,
        currency: "USD",
        reason: entry.cost.reason,
        breakdown: entry.cost.breakdown ?? null,
        pricing: entry.pricing ?? null,
      },
    });
    groups.set(operationId, group);
  });
  return [...groups.values()]
    .map((group) => {
      const values = group.attempts
        .map((attempt) => Number(attempt.cost.usd))
        .filter(Number.isFinite);
      return {
        ...group,
        totalCostUsd: values.length ? String(values.reduce((sum, value) => sum + value, 0)) : null,
      };
    })
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function readOperationLogsForApi({ workspaceId, limit = 100 } = {}) {
  if (!workspaceId) throw new TypeError("Operation reads require a workspace ID.");
  if (isDatabaseConfigured()) {
    try {
      return await readDatabaseOperationLogs({ workspaceId, limit });
    } catch (error) {
      console.error(
        "[OPERATION DATABASE] Operation log read failed; serving untraced JSONL records.",
        error,
      );
    }
  }
  return legacyOperationLogs(await readCostLedgerEntries({ workspaceId, limit }));
}
