import { localMode } from "../../local";
import { api, type MemoryRevision } from "../../api/client";
import { useState, useEffect } from "react";
import { Alert, Button, Group, Modal, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
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
  const [history, setHistory] = useState<MemoryRevision[]>([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (!localMode || !memory) return;
    let active = true;
    setHistory([]); setHistoryError("");
    api.history(memory.id).then(rows => { if (active) setHistory(rows); }).catch(e => { if (active) setHistoryError(e.message); });
    return () => { active = false; };
  }, [memory?.id, memory?.rawInput]);
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
              {localMode ? (memory.sourceSessionId ? "已确认回顾的摘录" : "原文摘录（非 AI 总结）") : "Summary"}
            </Title>
            <Text>{memory.summary}</Text>
          </Stack>

          <Textarea
            label={memory.sourceSessionId ? "已确认回顾（修改会保留历史）" : "Original"}
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

          {localMode && <Stack gap="xs">
            <Title order={3} size="h4">历史记录</Title>
            {historyError && <Text c="red">{historyError}</Text>}
            {history.map(revision => <details key={revision.revision}>
              <summary>版本 {revision.revision} · {({ created: "首次记录", edited: "修改", archived: "归档", restored: "恢复" } as Record<string, string>)[revision.action]} · {new Date(revision.updated_at).toLocaleString()}</summary>
              <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} mt="xs">{revision.raw_input}</Text>
            </details>)}
          </Stack>}

          <Group className="memory-detail__actions" justify="space-between">
            <Button
              color="red"
              disabled={updating}
              radius="sm"
              variant="subtle"
              onClick={() => setDeleteOpen(true)}
            >
              {localMode ? "归档记忆" : "Delete memory"}
            </Button>
            <Button disabled={!canUpdate || updating} loading={updating} radius="sm" onClick={onUpdate}>
              Save changes
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Modal
        centered
        opened={deleteOpen}
        radius="md"
        title={localMode ? "归档这条记忆？" : "Delete memory?"}
        onClose={() => setDeleteOpen(false)}
      >
        <Stack gap="md">
          <Text size="sm">
            {localMode ? "记忆会移入归档，原文和全部修改历史仍保留，可随时恢复。" : "This removes the memory from your timeline permanently. This cannot be undone."}
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
              {localMode ? "确认归档" : "Delete memory permanently"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
