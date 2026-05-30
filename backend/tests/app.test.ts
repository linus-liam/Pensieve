import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors.js";
import { schemaSql } from "../src/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDbTests = testDatabaseUrl ? describe : describe.skip;

const aiMocks = vi.hoisted(() => ({
  getAIReply: vi.fn(),
  generateTitle: vi.fn(),
}));

vi.mock("../src/services/aiService.js", () => aiMocks);

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-session-secret";
}

runDbTests("app", () => {
  let app: Express;
  let pool: typeof import("../src/db/client.js")["pool"];

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
    aiMocks.getAIReply.mockReset();
    aiMocks.generateTitle.mockReset();
    await pool.query('TRUNCATE messages, chats, "session", users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });

  async function register(email: string) {
    const agent = request.agent(app);
    const response = await agent
      .post("/api/auth/register")
      .send({ email, password: "correct horse battery staple" })
      .expect(201);

    expect(response.body.user.email).toBe(email);
    return agent;
  }

  it("requires authentication for chats", async () => {
    await request(app).get("/api/chats").expect(401);
  });

  it("prevents reading another user's chat", async () => {
    const firstUser = await register("one@example.com");
    const secondUser = await register("two@example.com");

    const chat = await firstUser.post("/api/chats").send({}).expect(201);

    await secondUser.get(`/api/chats/${chat.body.id}/messages`).expect(404);
  });

  it("stores one complete turn and deterministic title on AI success", async () => {
    aiMocks.getAIReply.mockResolvedValue("A short reply.");
    aiMocks.generateTitle.mockResolvedValue("A Useful Title");

    const agent = await register("writer@example.com");
    const chat = await agent.post("/api/chats").send({}).expect(201);

    const sent = await agent
      .post(`/api/chats/${chat.body.id}/messages`)
      .send({ content: "I feel overwhelmed today." })
      .expect(201);

    expect(sent.body.userMessage.content).toBe("I feel overwhelmed today.");
    expect(sent.body.assistantMessage.content).toBe("A short reply.");
    expect(sent.body.chat.title).toBe("A Useful Title");

    const messages = await agent.get(`/api/chats/${chat.body.id}/messages`).expect(200);
    expect(messages.body).toHaveLength(2);
  });

  it("does not persist a partial user message when AI fails", async () => {
    aiMocks.getAIReply.mockRejectedValue(
      new AppError(503, "AI provider unavailable", "ai_unavailable")
    );

    const agent = await register("failure@example.com");
    const chat = await agent.post("/api/chats").send({}).expect(201);

    await agent
      .post(`/api/chats/${chat.body.id}/messages`)
      .send({ content: "Please help." })
      .expect(503);

    const messages = await agent.get(`/api/chats/${chat.body.id}/messages`).expect(200);
    expect(messages.body).toHaveLength(0);
  });

  it("returns clean 400 JSON for invalid chat ids", async () => {
    const agent = await register("invalid@example.com");

    const response = await agent.get("/api/chats/not-a-uuid/messages").expect(400);
    expect(response.body.code).toBe("invalid_uuid");
  });
});
