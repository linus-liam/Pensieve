import { useRef } from "react";
import type { Message, ColorTokens } from "../../types";
import { useScrollToBottom } from "../../hooks/useScrollToBottom";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";
import { PendingIndicator } from "./PendingIndicator";

interface Props {
  messages: Message[];
  pending: boolean;
  error: string | null;
  t: ColorTokens;
}

export function MessageList({ messages, pending, error, t }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useScrollToBottom(scrollRef, [messages.length, pending]);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: "1 1 0",
        minHeight: 0,
        overflowY: "auto",
        padding: "32px 48px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        {messages.map((m) =>
          m.role === "assistant" ? (
            <AssistantMessage key={m.id} content={m.content} t={t} />
          ) : (
            <UserMessage key={m.id} content={m.content} t={t} />
          )
        )}
        {pending && <PendingIndicator t={t} />}
        {error && (
          <div style={{ color: t.accent, fontSize: 13 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
