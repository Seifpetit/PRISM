import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabasePool, getDatabasePool } from "./client.mjs";

const migrationFilePath = fileURLToPath(import.meta.url);
const migrationDirectory = path.join(path.dirname(migrationFilePath), "migrations");

export async function runDatabaseMigrations() {
  const database = getDatabasePool();
  database.exec(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at text not null default CURRENT_TIMESTAMP
    );
  `);
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const existing = database.query("select 1 from schema_migrations where version = $1", [file]);
    if (existing.rowCount) continue;
    database.exec("BEGIN");
    try {
      database.exec(await readFile(path.join(migrationDirectory, file), "utf8"));
      database.query("insert into schema_migrations (version) values ($1)", [file]);
      database.exec("COMMIT");
      console.log(`[DATABASE] Applied ${file}`);
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === migrationFilePath) {
  runDatabaseMigrations()
    .then(() => console.log("[DATABASE] Migrations complete"))
    .finally(closeDatabasePool);
}
