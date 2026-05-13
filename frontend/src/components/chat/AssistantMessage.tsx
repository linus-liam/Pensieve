import type { ColorTokens } from "../../types";

interface Props {
  content: string;
  t: ColorTokens;
}

export function AssistantMessage({ content, t }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: t.inkFaint,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 24,
            borderTop: `1px solid ${t.rule}`,
          }}
        />
        pensieve
      </div>
      <div
        style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 18,
          lineHeight: 1.6,
          color: t.ink,
        }}
      >
        {content}
      </div>
    </div>
  );
}
