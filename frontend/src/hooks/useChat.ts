import { useState, useCallback } from "react";
import { api } from "../api/client";
import type { Message } from "../types";

const INITIAL_MESSAGE: Message = {
  id: "init",
  chat_id: "",
  role: "assistant",
  content: "Hi. I’m here whenever you’re ready. What’s been on your mind today?",
  created_at: new Date().toISOString(),
};

interface UseChatState {
  messages: Message[];
  pending: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
}

export function useChat(chatId: string | null): UseChatState {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async (id: string) => {
    const msgs = await api.getMessages(id);
    setMessages(msgs.length > 0 ? msgs : [INITIAL_MESSAGE]);
    setError(null);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || !chatId) return;

      setError(null);
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        chat_id: chatId,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== "init"), optimistic]);
      setPending(true);

      try {
        const { userMessage, assistantMessage } = await api.sendMessage(chatId, trimmed);
        setMessages((prev) =>
          [...prev.filter((m) => m.id !== optimistic.id), userMessage, assistantMessage]
        );
      } catch {
        setError("Couldn’t reach the assistant. Take a breath and try again.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      } finally {
        setPending(false);
      }
    },
    [chatId, pending]
  );

  return { messages, pending, error, send, loadMessages };
}
