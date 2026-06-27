import { useMemo } from "react";
import { Button, Group, Paper, Text, TextInput } from "@mantine/core";
import { UnavailableIconButton } from "./UnavailableIconButton";

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CaptureComposer({ value, canSave, onChange, onSave }: CaptureComposerProps) {
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
      <Group align="flex-end" gap="sm">
        <Group gap="xs">
          <UnavailableIconButton label="Attach photo" icon="image" />
          <UnavailableIconButton label="Record voice note" icon="mic" />
          <UnavailableIconButton label="Add mood" icon="sentiment_satisfied" />
        </Group>

        <TextInput
          aria-label="What's on your mind?"
          flex={1}
          placeholder="What's on your mind?"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />

        <Text c="dimmed" size="sm" style={{ whiteSpace: "nowrap" }}>
          {words} {words === 1 ? "word" : "words"}
        </Text>

        <Button aria-label="Save memory" disabled={!canSave} radius="sm" type="submit">
          Save
        </Button>
      </Group>
    </Paper>
  );
}
