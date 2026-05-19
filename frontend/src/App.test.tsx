import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { api } from "./api/client";

vi.mock("./api/client", () => ({
  api: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    listChats: vi.fn(),
    createChat: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe("App auth state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows authentication when there is no session", async () => {
    mockedApi.me.mockResolvedValue({ user: null });

    render(<App />);

    expect(await screen.findByText("Create account")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("loads the chat shell for an authenticated user", async () => {
    mockedApi.me.mockResolvedValue({ user: { id: "user-1", email: "user@example.com" } });
    mockedApi.listChats.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Begin a new entry").length).toBeGreaterThan(0);
  });
});
