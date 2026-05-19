import type { Chat, ColorTokens, Theme } from "../../types";

interface Props {
  chat: Chat | null;
  t: ColorTokens;
  mode: Theme;
  onToggleTheme: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ChatHeader({ chat, t, mode, onToggleTheme }: Props) {
  return (
    <header
      style={{
        padding: "22px 48px 18px",
        borderBottom: `1px solid ${t.rule}`,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.inkFaint,
          }}
        >
          {chat ? formatDate(chat.updated_at) : "—"}
        </div>
        <h1
          style={{
            margin: "4px 0 0",
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: t.ink,
          }}
        >
          {chat?.title ?? "New entry"}
        </h1>
      </div>
      <button
        onClick={onToggleTheme}
        title="Toggle light / dark"
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          color: t.inkFaint,
          letterSpacing: "0.08em",
          padding: "4px 6px",
          border: `1px solid ${t.rule}`,
          borderRadius: 3,
        }}
      >
        {mode === "light" ? "dark" : "light"}
      </button>
    </header>
  );
}
