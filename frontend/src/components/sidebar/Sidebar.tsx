import { useState } from "react";
import type { Chat, ColorTokens, Theme } from "../../types";
import { SidebarHeader } from "./SidebarHeader";
import { NewChatButton } from "./NewChatButton";
import { SearchBar } from "./SearchBar";
import { HistoryGroup } from "./HistoryGroup";

interface Props {
  chats: Chat[];
  activeChatId: string | null;
  t: ColorTokens;
  mode: Theme;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
}

function groupChats(chats: Chat[], query: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  const q = query.trim().toLowerCase();
  const matches = (c: Chat) => !q || c.title.toLowerCase().includes(q);

  return {
    today: chats.filter((c) => matches(c) && new Date(c.updated_at) >= startOfToday),
    yesterday: chats.filter(
      (c) => matches(c) && new Date(c.updated_at) >= startOfYesterday && new Date(c.updated_at) < startOfToday
    ),
    week: chats.filter(
      (c) => matches(c) && new Date(c.updated_at) >= startOfWeek && new Date(c.updated_at) < startOfYesterday
    ),
    older: chats.filter((c) => matches(c) && new Date(c.updated_at) < startOfWeek),
  };
}

export function Sidebar({ chats, activeChatId, t, mode, onNewChat, onSelectChat }: Props) {
  const [query, setQuery] = useState("");
  const groups = groupChats(chats, query);

  return (
    <aside
      style={{
        background: t.sidebar,
        borderRight: `1px solid ${t.rule}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        gap: 14,
        overflow: "hidden",
      }}
    >
      <SidebarHeader t={t} />
      <NewChatButton t={t} onClick={onNewChat} />
      <SearchBar t={t} value={query} onChange={setQuery} />

      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: "1 1 0",
          minHeight: 0,
          marginRight: -6,
          paddingRight: 6,
        }}
      >
        <HistoryGroup label="Today" chats={groups.today} activeChatId={activeChatId} t={t} mode={mode} onSelect={onSelectChat} />
        <HistoryGroup label="Yesterday" chats={groups.yesterday} activeChatId={activeChatId} t={t} mode={mode} onSelect={onSelectChat} />
        <HistoryGroup label="This week" chats={groups.week} activeChatId={activeChatId} t={t} mode={mode} onSelect={onSelectChat} />
        <HistoryGroup label="Older" chats={groups.older} activeChatId={activeChatId} t={t} mode={mode} onSelect={onSelectChat} />
      </div>
    </aside>
  );
}
