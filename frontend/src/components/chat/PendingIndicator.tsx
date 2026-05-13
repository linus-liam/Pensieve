import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
}

export function PendingIndicator({ t }: Props) {
  return (
    <>
      <style>{`
        @keyframes pensieve-pen {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          color: t.inkFaint,
          fontStyle: "italic",
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 17,
          animation: "pensieve-pen 1.4s ease-in-out infinite",
        }}
      >
        …thinking with you
      </div>
    </>
  );
}
