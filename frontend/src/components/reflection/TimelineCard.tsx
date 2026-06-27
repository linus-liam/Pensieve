import { Card, Group, Image, Stack, Text, UnstyledButton } from "@mantine/core";
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
    <UnstyledButton
      aria-label={`${memory.summary} ${memory.time}`}
      display="block"
      opacity={muted ? 0.78 : 1}
      w="100%"
      onClick={onOpen}
    >
      <Card p="md" radius="md" shadow="none" withBorder>
        <Stack gap="sm">
          <Group gap="xs" justify="space-between">
            <Text c="dimmed" component="time" size="sm">
              {memory.time}
            </Text>
            <SourceBadge label={memory.source} type={memory.sourceType} />
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
    </UnstyledButton>
  );
}
