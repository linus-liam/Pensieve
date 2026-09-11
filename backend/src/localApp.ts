import express from "express";
import helmet from "helmet";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { LocalMemoryStore } from "./services/localMemoryStore.js";
import { LocalSessionStore } from "./services/localSessionStore.js";
import { createReflectionAI, type ReflectionAI } from "./services/reflectionAI.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireUuid } from "./utils/validation.js";
import { AppError } from "./errors.js";

export function createLocalApp(directory: string, token: string, ai: ReflectionAI = createReflectionAI()) {
  if (token.length < 32) throw new Error("Local access token must be at least 32 characters");
  const app = express();
  const store = new LocalMemoryStore(directory);
  const sessions = new LocalSessionStore(join(directory, "sessions"));
  app.use(helmet());
  app.use((req, res, next) => {
    const supplied = Buffer.from(req.get("X-Pensieve-Local-Token") ?? "");
    const expected = Buffer.from(token);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.status(401).json({ error: "Open Pensieve from the local launcher", code: "auth_required" });
      return;
    }
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  function raw(value: unknown, max = 500000) {
    if (typeof value !== "string" || !value.trim()) throw new AppError(400, "请输入内容", "invalid_input");
    if (value.length > max) throw new AppError(413, `内容超过 ${max} 字符`, "input_too_large");
    return value;
  }
  async function sessionOrNull(id: string) {
    try { return await sessions.get(id); }
    catch (error) { if (error instanceof AppError && error.status === 404) return null; throw error; }
  }
  app.get("/api/local-info", (_req, res) => res.json({ directory, aiEnabled: ai.configured, model: ai.model, provider: "OpenAI" }));
  app.get("/api/export", asyncHandler(async (_req, res) => {
    res.type("text/markdown").attachment("pensieve-memories.md").send(await store.exportMarkdown() + "\n\n" + await sessions.exportMarkdown());
  }));

  app.get("/api/sessions", asyncHandler(async (_req, res) => {
    res.json((await sessions.list()).map(s => ({ id: s.id, title: s.messages.find(m => m.role === "user")?.content.slice(0, 60) || "新聊天", created_at: s.created_at, updated_at: s.updated_at, status: s.status, message_count: s.messages.length })));
  }));
  app.post("/api/sessions", asyncHandler(async (req, res) => {
    res.status(201).json(await sessions.create(requireUuid(req.body?.id, "id")));
  }));
  app.get("/api/sessions/:id", asyncHandler(async (req, res) => res.json(await sessions.get(requireUuid(req.params.id, "id")))));
  app.post("/api/sessions/:id/messages", asyncHandler(async (req, res) => {
    res.json(await sessions.append(requireUuid(req.params.id, "id"), requireUuid(req.body?.id, "message id"), raw(req.body?.content, 20000)));
  }));
  app.post("/api/sessions/:id/respond", asyncHandler(async (req, res) => {
    if (req.body?.cloudConsent !== true) throw new AppError(403, "启用 AI 会将当前会话发送给 OpenAI，请先确认", "cloud_consent_required");
    const responseId = requireUuid(req.body?.id, "response id");
    const result = await sessions.update(requireUuid(req.params.id, "id"), async session => {
      if (session.messages.some(m => m.id === responseId)) return;
      if (session.status === "completed") throw new AppError(409, "这段聊天已结束", "session_completed");
      if (!session.messages.length) throw new AppError(400, "请先开始聊天", "empty_session");
      if (session.current_draft_id) return;
      const last = session.messages.at(-1)!;
      if (last.role === "assistant" && req.body?.review !== true) return;
      const previousDraft = session.drafts.at(-1);
      const sinceReview = session.messages.filter(m => m.role === "user" && !previousDraft?.source_message_ids.includes(m.id)).length;
      const reply = await ai.reply(session.messages.map(message => ({ ...message })), req.body?.review === true || sinceReview >= 12);
      const sourceIds = session.messages.map(m => m.id);
      const now = new Date().toISOString();
      session.messages.push({ id: responseId, role: "assistant", content: reply.message, created_at: now });
      if (reply.review) {
        const draft = { id: randomUUID(), text: reply.review, created_at: now, source_message_ids: sourceIds };
        session.drafts.push(draft);
        session.current_draft_id = draft.id;
        session.status = "review";
      }
    });
    res.json(result);
  }));
  app.post("/api/sessions/:id/confirm", asyncHandler(async (req, res) => {
    const draftId = req.body?.draftId === null ? null : requireUuid(req.body?.draftId, "draft id");
    res.json(await sessions.confirm(requireUuid(req.params.id, "id"), raw(req.body?.text, 20000), draftId));
  }));
  app.post("/api/sessions/:id/continue", asyncHandler(async (req, res) => {
    res.json(await sessions.update(requireUuid(req.params.id, "id"), s => {
      if (s.status === "completed") throw new AppError(409, "已确认的聊天请保留原貌，开启新聊天继续", "session_completed");
      s.current_draft_id = null; s.status = "active";
    }));
  }));

  app.get("/api/memory-entries", asyncHandler(async (req, res) => {
    const archived = req.query.archived === "true";
    res.json([...await store.list(archived), ...await sessions.memories(archived)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }));
  app.post("/api/memory-entries", asyncHandler(async (req, res) => {
    res.status(201).json({ ...await store.create(raw(req.body?.rawInput)), acknowledgement: "已保存到本机。原文和历史记录会一直保留。" });
  }));
  app.get("/api/memory-entries/:id/history", asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const session = await sessionOrNull(id);
    res.json(session ? session.memory_revisions : await store.history(id));
  }));
  app.get("/api/memory-entries/:id", asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const session = await sessionOrNull(id);
    const entry = session ? session.memory_revisions.at(-1) : await store.get(id);
    if (!entry) throw new AppError(404, "Memory not confirmed", "not_found");
    res.json(entry);
  }));
  app.patch("/api/memory-entries/:id", asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const text = raw(req.body?.rawInput);
    res.json(await sessionOrNull(id) ? (await sessions.changeMemory(id, "edited", text)).memory_revisions.at(-1) : await store.change(id, "edited", text));
  }));
  app.delete("/api/memory-entries/:id", asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    if (await sessionOrNull(id)) await sessions.changeMemory(id, "archived"); else await store.change(id, "archived");
    res.status(204).end();
  }));
  app.post("/api/memory-entries/:id/restore", asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    res.json(await sessionOrNull(id) ? (await sessions.changeMemory(id, "restored")).memory_revisions.at(-1) : await store.change(id, "restored"));
  }));
  app.use(errorHandler);
  return app;
}
