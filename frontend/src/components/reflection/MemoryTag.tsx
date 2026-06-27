import { Badge } from "@mantine/core";

interface MemoryTagProps {
  label: string;
}

export function MemoryTag({ label }: MemoryTagProps) {
  return (
    <Badge color="gray" radius="sm" size="sm" variant="light">
      {label}
    </Badge>
  );
}
