import type { Chat, ColorTokens, Theme } from "../../types";
import { HistoryItem } from "./HistoryItem";

interface Props {
  label: string;
  chats: Chat[];
  activeChatId: string | null;
  t: ColorTokens;
  mode: Theme;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function HistoryGroup({ label, chats, activeChatId, t, mode, onSelect, onDelete }: Props) {
  if (chats.length === 0) return null;

  return (
    <div>
      <div
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: t.inkFaint,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {chats.map((chat) => (
          <HistoryItem
            key={chat.id}
            chat={chat}
            active={chat.id === activeChatId}
            t={t}
            mode={mode}
            onClick={() => onSelect(chat.id)}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
