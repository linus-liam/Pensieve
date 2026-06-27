import { Badge } from "@mantine/core";
import type { MemorySourceType } from "../../types";

interface SourceBadgeProps {
  label: string;
  type: MemorySourceType;
}

const labels: Record<MemorySourceType, string> = {
  text: "Text",
  screenshot: "From screenshot",
  photo: "From photo",
  voice: "Voice note",
};

export function SourceBadge({ label, type }: SourceBadgeProps) {
  return (
    <Badge color="gray" radius="sm" size="sm" variant="outline">
      {labels[type] ?? label}
    </Badge>
  );
}
