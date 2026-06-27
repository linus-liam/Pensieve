import { pool } from "../db/client.js";
import { AppError } from "../errors.js";
import { summarizeMemory } from "./aiService.js";
import type { MemoryEntry } from "../types.js";

const DEFAULT_LIMIT = 50;

export async function listMemoryEntries(
  userId: string,
  limit = DEFAULT_LIMIT,
  offset = 0
): Promise<MemoryEntry[]> {
  const { rows } = await pool.query<MemoryEntry>(
    `SELECT id, user_id, raw_input, ai_summary, created_at, updated_at
     FROM memory_entries
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

export async function getMemoryEntry(userId: string, id: string): Promise<MemoryEntry> {
  const { rows } = await pool.query<MemoryEntry>(
    `SELECT id, user_id, raw_input, ai_summary, created_at, updated_at
     FROM memory_entries
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  const entry = rows[0];
  if (!entry) throw new AppError(404, "memory entry not found", "not_found");
  return entry;
}

export async function createMemoryEntry(userId: string, rawInput: string): Promise<MemoryEntry> {
  const aiSummary = await summarizeMemory(rawInput);
  const { rows } = await pool.query<MemoryEntry>(
    `INSERT INTO memory_entries (user_id, raw_input, ai_summary)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, raw_input, ai_summary, created_at, updated_at`,
    [userId, rawInput, aiSummary]
  );
  return rows[0];
}

export async function updateMemoryEntry(
  userId: string,
  id: string,
  rawInput: string
): Promise<MemoryEntry> {
  await getMemoryEntry(userId, id);
  const aiSummary = await summarizeMemory(rawInput);

  const { rows } = await pool.query<MemoryEntry>(
    `UPDATE memory_entries
     SET raw_input = $1, ai_summary = $2
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, raw_input, ai_summary, created_at, updated_at`,
    [rawInput, aiSummary, id, userId]
  );

  const entry = rows[0];
  if (!entry) throw new AppError(404, "memory entry not found", "not_found");
  return entry;
}

export async function deleteMemoryEntry(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM memory_entries WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
