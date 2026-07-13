import { Paper, Stack, Text, Title } from "@mantine/core";
import type { ReflectionMessage } from "../../types";

interface MemoryTranscriptProps {
  messages: ReflectionMessage[];
}

export function MemoryTranscript({ messages }: MemoryTranscriptProps) {
  return (
    <Stack aria-label="Source conversation" gap="sm">
      <Title order={3} size="h4">
        Source conversation
      </Title>
      {messages.map((message) => (
        <Paper key={message.id} p="sm" radius="sm" withBorder>
          <Text c="dimmed" fw={600} size="xs">
            {message.role === "assistant" ? "Pensieve" : "You"}
          </Text>
          <Text size="sm">{message.content}</Text>
        </Paper>
      ))}
    </Stack>
  );
}
