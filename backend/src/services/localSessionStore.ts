import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { atomicJson } from "../storage/atomicJson.js";
import { AppError } from "../errors.js";
import type { Revision } from "./localMemoryStore.js";

export interface SessionMessage { id: string; role: "user" | "assistant"; content: string; created_at: string }
export interface ReviewDraft { id: string; text: string; created_at: string; source_message_ids: string[]; author?: "user" }
export interface SessionMemory extends Revision { source_session_id: string }
export interface ReflectionSession {
  format: 1; id: string; created_at: string; updated_at: string;
  status: "active" | "review" | "completed";
  messages: SessionMessage[]; drafts: ReviewDraft[]; current_draft_id: string | null;
  memory_revisions: SessionMemory[];
}

export class LocalSessionStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(readonly directory: string) {}
  private path(id: string) { return join(this.directory, `${id}.json`); }
  async get(id: string): Promise<ReflectionSession> {
    try {
      const value = JSON.parse(await readFile(this.path(id), "utf8")) as ReflectionSession;
      if (value.format !== 1 || value.id !== id || !Array.isArray(value.messages) || !Array.isArray(value.drafts) || !Array.isArray(value.memory_revisions)) throw new Error("Invalid local session file");
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new AppError(404, "Session not found", "not_found");
      throw error;
    }
  }
  private serial<T>(id: string, work: () => Promise<T>): Promise<T> {
    const result = (this.queues.get(id) ?? Promise.resolve()).then(work);
    const settled = result.then(() => {}, () => {});
    this.queues.set(id, settled);
    void settled.then(() => { if (this.queues.get(id) === settled) this.queues.delete(id); });
    return result;
  }
  async list() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const files = (await readdir(this.directory)).filter(name => /^[0-9a-f-]{36}\.json$/.test(name));
    return (await Promise.all(files.map(name => this.get(name.slice(0, -5)))))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  create(id: string = randomUUID()) {
    return this.serial(id, async () => {
      try { return await this.get(id); } catch (error) { if (!(error instanceof AppError && error.status === 404)) throw error; }
      const now = new Date().toISOString();
      const session: ReflectionSession = { format: 1, id, created_at: now, updated_at: now, status: "active", messages: [], drafts: [], current_draft_id: null, memory_revisions: [] };
      await atomicJson(this.path(id), session);
      return session;
    });
  }
  update(id: string, operation: (session: ReflectionSession) => void | Promise<void>) {
    return this.serial(id, async () => {
      const session = await this.get(id);
      await operation(session);
      session.updated_at = new Date().toISOString();
      await atomicJson(this.path(id), session);
      return session;
    });
  }
  append(id: string, messageId: string, content: string) {
    return this.update(id, session => {
      const existing = session.messages.find(m => m.id === messageId);
      if (existing) {
        if (existing.content !== content || existing.role !== "user") throw new AppError(409, "Message ID already used", "conflict");
        return;
      }
      if (session.status === "completed") throw new AppError(409, "这段聊天已结束，请开启新聊天", "session_completed");
      session.messages.push({ id: messageId, role: "user", content, created_at: new Date().toISOString() });
      session.current_draft_id = null;
      session.status = "active";
    });
  }
  confirm(id: string, text: string, draftId: string | null) {
    return this.update(id, session => {
      if (session.status === "completed") {
        if (session.memory_revisions.at(-1)?.raw_input === text) return;
        throw new AppError(409, "回顾已确认，可在记忆详情中修改", "already_confirmed");
      }
      if (!session.messages.length) throw new AppError(400, "先留下这段聊天的内容", "empty_session");
      if (draftId !== session.current_draft_id) throw new AppError(409, "回顾已更新，请重新查看", "stale_draft");
      const now = new Date().toISOString();
      session.memory_revisions.push({ id, user_id: "local", raw_input: text, ai_summary: text.slice(0, 160), created_at: now, updated_at: now, action: "created", revision: 1, archived: false, source_session_id: id });
      session.status = "completed";
    });
  }
  changeMemory(id: string, action: "edited" | "archived" | "restored", text?: string) {
    return this.update(id, session => {
      const previous = session.memory_revisions.at(-1);
      if (!previous) throw new AppError(404, "Memory not confirmed", "not_found");
      const raw = text ?? previous.raw_input;
      session.memory_revisions.push({ ...previous, raw_input: raw, ai_summary: raw.slice(0, 160), updated_at: new Date().toISOString(), action, revision: previous.revision + 1, archived: action === "archived" ? true : action === "restored" ? false : previous.archived });
    });
  }
  async memories(archived = false) {
    return (await this.list()).flatMap(s => {
      const memory = s.memory_revisions.at(-1);
      return memory && memory.archived === archived ? [memory] : [];
    });
  }
  async exportMarkdown() {
    return (await this.list()).map(session => `## Reflection session ${session.id}\n\nStarted: ${session.created_at}\nStatus: ${session.status}\n\n` +
      session.messages.map(m => `### ${m.role} · ${m.created_at} · ${m.id}\n\n${m.content}\n`).join("\n") +
      "\n### Review drafts (unconfirmed interpretations)\n\n" + session.drafts.map(d => `${d.created_at} · ${d.id} · ${d.author === "user" ? "User" : "AI"}\nSources: ${d.source_message_ids.join(", ")}\n\n${d.text}\n`).join("\n") +
      "\n### User-confirmed memory history\n\n" + session.memory_revisions.map(r => `Revision ${r.revision} · ${r.action} · ${r.updated_at}\n\n${r.raw_input}\n`).join("\n")
    ).join("\n---\n\n");
  }
}
