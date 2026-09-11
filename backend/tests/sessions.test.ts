import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createLocalApp } from "../src/localApp.js";
import { AppError } from "../src/errors.js";
const token = "session-local-token-with-enough-characters";
const headers = { "X-Pensieve-Local-Token": token };
let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "pensieve-session-")); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
function setup(reply = vi.fn().mockResolvedValue({ message: "听起来你有了一个暂时的理解。", review: "我想给自己多一点时间。" })) {
  return { app: createLocalApp(directory, token, { configured: true, model: "test", reply }), reply };
}
async function create(app: ReturnType<typeof createLocalApp>) {
  const id = randomUUID();
  await request(app).post("/api/sessions").set(headers).send({ id }).expect(201);
  return id;
}
async function append(app: ReturnType<typeof createLocalApp>, id: string, content = "  我对新计划有些犹豫。\n还没想好。  ", messageId = randomUUID()) {
  await request(app).post(`/api/sessions/${id}/messages`).set(headers).send({ id: messageId, content }).expect(200);
  return messageId;
}
it("saves raw turns first; retries are idempotent and a restarted app retains the transcript", async () => {
  const { app, reply } = setup(vi.fn().mockRejectedValue(new AppError(503, "offline", "ai_unavailable")));
  const id = await create(app);
  const messageId = await append(app, id);
  await append(app, id, "  我对新计划有些犹豫。\n还没想好。  ", messageId);
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true }).expect(503);
  const restarted = setup().app;
  const session = (await request(restarted).get(`/api/sessions/${id}`).set(headers).expect(200)).body;
  expect(session.messages).toHaveLength(1);
  expect(session.messages[0].content).toBe("  我对新计划有些犹豫。\n还没想好。  ");
  expect(reply).toHaveBeenCalledOnce();
  expect((await request(app).get("/api/memory-entries").set(headers)).body).toEqual([]);
});
it("requires explicit cloud consent and sends only the selected session to AI", async () => {
  const { app, reply } = setup();
  const other = await create(app); await append(app, other, "另一段私密会话");
  const id = await create(app); await append(app, id, "这次的事情");
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID() }).expect(403);
  expect(reply).not.toHaveBeenCalled();
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true }).expect(200);
  expect(reply.mock.calls[0][0].map((m: {content: string}) => m.content)).toEqual(["这次的事情"]);
});
it("preserves AI drafts separately and creates exactly one linked memory only on confirmation", async () => {
  const { app, reply } = setup(); const id = await create(app); await append(app, id);
  const responseId = randomUUID();
  const draft = (await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: responseId, cloudConsent: true }).expect(200)).body;
  expect(draft.status).toBe("review");
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: responseId, cloudConsent: true }).expect(200);
  expect(reply).toHaveBeenCalledOnce();
  expect((await request(app).get("/api/memory-entries").set(headers)).body).toHaveLength(0);
  await request(app).post(`/api/sessions/${id}/confirm`).set(headers).send({ draftId: randomUUID(), text: "wrong draft" }).expect(409);
  const confirmedText = "我修正后的理解，保留不确定性。";
  for (let n = 0; n < 2; n++) await request(app).post(`/api/sessions/${id}/confirm`).set(headers).send({ draftId: draft.current_draft_id, text: confirmedText }).expect(200);
  const memories = (await request(app).get("/api/memory-entries").set(headers)).body;
  expect(memories).toHaveLength(1); expect(memories[0].raw_input).toBe(confirmedText); expect(memories[0].source_session_id).toBe(id);
  const current = (await request(app).get(`/api/sessions/${id}`).set(headers)).body;
  expect(current.drafts[0].text).toBe("我想给自己多一点时间。");
  expect(current.drafts[0].source_message_ids).toHaveLength(1);
  expect(current.messages).toHaveLength(2);
  await request(app).post(`/api/sessions/${id}/messages`).set(headers).send({ id: randomUUID(), content: "extra" }).expect(409);
  await request(app).patch(`/api/memory-entries/${id}`).set(headers).send({ rawInput: "后来的理解" }).expect(200);
  expect((await request(app).get(`/api/memory-entries/${id}/history`).set(headers)).body).toHaveLength(2);
  await request(app).delete(`/api/memory-entries/${id}`).set(headers).expect(204);
  expect((await request(app).get("/api/memory-entries?archived=true").set(headers)).body).toHaveLength(1);
  await request(app).post(`/api/memory-entries/${id}/restore`).set(headers).expect(200);
  const exported = await request(app).get("/api/export").set(headers);
  expect(exported.text).toContain(confirmedText); expect(exported.text).toContain("我想给自己多一点时间。"); expect(exported.text).toContain("我对新计划有些犹豫");
});
it("allows rejecting a draft and manually confirming without a model", async () => {
  const { app } = setup(); const id = await create(app); await append(app, id);
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true });
  const continued = (await request(app).post(`/api/sessions/${id}/continue`).set(headers).expect(200)).body;
  expect(continued.status).toBe("active"); expect(continued.current_draft_id).toBeNull(); expect(continued.drafts).toHaveLength(1);
  await request(app).post(`/api/sessions/${id}/confirm`).set(headers).send({ text: "自己的回顾", draftId: null }).expect(200);
});
it("serializes concurrent AI attempts and preserves the full multi-turn context", async () => {
  const reply = vi.fn().mockResolvedValue({ message: "可以再说一点。", review: null });
  const { app } = setup(reply); const id = await create(app); await append(app, id, "first");
  await Promise.all([1, 2].map(() => request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true }).expect(200)));
  expect(reply).toHaveBeenCalledOnce();
  await append(app, id, "second");
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true });
  expect(reply.mock.calls[1][0].map((m: {content: string}) => m.content)).toEqual(["first", "可以再说一点。", "second"]);
});
