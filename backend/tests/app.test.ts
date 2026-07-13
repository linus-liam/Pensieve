import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors.js";
import { schemaSql } from "../src/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDbTests = testDatabaseUrl ? describe : describe.skip;

const aiMocks = vi.hoisted(() => ({
  acknowledgeMemory: vi.fn(),
  continueReflection: vi.fn(),
  summarizeMemory: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("../src/services/aiService.js", () => aiMocks);
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: authMocks,
  })),
}));

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_URL = "http://localhost:54321";
}

runDbTests("memory entries API", () => {
  let app: Express;
  let pool: typeof import("../src/db/client.js")["pool"];
  const userAToken = "user-a-token";
  const userBToken = "user-b-token";
  const userAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeAll(async () => {
    const appModule = await import("../src/app.js");
    const dbModule = await import("../src/db/client.js");
    pool = dbModule.pool;

    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
    await pool.query(schemaSql);

    app = appModule.createApp();
  });

  beforeEach(async () => {
    aiMocks.acknowledgeMemory.mockReset();
    aiMocks.continueReflection.mockReset();
    aiMocks.summarizeMemory.mockReset();
    aiMocks.acknowledgeMemory.mockResolvedValue("I hear how much that mattered.");
    authMocks.getUser.mockReset();
    authMocks.getUser.mockImplementation(async (token: string) => {
      if (token === userBToken) {
        return { data: { user: { email: "b@example.com", id: userBId } }, error: null };
      }

      if (token === userAToken) {
        return { data: { user: { email: "a@example.com", id: userAId } }, error: null };
      }

      return { data: { user: null }, error: new Error("Invalid token") };
    });
    await pool.query("TRUNCATE reflection_sessions, memory_entries RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves raw input and AI summary", async () => {
    aiMocks.summarizeMemory.mockResolvedValue("A one sentence memory summary.");
    aiMocks.acknowledgeMemory.mockResolvedValue("That sounds worth holding onto.");

    const response = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "I felt calmer after writing the plan down." })
      .expect(201);

    expect(response.body.user_id).toBe(userAId);
    expect(response.body.raw_input).toBe("I felt calmer after writing the plan down.");
    expect(response.body.ai_summary).toBe("A one sentence memory summary.");
    expect(response.body.acknowledgement).toBe("That sounds worth holding onto.");
    expect(response.body.created_at).toBeTruthy();
    expect(response.body.updated_at).toBeTruthy();
  });

  it("lists memories newest first", async () => {
    aiMocks.summarizeMemory
      .mockResolvedValueOnce("First summary.")
      .mockResolvedValueOnce("Second summary.");

    const first = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "First memory" })
      .expect(201);
    const second = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "Second memory" })
      .expect(201);

    const list = await request(app)
      .get("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);

    expect(list.body.map((entry: { id: string }) => entry.id)).toEqual([
      second.body.id,
      first.body.id,
    ]);
  });

  it("opens detail, edits, and deletes a memory", async () => {
    aiMocks.summarizeMemory
      .mockResolvedValueOnce("Original summary.")
      .mockResolvedValueOnce("Updated summary.");

    const created = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "Original memory" })
      .expect(201);

    const detail = await request(app)
      .get(`/api/memory-entries/${created.body.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(detail.body.ai_summary).toBe("Original summary.");

    const updated = await request(app)
      .patch(`/api/memory-entries/${created.body.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "Updated memory" })
      .expect(200);
    expect(updated.body.raw_input).toBe("Updated memory");
    expect(updated.body.ai_summary).toBe("Updated summary.");

    await request(app)
      .delete(`/api/memory-entries/${created.body.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(204);
    await request(app)
      .get(`/api/memory-entries/${created.body.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(404);
  });

  it("requires a valid Supabase session", async () => {
    await request(app).get("/api/memory-entries").expect(401);

    const response = await request(app)
      .get("/api/memory-entries")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);

    expect(response.body.code).toBe("invalid_session");
  });

  it("scopes memories to the authenticated user", async () => {
    aiMocks.summarizeMemory
      .mockResolvedValueOnce("User A summary.")
      .mockResolvedValueOnce("User B summary.");

    const userAEntry = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "User A memory" })
      .expect(201);

    const userBEntry = await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ rawInput: "User B memory" })
      .expect(201);

    const userAList = await request(app)
      .get("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(userAList.body.map((entry: { id: string }) => entry.id)).toEqual([
      userAEntry.body.id,
    ]);

    await request(app)
      .get(`/api/memory-entries/${userBEntry.body.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(404);
  });

  it("does not persist a partial entry when AI summary fails", async () => {
    aiMocks.summarizeMemory.mockRejectedValue(
      new AppError(503, "AI provider unavailable", "ai_unavailable")
    );

    await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "Please summarize later." })
      .expect(503);

    const list = await request(app)
      .get("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("does not persist a partial entry when AI acknowledgement fails", async () => {
    aiMocks.summarizeMemory.mockResolvedValue("Summary before acknowledgement failure.");
    aiMocks.acknowledgeMemory.mockRejectedValue(
      new AppError(503, "AI provider unavailable", "ai_unavailable")
    );

    await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "Please acknowledge later." })
      .expect(503);

    const list = await request(app)
      .get("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("rejects oversized memory input before calling AI", async () => {
    await request(app)
      .post("/api/memory-entries")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ rawInput: "x".repeat(2001) })
      .expect(413);

    expect(aiMocks.summarizeMemory).not.toHaveBeenCalled();
    expect(aiMocks.acknowledgeMemory).not.toHaveBeenCalled();
  });

  it("returns clean 400 JSON for invalid ids", async () => {
    const response = await request(app)
      .get("/api/memory-entries/not-a-uuid")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(400);
    expect(response.body.code).toBe("invalid_uuid");
  });

  it("creates and resumes one active reflection session", async () => {
    const created = await request(app)
      .post("/api/reflection-sessions")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(201);

    expect(created.body.session).toMatchObject({
      user_id: userAId,
      status: "active",
      title: "Untitled reflection",
    });
    expect(created.body.messages).toHaveLength(1);
    expect(created.body.messages[0]).toMatchObject({
      role: "assistant",
      content: "I'm here. What feels worth remembering right now?",
    });

    const resumed = await request(app)
      .get("/api/reflection-sessions/active")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);

    expect(resumed.body.session.id).toBe(created.body.session.id);
    expect(resumed.body.messages).toEqual(created.body.messages);
  });

  it("posts a reflection message idempotently and stores both turns", async () => {
    aiMocks.continueReflection.mockResolvedValue({
      state: "exploring",
      reply: "What do you remember seeing when that happened?",
      memoryProposal: null,
    });
    const created = await request(app)
      .post("/api/reflection-sessions")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(201);
    const body = {
      clientMessageId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      content: "Dad laughed when the tent fell down.",
    };

    const first = await request(app)
      .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send(body)
      .expect(201);

    expect(first.body.replayed).toBe(false);
    expect(first.body.userMessage).toMatchObject({
      client_message_id: body.clientMessageId,
      content: body.content,
      role: "user",
    });
    expect(first.body.assistantMessage).toMatchObject({
      content: "What do you remember seeing when that happened?",
      role: "assistant",
      metadata: { state: "exploring" },
    });

    const replay = await request(app)
      .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send(body)
      .expect(200);

    expect(replay.body).toEqual({ ...first.body, replayed: true });
    expect(aiMocks.continueReflection).toHaveBeenCalledTimes(1);
  });

  it("keeps a user message when AI fails and retries without duplicating it", async () => {
    aiMocks.continueReflection
      .mockRejectedValueOnce(new AppError(503, "AI provider unavailable", "ai_unavailable"))
      .mockResolvedValueOnce({
        state: "exploring",
        reply: "What stood out most clearly?",
        memoryProposal: null,
      });
    const created = await request(app)
      .post("/api/reflection-sessions")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(201);
    const path = `/api/reflection-sessions/${created.body.session.id}/messages`;
    const body = {
      clientMessageId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      content: "I remember the room being very quiet.",
    };

    await request(app)
      .post(path)
      .set("Authorization", `Bearer ${userAToken}`)
      .send(body)
      .expect(503);

    const afterFailure = await request(app)
      .get(`/api/reflection-sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(afterFailure.body.messages.filter((message: { role: string }) => message.role === "user"))
      .toHaveLength(1);

    await request(app)
      .post(path)
      .set("Authorization", `Bearer ${userAToken}`)
      .send(body)
      .expect(201);

    const afterRetry = await request(app)
      .get(`/api/reflection-sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(afterRetry.body.messages.filter((message: { role: string }) => message.role === "user"))
      .toHaveLength(1);
    expect(afterRetry.body.messages.filter((message: { role: string }) => message.role === "assistant"))
      .toHaveLength(2);
  });

  it("does not expose another user's reflection session", async () => {
    const created = await request(app)
      .post("/api/reflection-sessions")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(201);

    await request(app)
      .get(`/api/reflection-sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .expect(404);

    expect(aiMocks.continueReflection).not.toHaveBeenCalled();
  });

  it("upgrades an existing reflection message table missing idempotency columns", async () => {
    await pool.query(
      "ALTER TABLE reflection_messages DROP COLUMN client_message_id, DROP COLUMN reply_to_message_id"
    );

    await expect(pool.query(schemaSql)).resolves.toBeTruthy();

    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'reflection_messages'`
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(
      expect.arrayContaining(["client_message_id", "reply_to_message_id"])
    );
  });

  it("saves the approved proposal exactly without another AI call", async () => {
    aiMocks.continueReflection.mockImplementationOnce(
      async (messages: Array<{ id: string; role: string; content: string }>) => {
        const userMessage = [...messages].reverse().find((message) => message.role === "user");
        return {
          state: "proposal_ready",
          reply: "That feels like a memory worth holding onto.",
          memoryProposal: {
            title: "The Collapsed Tent",
            summary: "I remember Dad laughing when our tent collapsed.",
            evidence: [
              {
                userMessageId: userMessage?.id,
                excerpt: "Dad laughed when our tent collapsed",
              },
            ],
          },
        };
      }
    );
    const created = await request(app)
      .post("/api/reflection-sessions")
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(201);
    const turn = await request(app)
      .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        clientMessageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        content: "Dad laughed when our tent collapsed, and I felt completely safe.",
      })
      .expect(201);

    const saved = await request(app)
      .post(`/api/reflection-sessions/${created.body.session.id}/memory`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        assistantMessageId: turn.body.assistantMessage.id,
        title: "Camping with Dad",
        summary: "I remember Dad laughing when our tent collapsed.",
      })
      .expect(201);

    expect(saved.body).toMatchObject({
      user_id: userAId,
      session_id: created.body.session.id,
      title: "Camping with Dad",
      ai_summary: "I remember Dad laughing when our tent collapsed.",
    });
    expect(saved.body.raw_input).toContain("Dad laughed when our tent collapsed");
    expect(aiMocks.continueReflection).toHaveBeenCalledTimes(1);
    expect(aiMocks.summarizeMemory).not.toHaveBeenCalled();
    expect(aiMocks.acknowledgeMemory).not.toHaveBeenCalled();

    const detail = await request(app)
      .get(`/api/reflection-sessions/${created.body.session.id}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .expect(200);
    expect(detail.body.session.status).toBe("completed");

    const duplicate = await request(app)
      .post(`/api/reflection-sessions/${created.body.session.id}/memory`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        assistantMessageId: turn.body.assistantMessage.id,
        title: "Camping with Dad",
        summary: "I remember Dad laughing when our tent collapsed.",
      })
      .expect(409);
    expect(duplicate.body.code).toBe("proposal_handled");
  });
});
