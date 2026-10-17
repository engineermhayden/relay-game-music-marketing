import pg from "pg";
import { readFile } from "node:fs/promises";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(7543902)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const version = "001-initial";
  const { rowCount } = await client.query(
    "SELECT 1 FROM schema_migrations WHERE version=$1",
    [version],
  );
  if (!rowCount) {
    await client.query(
      await readFile(new URL("../db/001-initial.sql", import.meta.url), "utf8"),
    );
    await client.query("INSERT INTO schema_migrations(version) VALUES($1)", [
      version,
    ]);
  }
  await client.query("COMMIT");
  console.log("Database migrations complete.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
