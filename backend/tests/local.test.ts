import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalApp } from "../src/localApp.js";
import { LocalMemoryStore } from "../src/services/localMemoryStore.js";

const token = "test-local-token-that-is-long-enough";
let directory: string;
const headers = { "X-Pensieve-Local-Token": token };
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "pensieve-test-")); });
afterEach(async () => { vi.unstubAllGlobals(); await rm(directory, { recursive: true, force: true }); });

describe("local memories", () => {
  it("preserves exact text and revisions across app restarts without a network call", async () => {
    const network = vi.fn(() => { throw new Error("Network must not be used"); });
    vi.stubGlobal("fetch", network);
    const app = createLocalApp(directory, token);
    const original = "  2022 年的想法\n\n第二段。  \n";
    const created = await request(app).post("/api/memory-entries").set(headers).send({ rawInput: original }).expect(201);
    const id = created.body.id;
    await request(app).patch(`/api/memory-entries/${id}`).set(headers).send({ rawInput: "今天有了不同的理解" }).expect(200);
    const restarted = createLocalApp(directory, token);
    const history = await request(restarted).get(`/api/memory-entries/${id}/history`).set(headers).expect(200);
    expect(history.body.map((r: {raw_input: string}) => r.raw_input)).toEqual([original, "今天有了不同的理解"]);
    expect(history.body[1].created_at).toBe(created.body.created_at);
    const files = await readdir(directory);
    expect(files).toEqual([`${id}.json`]);
    expect(JSON.parse(await readFile(join(directory, files[0]), "utf8")).revisions).toHaveLength(2);
    expect(network).not.toHaveBeenCalled();
  });
  it("archives, exports all history, and restores", async () => {
    const app = createLocalApp(directory, token);
    const created = await request(app).post("/api/memory-entries").set(headers).send({ rawInput: "不要丢失过去" });
    const id = created.body.id;
    await request(app).delete(`/api/memory-entries/${id}`).set(headers).expect(204);
    expect((await request(app).get("/api/memory-entries").set(headers)).body).toHaveLength(0);
    expect((await request(app).get("/api/memory-entries?archived=true").set(headers)).body).toHaveLength(1);
    const exported = await request(app).get("/api/export").set(headers).expect(200);
    expect(exported.text).toContain("不要丢失过去");
    expect(exported.text).toContain("Revision 2 · archived");
    await request(app).post(`/api/memory-entries/${id}/restore`).set(headers).expect(200);
    expect((await request(app).get("/api/memory-entries").set(headers)).body).toHaveLength(1);
  });
  it("rejects unauthenticated reads/writes, invalid IDs and blank input", async () => {
    const app = createLocalApp(directory, token);
    await request(app).get("/api/export").expect(401);
    await request(app).post("/api/memory-entries").send({ rawInput: "bad" }).expect(401);
    await request(app).get("/api/local-info").set("X-Pensieve-Local-Token", "wrong").expect(401);
    await request(app).get("/api/memory-entries/not-a-uuid").set(headers).expect(400);
    await request(app).post("/api/memory-entries").set(headers).send({ rawInput: "   " }).expect(400);
  });
  it("retains concurrent edits and lists beyond the cloud pagination limit", async () => {
    const store = new LocalMemoryStore(directory);
    const entry = await store.create("first");
    await Promise.all(Array.from({ length: 10 }, (_, i) => store.change(entry.id, "edited", `edit ${i}`)));
    expect(await store.history(entry.id)).toHaveLength(11);
    await Promise.all(Array.from({ length: 101 }, (_, i) => store.create(`memory ${i}`)));
    expect(await store.list()).toHaveLength(102);
  });
  it("accepts long pasted documents and reports disk corruption instead of silently hiding it", async () => {
    const app = createLocalApp(directory, token);
    const text = "一段过去的文字\n".repeat(2000);
    const created = await request(app).post("/api/memory-entries").set(headers).send({ rawInput: text }).expect(201);
    expect(created.body.raw_input).toBe(text);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(directory, `${created.body.id}.json`), "corrupted");
    await request(app).get("/api/memory-entries").set(headers).expect(500);
  });
});
