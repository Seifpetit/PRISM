import { closeDatabasePool, databasePath, getDatabasePool } from "./client.mjs";
import { runDatabaseMigrations } from "./migrate.mjs";

try {
  getDatabasePool();
  await runDatabaseMigrations();
  console.log(`[DATABASE] SQLite database ready at ${databasePath()}`);
} finally {
  await closeDatabasePool();
}
