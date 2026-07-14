import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { ArrowUp, Plus, RotateCcw } from "lucide-react";
import type { MemoryProposal } from "../../types";
import { MemoryProposalCard } from "./MemoryProposalCard";

export interface CaptureChatMessage {
  id: string;
  clientMessageId?: string;
  role: "assistant" | "user";
  content: string;
  proposal?: MemoryProposal;
  proposalStatus?: "deferred" | "pending" | "saved";
  savedMemoryId?: string;
  status?: "sending" | "error";
}

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  messages: CaptureChatMessage[];
  proposalSavingId: string | null;
  saving: boolean;
  startingNew: boolean;
  onChange: (value: string) => void;
  onChangeProposal: (messageId: string, proposal: MemoryProposal) => void;
  onDismissProposal: (messageId: string) => void;
  onRestoreProposal: (messageId: string) => void;
  onRetry: () => void;
  onSaveProposal: (messageId: string) => void;
  onSave: () => void;
  onStartNew: () => void;
  onViewMemory: (memoryId: string) => void;
}

export function CaptureComposer({
  value,
  canSave,
  messages,
  proposalSavingId,
  saving,
  startingNew,
  onChange,
  onChangeProposal,
  onDismissProposal,
  onRestoreProposal,
  onRetry,
  onSaveProposal,
  onSave,
  onStartNew,
  onViewMemory,
}: CaptureComposerProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const [newReflectionOpen, setNewReflectionOpen] = useState(false);
  const hasUserMessages = messages.some((message) => message.role === "user");

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
    <section aria-labelledby="capture-heading" className="capture-workspace">
      <Stack gap={0} h="100%">
        <header className="capture-workspace__header">
          <Group align="center" justify="space-between" wrap="nowrap">
            <Title className="capture-workspace__title" id="capture-heading" order={1}>
              Capture a memory
            </Title>
            {hasUserMessages ? (
              <Button
                aria-label="New reflection"
                className="button-secondary capture-workspace__new"
                disabled={startingNew || saving}
                leftSection={<Plus aria-hidden="true" size={16} />}
                variant="subtle"
                onClick={() => setNewReflectionOpen(true)}
              >
                New reflection
              </Button>
            ) : null}
          </Group>
        </header>

        <Box
          ref={messagesRef}
          aria-label="Memory capture conversation"
          aria-live="polite"
          className="capture-conversation"
          role="log"
        >
          <Stack gap="lg">
            {messages.map((message) => (
              <Box
                className={`capture-message capture-message--${message.role}`}
                data-status={message.status}
                key={message.id}
              >
                {message.role === "assistant" ? (
                  <span aria-hidden="true" className="capture-message__mark" />
                ) : null}
                <Text className="capture-message__text">{message.content}</Text>
                {message.status === "sending" ? (
                  <Text className="capture-message__status" role="status" size="xs">
                    Sending…
                  </Text>
                ) : null}
                {message.status === "error" ? (
                  <Group className="capture-message__error" gap="xs" mt={6}>
                    <Text c="red.8" size="xs">
                      Not sent
                    </Text>
                    <Button
                      className="button-secondary"
                      leftSection={<RotateCcw aria-hidden="true" size={12} />}
                      size="compact-xs"
                      variant="subtle"
                      onClick={onRetry}
                    >
                      Try again
                    </Button>
                  </Group>
                ) : null}
                {message.proposal && message.proposalStatus === "deferred" ? (
                  <Group
                    className="memory-proposal-paused"
                    gap="sm"
                    justify="space-between"
                    mt="lg"
                  >
                    <Text role="status" size="sm">Memory suggestion paused</Text>
                    <Button
                      className="button-secondary"
                      size="compact-sm"
                      variant="subtle"
                      onClick={() => onRestoreProposal(message.id)}
                    >
                      Review suggestion
                    </Button>
                  </Group>
                ) : message.proposal ? (
                  <MemoryProposalCard
                    messageId={message.id}
                    proposal={message.proposal}
                    saved={message.proposalStatus === "saved"}
                    savedMemoryId={message.savedMemoryId}
                    saving={proposalSavingId === message.id}
                    startingNew={startingNew}
                    onChange={(proposal) => onChangeProposal(message.id, proposal)}
                    onDismiss={() => onDismissProposal(message.id)}
                    onSave={() => onSaveProposal(message.id)}
                    onStartNew={onStartNew}
                    onViewMemory={onViewMemory}
                  />
                ) : null}
              </Box>
            ))}

          </Stack>
        </Box>

        <Box
          className="capture-composer"
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="capture-composer__field">
            <Textarea
              aria-label="Message to Pensieve"
              placeholder="Share what you remember…"
              rightSection={
                <ActionIcon
                  aria-label="Send message"
                  className="capture-composer__send"
                  disabled={!canSave || saving}
                  loading={saving}
                  radius="xl"
                  size={44}
                  type="submit"
                >
                  <ArrowUp aria-hidden="true" size={17} strokeWidth={2} />
                </ActionIcon>
              }
              rightSectionWidth={60}
              rightSectionPointerEvents="all"
              rows={1}
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  onSave();
                }
              }}
            />
          </div>
        </Box>
      </Stack>

      <Modal
        centered
        opened={newReflectionOpen}
        title="Start a new reflection?"
        onClose={() => setNewReflectionOpen(false)}
      >
        <Stack gap="md">
          <Text size="sm">
            This ends the current conversation without saving it as a memory.
          </Text>
          <Group justify="flex-end">
            <Button
              className="button-secondary"
              disabled={startingNew}
              variant="default"
              onClick={() => setNewReflectionOpen(false)}
            >
              Keep this reflection
            </Button>
            <Button
              loading={startingNew}
              onClick={() => {
                setNewReflectionOpen(false);
                onStartNew();
              }}
            >
              Start new reflection
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  );
}
