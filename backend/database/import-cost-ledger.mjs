import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabasePool, withDatabaseTransaction } from "./client.mjs";
import { runDatabaseMigrations } from "./migrate.mjs";
import { importCostLedgerEntry } from "./operation-log-repository.mjs";
import { costLedgerPath } from "../ai-cost-tracker/ledger/file-ledger.mjs";

const importerFilePath = fileURLToPath(import.meta.url);

export async function importJsonlCostLedger({
  filePath,
  workspaceId = process.env.PRISM_IMPORT_WORKSPACE_ID,
} = {}) {
  if (!workspaceId) {
    throw new Error(
      "Set PRISM_IMPORT_WORKSPACE_ID to explicitly assign imported ledger rows to a workspace.",
    );
  }
  await runDatabaseMigrations();
  const target = costLedgerPath(filePath);
  const contents = await readFile(target, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "";
    throw error;
  });
  const entries = contents
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${target}:${index + 1}`, { cause: error });
      }
    });
  await withDatabaseTransaction(async (client) => {
    for (const entry of entries) {
      await importCostLedgerEntry(
        client,
        { ...entry, workspaceId },
        { historical: true },
      );
    }
  });
  console.log(
    `[DATABASE] Imported ${entries.length} cost ledger records from ${path.resolve(target)}`,
  );
  return entries.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === importerFilePath) {
  importJsonlCostLedger().finally(closeDatabasePool);
}
