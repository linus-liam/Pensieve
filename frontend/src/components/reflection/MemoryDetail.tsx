import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { Pencil, Trash2 } from "lucide-react";
import type { Memory, ReflectionMessage } from "../../types";
import { MemoryTranscript } from "./MemoryTranscript";

interface MemoryDetailProps {
  memory: Memory | null;
  transcript: ReflectionMessage[] | null;
  rawInputValue: string;
  summaryValue: string;
  titleValue: string;
  error: string | null;
  success: string | null;
  canUpdate: boolean;
  editing: boolean;
  updating: boolean;
  onCancelEdit: () => void;
  onChangeRawInput: (value: string) => void;
  onChangeSummary: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  onUpdate: () => void;
}

export function MemoryDetail({
  memory,
  transcript,
  rawInputValue,
  summaryValue,
  titleValue,
  error,
  success,
  canUpdate,
  editing,
  updating,
  onCancelEdit,
  onChangeRawInput,
  onChangeSummary,
  onChangeTitle,
  onDelete,
  onEdit,
  onUpdate,
}: MemoryDetailProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!memory) {
    return <Text c="dimmed">Memory not found.</Text>;
  }

  return (
    <>
      <article className="memory-detail">
        <Stack gap={48}>
          <header className="memory-detail__header">
            <Text className="memory-detail__date" component="time">
              {memory.day} · {memory.time}
            </Text>
            {editing ? (
              <Stack className="memory-detail__edit-fields" gap="md">
                <TextInput
                  aria-label="Memory title"
                  label="Title"
                  maxLength={120}
                  value={titleValue}
                  onChange={(event) => onChangeTitle(event.currentTarget.value)}
                />
                <Textarea
                  aria-label="Memory summary"
                  label="Summary"
                  maxLength={600}
                  minRows={3}
                  value={summaryValue}
                  onChange={(event) => onChangeSummary(event.currentTarget.value)}
                />
              </Stack>
            ) : (
              <>
                <Title className="memory-detail__title" order={1}>{memory.title}</Title>
                {memory.summary !== memory.title ? (
                  <Text className="memory-detail__summary">{memory.summary}</Text>
                ) : null}
              </>
            )}
          </header>

          {memory.sessionId ? (
            transcript ? (
              <MemoryTranscript messages={transcript} />
            ) : (
              <Text c="dimmed" role="status">
                Loading conversation…
              </Text>
            )
          ) : editing ? (
            <Textarea
              aria-label="Original memory input"
              className="memory-detail__original"
              label="Original memory"
              rows={6}
              value={rawInputValue}
              onChange={(event) => onChangeRawInput(event.currentTarget.value)}
            />
          ) : (
            <section aria-labelledby="original-memory-heading" className="memory-detail__original-copy">
              <Text className="memory-detail__eyebrow" id="original-memory-heading">
                Original memory
              </Text>
              <Text className="memory-detail__original-text">{memory.rawInput}</Text>
            </section>
          )}

          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}

          {success ? (
            <Text className="memory-detail__success" role="status">
              {success}
            </Text>
          ) : null}

          <Group className="memory-detail__actions" justify="space-between">
            <Button
              className="button-danger-secondary memory-detail__delete"
              color="red"
              disabled={updating}
              leftSection={<Trash2 aria-hidden="true" size={15} />}
              variant="subtle"
              onClick={() => setDeleteOpen(true)}
            >
              Delete memory
            </Button>
            {editing ? (
              <Group className="memory-detail__edit-actions" gap="sm">
                <Button
                  className="button-secondary"
                  disabled={updating}
                  variant="default"
                  onClick={onCancelEdit}
                >
                  Cancel
                </Button>
                <Button disabled={!canUpdate || updating} loading={updating} onClick={onUpdate}>
                  Save changes
                </Button>
              </Group>
            ) : (
              <Button
                className="button-secondary"
                leftSection={<Pencil aria-hidden="true" size={15} />}
                variant="default"
                onClick={onEdit}
              >
                Edit memory
              </Button>
            )}
          </Group>
        </Stack>
      </article>

      <Modal centered opened={deleteOpen} title="Delete memory?" onClose={() => setDeleteOpen(false)}>
        <Stack gap="md">
          <Text size="sm">This permanently removes the memory.</Text>
          <Group justify="flex-end">
            <Button
              className="button-secondary"
              disabled={updating}
              variant="default"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={updating}
              loading={updating}
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
