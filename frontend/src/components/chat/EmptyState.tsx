import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
  onNewChat: () => void;
}

export function EmptyState({ t, onNewChat }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 48,
      }}
    >
      <div
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 22,
          fontWeight: 300,
          color: t.inkSoft,
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        A quiet place to untangle
        <br />
        what's sitting with you.
      </div>
      <button
        onClick={onNewChat}
        style={{
          all: "unset",
          cursor: "pointer",
          border: `1px solid ${t.ink}`,
          color: t.ink,
          padding: "10px 20px",
          fontSize: 14,
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontStyle: "italic",
        }}
      >
        Begin a new entry
      </button>
    </div>
  );
}
