import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mobileRequest } from "./api";
import { get, snapshot, restoreBackup, validateBackup } from "./store";
import type { ReflectionSession } from "../sessionTypes";

const send = <T = ReflectionSession>(path: string, body?: unknown) => mobileRequest<T>(path, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase("pensieve-phone-v1"); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); });
});
afterEach(() => { vi.unstubAllGlobals(); });
async function start() {
  const id = crypto.randomUUID(); await send("/sessions", { id });
  const messageId = crypto.randomUUID();
  await send(`/sessions/${id}/messages`, { id: messageId, content: "  合成原文\n保留空白  " });
  return { id, messageId };
}
it("commits original text before an offline AI attempt and keeps retries idempotent", async () => {
  const { id, messageId } = await start();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(send(`/sessions/${id}/respond`, { id: crypto.randomUUID(), cloudConsent: true })).rejects.toThrow("原文仍在这台设备");
  await send(`/sessions/${id}/messages`, { id: messageId, content: "  合成原文\n保留空白  " });
  const saved = await get<ReflectionSession>("sessions", id);
  expect(saved?.messages).toHaveLength(1); expect(saved?.messages[0].content).toBe("  合成原文\n保留空白  ");
});
it("preserves drafts and the edited confirmation through reopen and backup restore", async () => {
  const { id } = await start();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "先到这里", review: "AI 的暂定回顾" }))));
  const draft = await send(`/sessions/${id}/respond`, { id: crypto.randomUUID(), cloudConsent: true, timeZone: "Asia/Shanghai" });
  expect(await send("/memory-entries")).toEqual([]);
  const edited = await send(`/sessions/${id}/review-draft`, { text: "用户修改", draftId: draft.current_draft_id });
  await send(`/sessions/${id}/confirm`, { text: "用户确认", draftId: edited.current_draft_id });
  const reopened = await send(`/sessions/${id}`);
  expect(reopened.drafts.map(d => d.text)).toEqual(["AI 的暂定回顾", "用户修改"]);
  expect(reopened.memory_revisions[0].raw_input).toBe("用户确认");
  expect(reopened.drafts[0].source_message_ids).toEqual([reopened.messages[0].id]);
  const backup = await snapshot(); expect(validateBackup(backup)).toEqual(backup);
  await restoreBackup(backup);
  expect(await snapshot()).toMatchObject({ sessions: backup.sessions });
});
it("rejects conflicting restore atomically and never loses existing records", async () => {
  const { id } = await start(); const backup = await snapshot();
  const newer = structuredClone(backup); newer.sessions[0].messages[0].content = "不同版本";
  const fresh = structuredClone(backup.sessions[0]); fresh.id = crypto.randomUUID();
  newer.sessions.unshift(fresh);
  await expect(restoreBackup(newer)).rejects.toThrow("不同版本");
  expect((await snapshot()).sessions).toHaveLength(1);
  expect((await send(`/sessions/${id}`)).messages[0].content).toContain("合成原文");
  expect(await get("sessions", fresh.id)).toBeUndefined();
});
it("does not overwrite a session changed while the model was responding", async () => {
  const { id } = await start();
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetcher);
  const response = send(`/sessions/${id}/respond`, { id: crypto.randomUUID(), cloudConsent: true });
  const assertion = expect(response).rejects.toThrow("另一个页面更新");
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  await send(`/sessions/${id}/messages`, { id: crypto.randomUUID(), content: "另一页的新消息" });
  finish(new Response(JSON.stringify({ message: "旧上下文的回复", review: "旧回顾" })));
  await assertion;
  const current = await send(`/sessions/${id}`); expect(current.messages).toHaveLength(2); expect(current.drafts).toEqual([]);
});
it("preserves archived independent writing and rejects corrupt backups before writing", async () => {
  const entry = await send<{ id: string }>("/memory-entries", { rawInput: "合成旧文字" });
  await mobileRequest(`/memory-entries/${entry.id}`, { method: "DELETE" });
  expect(await send("/memory-entries")).toEqual([]);
  expect(await send("/memory-entries?archived=true")).toHaveLength(1);
  const backup = await snapshot(); const broken = structuredClone(backup); broken.entries[0].revisions[0].raw_input = null as unknown as string;
  await expect(restoreBackup(broken)).rejects.toThrow("不是有效");
  await send(`/memory-entries/${entry.id}/restore`, {});
  expect(await send("/memory-entries")).toHaveLength(1);
});
