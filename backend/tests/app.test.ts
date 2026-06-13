import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../src/errors.js";
import { schemaSql } from "../src/db/schema.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const runDbTests = testDatabaseUrl ? describe : describe.skip;

const aiMocks = vi.hoisted(() => ({
  summarizeMemory: vi.fn(),
}));

vi.mock("../src/services/aiService.js", () => aiMocks);

if (testDatabaseUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
}

runDbTests("memory entries API", () => {
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
    aiMocks.summarizeMemory.mockReset();
    await pool.query("TRUNCATE memory_entries RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves raw input and AI summary", async () => {
    aiMocks.summarizeMemory.mockResolvedValue("A one sentence memory summary.");

    const response = await request(app)
      .post("/api/memory-entries")
      .send({ rawInput: "I felt calmer after writing the plan down." })
      .expect(201);

    expect(response.body.raw_input).toBe("I felt calmer after writing the plan down.");
    expect(response.body.ai_summary).toBe("A one sentence memory summary.");
    expect(response.body.created_at).toBeTruthy();
    expect(response.body.updated_at).toBeTruthy();
  });

  it("lists memories newest first", async () => {
    aiMocks.summarizeMemory
      .mockResolvedValueOnce("First summary.")
      .mockResolvedValueOnce("Second summary.");

    const first = await request(app)
      .post("/api/memory-entries")
      .send({ rawInput: "First memory" })
      .expect(201);
    const second = await request(app)
      .post("/api/memory-entries")
      .send({ rawInput: "Second memory" })
      .expect(201);

    const list = await request(app).get("/api/memory-entries").expect(200);

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
      .send({ rawInput: "Original memory" })
      .expect(201);

    const detail = await request(app)
      .get(`/api/memory-entries/${created.body.id}`)
      .expect(200);
    expect(detail.body.ai_summary).toBe("Original summary.");

    const updated = await request(app)
      .patch(`/api/memory-entries/${created.body.id}`)
      .send({ rawInput: "Updated memory" })
      .expect(200);
    expect(updated.body.raw_input).toBe("Updated memory");
    expect(updated.body.ai_summary).toBe("Updated summary.");

    await request(app).delete(`/api/memory-entries/${created.body.id}`).expect(204);
    await request(app).get(`/api/memory-entries/${created.body.id}`).expect(404);
  });

  it("does not persist a partial entry when AI summary fails", async () => {
    aiMocks.summarizeMemory.mockRejectedValue(
      new AppError(503, "AI provider unavailable", "ai_unavailable")
    );

    await request(app)
      .post("/api/memory-entries")
      .send({ rawInput: "Please summarize later." })
      .expect(503);

    const list = await request(app).get("/api/memory-entries").expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("rejects oversized memory input before calling AI", async () => {
    await request(app)
      .post("/api/memory-entries")
      .send({ rawInput: "x".repeat(2001) })
      .expect(413);

    expect(aiMocks.summarizeMemory).not.toHaveBeenCalled();
  });

  it("returns clean 400 JSON for invalid ids", async () => {
    const response = await request(app).get("/api/memory-entries/not-a-uuid").expect(400);
    expect(response.body.code).toBe("invalid_uuid");
  });
});
