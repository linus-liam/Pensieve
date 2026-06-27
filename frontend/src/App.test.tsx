import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const firstEntry = {
  id: "11111111-1111-4111-8111-111111111111",
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

describe("App memory flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState(null, "", "/");
  });

  it("opens on the capture page with a focused composer and main navigation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(<App />);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What do you want to put down?" })).toBeInTheDocument();
    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument();
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
        .mockResolvedValueOnce(jsonResponse(firstEntry, { status: 201 }))
    );

    render(<App />);

    await user.type(screen.getByLabelText("What's on your mind?"), firstEntry.raw_input);
    await user.click(screen.getAllByRole("button", { name: "Save memory" })[0]);

    expect(screen.getByRole("heading", { name: "What do you want to put down?" })).toBeInTheDocument();
    expect(await screen.findByText("Saved to your memories")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Memories" }));
    expect(await screen.findByText(firstEntry.ai_summary)).toBeInTheDocument();
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

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Memories" }));
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
        .mockResolvedValueOnce(jsonResponse(firstEntry, { status: 201 }))
    );

    render(<App />);

    await user.type(screen.getByLabelText("What's on your mind?"), "A quiet thought");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(await screen.findByText("Saved to your memories")).toBeInTheDocument();
  });

  it("updates the word count in the composer", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(<App />);

    expect(screen.getByText("0 words")).toBeInTheDocument();

    await user.type(screen.getByLabelText("What's on your mind?"), "one two three");
    expect(screen.getByText("3 words")).toBeInTheDocument();
  });

  it("does not surface unavailable controls as primary actions", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(<App />);

    expect(screen.queryByRole("button", { name: /Attach photo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record voice note/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add mood/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Memories" }));

    expect(screen.queryByRole("button", { name: /Settings/ })).not.toBeInTheDocument();
  });
});
