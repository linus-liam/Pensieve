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
  });

  it("opens on the capture page with display-only body and a single composer input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    render(<App />);

    expect(screen.getByRole("button", { name: "Pensieve" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What do you want to put down?" })).toBeInTheDocument();
    expect(screen.getByLabelText("What's on your mind?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open memories" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("textbox", { name: /put down/i })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/memory-entries?limit=100", expect.any(Object)));
  });

  it("saves a memory and shows the AI summary on the timeline", async () => {
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

    expect(await screen.findByText(firstEntry.ai_summary)).toBeInTheDocument();
    expect(screen.getByText("Saved to your memories")).toBeInTheDocument();
  });

  it("opens detail, edits, and deletes a memory", async () => {
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

    await user.click(screen.getByRole("button", { name: "Open memories" }));
    await user.click(await screen.findByRole("button", { name: /Writing the plan down/ }));

    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Original memory input")).toHaveValue(firstEntry.raw_input);

    await user.clear(screen.getByLabelText("Original memory input"));
    await user.type(screen.getByLabelText("Original memory input"), updatedEntry.raw_input);
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText(updatedEntry.ai_summary)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No memories saved yet.")).toBeInTheDocument();
  });

  it("submits on Enter from the composer input", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse(firstEntry, { status: 201 }))
    );

    render(<App />);

    await user.type(screen.getByLabelText("What's on your mind?"), "A quiet thought{Enter}");

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
});
