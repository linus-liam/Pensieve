import { Button, Group, Paper, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import type { MemoryProposal } from "../../types";

interface MemoryProposalCardProps {
  proposal: MemoryProposal;
  saved: boolean;
  saving: boolean;
  onChange: (proposal: MemoryProposal) => void;
  onDismiss: () => void;
  onSave: () => void;
}

export function MemoryProposalCard({
  proposal,
  saved,
  saving,
  onChange,
  onDismiss,
  onSave,
}: MemoryProposalCardProps) {
  return (
    <Paper className="memory-proposal" p="md" radius="sm" shadow="none" withBorder>
      <Stack gap="sm">
        <Text c="dimmed" fw={600} size="xs">
          {saved ? "Reflection saved" : "Possible reflection"}
        </Text>
        {saved ? (
          <Stack gap={4}>
            <Title order={3} size="h4">
              {proposal.title}
            </Title>
            <Text size="sm">{proposal.summary}</Text>
          </Stack>
        ) : (
          <Stack gap="xs">
            <TextInput
              aria-label="Memory title"
              maxLength={120}
              value={proposal.title}
              onChange={(event) => onChange({ ...proposal, title: event.currentTarget.value })}
            />
            <Textarea
              aria-label="Memory summary"
              maxLength={600}
              rows={3}
              value={proposal.summary}
              onChange={(event) => onChange({ ...proposal, summary: event.currentTarget.value })}
            />
          </Stack>
        )}
        {!saved ? (
          <Group gap="sm" justify="flex-end">
            <Button disabled={saving} radius="sm" size="xs" variant="default" onClick={onDismiss}>
              Keep talking
            </Button>
            <Button
              disabled={!proposal.title.trim() || !proposal.summary.trim()}
              loading={saving}
              radius="sm"
              size="xs"
              onClick={onSave}
            >
              Save reflection
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}
