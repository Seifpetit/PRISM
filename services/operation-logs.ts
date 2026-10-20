import { api } from "@/api/api";
import { AI_PROVIDER_META } from "@/data/ai-providers";
import { AI_MODEL_OPTIONS, AI_PROVIDERS, type AiProvider } from "@/types/strategy";
import type { AiCostLedgerEntry } from "@/types/cost-ledger";
import type { OperationLog } from "@/types/operation-log";

function isAiProvider(value?: string | null): value is AiProvider {
  return Boolean(value && AI_PROVIDERS.some((provider) => provider === value));
}

function readableIdentifier(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labels(logs: OperationLog[]) {
  return logs.map((log) => ({
    ...log,
    attempts: log.attempts.map((attempt) => {
      const provider = isAiProvider(attempt.provider)
        ? AI_PROVIDER_META[attempt.provider].label
        : attempt.provider
          ? readableIdentifier(attempt.provider)
          : null;
      const model = isAiProvider(attempt.provider)
        ? (AI_MODEL_OPTIONS[attempt.provider].find((option) => option.id === attempt.model)
            ?.label ?? attempt.model)
        : attempt.model;
      return { ...attempt, provider, model };
    }),
  }));
}

export function aiLedgerEntriesToOperationLogs(entries: AiCostLedgerEntry[]): OperationLog[] {
  return labels(
    entries.map((entry) => {
      const operationId = entry.operationId ?? entry.parentGenerationId ?? `untraced:${entry.id}`;
      return {
        id: operationId,
        operationType: entry.operation,
        status: "untraced",
        startedAt: entry.occurredAt || entry.createdAt,
        completedAt: null,
        durationMs: null,
        input: {
          id: `${operationId}:input`,
          traceStatus: "untraced",
          representation: "normalized",
          content: null,
          redactionStatus: "not_required",
        },
        output: {
          id: `${operationId}:output`,
          traceStatus: "untraced",
          representation: "normalized",
          content: null,
          redactionStatus: "not_required",
        },
        attempts: [
          {
            id: `${operationId}:attempt:${entry.attempt}`,
            attemptNumber: entry.attempt,
            costSource: "ai",
            provider: entry.provider,
            service: "ai_model",
            model: entry.model,
            status: "success",
            startedAt: entry.occurredAt || entry.createdAt,
            completedAt: entry.createdAt,
            durationMs: null,
            providerRequestId: entry.providerRequestId,
            requestOptions: entry.requestContext,
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
            request: {
              id: `${entry.id}:input`,
              traceStatus: "untraced",
              representation: "normalized",
              content: null,
              redactionStatus: "not_required",
            },
            response: {
              id: `${entry.id}:output`,
              traceStatus: "untraced",
              representation: "normalized",
              content: null,
              redactionStatus: "not_required",
            },
            usage: entry.normalizedUsage ? { ...entry.normalizedUsage } : null,
            cost: {
              ...entry.cost,
              currency: "USD",
              breakdown: entry.cost.breakdown,
              pricing: entry.pricing,
            },
          },
        ],
        totalCostUsd: entry.cost.usd,
        error: null,
        related: { generationId: entry.parentGenerationId },
      } satisfies OperationLog;
    }),
  ).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export async function getOperationLogs(
  fallbackEntries: AiCostLedgerEntry[] = [],
): Promise<OperationLog[]> {
  try {
    return labels(await api.operationLogs({ limit: 100 }));
  } catch {
    return aiLedgerEntriesToOperationLogs(fallbackEntries);
  }
}
