import type { ColorTokens } from "../../types";
import { useComposer } from "../../hooks/useComposer";

interface Props {
  t: ColorTokens;
  pending: boolean;
  onSend: (text: string) => Promise<boolean>;
}

export function Composer({ t, pending, onSend }: Props) {
  const { value, setValue, ref, handleKey, submit } = useComposer(onSend);

  const canSend = !pending && value.trim().length > 0;

  return (
    <div
      style={{
        borderTop: `1px solid ${t.rule}`,
        padding: "18px 48px 22px",
        flexShrink: 0,
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 12,
            borderBottom: `1px solid ${t.ink}`,
            paddingBottom: 8,
          }}
        >
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Write what's sitting with you…"
            rows={1}
            style={{
              all: "unset",
              flex: 1,
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 17,
              lineHeight: 1.5,
              color: t.ink,
              resize: "none",
              overflow: "hidden",
            }}
          />
          <button
            disabled={!canSend}
            onClick={() => void submit()}
            style={{
              all: "unset",
              cursor: canSend ? "pointer" : "default",
              opacity: canSend ? 1 : 0.4,
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontStyle: "italic",
              fontSize: 14,
              color: t.accent,
              padding: "4px 2px",
              flexShrink: 0,
            }}
          >
            send ↵
          </button>
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: t.inkFaint,
          }}
        >
          <span>shift + ↵ for a new line</span>
        </div>
      </div>
    </div>
  );
}
