import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "./useChat";
import { api } from "../api/client";
import type { Message } from "../types";

vi.mock("../api/client", () => ({
  api: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

function message(id: string, chatId: string, content: string): Message {
  return {
    id,
    chat_id: chatId,
    role: "user",
    content,
    created_at: new Date().toISOString(),
  };
}

function Harness({ chatId }: { chatId: string }) {
  const { messages, loadMessages } = useChat(chatId);

  useEffect(() => {
    void loadMessages(chatId);
  }, [chatId, loadMessages]);

  return <div data-testid="messages">{messages.map((item) => item.content).join("|")}</div>;
}

describe("useChat", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("ignores stale load responses after switching chats", async () => {
    let resolveOld: (messages: Message[]) => void = () => undefined;
    let resolveNew: (messages: Message[]) => void = () => undefined;

    mockedApi.getMessages.mockImplementation((chatId: string) => {
      if (chatId === "old-chat") {
        return new Promise<Message[]>((resolve) => {
          resolveOld = resolve;
        });
      }

      return new Promise<Message[]>((resolve) => {
        resolveNew = resolve;
      });
    });

    const { rerender } = render(<Harness chatId="old-chat" />);
    rerender(<Harness chatId="new-chat" />);

    resolveNew([message("new-message", "new-chat", "new content")]);
    await screen.findByText("new content");

    resolveOld([message("old-message", "old-chat", "old content")]);
    await waitFor(() => {
      expect(screen.getByTestId("messages")).toHaveTextContent("new content");
      expect(screen.getByTestId("messages")).not.toHaveTextContent("old content");
    });
  });
});
