import type { Chat, Message } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listChats: () => request<Chat[]>("/chats"),

  createChat: () => request<Chat>("/chats", { method: "POST", body: JSON.stringify({}) }),

  getMessages: (chatId: string) => request<Message[]>(`/chats/${chatId}/messages`),

  sendMessage: (chatId: string, content: string) =>
    request<{ userMessage: Message; assistantMessage: Message }>(
      `/chats/${chatId}/messages`,
      { method: "POST", body: JSON.stringify({ content }) }
    ),
};
