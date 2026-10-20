import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(databaseDirectory, "../..");
const jsonColumns = new Set([
  "request_options",
  "flags",
  "content_json",
  "raw_usage",
  "normalized_usage",
  "pricing_snapshot",
  "cost_breakdown",
  "source_json",
  "context_json",
  "node_json",
  "edge_json",
  "exploration_json",
  "event_json",
  "avatars_json",
  "canvas_json",
  "structure_json",
  "sources_json",
  "checklist_json",
]);
let database;

export function databasePath() {
  const configuredPath = process.env.DATABASE_PATH ?? "data/prism.db";
  return path.resolve(projectDirectory, configuredPath);
}

export function isDatabaseConfigured() {
  return true;
}

function normalizeValue(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return typeof value === "object" ? JSON.stringify(value) : value;
}

function normalizeSql(sql, parameters) {
  const orderedParameters = [];
  const statement = sql
    .replace(/\$(\d+)/g, (_, position) => {
      orderedParameters.push(parameters[Number(position) - 1]);
      return "?";
    })
    .replace(/now\(\)/gi, "CURRENT_TIMESTAMP");
  return { statement, parameters: orderedParameters.map(normalizeValue) };
}

function normalizeRow(row) {
  if (!row) return row;
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (jsonColumns.has(key) && typeof value === "string") {
        try {
          return [key, JSON.parse(value)];
        } catch {
          return [key, value];
        }
      }
      return [key, value];
    }),
  );
}

function createClient(connection) {
  return {
    query(sql, parameters = []) {
      const { statement, parameters: values } = normalizeSql(sql, parameters);
      const prepared = connection.prepare(statement);
      if (/^\s*(select|pragma|with)\b/i.test(statement)) {
        const rows = prepared.all(...values).map(normalizeRow);
        return { rows, rowCount: rows.length };
      }
      const result = prepared.run(...values);
      return { rows: [], rowCount: result.changes };
    },
    exec(sql) {
      connection.exec(sql.replace(/now\(\)/gi, "CURRENT_TIMESTAMP"));
    },
  };
}

export function getDatabasePool() {
  if (!database) {
    const target = databasePath();
    mkdirSync(path.dirname(target), { recursive: true });
    database = new DatabaseSync(target);
    database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  }
  return createClient(database);
}

export async function withDatabaseTransaction(callback) {
  const client = getDatabasePool();
  client.exec("BEGIN");
  try {
    const result = await callback(client);
    client.exec("COMMIT");
    return result;
  } catch (error) {
    client.exec("ROLLBACK");
    throw error;
  }
}

export async function closeDatabasePool() {
  if (!database) return;
  database.close();
  database = undefined;
}
