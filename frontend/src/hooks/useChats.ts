import { useState, useCallback, useEffect } from "react";
import { api } from "../api/client";
import type { Chat } from "../types";

interface UseChatsState {
  chats: Chat[];
  activeChatId: string | null;
  selectChat: (id: string) => void;
  createChat: () => Promise<string>;
  refreshChats: () => Promise<void>;
}

export function useChats(): UseChatsState {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const refreshChats = useCallback(async () => {
    const data = await api.listChats();
    setChats(data);
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const createChat = useCallback(async () => {
    const chat = await api.createChat();
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat.id;
  }, []);

  const selectChat = useCallback((id: string) => {
    setActiveChatId(id);
  }, []);

  return { chats, activeChatId, selectChat, createChat, refreshChats };
}
