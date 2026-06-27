import { Divider, Stack, Text, Title } from "@mantine/core";
import type { Memory } from "../../types";
import { TimelineCard } from "./TimelineCard";

interface TimelineProps {
  memories: Memory[];
  onOpenMemory: (memory: Memory) => void;
}

const dayOrder = ["Today", "Yesterday"];

function groupMemories(memories: Memory[]) {
  const groups = new Map<string, Memory[]>();

  for (const memory of memories) {
    groups.set(memory.day, [...(groups.get(memory.day) ?? []), memory]);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = dayOrder.indexOf(a);
    const bIndex = dayOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function Timeline({ memories, onOpenMemory }: TimelineProps) {
  const groups = groupMemories(memories);

  return (
    <Stack gap="xl">
      {groups.map(([day, dayMemories]) => (
        <section key={day} aria-labelledby={`timeline-${day}`}>
          <Stack gap="sm">
            <Title id={`timeline-${day}`} order={2} size="h3">
              {day}
            </Title>

            <Stack gap="sm">
              {dayMemories.map((memory) => (
                <TimelineCard
                  key={memory.id}
                  memory={memory}
                  muted={day !== "Today"}
                  onOpen={() => onOpenMemory(memory)}
                />
              ))}
            </Stack>
          </Stack>
        </section>
      ))}

      <Divider />
      <Text c="dimmed" component="footer" size="sm">
        That's all for now. Take a breath.
      </Text>
    </Stack>
  );
}
