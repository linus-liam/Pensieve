import { pool } from "../db/client.js";
import { AppError } from "../errors.js";
import { acknowledgeMemory, summarizeMemory } from "./aiService.js";
import type { CapturedMemoryEntry, MemoryEntry } from "../types.js";

const DEFAULT_LIMIT = 50;

export async function listMemoryEntries(
  userId: string,
  limit = DEFAULT_LIMIT,
  offset = 0
): Promise<MemoryEntry[]> {
  const { rows } = await pool.query<MemoryEntry>(
    `SELECT id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at
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
    `SELECT id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at
     FROM memory_entries
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  const entry = rows[0];
  if (!entry) throw new AppError(404, "memory entry not found", "not_found");
  return entry;
}

export async function createMemoryEntry(
  userId: string,
  rawInput: string
): Promise<CapturedMemoryEntry> {
  const [aiSummary, acknowledgement] = await Promise.all([
    summarizeMemory(rawInput),
    acknowledgeMemory(rawInput),
  ]);

  const { rows } = await pool.query<MemoryEntry>(
    `INSERT INTO memory_entries (user_id, title, raw_input, ai_summary)
     VALUES ($1, $2, $3, $2)
     RETURNING id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at`,
    [userId, aiSummary, rawInput]
  );
  return { ...rows[0], acknowledgement };
}

export async function updateMemoryEntry(
  userId: string,
  id: string,
  input: {
    rawInput?: string;
    summary?: string;
    title?: string;
  }
): Promise<MemoryEntry> {
  const current = await getMemoryEntry(userId, id);
  const rawInput = input.rawInput ?? current.raw_input;
  const aiSummary =
    input.summary ??
    (input.rawInput !== undefined && input.rawInput !== current.raw_input
      ? await summarizeMemory(rawInput)
      : current.ai_summary);
  const title =
    input.title ??
    (current.title === current.ai_summary && aiSummary !== current.ai_summary
      ? aiSummary
      : current.title);

  const { rows } = await pool.query<MemoryEntry>(
    `UPDATE memory_entries
     SET raw_input = $1, ai_summary = $2, title = $3
     WHERE id = $4 AND user_id = $5
     RETURNING id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at`,
    [rawInput, aiSummary, title, id, userId]
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
