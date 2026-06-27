import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors.js";
import { schemaSql } from "../src/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDbTests = testDatabaseUrl ? describe : describe.skip;

const aiMocks = vi.hoisted(() => ({
  acknowledgeMemory: vi.fn(),
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
    await pool.query("TRUNCATE memory_entries RESTART IDENTITY CASCADE");
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
});
