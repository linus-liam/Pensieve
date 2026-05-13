import type { ColorTokens } from "../../types";

interface Props {
  content: string;
  t: ColorTokens;
}

export function UserMessage({ content, t }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: t.inkFaint,
        }}
      >
        you ·
      </div>
      <div
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontStyle: "italic",
          fontSize: 17,
          lineHeight: 1.55,
          color: t.ink,
          opacity: 0.86,
          maxWidth: "85%",
          textAlign: "right",
        }}
      >
        {content}
      </div>
    </div>
  );
}
