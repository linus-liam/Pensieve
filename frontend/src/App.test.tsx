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

describe("App memory flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: testSession }, error: null });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithOAuth.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
    window.history.pushState(null, "", "/");
  });

  it("starts Google OAuth from the sign-in screen", async () => {
    const user = userEvent.setup();
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

  it("opens on the capture page with a focused composer and main navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      within(await findMainNavigation()).getByRole("button", { name: "Capture" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByText("I'm here. What feels worth remembering right now?")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to save as a memory")).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: /put down/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/memory-entries?limit=100", expect.any(Object)));
  });

  it("saves a memory in place and shows the AI summary on the timeline", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse(capturedFirstEntry, { status: 201 }))
    );

    renderApp();

    await user.type(await screen.findByLabelText("Message to save as a memory"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Send memory" })[0]);

    expect(screen.getByRole("heading", { name: "Capture" })).toBeInTheDocument();
    expect(await screen.findByText(capturedFirstEntry.acknowledgement)).toBeInTheDocument();

    await user.click(
      within(await findMainNavigation()).getByRole("button", { name: "Memories" })
    );
    expect(await screen.findByText(firstEntry.ai_summary)).toBeInTheDocument();
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

    expect(screen.getByText("Summary")).toBeInTheDocument();
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
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse(capturedFirstEntry, { status: 201 }))
    );

    renderApp();

    await user.type(await screen.findByLabelText("Message to save as a memory"), "A quiet thought");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText(capturedFirstEntry.acknowledgement)).toBeInTheDocument();
  });

  it("updates the word count in the composer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderApp();

    expect(await screen.findByText("0 words")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Message to save as a memory"), "one two three");
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
});
