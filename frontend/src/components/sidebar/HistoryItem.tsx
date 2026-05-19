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
        transition: "background 0.2s ease, border-color 0.2s ease",
        display: "block",
        width: "100%",
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
  );
}
