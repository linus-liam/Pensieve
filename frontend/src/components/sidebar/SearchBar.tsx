import type { ColorTokens } from "../../types";

interface Props {
  t: ColorTokens;
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ t, value, onChange }: Props) {
  return (
    <div style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          color: t.inkFaint,
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        ⌕
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search entries…"
        style={{
          all: "unset",
          width: "100%",
          boxSizing: "border-box",
          borderBottom: `1px solid ${t.rule}`,
          padding: "6px 0 6px 16px",
          fontSize: 12,
          color: t.ink,
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}
