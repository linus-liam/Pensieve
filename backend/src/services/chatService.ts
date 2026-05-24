import { pool } from "../db/client.js";
import type { Chat, Message } from "../types.js";
import { AppError } from "../errors.js";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
};

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listChats(
  userId: string,
  limit = 50,
  offset = 0
): Promise<Chat[]> {
  const { rows } = await pool.query<Chat>(
    `SELECT * FROM chats
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
}

export async function createChat(userId: string, title = "New entry"): Promise<Chat> {
  const { rows } = await pool.query<Chat>(
    "INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *",
    [userId, title]
  );
  return rows[0];
}

export async function updateChatTitle(
  userId: string,
  id: string,
  title: string,
  db: Queryable = pool
): Promise<Chat | null> {
  const { rows } = await db.query<Chat>(
    `UPDATE chats
     SET title = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [title, id, userId]
  );
  return rows[0] ?? null;
}

export async function getChat(userId: string, id: string, db: Queryable = pool): Promise<Chat> {
  const { rows } = await db.query<Chat>(
    "SELECT * FROM chats WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  const chat = rows[0];
  if (!chat) throw new AppError(404, "chat not found", "not_found");
  return chat;
}

export async function getMessages(
  userId: string,
  chatId: string,
  db: Queryable = pool
): Promise<Message[]> {
  await getChat(userId, chatId, db);

  const { rows } = await db.query<Message>(
    `SELECT messages.*
     FROM messages
     JOIN chats ON chats.id = messages.chat_id
     WHERE messages.chat_id = $1 AND chats.user_id = $2
     ORDER BY messages.created_at ASC`,
    [chatId, userId]
  );
  return rows;
}

export async function deleteChat(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM chats WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function addMessage(
  userId: string,
  chatId: string,
  role: "user" | "assistant",
  content: string,
  db: Queryable = pool
): Promise<Message> {
  const { rows } = await db.query<Message>(
    `INSERT INTO messages (chat_id, role, content)
     SELECT id, $2, $3
     FROM chats
     WHERE id = $1 AND user_id = $4
     RETURNING *`,
    [chatId, role, content, userId]
  );

  if (!rows[0]) throw new AppError(404, "chat not found", "not_found");
  return rows[0];
}
