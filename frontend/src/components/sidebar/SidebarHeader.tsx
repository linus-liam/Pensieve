import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
}

export function SidebarHeader({ t }: Props) {
  return (
    <div
      style={{
        fontFamily: '"Source Serif 4", "Source Serif Pro", Georgia, serif',
        fontSize: 22,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: t.ink,
      }}
    >
      Pensieve
    </div>
  );
}
