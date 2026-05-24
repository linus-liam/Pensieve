import { useState, useCallback, useEffect } from "react";
import { api } from "../api/client";
import type { Chat } from "../types";

interface UseChatsState {
  chats: Chat[];
  activeChatId: string | null;
  loading: boolean;
  error: string | null;
  selectChat: (id: string) => void;
  createChat: () => Promise<string>;
  deleteChat: (id: string) => Promise<void>;
  refreshChats: () => Promise<void>;
  clearChats: () => void;
}

export function useChats(enabled: boolean): UseChatsState {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshChats = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
    const data = await api.listChats();
    setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chats");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      refreshChats();
    } else {
      setChats([]);
      setActiveChatId(null);
      setError(null);
    }
  }, [enabled, refreshChats]);

  const createChat = useCallback(async () => {
    setError(null);
    const chat = await api.createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    await api.deleteChat(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    setActiveChatId((prev) => (prev === id ? null : prev));
  }, []);

  const clearChats = useCallback(() => {
    setChats([]);
    setActiveChatId(null);
    setError(null);
  }, []);

  return { chats, activeChatId, loading, error, selectChat, createChat, deleteChat, refreshChats, clearChats };
}
