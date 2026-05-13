import { useEffect } from "react";
import type { Chat, ColorTokens, Theme } from "../../types";
import { useChat } from "../../hooks/useChat";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";

interface Props {
  chat: Chat | null;
  t: ColorTokens;
  mode: Theme;
  onToggleTheme: () => void;
  onNewChat: () => void;
  onChatUpdated: () => void;
}

export function ChatPanel({ chat, t, mode, onToggleTheme, onNewChat, onChatUpdated }: Props) {
  const { messages, pending, error, send, loadMessages } = useChat(chat?.id ?? null);

  useEffect(() => {
    if (chat?.id) {
      loadMessages(chat.id);
    }
  }, [chat?.id, loadMessages]);

  const handleSend = async (text: string) => {
    await send(text);
    onChatUpdated();
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        background: "transparent",
      }}
    >
      <ChatHeader chat={chat} t={t} mode={mode} onToggleTheme={onToggleTheme} />
      {chat ? (
        <>
          <MessageList messages={messages} pending={pending} error={error} t={t} />
          <Composer t={t} pending={pending} onSend={handleSend} />
        </>
      ) : (
        <EmptyState t={t} onNewChat={onNewChat} />
      )}
    </main>
  );
}
