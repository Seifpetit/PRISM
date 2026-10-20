import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mirrorCostLedgerEntry } from "../../database/operation-log-repository.mjs";

const writeQueues = new Map();

export function costLedgerPath(filePath = process.env.AI_COST_LEDGER_PATH) {
  return resolve(filePath ?? "data/ai-cost-ledger.jsonl");
}

/** Append one immutable JSONL row, then log that exact persisted row once. */
export async function appendCostLedgerRecord(entry, { filePath } = {}) {
  const target = costLedgerPath(filePath);
  const previous = writeQueues.get(target) ?? Promise.resolve();
  const write = previous.then(async () => {
    await mkdir(dirname(target), { recursive: true });
    await appendFile(target, `${JSON.stringify(entry)}\n`, { encoding: "utf8", flag: "a" });
    if (filePath === undefined) {
      try {
        await mirrorCostLedgerEntry(entry);
      } catch (error) {
        console.error(
          "[OPERATION DATABASE] Cost mirror failed; JSONL remains authoritative for this row.",
          error,
        );
      }
    }
    console.log("[AI COST LEDGER]", entry);
    return entry;
  });
  writeQueues.set(
    target,
    write.catch(() => undefined),
  );
  return write;
}

export async function readCostLedgerEntries({
  filePath,
  id,
  providerRequestId,
  parentGenerationId,
  operation,
  operationId,
  workspaceId,
  limit,
} = {}) {
  const target = costLedgerPath(filePath);
  let contents;
  try {
    contents = await readFile(target, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  let entries = contents
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Malformed AI cost ledger row ${index + 1} in ${target}`, { cause: error });
      }
    });
  if (id !== undefined) entries = entries.filter((entry) => entry.id === id);
  if (providerRequestId !== undefined)
    entries = entries.filter((entry) => entry.providerRequestId === providerRequestId);
  if (parentGenerationId !== undefined)
    entries = entries.filter((entry) => entry.parentGenerationId === parentGenerationId);
  if (operation !== undefined) entries = entries.filter((entry) => entry.operation === operation);
  if (operationId !== undefined)
    entries = entries.filter((entry) => entry.operationId === operationId);
  if (workspaceId !== undefined)
    entries = entries.filter((entry) => entry.workspaceId === workspaceId);
  if (limit !== undefined) {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new TypeError("Ledger limit must be a positive integer.");
    entries = entries.slice(-limit);
  }
  return entries;
}

export async function getCostLedgerEntry(id, options = {}) {
  const [entry] = await readCostLedgerEntries({ ...options, id, limit: 1 });
  return entry ?? null;
}
