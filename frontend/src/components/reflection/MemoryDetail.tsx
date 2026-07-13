import { useState } from "react";
import { Alert, Button, Group, Modal, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import type { Memory, ReflectionMessage } from "../../types";
import { MemoryTranscript } from "./MemoryTranscript";

interface MemoryDetailProps {
  memory: Memory | null;
  transcript: ReflectionMessage[] | null;
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
  transcript,
  value,
  error,
  canUpdate,
  updating,
  onChange,
  onDelete,
  onUpdate,
}: MemoryDetailProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!memory) {
    return <Text c="dimmed">Memory not found. Return to memories and choose another entry.</Text>;
  }

  return (
    <>
      <Paper component="article" p="md" radius="md" shadow="none" withBorder>
        <Stack gap="lg">
          <Text c="dimmed" component="time" size="sm">
            {memory.day} at {memory.time}
          </Text>

          <Stack gap="xs">
            <Title order={2} size="h3">
              {memory.title}
            </Title>
            {memory.summary !== memory.title ? <Text>{memory.summary}</Text> : null}
          </Stack>

          {memory.sessionId ? (
            transcript ? <MemoryTranscript messages={transcript} /> : <Text c="dimmed">Loading source conversation...</Text>
          ) : (
            <Textarea
              label="Original"
              rows={6}
              value={value}
              aria-label="Original memory input"
              onChange={(event) => onChange(event.currentTarget.value)}
            />
          )}

          {error ? (
            <Alert color="red" role="alert" title="Something went wrong">
              {error}
            </Alert>
          ) : null}

          <Group className="memory-detail__actions" justify="space-between">
            <Button
              color="red"
              disabled={updating}
              radius="sm"
              variant="subtle"
              onClick={() => setDeleteOpen(true)}
            >
              Delete memory
            </Button>
            {!memory.sessionId ? (
              <Button disabled={!canUpdate || updating} loading={updating} radius="sm" onClick={onUpdate}>
                Save changes
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Paper>

      <Modal
        centered
        opened={deleteOpen}
        radius="md"
        title="Delete memory?"
        onClose={() => setDeleteOpen(false)}
      >
        <Stack gap="md">
          <Text size="sm">
            This removes the memory from your timeline permanently. This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button disabled={updating} radius="sm" variant="default" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              disabled={updating}
              loading={updating}
              radius="sm"
              onClick={() => {
                setDeleteOpen(false);
                onDelete();
              }}
            >
              Delete memory permanently
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
