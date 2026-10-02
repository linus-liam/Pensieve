import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { LocalBackups, restoreLocalBackup } from "../src/services/localBackups.js";
import { createLocalApp } from "../src/localApp.js";
import { LocalMemoryStore } from "../src/services/localMemoryStore.js";

let root: string;
const token = "synthetic-backup-test-token-123456789";
const headers = { "X-Pensieve-Local-Token": token };
const ai = { configured: false, model: "test", reply: async () => ({ message: "合成回复", review: "合成草稿" }) };
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "pensieve-backup-test-")); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function latest(backups: LocalBackups) {
  const names = (await readdir(backups.directory)).filter(name => name.startsWith("snapshot-")).sort();
  return join(backups.directory, names.at(-1)!);
}
it("restores raw messages, unconfirmed drafts, confirmed memories and their revisions without secrets", async () => {
  const source = join(root, "source");
  const backups = new LocalBackups(source);
  const app = createLocalApp(source, token, ai);
  const entry = await request(app).post("/api/memory-entries").set(headers).send({ rawInput: "  合成旧文字\n第二行  " });
  await request(app).patch(`/api/memory-entries/${entry.body.id}`).set(headers).send({ rawInput: "合成修改" });
  const id = randomUUID();
  await request(app).post("/api/sessions").set(headers).send({ id });
  await request(app).post(`/api/sessions/${id}/messages`).set(headers).send({ id: randomUUID(), content: "合成聊天原文" });
  await request(app).post(`/api/sessions/${id}/respond`).set(headers).send({ id: randomUUID(), cloudConsent: true });
  await writeFile(join(source, ".env.local"), "SYNTHETIC_SECRET_DO_NOT_COPY");
  await writeFile(join(source, "server.json"), "synthetic runtime");
  await backups.run();
  const snapshot = await latest(backups);
  const manifest = JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8"));
  expect(manifest.files.map((file: {path: string}) => file.path)).toEqual([`${entry.body.id}.json`, `sessions/${id}.json`]);
  const destination = join(root, "restored");
  expect(await restoreLocalBackup(snapshot, destination)).toBe(2);
  const restored = createLocalApp(destination, token, ai);
  const restoredSession = (await request(restored).get(`/api/sessions/${id}`).set(headers)).body;
  expect(restoredSession.messages[0].content).toBe("合成聊天原文");
  expect(restoredSession.drafts[0].text).toBe("合成草稿");
  expect((await request(restored).get(`/api/memory-entries/${entry.body.id}/history`).set(headers)).body.map((r: {raw_input: string}) => r.raw_input)).toEqual(["  合成旧文字\n第二行  ", "合成修改"]);
  await request(app).post(`/api/sessions/${id}/confirm`).set(headers).send({ draftId: restoredSession.current_draft_id, text: "自己确认的合成回顾" });
  await backups.run();
  await restoreLocalBackup(await latest(backups), join(root, "confirmed"));
  expect((await request(createLocalApp(join(root, "confirmed"), token, ai)).get("/api/memory-entries").set(headers)).body).toHaveLength(2);
});
it("deduplicates unchanged content, serializes requests and flushes pending changes on close", async () => {
  const source = join(root, "source");
  const backups = new LocalBackups(source);
  const store = new LocalMemoryStore(source);
  const entry = await store.create("第一版合成内容");
  await Promise.all([backups.run(), backups.run(), backups.run()]);
  expect((await backups.status()).count).toBe(1);
  await store.change(entry.id, "edited", "第二版合成内容");
  backups.schedule();
  await backups.close();
  expect((await backups.status()).count).toBe(2);
  await restoreLocalBackup(await latest(backups), join(root, "restored"));
  expect(await new LocalMemoryStore(join(root, "restored")).history(entry.id)).toHaveLength(2);
});
it("backs up successful API writes automatically and protects the manual backup endpoint", async () => {
  const source = join(root, "source");
  const backups = new LocalBackups(source);
  const app = createLocalApp(source, token, ai, backups);
  try {
    await request(app).post("/api/backups").expect(401);
    await request(app).post("/api/memory-entries").set(headers).send({ rawInput: "合成自动保存" }).expect(201);
    await new Promise(resolve => setTimeout(resolve, 1800));
    const info = (await request(app).get("/api/local-info").set(headers)).body;
    expect(info.backup.count).toBe(1);
    expect(info.backup.lastBackupAt).toBeTruthy();
    await request(app).post("/api/backups").set(headers).expect(200);
    expect((await backups.status()).count).toBe(1);
  } finally { await backups.close(); }
});
it("does not overwrite existing data or restore damaged files or paths outside the backup", async () => {
  const source = join(root, "source");
  const store = new LocalMemoryStore(source);
  const entry = await store.create("合成内容");
  const backups = new LocalBackups(source);
  await backups.run();
  const snapshot = await latest(backups);
  await expect(restoreLocalBackup(snapshot, source)).rejects.toThrow();
  expect((await store.history(entry.id))[0].raw_input).toBe("合成内容");
  await writeFile(join(snapshot, `${entry.id}.json`), "tampered");
  await expect(restoreLocalBackup(snapshot, join(root, "damaged"))).rejects.toThrow("校验失败");
  const manifest = JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8"));
  manifest.files[0].path = "../outside.json";
  manifest.digest = createHash("sha256").update(JSON.stringify(manifest.files)).digest("hex");
  await writeFile(join(snapshot, "manifest.json"), JSON.stringify(manifest));
  await expect(restoreLocalBackup(snapshot, join(root, "unsafe"))).rejects.toThrow("路径无效");
  expect(await readdir(root)).toEqual(["source"]);
});
it("reports backup failure without preventing local chat or claiming a valid snapshot", async () => {
  const source = join(root, "source"); await mkdir(source);
  await writeFile(join(source, ".backups"), "synthetic file in place of directory");
  const backups = new LocalBackups(source);
  const app = createLocalApp(source, token, ai, backups);
  try {
    await request(app).post("/api/memory-entries").set(headers).send({ rawInput: "仍然可以记录" }).expect(201);
    await request(app).post("/api/backups").set(headers).expect(503);
    const info = (await request(app).get("/api/local-info").set(headers).expect(200)).body;
    expect(info.backup.error).toContain("无法读取备份目录");
    expect(info.backup.lastBackupAt).toBeNull();
    expect((await request(app).get("/api/memory-entries").set(headers)).body).toHaveLength(1);
  } finally { await backups.close().catch(() => {}); }
});
it("retains the latest twenty snapshots and the latest snapshot for each older day", async () => {
  const source = join(root, "source");
  const backups = new LocalBackups(source);
  const store = new LocalMemoryStore(source);
  await store.create("合成保留规则");
  await backups.run();
  const original = await latest(backups);
  const manifest = JSON.parse(await readFile(join(original, "manifest.json"), "utf8"));
  // Seed metadata for older snapshots; the retention operation must not delete unknown folders.
  for (let i = 0; i < 35; i++) {
    const folder = join(backups.directory, `snapshot-2020-01-01T00-00-${String(i).padStart(2, "0")}-${randomUUID()}`);
    await mkdir(folder);
    await writeFile(join(folder, "manifest.json"), JSON.stringify({ ...manifest, digest: `old-${i}`, created_at: `2020-01-01T00:00:${String(i).padStart(2, "0")}.000Z` }));
  }
  await mkdir(join(backups.directory, "leave-this-folder"));
  await store.create("触发新快照");
  await backups.run();
  const remaining = await readdir(backups.directory);
  expect(remaining).toContain("leave-this-folder");
  expect((await backups.status()).count).toBe(20);
});
