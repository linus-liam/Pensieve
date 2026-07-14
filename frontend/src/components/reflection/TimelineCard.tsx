import { Box, Group, Stack, Text, Title } from "@mantine/core";
import type { Memory } from "../../types";

interface TimelineCardProps {
  memory: Memory;
  onOpen: () => void;
}

export function TimelineCard({ memory, onOpen }: TimelineCardProps) {
  return (
    <Box
      aria-label={`${memory.title}, ${memory.time}`}
      className="memory-row"
      component="a"
      href={`#memory/${encodeURIComponent(memory.id)}`}
      onClick={(event) => {
        event.preventDefault();
        onOpen();
      }}
    >
      <Group align="flex-start" gap="lg" justify="space-between" wrap="nowrap">
        <Stack className="memory-row__copy" gap={6}>
          <Title className="memory-row__title" order={3} size="h4">
            {memory.title}
          </Title>
          <Text className="memory-row__summary" lineClamp={2}>
            {memory.summary}
          </Text>
        </Stack>
        <Stack align="flex-end" className="memory-row__meta" gap="sm">
          <Text className="memory-row__time" component="time" size="xs">
            {memory.time}
          </Text>
        </Stack>
      </Group>
    </Box>
  );
}
