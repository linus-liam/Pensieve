import { useState } from "react";
import { Button, Group, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import type { MemoryProposal } from "../../types";

interface MemoryProposalCardProps {
  messageId: string;
  proposal: MemoryProposal;
  saved: boolean;
  savedMemoryId?: string;
  saving: boolean;
  startingNew: boolean;
  onChange: (proposal: MemoryProposal) => void;
  onDismiss: () => void;
  onSave: () => void;
  onStartNew: () => void;
  onViewMemory: (memoryId: string) => void;
}

export function MemoryProposalCard({
  messageId,
  proposal,
  saved,
  savedMemoryId,
  saving,
  startingNew,
  onChange,
  onDismiss,
  onSave,
  onStartNew,
  onViewMemory,
}: MemoryProposalCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section aria-labelledby={`proposal-${messageId}`} className="memory-proposal">
      <Stack gap="md">
        <Title id={`proposal-${messageId}`} order={3} size="h4">
          {saved ? "Memory saved" : "Memory ready"}
        </Title>

        {editing && !saved ? (
          <Stack gap="sm">
            <TextInput
              aria-label="Memory title"
              maxLength={120}
              value={proposal.title}
              onChange={(event) =>
                onChange({ ...proposal, title: event.currentTarget.value })
              }
            />
            <Textarea
              aria-label="Memory summary"
              maxLength={600}
              rows={4}
              value={proposal.summary}
              onChange={(event) =>
                onChange({ ...proposal, summary: event.currentTarget.value })
              }
            />
          </Stack>
        ) : (
          <Stack className="memory-proposal__copy" gap="xs">
            <Text className="memory-proposal__title">{proposal.title}</Text>
            <Text className="memory-proposal__summary">{proposal.summary}</Text>
          </Stack>
        )}

        {!saved ? (
          <Group className="memory-proposal__actions memory-proposal__actions--pending" gap="xs">
            <Button
              className="button-primary"
              disabled={!proposal.title.trim() || !proposal.summary.trim()}
              loading={saving}
              onClick={onSave}
            >
              Save memory
            </Button>
            <Button
              className="button-secondary"
              disabled={saving}
              variant="subtle"
              onClick={onDismiss}
            >
              Not yet—keep talking
            </Button>
            <Button
              className="button-secondary"
              disabled={saving}
              variant="subtle"
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Done editing" : "Edit"}
            </Button>
          </Group>
        ) : (
          <Group className="memory-proposal__actions memory-proposal__actions--saved" gap="xs">
            <Button
              className="button-primary"
              disabled={!savedMemoryId}
              onClick={() => savedMemoryId && onViewMemory(savedMemoryId)}
            >
              View memory
            </Button>
            <Button
              className="button-secondary"
              loading={startingNew}
              variant="subtle"
              onClick={onStartNew}
            >
              Start a new memory
            </Button>
          </Group>
        )}
      </Stack>
    </section>
  );
}
