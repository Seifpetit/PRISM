import { AI_PROVIDER_META } from "@/data/ai-providers";
import { api } from "@/api/api";
import { AI_MODEL_OPTIONS, AI_PROVIDERS, type AiProvider } from "@/types/strategy";
import type { AiCostLedgerEntry, CostLedgerRecord } from "@/types/cost-ledger";

function isAiProvider(value: string): value is AiProvider {
  return AI_PROVIDERS.some((provider) => provider === value);
}

function readableIdentifier(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function aiLedgerEntryToCostRecord(entry: AiCostLedgerEntry): CostLedgerRecord {
  const knownProvider = isAiProvider(entry.provider) ? entry.provider : null;
  const providerLabel = knownProvider
    ? AI_PROVIDER_META[knownProvider].label
    : readableIdentifier(entry.provider);
  const modelLabel = knownProvider
    ? (AI_MODEL_OPTIONS[knownProvider].find((model) => model.id === entry.model)?.label ??
      entry.model)
    : entry.model;

  return {
    id: entry.id,
    source: { kind: "ai", label: "AI model" },
    provider: { id: entry.provider, label: providerLabel },
    service: { id: entry.model, label: modelLabel },
    operation: entry.operation,
    occurredAt: entry.occurredAt || entry.createdAt,
    usage: { total: entry.normalizedUsage?.totalTokens ?? null, unit: "tokens" },
    cost: entry.cost,
  };
}

export async function getCostLedgerRecords(): Promise<CostLedgerRecord[]> {
  const entries = await api.costLedger();
  return entries.map(aiLedgerEntryToCostRecord);
}

export async function getAiCostLedgerEntries(): Promise<AiCostLedgerEntry[]> {
  return api.costLedger();
}
