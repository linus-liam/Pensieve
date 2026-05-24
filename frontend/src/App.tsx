import { useState, useCallback } from "react";
import type { Theme } from "./types";
import { tokens } from "./tokens/colors";
import { useAuth } from "./hooks/useAuth";
import { useChats } from "./hooks/useChats";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthForm } from "./components/auth/AuthForm";
import { Sidebar } from "./components/sidebar/Sidebar";
import { ChatPanel } from "./components/chat/ChatPanel";

export function App() {
  const [mode, setMode] = useState<Theme>("light");
  const t = tokens[mode];

  const auth = useAuth();
  const { chats, activeChatId, selectChat, createChat, deleteChat, refreshChats, clearChats } = useChats(
    Boolean(auth.user)
  );
  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const handleNewChat = useCallback(async () => {
    await createChat();
  }, [createChat]);

  const handleToggleTheme = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  const handleLogout = useCallback(async () => {
    await auth.logout();
    clearChats();
  }, [auth, clearChats]);

  if (auth.loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.paper,
          color: t.inkSoft,
          fontFamily: '"Source Serif 4", Georgia, serif',
        }}
      >
        Loading Pensieve…
      </div>
    );
  }

  if (!auth.user) {
    return <AuthForm t={t} onLogin={auth.login} onRegister={auth.register} />;
  }

  return (
    <AppLayout
      t={t}
      sidebar={
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          t={t}
          mode={mode}
          userEmail={auth.user.email}
          onNewChat={handleNewChat}
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
          onLogout={handleLogout}
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
