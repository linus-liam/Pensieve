import { useEffect, useMemo, useRef } from "react";
import { Box, Button, Group, Paper, Stack, Text, Textarea, Title } from "@mantine/core";

export interface CaptureChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  status?: "sending" | "error";
}

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  messages: CaptureChatMessage[];
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
  messages,
  saving,
  onChange,
  onSave,
}: CaptureComposerProps) {
  const words = useMemo(() => wordCount(value), [value]);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messageList = messagesRef.current;
    if (!messageList) return;
    if (typeof messageList.scrollTo === "function") {
      messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
    } else {
      messageList.scrollTop = messageList.scrollHeight;
    }
  }, [messages, saving]);

  return (
    <section aria-label="Capture chat">
      <Stack gap="sm">
        <Title order={2} size="h2">
          Capture
        </Title>

        <Paper
          aria-label="Memory chat"
          className="capture-chat"
          p="md"
          radius="md"
          shadow="none"
          withBorder
        >
          <Stack gap="md" h="100%">
            <Box
              ref={messagesRef}
              aria-label="Memory capture conversation"
              aria-live="polite"
              className="capture-chat__messages"
              role="log"
            >
              <Stack gap="sm">
                {messages.map((message) => (
                  <Box
                    className={[
                      "capture-chat__bubble",
                      `capture-chat__bubble--${message.role}`,
                      message.status === "error" ? "capture-chat__bubble--error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={message.id}
                  >
                    <Text className="capture-chat__speaker" fw={600} size="xs">
                      {message.role === "assistant" ? "Pensieve" : "You"}
                    </Text>
                    <Text size="sm">{message.content}</Text>
                    {message.status ? (
                      <Text className="capture-chat__status" size="xs">
                        {message.status === "sending" ? "Saving..." : "Not saved"}
                      </Text>
                    ) : null}
                  </Box>
                ))}

                {saving ? (
                  <Box className="capture-chat__bubble capture-chat__bubble--assistant">
                    <Text className="capture-chat__speaker" fw={600} size="xs">
                      Pensieve
                    </Text>
                    <Text c="dimmed" size="sm">
                      Thinking...
                    </Text>
                  </Box>
                ) : null}
              </Stack>
            </Box>

            <Box
              className="capture-chat__form"
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <Stack gap="sm">
                <Textarea
                  aria-label="Message to save as a memory"
                  placeholder="Write a memory..."
                  rows={3}
                  value={value}
                  onChange={(event) => onChange(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onSave();
                    }
                  }}
                />

                <Group
                  className="capture-composer__footer"
                  gap="sm"
                  justify="space-between"
                >
                  <Text c="dimmed" size="sm" style={{ whiteSpace: "nowrap" }}>
                    {words} {words === 1 ? "word" : "words"}
                  </Text>

                  <Button
                    aria-label="Send memory"
                    disabled={!canSave || saving}
                    loading={saving}
                    radius="sm"
                    type="submit"
                  >
                    Send
                  </Button>
                </Group>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </section>
  );
}
