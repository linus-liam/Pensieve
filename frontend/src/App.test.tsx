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

const freshReflectionSession = {
  ...reflectionSession,
  id: "12121212-1212-4212-8212-121212121212",
  created_at: "2026-07-13T19:00:00.000Z",
  updated_at: "2026-07-13T19:00:00.000Z",
};

const freshReflectionGreeting = {
  ...reflectionGreeting,
  id: "13131313-1313-4313-8313-131313131313",
  session_id: freshReflectionSession.id,
  content: "What would you like to remember?",
  created_at: freshReflectionSession.created_at,
};

const linkedEntry = {
  ...firstEntry,
  session_id: reflectionSession.id,
  title: "The collapsed tent",
};

const sourceUserMessage = {
  ...reflectionGreeting,
  id: "99999999-9999-4999-8999-999999999999",
  role: "user" as const,
  content: "Dad laughed when our tent collapsed.",
};

const sourceAssistantMessage = {
  ...reflectionGreeting,
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  content: "What made that moment feel important to you?",
  metadata: { state: "exploring" },
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
    if (url === "/api/reflection-sessions" && method === "POST") {
      return jsonResponse(
        { session: freshReflectionSession, messages: [freshReflectionGreeting] },
        { status: 201 }
      );
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

  it("shows a concise sign-in screen", async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    vi.stubGlobal("fetch", vi.fn());

    renderApp();

    expect(await screen.findByRole("heading", { name: "Pensieve" })).toBeInTheDocument();
    expect(
      screen.getByText("A quiet place for the moments you want to keep.")
    ).toBeInTheDocument();
    expect(screen.getByText(/stored privately in your account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveClass(
      "auth-screen__action"
    );
    expect(screen.queryByText("Memory capture")).not.toBeInTheDocument();
  });

  it("keeps account actions outside primary navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    const navigation = await findMainNavigation();
    expect(within(navigation).getByRole("button", { name: "Capture" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Memories" })).toBeInTheDocument();
    expect(within(navigation).queryByText("Signed in")).not.toBeInTheDocument();
    const signOutButtons = screen.getAllByRole("button", { name: "Sign out" });
    expect(signOutButtons.length).toBeGreaterThan(0);
    signOutButtons.forEach((button) => expect(button).toHaveClass("button-secondary"));
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
    expect(screen.getByRole("heading", { name: "Capture a memory" })).toBeInTheDocument();
    expect(screen.getByText("I'm here. What feels worth remembering right now?")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to Pensieve")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: /put down/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/memory-entries?limit=100", expect.any(Object)));
  });

  it("can intentionally replace an unfinished reflection", async () => {
    const user = userEvent.setup();
    const fetchMock = createSessionFetch([
      reflectionPair("Something I realized today", earlyReflectionReply.reply),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await screen.findByLabelText("Message to Pensieve");
    expect(screen.queryByRole("button", { name: "New reflection" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Message to Pensieve"), "Something I realized today");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText(earlyReflectionReply.reply);

    const newReflectionButton = screen.getByRole("button", { name: "New reflection" });
    expect(newReflectionButton).toBeEnabled();
    await user.click(newReflectionButton);
    expect(await screen.findByText("Start a new reflection?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start new reflection" }));

    expect(await screen.findByText(freshReflectionGreeting.content)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reflection-sessions",
      expect.objectContaining({
        body: JSON.stringify({ replaceActive: true }),
        method: "POST",
      })
    );
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

    expect(screen.getByRole("heading", { name: "Capture a memory" })).toBeInTheDocument();
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
    expect(await screen.findByText("No memories yet")).toBeInTheDocument();
  });

  it("shows a readable proposal before revealing edit fields", async () => {
    const user = userEvent.setup();
    const fetchMock = createSessionFetch([
      reflectionPair(firstEntry.raw_input, proposalReflectionReply.reply, reflectionProposal),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Send message" })[0]);
    await screen.findByText(proposalReflectionReply.reply);

    expect(await screen.findByRole("heading", { name: "Memory ready" })).toBeInTheDocument();
    expect(screen.getByText(reflectionProposal.title)).toBeInTheDocument();
    expect(screen.queryByLabelText("Memory title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save memory" }).closest(".memory-proposal__actions"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not yet—keep talking" })).toHaveClass(
      "button-secondary"
    );
    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass("button-secondary");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/memory-entries",
      expect.objectContaining({ method: "POST" })
    );

    await user.click(screen.getByRole("button", { name: "Not yet—keep talking" }));
    expect(screen.getByText("Memory suggestion paused")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Memory ready" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review suggestion" }));
    expect(screen.getByRole("heading", { name: "Memory ready" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Memory title")).toHaveValue(reflectionProposal.title);
    expect(screen.getByLabelText("Memory summary")).toHaveValue(reflectionProposal.summary);

    const editedTitle = "Choosing one direction";
    const editedSummary = "I noticed that choosing one direction can feel like losing the others.";
    await user.clear(screen.getByLabelText("Memory title"));
    await user.type(screen.getByLabelText("Memory title"), editedTitle);
    await user.clear(screen.getByLabelText("Memory summary"));
    await user.type(screen.getByLabelText("Memory summary"), editedSummary);
    await user.click(screen.getByRole("button", { name: "Save memory" }));

    expect(await screen.findByRole("heading", { name: "Memory saved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View memory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start a new memory" })).toHaveClass(
      "button-secondary"
    );
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

  it("starts a fresh reflection from the saved state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      createSessionFetch([
        reflectionPair(firstEntry.raw_input, proposalReflectionReply.reply, reflectionProposal),
      ])
    );

    renderApp();

    await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: "Save memory" }));
    await user.click(await screen.findByRole("button", { name: "Start a new memory" }));

    expect(await screen.findByText(freshReflectionGreeting.content)).toBeInTheDocument();
    expect(screen.queryByText(reflectionProposal.title)).not.toBeInTheDocument();
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
    const messages = chatLog.querySelectorAll(".capture-message");
    const newestMessage = messages[messages.length - 1];

    expect(newestMessage).toHaveClass("capture-message--user");
    expect(newestMessage).toHaveTextContent(firstEntry.raw_input);
    expect(newestMessage).toHaveTextContent("Sending…");
    expect(newestMessage).not.toHaveTextContent("You");

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

  it("exposes one current destination in each navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    const desktop = await findMainNavigation();
    const mobile = await findPrimaryNavigation();
    expect(
      within(desktop)
        .getAllByRole("button")
        .filter((item) => item.hasAttribute("aria-current"))
    ).toHaveLength(1);
    expect(
      within(mobile)
        .getAllByRole("button")
        .filter((item) => item.hasAttribute("aria-current"))
    ).toHaveLength(1);
  });

  it("keeps conversation controls labelled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(
      await screen.findByRole("log", { name: "Memory capture conversation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message to Pensieve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toHaveClass("capture-composer__send");
    expect(sendButton).toHaveStyle("--ai-size: calc(2.75rem * var(--mantine-scale))");
  });

  it("shows an empty state that returns to capture", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    expect(await screen.findByText("No memories yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Capture a memory" }));
    expect(await screen.findByRole("heading", { name: "Capture a memory" })).toBeInTheDocument();
  });

  it("keeps implementation metadata out of memory rows", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));

    renderApp();

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    const row = await screen.findByRole("link", { name: new RegExp(firstEntry.ai_summary) });
    expect(within(row).queryByText("Text")).not.toBeInTheDocument();
    expect(within(row).queryByText("reflection")).not.toBeInTheDocument();
    expect(within(row).queryByText("Open memory")).not.toBeInTheDocument();
  });

  it("searches memories and filters them by recency", async () => {
    const user = userEvent.setup();
    const olderEntry = {
      ...firstEntry,
      created_at: "2020-01-15T10:42:00.000Z",
    };
    const recentEntry = {
      ...firstEntry,
      id: "44444444-4444-4444-8444-444444444444",
      title: "The collapsed tent",
      raw_input: "Dad laughed when the tent collapsed.",
      ai_summary: "A chaotic camping moment became a favorite family story.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([recentEntry, olderEntry])));

    renderApp();
    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );

    await user.type(await screen.findByLabelText("Search memories"), "tent");
    expect(await screen.findByRole("link", { name: /The collapsed tent/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Writing the plan down/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear memory search" }));
    await user.click(screen.getByRole("radio", { name: "Earlier" }));
    expect(await screen.findByRole("link", { name: /Writing the plan down/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /The collapsed tent/ })).not.toBeInTheDocument();
  });

  it("keeps memory groups in actual chronological order", async () => {
    const user = userEvent.setup();
    const newerJanuaryEntry = {
      ...firstEntry,
      id: "15151515-1515-4515-8515-151515151515",
      title: "January memory",
      ai_summary: "A newer memory from January.",
      created_at: "2026-01-15T10:00:00.000Z",
    };
    const olderDecemberEntry = {
      ...firstEntry,
      id: "14141414-1414-4414-8414-141414141414",
      title: "December memory",
      ai_summary: "An older memory from December.",
      created_at: "2025-12-15T10:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([olderDecemberEntry, newerJanuaryEntry]))
    );

    renderApp();
    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );

    const rows = await screen.findAllByRole("link");
    expect(rows[0]).toHaveAccessibleName(/January memory/);
    expect(rows[1]).toHaveAccessibleName(/December memory/);
  });

  it("does not use legacy CSS sizing classes for the capture chat shell", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    await screen.findByRole("heading", { name: "Capture a memory" });
    const conversation = screen.getByRole("log", { name: "Memory capture conversation" });
    expect(screen.queryByLabelText("Memory chat")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("Pensieve")).not.toBeInTheDocument();
    expect(within(conversation).queryByText("You")).not.toBeInTheDocument();
    expect(screen.queryByText("0 words")).not.toBeInTheDocument();
  });

  it("keeps Memories active on detail and returns to the memories page from Back", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));

    renderApp();

    await user.click(
      within(await findPrimaryNavigation()).getByRole("button", { name: "Memories" })
    );
    await user.click(await screen.findByRole("link", { name: /Writing the plan down/ }));

    const primaryNavigation = await findPrimaryNavigation();

    expect(
      within(primaryNavigation).getByRole("button", { name: "Memories" })
    ).toHaveAttribute("aria-current", "page");
    expect(window.location.hash).toBe(`#memory/${encodeURIComponent(firstEntry.id)}`);

    const backButton = screen.getByRole("button", { name: "Back to memories" });
    expect(backButton).toHaveClass("button-secondary");
    await user.click(backButton);

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
    await user.click(await screen.findByRole("link", { name: /Writing the plan down/ }));

    expect(screen.getByRole("heading", { name: firstEntry.ai_summary })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit memory" }));
    expect(screen.getByLabelText("Original memory input")).toHaveValue(firstEntry.raw_input);

    await user.clear(screen.getByLabelText("Original memory input"));
    await user.type(screen.getByLabelText("Original memory input"), updatedEntry.raw_input);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(updatedEntry.ai_summary)).toBeInTheDocument();
    expect(screen.getByText("Changes saved.")).toHaveAttribute("role", "status");

    const deleteButton = screen.getByRole("button", { name: "Delete memory" });
    expect(deleteButton).toHaveClass("button-danger-secondary");
    await user.click(deleteButton);
    const confirmDelete = await screen.findByRole("button", {
      name: "Delete memory permanently",
    });
    expect(confirmDelete).toBeInTheDocument();
    await user.click(confirmDelete);
    expect(await screen.findByText("No memories yet")).toBeInTheDocument();
  });

  it("warns before navigating away from unsaved memory edits", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));

    renderApp();
    const mainNavigation = await findMainNavigation();
    await user.click(within(mainNavigation).getByRole("button", { name: "Memories" }));
    await user.click(await screen.findByRole("link", { name: /Writing the plan down/ }));
    await user.click(screen.getByRole("button", { name: "Edit memory" }));
    await user.type(screen.getByLabelText("Memory title"), " revised");

    await user.click(within(mainNavigation).getByRole("button", { name: "Capture" }));
    expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Memory title")).toHaveValue(
      `${firstEntry.ai_summary} revised`
    );

    await user.click(within(mainNavigation).getByRole("button", { name: "Capture" }));
    await user.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "Capture a memory" })).toBeInTheDocument();
  });

  it("submits with Enter and keeps Shift+Enter as a line break", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", createSessionFetch([
      reflectionPair("A quiet\nthought", earlyReflectionReply.reply),
    ]));

    renderApp();

    const composer = await screen.findByLabelText("Message to Pensieve");
    await user.type(composer, "A quiet{Shift>}{Enter}{/Shift}thought");
    expect(composer).toHaveValue("A quiet\nthought");
    await user.keyboard("{Enter}");

    expect(await screen.findByText(earlyReflectionReply.reply)).toBeInTheDocument();
  });

  it("keeps the composer free of writing metrics", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    await screen.findByLabelText("Message to Pensieve");
    expect(screen.queryByText(/words?$/)).not.toBeInTheDocument();
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

  it("keeps a linked conversation collapsed until requested", async () => {
    const user = userEvent.setup();
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
    await user.click(await screen.findByRole("link", { name: new RegExp(linkedEntry.title) }));

    expect(await screen.findByRole("heading", { name: linkedEntry.title })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Show conversation" })).toBeInTheDocument();
    expect(screen.getByText(sourceUserMessage.content)).not.toBeVisible();
    const conversationToggle = screen.getByRole("button", { name: "Show conversation" });
    expect(conversationToggle).toHaveClass("button-secondary");
    await user.click(conversationToggle);
    expect(conversationToggle).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(sourceUserMessage.content)).toBeInTheDocument();
    expect(screen.getByText(sourceAssistantMessage.content)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide conversation" })).toBeInTheDocument();
  });

  it("edits the title and summary of a conversation-created memory", async () => {
    const user = userEvent.setup();
    const revisedEntry = {
      ...linkedEntry,
      title: "The tent that made us laugh",
      ai_summary: "A collapsed tent became a family story we still laugh about.",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
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
      if (url === `/api/memory-entries/${linkedEntry.id}` && method === "PATCH") {
        return jsonResponse(revisedEntry);
      }
      return jsonResponse({ error: `Unexpected ${method} ${url}` }, { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderApp();
    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    await user.click(await screen.findByRole("link", { name: new RegExp(linkedEntry.title) }));
    await user.click(await screen.findByRole("button", { name: "Edit memory" }));

    expect(screen.queryByLabelText("Original memory input")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Memory title"));
    await user.type(screen.getByLabelText("Memory title"), revisedEntry.title);
    await user.clear(screen.getByLabelText("Memory summary"));
    await user.type(screen.getByLabelText("Memory summary"), revisedEntry.ai_summary);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: revisedEntry.title })).toBeInTheDocument();
    expect(screen.getByText("Changes saved.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/memory-entries/${linkedEntry.id}`,
      expect.objectContaining({
        body: JSON.stringify({
          title: revisedEntry.title,
          summary: revisedEntry.ai_summary,
        }),
        method: "PATCH",
      })
    );
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
    expect(await screen.findByText("Not sent")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Try again" });
    expect(retryButton).toHaveClass("button-secondary");
    await user.click(retryButton);
    expect(await screen.findByText("What could you hear in the room?")).toBeInTheDocument();

    const requestBodies = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/messages"))
      .map(([, init]) => JSON.parse(String(init?.body)) as { clientMessageId: string });
    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[1].clientMessageId).toBe(requestBodies[0].clientMessageId);
  });
});
