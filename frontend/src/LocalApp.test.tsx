import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
vi.mock("./local", () => ({ localMode: true, localToken: "local-test-token" }));
const record = { id: "11111111-1111-4111-8111-111111111111", user_id: "local", raw_input: "旧日的理解", ai_summary: "旧日的理解", created_at: "2026-09-11T12:00:00Z", updated_at: "2026-09-11T12:00:00Z" };
function json(data: unknown) { return new Response(JSON.stringify(data), { status: 200 }); }
beforeEach(() => { window.history.pushState(null, "", "/"); });
afterEach(() => { vi.unstubAllGlobals(); });
it("opens without cloud auth and saves exact text using the local credential", async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/local-info")) return json({ directory: "/local/memories", aiEnabled: false });
    if (init?.method === "POST") return json({ ...record, raw_input: JSON.parse(init.body as string).rawInput, acknowledgement: "本机已保存" });
    return json([]);
  });
  vi.stubGlobal("fetch", fetch);
  render(<AuthProvider><App /></AuthProvider>);
  expect(await screen.findByText(/存储目录：\/local\/memories/)).toBeInTheDocument();
  expect(screen.queryByText("Continue with Google")).not.toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByText("直接保存旧文字"));
  await user.click(screen.getByRole("textbox", { name: "Message to save as a memory" }));
  await user.paste("  原文\n第二行  ");
  await user.click(screen.getByRole("button", { name: "Send memory" }));
  expect(await screen.findByText("本机已保存")).toBeInTheDocument();
  const submitted = fetch.mock.calls.find(([, init]) => init?.method === "POST")!;
  expect(JSON.parse(submitted[1]!.body as string).rawInput).toBe("  原文\n第二行  ");
  expect(submitted[1]!.headers).toMatchObject({ "X-Pensieve-Local-Token": "local-test-token" });
  expect(submitted[1]!.headers).not.toHaveProperty("Authorization");
});
it("searches local records and displays their revision history", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/local-info")) return json({ directory: "/local/memories" });
    if (url.endsWith("/sessions")) return json([]);
    if (url.endsWith("/history")) return json([{ ...record, revision: 1, action: "created" }]);
    return json([record]);
  }));
  render(<AuthProvider><App /></AuthProvider>);
  const user = userEvent.setup();
  const nav = await screen.findByRole("navigation", { name: "Main navigation" });
  await user.click(within(nav).getByRole("button", { name: "Memories" }));
  await user.type(await screen.findByRole("textbox", { name: "搜索记忆" }), "不存在");
  await waitFor(() => expect(screen.queryByText("旧日的理解")).not.toBeInTheDocument());
  await user.clear(screen.getByRole("textbox", { name: "搜索记忆" }));
  await user.click(await screen.findByText("旧日的理解"));
  expect(await screen.findByText(/版本 1/)).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "原文摘录（非 AI 总结）" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "归档记忆" })).toBeInTheDocument();
});
