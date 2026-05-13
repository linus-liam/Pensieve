import type { Chat, ColorTokens, Theme } from "../../types";

interface Props {
  chat: Chat;
  active: boolean;
  t: ColorTokens;
  mode: Theme;
  onClick: () => void;
}

export function HistoryItem({ chat, active, t, mode, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "6px 8px",
        borderLeft: `2px solid ${active ? t.accent : "transparent"}`,
        background: active
          ? mode === "light"
            ? "rgba(122,59,29,0.06)"
            : "rgba(214,138,92,0.08)"
          : "transparent",
        display: "block",
        width: "100%",
      }}
    >
      <div
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 13,
          lineHeight: 1.25,
          color: t.ink,
          fontStyle: active ? "italic" : "normal",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {chat.title}
      </div>
    </button>
  );
}
