import type { ReflectionSession, LocalInfo } from "../sessionTypes";
import type { MemoryRevision } from "../api/client";
import { all, change, get, snapshot, type StoredEntry } from "./store";
import { makeMaterial, readMaterialBackup, summary, verifyMaterial, type RawMaterial } from "../../../backend/src/imports/materials";
import { readInWorker } from "../imports/readInWorker";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
function raw(value: unknown, max = 20000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`请输入 1–${max} 字符的内容。`);
  return value;
}
async function session(sessionId: string) {
  const value = await get<ReflectionSession>("sessions", sessionId);
  if (!value) throw new Error("这段聊天不在当前设备，请从历史打开，或恢复手机备份。");
  return value;
}
function update(sessionId: string, work: (s: ReflectionSession) => void) {
  return change<ReflectionSession>("sessions", sessionId, s => {
    if (!s) throw new Error("聊天不存在");
    work(s); s.updated_at = now(); return s;
  });
}
function active(s: ReflectionSession) { if (s.status === "completed") throw new Error("这段聊天已确认，请开启新聊天。"); }
export async function mobileRemote<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/mobile/${path}`, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Pensieve-Client": "phone-v1" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(70000) }); }
  catch { throw new Error("暂时无法连接 AI。已发送的原文仍在这台设备上，联网后可以重试。"); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 && path !== "login" ? "AI 连接需要重新验证。请到设置中输入试用口令；聊天仍在本机。" : data?.error || "AI 暂时未能回复，原文已保存在设备上。");
  return data as T;
}
export function download(contents: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const a = document.createElement("a"); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function mobileInfo(): Promise<LocalInfo> {
  const status = await mobileRemote<{ configured: boolean; model: string; authenticated: boolean }>("status").catch(() => ({ configured: true, model: "联网后可用", authenticated: false }));
  return { directory: "当前设备 · Pensieve 网页存储", aiEnabled: status.configured, model: status.model, provider: "OpenAI", authenticated: status.authenticated };
}
async function changeMemory(memoryId: string, action: "edited" | "archived" | "restored", value?: string) {
  const make = (previous: MemoryRevision): MemoryRevision => {
    const content = value === undefined ? previous.raw_input : raw(value, 500000);
    return { ...previous, raw_input: content, ai_summary: content.slice(0, 160), updated_at: now(), revision: previous.revision + 1, action, archived: action === "archived" ? true : action === "restored" ? false : previous.archived };
  };
  if (await get("sessions", memoryId)) {
    const s = await update(memoryId, s => {
      const previous = s.memory_revisions.at(-1) as MemoryRevision | undefined;
      if (!previous) throw new Error("回顾尚未确认");
      s.memory_revisions.push(make(previous));
    });
    return s.memory_revisions.at(-1);
  }
  const entry = await change<StoredEntry>("entries", memoryId, e => {
    if (!e) throw new Error("记忆不存在"); e.revisions.push(make(e.revisions.at(-1)!)); return e;
  });
  return entry.revisions.at(-1);
}
export async function mobileRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(path, "https://device.invalid");
  const parts = url.pathname.split("/").filter(Boolean);
  const method = init?.method || "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  let result: unknown;
  if (parts[0] === "local-info") result = await mobileInfo();
  else if (parts[0] === "materials") {
    if (method === "GET" && parts[1]) {
      const record = await get<RawMaterial>("materials", parts[1]);
      if (!record) throw new Error("这份原材料不在当前设备。");
      result = await verifyMaterial(record);
    } else if (method === "GET") {
      const records = await all<RawMaterial>("materials");
      const summaries = [];
      for (const record of records) summaries.push(summary(await verifyMaterial(record)));
      result = summaries.sort((a, b) => b.imported_at.localeCompare(a.imported_at));
    } else if (method === "POST" && (!parts[1] || parts[1] === "restore")) {
      const record = parts[1] === "restore" ? await readMaterialBackup(body) : await makeMaterial(body);
      await readInWorker(record);
      let duplicate = false;
      const saved = await change<RawMaterial>("materials", record.id, existing => {
        if (existing) { duplicate = true; return existing; }
        return record;
      });
      result = { material: summary(await verifyMaterial(saved)), duplicate };
    } else throw new Error("不支持的原材料操作");
  }
  else if (parts[0] === "sessions") {
    const sessionId = parts[1]; const action = parts[2];
    if (!sessionId) {
      if (method === "GET") result = (await all<ReflectionSession>("sessions")).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(s => ({ id: s.id, title: s.messages.find(m => m.role === "user")?.content.slice(0, 60) || "新聊天", updated_at: s.updated_at, status: s.status, message_count: s.messages.length }));
      else result = await change<ReflectionSession>("sessions", body.id, s => s ?? { id: body.id, created_at: now(), updated_at: now(), status: "active", messages: [], drafts: [], current_draft_id: null, memory_revisions: [] });
    } else if (!action) result = await session(sessionId);
    else if (action === "messages") result = await update(sessionId, s => {
      const content = raw(body.content); const existing = s.messages.find(m => m.id === body.id);
      if (existing) { if (existing.role !== "user" || existing.content !== content) throw new Error("消息编号已被使用"); return; }
      active(s); s.messages.push({ id: body.id, role: "user", content, created_at: now() }); s.current_draft_id = null; s.status = "active";
    });
    else if (action === "respond") {
      if (body.cloudConsent !== true) throw new Error("请先同意启用 AI");
      const before = await session(sessionId); active(before);
      if (!before.messages.length) throw new Error("请先开始聊天");
      if (before.current_draft_id || before.messages.some(m => m.id === body.id) || (before.messages.at(-1)?.role === "assistant" && !body.review)) return before as T;
      const previous = before.drafts.at(-1);
      const forceReview = body.review === true || before.messages.filter(m => m.role === "user" && !previous?.source_message_ids.includes(m.id)).length >= 12;
      const reply = await mobileRemote<{ message: string; review: string | null }>("reply", { messages: before.messages, review: forceReview, timeZone: body.timeZone, cloudConsent: true });
      result = await update(sessionId, s => {
        if (s.messages.some(m => m.id === body.id)) return;
        active(s);
        if (JSON.stringify(s) !== JSON.stringify(before)) throw new Error("聊天已在另一个页面更新。这次回复未覆盖它，请重新打开聊天。");
        const sourceIds = s.messages.map(m => m.id);
        s.messages.push({ id: body.id, role: "assistant", content: reply.message, created_at: now() });
        if (reply.review) {
          const draft = { id: id(), text: reply.review, created_at: now(), source_message_ids: sourceIds };
          s.drafts.push(draft); s.current_draft_id = draft.id; s.status = "review";
        }
      });
    } else if (action === "review-draft") result = await update(sessionId, s => {
      active(s); if (!s.messages.length) throw new Error("请先开始聊天");
      const content = raw(body.text); const current = s.drafts.find(d => d.id === s.current_draft_id);
      if (current?.text === content && current.author === "user") return;
      if (s.current_draft_id !== body.draftId) throw new Error("回顾已更新，请重新打开");
      if (current?.text === content) return;
      const draft = { id: id(), text: content, author: "user" as const, created_at: now(), source_message_ids: s.messages.map(m => m.id) };
      s.drafts.push(draft); s.current_draft_id = draft.id; s.status = "review";
    });
    else if (action === "continue") result = await update(sessionId, s => { active(s); s.current_draft_id = null; s.status = "active"; });
    else if (action === "confirm") result = await update(sessionId, s => {
      const content = raw(body.text);
      if (s.status === "completed" && s.memory_revisions.at(-1)?.raw_input === content) return;
      active(s); if (!s.messages.length || s.current_draft_id !== body.draftId) throw new Error("回顾已更新，请重新打开");
      const memory: MemoryRevision = { id: sessionId, user_id: "local", raw_input: content, ai_summary: content.slice(0, 160), created_at: now(), updated_at: now(), revision: 1, action: "created", archived: false, source_session_id: sessionId };
      s.memory_revisions.push(memory); s.status = "completed";
    });
    else throw new Error("不支持的聊天操作");
  } else if (parts[0] === "memory-entries") {
    const memoryId = parts[1];
    if (!memoryId && method === "GET") {
      const backup = await snapshot(false);
      result = [...backup.sessions.map(s => s.memory_revisions.at(-1)), ...backup.entries.map(e => e.revisions.at(-1))].filter((r): r is MemoryRevision => Boolean(r) && (r as MemoryRevision).archived === (url.searchParams.get("archived") === "true")).sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (!memoryId) {
      const content = raw(body.rawInput, 500000); const memoryId = id();
      const memory: MemoryRevision = { id: memoryId, user_id: "local", raw_input: content, ai_summary: content.slice(0, 160), created_at: now(), updated_at: now(), revision: 1, action: "created", archived: false };
      await change<StoredEntry>("entries", memoryId, () => ({ id: memoryId, revisions: [memory] }));
      result = { ...memory, acknowledgement: "已保存在当前设备。" };
    } else if (parts[2] === "restore") result = await changeMemory(memoryId, "restored");
    else if (method === "PATCH") result = await changeMemory(memoryId, "edited", body.rawInput);
    else if (method === "DELETE") { await changeMemory(memoryId, "archived"); result = undefined; }
    else {
      const s = await get<ReflectionSession>("sessions", memoryId);
      const e = s ? null : await get<StoredEntry>("entries", memoryId);
      const revisions = s?.memory_revisions ?? e?.revisions;
      if (!revisions?.length) throw new Error("记忆不存在");
      result = parts[2] === "history" ? revisions : revisions.at(-1);
    }
  } else throw new Error("当前设备不支持这项操作");
  return result as T;
}
export async function exportMobileMarkdown() {
  const backup = await snapshot(false);
  const sessions = backup.sessions.map(s => `## 聊天 ${s.id}\n\n${s.created_at}\n\n` + s.messages.map(m => `### ${m.role} · ${m.created_at}\n\n${m.content}\n`).join("\n") + "\n### 回顾草稿（未经确认）\n\n" + s.drafts.map(d => `${d.author === "user" ? "用户修改" : "AI"} · ${d.created_at}\n\n${d.text}\n`).join("\n") + "\n### 确认与修改历史\n\n" + s.memory_revisions.map(r => `${r.updated_at}\n\n${r.raw_input}\n`).join("\n"));
  const entries = backup.entries.map(e => `## 文字存档 ${e.id}\n\n` + e.revisions.map(r => `${r.action} · ${r.updated_at}\n\n${r.raw_input}\n`).join("\n"));
  download([...sessions, ...entries].join("\n---\n\n"), "pensieve-memories.md", "text/markdown;charset=utf-8");
}
