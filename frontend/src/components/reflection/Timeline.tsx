import { Stack, Text } from "@mantine/core";
import type { Memory } from "../../types";
import { TimelineCard } from "./TimelineCard";

interface TimelineProps {
  memories: Memory[];
  onOpenMemory: (memory: Memory) => void;
}

function groupMemories(memories: Memory[]) {
  const groups = new Map<string, { memories: Memory[]; newestAt: number }>();

  for (const memory of memories) {
    const createdAt = new Date(memory.createdAt).getTime();
    const current = groups.get(memory.day);
    groups.set(memory.day, {
      memories: [...(current?.memories ?? []), memory],
      newestAt: Math.max(current?.newestAt ?? Number.NEGATIVE_INFINITY, createdAt),
    });
  }

  return [...groups.entries()]
    .sort(([, a], [, b]) => b.newestAt - a.newestAt)
    .map(([day, group]) => [day, group.memories] as const);
}

export function Timeline({ memories, onOpenMemory }: TimelineProps) {
  return (
    <Stack className="memory-list" gap="xl">
      {groupMemories(memories).map(([day, dayMemories]) => (
        <section aria-labelledby={`timeline-${day}`} key={day}>
          <Text className="memory-list__day" id={`timeline-${day}`} mb="xs" size="xs">
            {day}
          </Text>
          <Stack gap={0}>
            {dayMemories.map((memory) => (
              <TimelineCard
                key={memory.id}
                memory={memory}
                onOpen={() => onOpenMemory(memory)}
              />
            ))}
          </Stack>
        </section>
      ))}
    </Stack>
  );
}
