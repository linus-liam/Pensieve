import { useState } from "react";
import { Box, Button, Collapse, Stack, Text } from "@mantine/core";
import { ChevronDown } from "lucide-react";
import type { ReflectionMessage } from "../../types";

interface MemoryTranscriptProps {
  messages: ReflectionMessage[];
}

export function MemoryTranscript({ messages }: MemoryTranscriptProps) {
  const [opened, setOpened] = useState(false);

  return (
    <section className="memory-transcript">
      <Button
        aria-expanded={opened}
        className="button-secondary memory-transcript__toggle"
        rightSection={
          <ChevronDown
            aria-hidden="true"
            className={opened ? "memory-transcript__chevron--open" : undefined}
            size={16}
          />
        }
        variant="subtle"
        onClick={() => setOpened((value) => !value)}
      >
        {opened ? "Hide conversation" : "Show conversation"}
      </Button>
      <Collapse expanded={opened}>
        <Stack aria-label="Source conversation" className="memory-transcript__messages" gap="lg" pt="lg">
          {messages.map((message) => (
            <Box
              className={`transcript-message transcript-message--${message.role}`}
              key={message.id}
            >
              {message.role === "assistant" ? (
                <span aria-hidden="true" className="transcript-message__mark" />
              ) : null}
              <Text className="transcript-message__text" size="sm">{message.content}</Text>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </section>
  );
}
