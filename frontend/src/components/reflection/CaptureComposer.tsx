import { useEffect, useMemo, useRef } from "react";
import { Box, Button, Group, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import type { MemoryProposal } from "../../types";
import { MemoryProposalCard } from "./MemoryProposalCard";

export interface CaptureChatMessage {
  id: string;
  clientMessageId?: string;
  role: "assistant" | "user";
  content: string;
  proposal?: MemoryProposal;
  proposalStatus?: "dismissed" | "pending" | "saved";
  status?: "sending" | "error";
}

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  messages: CaptureChatMessage[];
  proposalSavingId: string | null;
  saving: boolean;
  onChange: (value: string) => void;
  onChangeProposal: (messageId: string, proposal: MemoryProposal) => void;
  onDismissProposal: (messageId: string) => void;
  onSaveProposal: (messageId: string) => void;
  onSave: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CaptureComposer({
  value,
  canSave,
  messages,
  proposalSavingId,
  saving,
  onChange,
  onChangeProposal,
  onDismissProposal,
  onSaveProposal,
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
          p="md"
          radius="md"
          shadow="none"
          withBorder
        >
          <Stack gap="md">
            <Box
              ref={messagesRef}
              aria-label="Memory capture conversation"
              aria-live="polite"
              mah="min(54vh, 520px)"
              pr={4}
              role="log"
              style={{ overflowY: "auto" }}
            >
              <Stack gap="sm">
                {messages.map((message) => (
                  <Stack gap="xs" key={message.id}>
                    <Box
                      className={[
                        "capture-chat__bubble",
                        `capture-chat__bubble--${message.role}`,
                        message.status === "error" ? "capture-chat__bubble--error" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Text className="capture-chat__speaker" fw={600} size="xs">
                        {message.role === "assistant" ? "Pensieve" : "You"}
                      </Text>
                      <Text size="sm">{message.content}</Text>
                      {message.status ? (
                        <Text className="capture-chat__status" size="xs">
                          {message.status === "sending" ? "Sending..." : "Not sent"}
                        </Text>
                      ) : null}
                    </Box>
                    {message.proposal && message.proposalStatus !== "dismissed" ? (
                      <MemoryProposalCard
                        proposal={message.proposal}
                        saved={message.proposalStatus === "saved"}
                        saving={proposalSavingId === message.id}
                        onChange={(proposal) => onChangeProposal(message.id, proposal)}
                        onDismiss={() => onDismissProposal(message.id)}
                        onSave={() => onSaveProposal(message.id)}
                      />
                    ) : null}
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box
              component="form"
              pt="md"
              style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <Stack gap="sm">
                <Textarea
                  aria-label="Message to Pensieve"
                  placeholder="Write to Pensieve..."
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
                    aria-label="Send message"
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
