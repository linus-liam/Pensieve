import type { PoolClient } from "pg";
import { pool } from "../db/client.js";
import { AppError } from "../errors.js";
import { continueReflection } from "./aiService.js";
import type {
  MemoryEntry,
  ReflectionMessage,
  ReflectionSession,
  ReflectionSessionDetail,
} from "../types.js";

export const INITIAL_REFLECTION_PROMPT = "I'm here. What feels worth remembering right now?";

const sessionColumns = "id, user_id, title, status, created_at, updated_at";
const messageColumns =
  "id, session_id, user_id, client_message_id, reply_to_message_id, role, content, metadata, created_at";

async function loadMessages(client: PoolClient, userId: string, sessionId: string) {
  const { rows } = await client.query<ReflectionMessage>(
    `SELECT ${messageColumns}
     FROM reflection_messages
     WHERE session_id = $1 AND user_id = $2
     ORDER BY created_at ASC, id ASC`,
    [sessionId, userId]
  );
  return rows;
}

export async function getReflectionSession(
  userId: string,
  sessionId: string
): Promise<ReflectionSessionDetail> {
  const { rows } = await pool.query<ReflectionSession>(
    `SELECT ${sessionColumns}
     FROM reflection_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  const session = rows[0];
  if (!session) throw new AppError(404, "reflection session not found", "not_found");

  const client = await pool.connect();
  try {
    return { session, messages: await loadMessages(client, userId, sessionId) };
  } finally {
    client.release();
  }
}

export async function getActiveReflectionSession(
  userId: string
): Promise<ReflectionSessionDetail | null> {
  const { rows } = await pool.query<ReflectionSession>(
    `SELECT ${sessionColumns}
     FROM reflection_sessions
     WHERE user_id = $1 AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] ? getReflectionSession(userId, rows[0].id) : null;
}

export async function createReflectionSession(
  userId: string,
  options: { replaceActive?: boolean } = {}
): Promise<ReflectionSessionDetail> {
  if (!options.replaceActive) {
    const existing = await getActiveReflectionSession(userId);
    if (existing) return existing;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (options.replaceActive) {
      await client.query(
        `UPDATE reflection_sessions
         SET status = 'archived', updated_at = NOW()
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }
    const sessionResult = await client.query<ReflectionSession>(
      `INSERT INTO reflection_sessions (user_id)
       VALUES ($1)
       RETURNING ${sessionColumns}`,
      [userId]
    );
    const session = sessionResult.rows[0];
    const messageResult = await client.query<ReflectionMessage>(
      `INSERT INTO reflection_messages (session_id, user_id, role, content)
       VALUES ($1, $2, 'assistant', $3)
       RETURNING ${messageColumns}`,
      [session.id, userId, INITIAL_REFLECTION_PROMPT]
    );
    await client.query("COMMIT");
    return { session, messages: messageResult.rows };
  } catch (error) {
    await client.query("ROLLBACK");
    if (!options.replaceActive && (error as { code?: string }).code === "23505") {
      const active = await getActiveReflectionSession(userId);
      if (active) return active;
    }
    throw error;
  } finally {
    client.release();
  }
}

export interface AppendReflectionMessageResult {
  userMessage: ReflectionMessage;
  assistantMessage: ReflectionMessage;
  replayed: boolean;
}

async function getStoredMessagePair(
  userId: string,
  sessionId: string,
  clientMessageId: string
): Promise<Omit<AppendReflectionMessageResult, "replayed"> | null> {
  const userResult = await pool.query<ReflectionMessage>(
    `SELECT ${messageColumns}
     FROM reflection_messages
     WHERE session_id = $1 AND user_id = $2 AND client_message_id = $3 AND role = 'user'`,
    [sessionId, userId, clientMessageId]
  );
  const userMessage = userResult.rows[0];
  if (!userMessage) return null;

  const assistantResult = await pool.query<ReflectionMessage>(
    `SELECT ${messageColumns}
     FROM reflection_messages
     WHERE session_id = $1 AND user_id = $2 AND reply_to_message_id = $3 AND role = 'assistant'
     ORDER BY created_at DESC
     LIMIT 1`,
    [sessionId, userId, userMessage.id]
  );
  const assistantMessage = assistantResult.rows[0];
  return assistantMessage ? { userMessage, assistantMessage } : null;
}

export async function appendReflectionMessage(input: {
  userId: string;
  sessionId: string;
  content: string;
  clientMessageId: string;
}): Promise<AppendReflectionMessageResult> {
  const { userId, sessionId, content, clientMessageId } = input;
  const existingPair = await getStoredMessagePair(userId, sessionId, clientMessageId);
  if (existingPair) return { ...existingPair, replayed: true };

  const sessionResult = await pool.query<ReflectionSession>(
    `SELECT ${sessionColumns}
     FROM reflection_sessions
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [sessionId, userId]
  );
  if (!sessionResult.rows[0]) {
    throw new AppError(404, "active reflection session not found", "not_found");
  }

  let userMessage: ReflectionMessage;
  const existingUserResult = await pool.query<ReflectionMessage>(
    `SELECT ${messageColumns}
     FROM reflection_messages
     WHERE session_id = $1 AND user_id = $2 AND client_message_id = $3 AND role = 'user'`,
    [sessionId, userId, clientMessageId]
  );

  if (existingUserResult.rows[0]) {
    userMessage = existingUserResult.rows[0];
  } else {
    const inserted = await pool.query<ReflectionMessage>(
      `INSERT INTO reflection_messages
         (session_id, user_id, client_message_id, role, content)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING ${messageColumns}`,
      [sessionId, userId, clientMessageId, content]
    );
    userMessage = inserted.rows[0];
  }

  const transcript = await getReflectionSession(userId, sessionId);
  const reflection = await continueReflection(
    transcript.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    }))
  );
  const metadata =
    reflection.state === "proposal_ready"
      ? {
          state: reflection.state,
          memoryProposal: reflection.memoryProposal,
          proposalState: "pending" as const,
        }
      : { state: reflection.state };
  const assistantResult = await pool.query<ReflectionMessage>(
    `INSERT INTO reflection_messages
       (session_id, user_id, reply_to_message_id, role, content, metadata)
     VALUES ($1, $2, $3, 'assistant', $4, $5::jsonb)
     RETURNING ${messageColumns}`,
    [sessionId, userId, userMessage.id, reflection.reply, JSON.stringify(metadata)]
  );
  await pool.query(
    "UPDATE reflection_sessions SET updated_at = NOW() WHERE id = $1 AND user_id = $2",
    [sessionId, userId]
  );

  return { userMessage, assistantMessage: assistantResult.rows[0], replayed: false };
}

export async function confirmReflectionMemory(input: {
  userId: string;
  sessionId: string;
  assistantMessageId: string;
  title: string;
  summary: string;
}): Promise<MemoryEntry> {
  const { userId, sessionId, assistantMessageId, title, summary } = input;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query<ReflectionSession>(
      `SELECT ${sessionColumns}
       FROM reflection_sessions
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [sessionId, userId]
    );
    if (!sessionResult.rows[0]) {
      throw new AppError(404, "reflection session not found", "not_found");
    }

    const messageResult = await client.query<ReflectionMessage>(
      `SELECT ${messageColumns}
       FROM reflection_messages
       WHERE id = $1 AND session_id = $2 AND user_id = $3 AND role = 'assistant'
       FOR UPDATE`,
      [assistantMessageId, sessionId, userId]
    );
    const assistantMessage = messageResult.rows[0];
    if (!assistantMessage || !assistantMessage.metadata.memoryProposal) {
      throw new AppError(400, "assistant message has no memory proposal", "invalid_proposal");
    }
    if (assistantMessage.metadata.proposalState !== "pending") {
      throw new AppError(409, "memory proposal has already been handled", "proposal_handled");
    }
    if (sessionResult.rows[0].status !== "active") {
      throw new AppError(409, "reflection session is already completed", "session_completed");
    }

    const transcriptMessages = await loadMessages(client, userId, sessionId);
    const rawInput = transcriptMessages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n\n");
    const entryResult = await client.query<MemoryEntry>(
      `INSERT INTO memory_entries (user_id, session_id, title, raw_input, ai_summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at`,
      [userId, sessionId, title, rawInput, summary]
    );
    const entry = entryResult.rows[0];

    await client.query(
      `UPDATE reflection_messages
       SET metadata = metadata || jsonb_build_object(
         'proposalState', 'saved',
         'memoryEntryId', $1::text
       )
       WHERE id = $2 AND session_id = $3 AND user_id = $4`,
      [entry.id, assistantMessageId, sessionId, userId]
    );
    await client.query(
      `UPDATE reflection_sessions
       SET status = 'completed', title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [title, sessionId, userId]
    );
    await client.query("COMMIT");
    return entry;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
