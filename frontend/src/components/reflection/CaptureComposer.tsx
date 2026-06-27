import { useMemo } from "react";
import { Button, Group, Paper, Stack, Text, Textarea } from "@mantine/core";

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CaptureComposer({
  value,
  canSave,
  saving,
  onChange,
  onSave,
}: CaptureComposerProps) {
  const words = useMemo(() => wordCount(value), [value]);

  return (
    <Paper
      aria-label="Capture actions"
      component="form"
      p="md"
      radius="md"
      shadow="none"
      withBorder
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <Stack gap="sm">
        <Textarea
          aria-label="What's on your mind?"
          rows={5}
          placeholder="What's on your mind?"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSave();
            }
          }}
        />

        <Group className="capture-composer__footer" gap="sm" justify="space-between">
          <Text c="dimmed" size="sm" style={{ whiteSpace: "nowrap" }}>
            {words} {words === 1 ? "word" : "words"}
          </Text>

          <Button
            aria-label="Save memory"
            disabled={!canSave || saving}
            loading={saving}
            radius="sm"
            type="submit"
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
