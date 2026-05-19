import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "migrations");

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const filename of migrations) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM schema_migrations WHERE filename = $1",
    [filename]
  );

  if (rowCount) continue;

  const sql = readFileSync(join(migrationsDir, filename), "utf8");
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await pool.query("COMMIT");
    console.log(`Applied migration ${filename}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

console.log("Migrations complete.");
await pool.end();
