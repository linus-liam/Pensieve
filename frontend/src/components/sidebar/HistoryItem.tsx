import { useState } from "react";
import type { Chat, ColorTokens, Theme } from "../../types";

interface Props {
  chat: Chat;
  active: boolean;
  t: ColorTokens;
  mode: Theme;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function HistoryItem({ chat, active, t, mode, onClick, onDelete }: Props) {
  const [hovered, setHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(chat.id);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        borderLeft: `2px solid ${active ? t.accent : "transparent"}`,
        background: active
          ? mode === "light"
            ? "rgba(122,59,29,0.06)"
            : "rgba(214,138,92,0.08)"
          : "transparent",
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
    >
      <button
        onClick={onClick}
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "6px 8px",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 13,
            lineHeight: 1.25,
            color: active ? t.accent : t.ink,
            fontWeight: active ? 500 : 400,
            transition: "color 0.2s ease, font-weight 0.2s ease",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {chat.title}
        </div>
      </button>

      <button
        onClick={handleDelete}
        title="Delete entry"
        style={{
          all: "unset",
          cursor: "pointer",
          padding: "4px 6px",
          marginRight: 4,
          color: t.inkFaint,
          fontSize: 14,
          lineHeight: 1,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s ease",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
