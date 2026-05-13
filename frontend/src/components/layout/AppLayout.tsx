import type { ReactNode } from "react";
import type { ColorTokens } from "../../types";

interface Props {
  sidebar: ReactNode;
  main: ReactNode;
  t: ColorTokens;
}

export function AppLayout({ sidebar, main, t }: Props) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "212px 1fr",
        gridTemplateRows: "100%",
        fontFamily: '"Source Sans 3", "Inter", system-ui, sans-serif',
        color: t.ink,
        background: t.paper,
        backgroundImage: `radial-gradient(${t.paperEdge} 1px, transparent 1px)`,
        backgroundSize: "3px 3px",
        overflow: "hidden",
      }}
    >
      {sidebar}
      {main}
    </div>
  );
}
