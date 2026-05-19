import type { Chat, Message, User } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      typeof body?.error === "string" ? body.error : res.statusText || "Request failed";
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: User | null }>("/auth/me"),

  register: (email: string, password: string) =>
    request<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<void>("/auth/logout", { method: "POST" }),

  listChats: () => request<Chat[]>("/chats?limit=50"),

  createChat: () => request<Chat>("/chats", { method: "POST", body: JSON.stringify({}) }),

  getMessages: (chatId: string, signal?: AbortSignal) =>
    request<Message[]>(`/chats/${chatId}/messages`, { signal }),

  sendMessage: (chatId: string, content: string) =>
    request<{ userMessage: Message; assistantMessage: Message; chat: Chat | null }>(
      `/chats/${chatId}/messages`,
      { method: "POST", body: JSON.stringify({ content }) }
    ),
};
