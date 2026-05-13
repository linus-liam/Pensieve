import { pool } from "../db/client.js";
import type { Chat, Message } from "../types.js";

export async function listChats(): Promise<Chat[]> {
  const { rows } = await pool.query<Chat>(
    "SELECT * FROM chats ORDER BY updated_at DESC"
  );
  return rows;
}

export async function createChat(title = "New entry"): Promise<Chat> {
  const { rows } = await pool.query<Chat>(
    "INSERT INTO chats (title) VALUES ($1) RETURNING *",
    [title]
  );
  return rows[0];
}

export async function updateChatTitle(id: string, title: string): Promise<Chat | null> {
  const { rows } = await pool.query<Chat>(
    "UPDATE chats SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [title, id]
  );
  return rows[0] ?? null;
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    "SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC",
    [chatId]
  );
  return rows;
}

export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string
): Promise<Message> {
  const { rows } = await pool.query<Message>(
    "INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3) RETURNING *",
    [chatId, role, content]
  );
  return rows[0];
}
