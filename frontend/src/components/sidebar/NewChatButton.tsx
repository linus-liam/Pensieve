import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
  onClick: () => void;
}

export function NewChatButton({ t, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        border: `1px solid ${t.ink}`,
        color: t.ink,
        padding: "8px 12px",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: '"Source Serif 4", Georgia, serif',
        fontStyle: "italic",
      }}
    >
      <span>Begin a new entry</span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontStyle: "normal" }}>+</span>
    </button>
  );
}
