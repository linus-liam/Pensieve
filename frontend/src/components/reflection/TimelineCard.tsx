import { Card, Group, Image, Stack, Text } from "@mantine/core";
import type { Memory } from "../../types";
import { MemoryTag } from "./MemoryTag";
import { SourceBadge } from "./SourceBadge";

interface TimelineCardProps {
  memory: Memory;
  muted?: boolean;
  onOpen: () => void;
}

export function TimelineCard({ memory, muted = false, onOpen }: TimelineCardProps) {
  return (
    <Card
      component="a"
      href={`#memory/${encodeURIComponent(memory.id)}`}
      aria-label={`Open memory: ${memory.summary} ${memory.time}`}
      className="timeline-card"
      opacity={muted ? 0.78 : 1}
      p="md"
      radius="md"
      shadow="none"
      withBorder
      onClick={onOpen}
    >
      <Stack gap="sm">
        <Group gap="xs" justify="space-between">
          <Text c="dimmed" component="time" size="sm">
            {memory.time}
          </Text>
          <Group gap="xs" wrap="nowrap">
            <SourceBadge label={memory.source} type={memory.sourceType} />
            <Text className="timeline-card__action" fw={600} size="sm">
              Open memory
            </Text>
          </Group>
        </Group>

        {memory.image ? (
          <Image alt={memory.imageAlt ?? ""} radius="sm" src={memory.image} />
        ) : null}

        <Text>{memory.summary}</Text>

        <Group aria-label="Memory tags" gap="xs">
          {memory.tags.map((tag) => (
            <MemoryTag key={tag} label={tag} />
          ))}
        </Group>
      </Stack>
    </Card>
  );
}
