import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithOAuth: authMocks.signInWithOAuth,
      signOut: authMocks.signOut,
    },
  })),
}));

const firstEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  raw_input: "I felt calmer after writing the plan down.",
  ai_summary: "Writing the plan down helped the day feel calmer.",
  created_at: "2026-06-10T10:42:00.000Z",
  updated_at: "2026-06-10T10:42:00.000Z",
};

const updatedEntry = {
  ...firstEntry,
  raw_input: "I felt calmer after writing the plan down and taking a walk.",
  ai_summary: "Planning and walking helped the day feel calmer.",
  updated_at: "2026-06-10T11:00:00.000Z",
};

const capturedFirstEntry = {
  ...firstEntry,
  acknowledgement: "It makes sense that writing the plan down helped things feel steadier.",
};

const earlyReflectionReply = {
  reply:
    "That sounds frustrating. Is the harder part the amount of work, or not knowing which work matters most?",
};

const reflectionProposal = {
  title: "Fear of Commitment, Not Lack of Focus",
  summary:
    "Today I realized my focus keeps shifting because choosing one direction feels like losing other possibilities.",
  evidence: [
    {
      userMessageId: "55555555-5555-4555-8555-555555555555",
      excerpt: "afraid of making the wrong choice",
    },
  ],
};

const proposalReflectionReply = {
  reply: "Here is what I think we discovered together.",
  memoryProposal: reflectionProposal,
};

const reflectionSession = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: firstEntry.user_id,
  title: "Untitled reflection",
  status: "active",
  created_at: "2026-07-13T18:00:00.000Z",
  updated_at: "2026-07-13T18:00:00.000Z",
};

const reflectionGreeting = {
  id: "33333333-3333-4333-8333-333333333333",
  session_id: reflectionSession.id,
  user_id: firstEntry.user_id,
  client_message_id: null,
  reply_to_message_id: null,
  role: "assistant",
  content: "I'm here. What feels worth remembering right now?",
  metadata: {},
  created_at: reflectionSession.created_at,
};

function reflectionPair(
  userContent: string,
  assistantContent: string,
  proposal?: typeof reflectionProposal,
  suffix = "7"
) {
  const userMessage = {
    ...reflectionGreeting,
    id: `${suffix.repeat(8)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`,
    client_message_id: "66666666-6666-4666-8666-666666666666",
    role: "user",
    content: userContent,
  };
  return {
    userMessage,
    assistantMessage: {
      ...reflectionGreeting,
      id: `8${suffix.repeat(7)}-${suffix.repeat(4)}-4${suffix.repeat(3)}-8${suffix.repeat(3)}-${suffix.repeat(12)}`,
      reply_to_message_id: userMessage.id,
      content: assistantContent,
      metadata: proposal
        ? { state: "proposal_ready", memoryProposal: proposal, proposalState: "pending" }
        : { state: "exploring" },
    },
    replayed: false,
  };
}

function createSessionFetch(turns: ReturnType<typeof reflectionPair>[], saved = capturedFirstEntry) {
  let turnIndex = 0;
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
    if (url === "/api/reflection-sessions/active") {
      return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
    }
    if (url === `/api/reflection-sessions/${reflectionSession.id}/messages`) {
      return jsonResponse(turns[turnIndex++] ?? turns.at(-1), { status: 201 });
    }
    if (url === `/api/reflection-sessions/${reflectionSession.id}/memory` && method === "POST") {
      return jsonResponse(saved, { status: 201 });
    }
    return jsonResponse({ error: `Unexpected ${method} ${url}` }, { status: 500 });
  });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function emptyResponse() {
  return new Response(null, { status: 204 });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

async function findMainNavigation() {
  return screen.findByRole("navigation", { name: "Main navigation" });
}

async function findPrimaryNavigation() {
  return screen.findByRole("navigation", { name: "Primary navigation" });
}

const testSession = {
  access_token: "test-access-token",
  user: {
    email: "a@example.com",
    id: firstEntry.user_id,
  },
};
const defaultAuthRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL ?? "";

describe("App memory flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_AUTH_REDIRECT_URL", defaultAuthRedirectUrl);
    authMocks.getSession.mockResolvedValue({ data: { session: testSession }, error: null });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithOAuth.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
    window.history.pushState(null, "", "/");
  });

  it("uses the current origin for Google OAuth when no redirect is configured", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_AUTH_REDIRECT_URL", "");
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderApp();

    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  });

  it("uses the configured Google OAuth redirect after trimming whitespace", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_AUTH_REDIRECT_URL", "  https://memories.example/auth/callback  ");
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderApp();

    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));

    expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://memories.example/auth/callback",
      },
    });
  });

  it("opens on the capture page with a focused composer and main navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      within(await findMainNavigation()).getByRole("button", { name: "Capture" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByText("I'm here. What feels worth remembering right now?")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to Pensieve")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: /put down/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/memory-entries?limit=100", expect.any(Object)));
  });

  it("continues the reflection without saving a memory on send", async () => {
    const user = userEvent.setup();
    const fetchMock = createSessionFetch([
      reflectionPair(firstEntry.raw_input, earlyReflectionReply.reply),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Send message" })[0]);

    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(await screen.findByText(earlyReflectionReply.reply)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reflection-sessions/${reflectionSession.id}/messages`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(`"content":"${firstEntry.raw_input}"`),
      })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/memory-entries",
      expect.objectContaining({ method: "POST" })
    );

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    expect(await screen.findByText("No memories saved yet.")).toBeInTheDocument();
  });

  it("shows a proposal card and only saves the memory after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = createSessionFetch([
      reflectionPair(firstEntry.raw_input, proposalReflectionReply.reply, reflectionProposal),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Send message" })[0]);
    await screen.findByText(proposalReflectionReply.reply);

    expect(await screen.findByText("Possible reflection")).toBeInTheDocument();
    expect(screen.getByLabelText("Memory title")).toHaveValue(reflectionProposal.title);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/memory-entries",
      expect.objectContaining({ method: "POST" })
    );

    const editedTitle = "Choosing one direction";
    const editedSummary = "I noticed that choosing one direction can feel like losing the others.";
    await user.clear(screen.getByLabelText("Memory title"));
    await user.type(screen.getByLabelText("Memory title"), editedTitle);
    await user.clear(screen.getByLabelText("Memory summary"));
    await user.type(screen.getByLabelText("Memory summary"), editedSummary);
    await user.click(screen.getByRole("button", { name: "Save reflection" }));

    expect(await screen.findByText("Reflection saved")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reflection-sessions/${reflectionSession.id}/memory`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(editedSummary),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reflection-sessions/${reflectionSession.id}/memory`,
      expect.objectContaining({ body: expect.stringContaining(editedTitle) })
    );
  });

  it("keeps the sent message as the newest chat bubble while Pensieve responds", async () => {
    const user = userEvent.setup();
    const saveResponse = createDeferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
      if (url === "/api/reflection-sessions/active") {
        return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
      }
      if (url === `/api/reflection-sessions/${reflectionSession.id}/messages`) {
        return saveResponse.promise;
      }
      return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Send message" })[0]);

    const chatLog = screen.getByRole("log", { name: "Memory capture conversation" });
    const bubbles = chatLog.querySelectorAll(".capture-chat__bubble");
    const newestBubble = bubbles[bubbles.length - 1];

    expect(newestBubble).toHaveTextContent("You");
    expect(newestBubble).toHaveTextContent(firstEntry.raw_input);
    expect(newestBubble).toHaveTextContent("Sending...");
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();

    saveResponse.resolve(
      jsonResponse(reflectionPair(firstEntry.raw_input, earlyReflectionReply.reply), { status: 201 })
    );
    expect(await screen.findByText(earlyReflectionReply.reply)).toBeInTheDocument();
  });

  it("renders mobile bottom primary navigation instead of a segmented switcher", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    const primaryNavigation = await findPrimaryNavigation();

    expect(primaryNavigation).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Mobile navigation" })
    ).not.toBeInTheDocument();
    expect(
      within(primaryNavigation).getByRole("button", { name: "Capture" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(primaryNavigation).getByRole("button", { name: "Memories" })
    ).not.toHaveAttribute("aria-current");
  });

  it("does not use legacy CSS sizing classes for the capture chat shell", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(await screen.findByLabelText("Memory chat")).not.toHaveClass("capture-chat");
    expect(screen.getByLabelText("Memory capture conversation")).not.toHaveClass(
      "capture-chat__messages"
    );
  });

  it("keeps Memories active on detail and returns to the memories page from Back", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));

    renderApp();

    await user.click(
      within(await findPrimaryNavigation()).getByRole("button", { name: "Memories" })
    );
    await user.click(await screen.findByRole("link", { name: /Open memory: Writing the plan down/ }));

    const primaryNavigation = await findPrimaryNavigation();

    expect(
      within(primaryNavigation).getByRole("button", { name: "Memories" })
    ).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe(`#memory/${encodeURIComponent(firstEntry.id)}`);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("heading", { name: "Memories" })).toBeInTheDocument();
    expect(window.location.hash).toBe("#memories");
  });

  it("opens detail, edits, and confirms before deleting a memory", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/memory-entries?limit=100") return jsonResponse([firstEntry]);
        if (url === `/api/memory-entries/${firstEntry.id}` && method === "PATCH") {
          return jsonResponse(updatedEntry);
        }
        if (url === `/api/memory-entries/${firstEntry.id}` && method === "DELETE") {
          return emptyResponse();
        }
        return jsonResponse(firstEntry);
      })
    );

    renderApp();

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    await user.click(await screen.findByRole("link", { name: /Open memory: Writing the plan down/ }));

    expect(screen.getByRole("heading", { name: firstEntry.ai_summary })).toBeInTheDocument();
    expect(screen.getByLabelText("Original memory input")).toHaveValue(firstEntry.raw_input);

    await user.clear(screen.getByLabelText("Original memory input"));
    await user.type(screen.getByLabelText("Original memory input"), updatedEntry.raw_input);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(updatedEntry.ai_summary)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete memory" }));
    const confirmDelete = await screen.findByRole("button", {
      name: "Delete memory permanently",
    });
    expect(confirmDelete).toBeInTheDocument();
    await user.click(confirmDelete);
    expect(await screen.findByText("No memories saved yet.")).toBeInTheDocument();
  });

  it("submits on Ctrl+Enter from the composer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createSessionFetch([
      reflectionPair("A quiet thought", earlyReflectionReply.reply),
    ]));

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), "A quiet thought");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText(earlyReflectionReply.reply)).toBeInTheDocument();
  });

  it("updates the word count in the composer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(await screen.findByText("0 words")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Message to Pensieve"), "one two three");
    expect(screen.getByText("3 words")).toBeInTheDocument();
  });

  it("does not surface unavailable controls as primary actions", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(
      within(await findMainNavigation()).getByRole("button", { name: "Capture" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attach photo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record voice note/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add mood/ })).not.toBeInTheDocument();

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );

    expect(screen.queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("loads a durable session and sends only the newest user message", async () => {
    const user = userEvent.setup();
    const assistantMessage = {
      ...reflectionGreeting,
      id: "44444444-4444-4444-8444-444444444444",
      reply_to_message_id: "55555555-5555-4555-8555-555555555555",
      content: "What do you remember seeing when that happened?",
      metadata: { state: "exploring" },
    };
    const userMessage = {
      ...reflectionGreeting,
      id: assistantMessage.reply_to_message_id,
      client_message_id: "66666666-6666-4666-8666-666666666666",
      role: "user",
      content: "Dad laughed when the tent fell down.",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
      if (url === "/api/reflection-sessions/active") {
        return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
      }
      if (url === `/api/reflection-sessions/${reflectionSession.id}/messages`) {
        return jsonResponse({ userMessage, assistantMessage, replayed: false }, { status: 201 });
      }
      return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await screen.findByText(reflectionGreeting.content);
    await user.type(screen.getByLabelText("Message to Pensieve"), userMessage.content);
    await user.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText(assistantMessage.content)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/reflection-sessions/${reflectionSession.id}/messages`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(`"content":"${userMessage.content}"`),
      })
    );
    const messageRequest = fetchMock.mock.calls.find(
      ([url]) => String(url) === `/api/reflection-sessions/${reflectionSession.id}/messages`
    );
    expect(JSON.parse(String(messageRequest?.[1]?.body))).toEqual({
      clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      content: userMessage.content,
    });
  });

  it("shows the source transcript for a linked memory", async () => {
    const user = userEvent.setup();
    const linkedEntry = {
      ...firstEntry,
      session_id: reflectionSession.id,
      title: "The collapsed tent",
    };
    const sourceUserMessage = {
      ...reflectionGreeting,
      id: "99999999-9999-4999-8999-999999999999",
      role: "user",
      content: "Dad laughed when our tent collapsed.",
    };
    const sourceAssistantMessage = {
      ...reflectionGreeting,
      id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      content: "What made that moment feel important to you?",
      metadata: { state: "exploring" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/memory-entries?limit=100") return jsonResponse([linkedEntry]);
        if (url === "/api/reflection-sessions/active") {
          return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
        }
        if (url === `/api/reflection-sessions/${reflectionSession.id}`) {
          return jsonResponse({
            session: { ...reflectionSession, status: "completed" },
            messages: [reflectionGreeting, sourceUserMessage, sourceAssistantMessage],
          });
        }
        return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
      })
    );

    renderApp();
    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    await user.click(await screen.findByRole("link", { name: /Open memory:/ }));

    expect(await screen.findByRole("heading", { name: linkedEntry.title })).toBeInTheDocument();
    expect(await screen.findByText(sourceUserMessage.content)).toBeInTheDocument();
    expect(screen.getByText(sourceAssistantMessage.content)).toBeInTheDocument();
  });

  it("reuses the idempotency key when retrying a failed AI turn", async () => {
    const user = userEvent.setup();
    let messageAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
      if (url === "/api/reflection-sessions/active") {
        return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
      }
      if (url === `/api/reflection-sessions/${reflectionSession.id}/messages`) {
        messageAttempts += 1;
        if (messageAttempts === 1) {
          return jsonResponse({ error: "AI provider unavailable", code: "ai_unavailable" }, { status: 503 });
        }
        return jsonResponse(
          reflectionPair("The room was very quiet.", "What could you hear in the room?"),
          { status: 201 }
        );
      }
      return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp();
    const composer = await screen.findByLabelText("Message to Pensieve");
    await user.type(composer, "The room was very quiet.");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("AI provider unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("What could you hear in the room?")).toBeInTheDocument();

    const requestBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/messages"))
      .map(([, init]) => JSON.parse(String(init?.body)) as { clientMessageId: string });
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[1].clientMessageId).toBe(requestBodies[0].clientMessageId);
  });
});
