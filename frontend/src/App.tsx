import { useState, useCallback } from "react";
import type { Theme } from "./types";
import { tokens } from "./tokens/colors";
import { useChats } from "./hooks/useChats";
import { AppLayout } from "./components/layout/AppLayout";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatPanel } from "./components/chat/ChatPanel";

export function App() {
  const [mode, setMode] = useState<Theme>("light");
  const t = tokens[mode];

  const { chats, activeChatId, selectChat, createChat, refreshChats } = useChats();
  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const handleNewChat = useCallback(async () => {
    await createChat();
  }, [createChat]);

  const handleToggleTheme = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  return (
    <AppLayout
      t={t}
      sidebar={
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          t={t}
          mode={mode}
          onNewChat={handleNewChat}
          onSelectChat={selectChat}
        />
      }
      main={
        <ChatPanel
          chat={activeChat}
          t={t}
          mode={mode}
          onToggleTheme={handleToggleTheme}
          onNewChat={handleNewChat}
          onChatUpdated={refreshChats}
        />
      }
    />
  );
}
