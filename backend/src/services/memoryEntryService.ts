import { pool } from "../db/client.js";
import { AppError } from "../errors.js";
import { summarizeMemory } from "./aiService.js";
import type { MemoryEntry } from "../types.js";

const DEFAULT_LIMIT = 50;

export async function listMemoryEntries(
  limit = DEFAULT_LIMIT,
  offset = 0
): Promise<MemoryEntry[]> {
  const { rows } = await pool.query<MemoryEntry>(
    `SELECT id, raw_input, ai_summary, created_at, updated_at
     FROM memory_entries
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function getMemoryEntry(id: string): Promise<MemoryEntry> {
  const { rows } = await pool.query<MemoryEntry>(
    `SELECT id, raw_input, ai_summary, created_at, updated_at
     FROM memory_entries
     WHERE id = $1`,
    [id]
  );

  const entry = rows[0];
  if (!entry) throw new AppError(404, "memory entry not found", "not_found");
  return entry;
}

export async function createMemoryEntry(rawInput: string): Promise<MemoryEntry> {
  const aiSummary = await summarizeMemory(rawInput);
  const { rows } = await pool.query<MemoryEntry>(
    `INSERT INTO memory_entries (raw_input, ai_summary)
     VALUES ($1, $2)
     RETURNING id, raw_input, ai_summary, created_at, updated_at`,
    [rawInput, aiSummary]
  );
  return rows[0];
}

export async function updateMemoryEntry(
  id: string,
  rawInput: string
): Promise<MemoryEntry> {
  await getMemoryEntry(id);
  const aiSummary = await summarizeMemory(rawInput);

  const { rows } = await pool.query<MemoryEntry>(
    `UPDATE memory_entries
     SET raw_input = $1, ai_summary = $2
     WHERE id = $3
     RETURNING id, raw_input, ai_summary, created_at, updated_at`,
    [rawInput, aiSummary, id]
  );
  return rows[0];
}

export async function deleteMemoryEntry(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM memory_entries WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
