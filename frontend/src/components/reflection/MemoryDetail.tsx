import { Alert, Button, Group, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import type { Memory } from "../../types";

interface MemoryDetailProps {
  memory: Memory | null;
  value: string;
  error: string | null;
  canUpdate: boolean;
  updating: boolean;
  onChange: (value: string) => void;
  onDelete: () => void;
  onUpdate: () => void;
}

export function MemoryDetail({
  memory,
  value,
  error,
  canUpdate,
  updating,
  onChange,
  onDelete,
  onUpdate,
}: MemoryDetailProps) {
  if (!memory) {
    return <Text c="dimmed">Select a memory from the timeline.</Text>;
  }

  return (
    <Paper component="article" p="md" radius="md" shadow="none" withBorder>
      <Stack gap="lg">
        <Text c="dimmed" component="time" size="sm">
          {memory.day} at {memory.time}
        </Text>

        <Stack gap="xs">
          <Title order={2} size="h3">
            Summary
          </Title>
          <Text>{memory.summary}</Text>
        </Stack>

        <Textarea
          label="Original"
          rows={6}
          value={value}
          aria-label="Original memory input"
          onChange={(event) => onChange(event.currentTarget.value)}
        />

        {error ? (
          <Alert color="red" role="alert" title="Something went wrong">
            {error}
          </Alert>
        ) : null}

        <Group justify="flex-end">
          <Button color="red" disabled={updating} radius="sm" variant="light" onClick={onDelete}>
            Delete
          </Button>
          <Button disabled={!canUpdate || updating} radius="sm" onClick={onUpdate}>
            {updating ? "Saving..." : "Save Changes"}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
