import type { MemorySourceType } from "../../types";

interface SourceBadgeProps {
  label: string;
  type: MemorySourceType;
}

const icons: Record<MemorySourceType, string> = {
  text: "chat",
  screenshot: "screenshot_monitor",
  photo: "image",
  voice: "mic",
};

const labels: Record<MemorySourceType, string> = {
  text: "From chat",
  screenshot: "From screenshot",
  photo: "From photo",
  voice: "Voice note",
};

export function SourceBadge({ label, type }: SourceBadgeProps) {
  return (
    <span className="source-badge">
      <span className="material-symbols-outlined source-badge__icon" aria-hidden="true">
        {icons[type]}
      </span>
      {labels[type] ?? label}
    </span>
  );
}
