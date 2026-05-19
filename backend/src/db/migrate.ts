import { pool } from "./client.js";
import { schemaSql } from "./schema.js";

await pool.query(schemaSql);
console.log("Migration complete.");
await pool.end();
