import { useState, useCallback, useEffect, useRef } from "react";
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
  send: (text: string) => Promise<boolean>;
  loadMessages: (chatId: string) => Promise<void>;
}

export function useChat(chatId: string | null): UseChatState {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const chatIdRef = useRef(chatId);

  useEffect(() => {
    chatIdRef.current = chatId;
    generationRef.current += 1;
    setMessages([INITIAL_MESSAGE]);
    setPending(false);
    setError(null);
  }, [chatId]);

  const loadMessages = useCallback(async (id: string) => {
    const generation = generationRef.current;
    const controller = new AbortController();

    try {
      const msgs = await api.getMessages(id, controller.signal);
      if (generationRef.current !== generation || chatIdRef.current !== id) return;
      setMessages(msgs.length > 0 ? msgs : [INITIAL_MESSAGE]);
      setError(null);
    } catch (err) {
      if (generationRef.current !== generation || chatIdRef.current !== id) return;
      setError(err instanceof Error ? err.message : "Could not load messages");
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || !chatId) return false;

      const sendChatId = chatId;
      const generation = generationRef.current;
      setError(null);
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        chat_id: sendChatId,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev.filter((m) => m.id !== "init"), optimistic]);
      setPending(true);

      try {
        const { userMessage, assistantMessage } = await api.sendMessage(sendChatId, trimmed);
        if (generationRef.current !== generation || chatIdRef.current !== sendChatId) {
          return true;
        }
        setMessages((prev) =>
          [...prev.filter((m) => m.id !== optimistic.id), userMessage, assistantMessage]
        );
        return true;
      } catch (err) {
        if (generationRef.current === generation && chatIdRef.current === sendChatId) {
          setError(err instanceof Error ? err.message : "Couldn’t reach the assistant. Take a breath and try again.");
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        }
        return false;
      } finally {
        if (generationRef.current === generation && chatIdRef.current === sendChatId) {
          setPending(false);
        }
      }
    },
    [chatId, pending]
  );

  return { messages, pending, error, send, loadMessages };
}
