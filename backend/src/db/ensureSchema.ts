import { pool } from "./client.js";
import { schemaSql } from "./schema.js";

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  schemaReady ??= pool.query(schemaSql).then(() => undefined);
  return schemaReady;
}
