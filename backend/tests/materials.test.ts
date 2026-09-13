import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from "@zip.js/zip.js";
import request from "supertest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fromBase64, makeMaterial, materialBackup, MAX_FILE_BYTES, readMaterialBackup, toBase64, type MaterialInput } from "../src/imports/materials.js";
import { readMaterial } from "../src/imports/readMaterial.js";
import { LocalMaterialStore } from "../src/services/localMaterialStore.js";
import { LocalBackups, restoreLocalBackup } from "../src/services/localBackups.js";
import { createLocalApp } from "../src/localApp.js";

const bytes = (s: string) => new TextEncoder().encode(s);
const input = (text = "  合成情绪原文\r\n哲学与情绪 🌊  ", overrides: Partial<MaterialInput> = {}): MaterialInput => ({ name: "合成.txt", kind: "text", origin: "paste", source: "", source_date: null, base64: toBase64(bytes(text)), ...overrides });
async function zip(files: [string, Uint8Array][], options: { password?: string; level?: number } = {}) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), { useWebWorkers: false });
  for (const [name, data] of files) await writer.add(name, new Uint8ArrayReader(data), { ...options, useWebWorkers: false });
  return writer.close();
}
const conversation = [{ id: "synthetic-conversation", title: "合成的完整讨论", create_time: 1500000000, mapping: {
  a: { parent: null, children: ["b", "c"], message: { author: { role: "user" }, create_time: null, content: { content_type: "text", parts: ["  用户的原话\n不能被摘要替换  "] } } },
  b: { parent: "a", message: { author: { role: "assistant" }, create_time: 1500000001, content: { content_type: "text", parts: ["旧回复"] } } },
  c: { parent: "a", message: { author: { role: "tool" }, create_time: null, content: { content_type: "image_asset_pointer", asset_pointer: "attachment.bin" } } },
}, current_node: "c", unknown_future_metadata: { keep: true } }];
let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), "pensieve-material-test-")); });
afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });
const token = "synthetic-import-token-never-a-real-secret";
const headers = { "X-Pensieve-Local-Token": token };
const ai = { configured: false, model: "test", reply: vi.fn() };

it("persists exact pasted and file bytes with unknown dates, across restart and authenticated API reads", async () => {
  const app = createLocalApp(root, token, ai);
  await request(app).post("/api/materials").send(input()).expect(401);
  const created = (await request(app).post("/api/materials").set(headers).send(input()).expect(201)).body;
  const restarted = createLocalApp(root, token, ai);
  const result = (await request(restarted).get(`/api/materials/${created.material.id}`).set(headers).expect(200)).body;
  expect(result.base64).toBe(input().base64);
  expect(result.source_date).toBeNull();
  expect((await readMaterial(result)).documents[0].text).toBe(new TextDecoder().decode(fromBase64(input().base64)));
  expect((await request(restarted).get("/api/materials").set(headers)).body[0].base64).toBeUndefined();
  expect((await request(restarted).get("/api/memory-entries").set(headers)).body).toEqual([]);
  expect((await stat(join(root, "materials", `${result.id}.json`))).mode & 0o777).toBe(0o600);
  expect(ai.reply).not.toHaveBeenCalled();
  // Exercise the larger endpoint without raising limits on chat messages.
  await request(app).post("/api/materials").set(headers).send(input("长".repeat(800000), { origin: "file" })).expect(201);
});
it("reads numbered ChatGPT exports, every branch/role and text notes while retaining every archive byte", async () => {
  const archive = await zip([["export/conversations-1.json", bytes(JSON.stringify(conversation))], ["notes/想法.md", bytes("\uFEFF# 合成\r\n  原话  ")], ["attachment.bin", new Uint8Array([0, 255, 18, 90])]]);
  const material = await makeMaterial(input("", { name: "chatgpt.zip", kind: "zip", origin: "file", base64: toBase64(archive) }));
  const view = await readMaterial(material);
  expect(view.files).toHaveLength(3); expect(view.documents).toHaveLength(2);
  const doc = view.documents[0];
  expect(doc.source_created_at).toBe("2017-07-14T02:40:00.000Z");
  expect(doc.text).toContain("user · 原始时间未知");
  expect(doc.text).toContain("  用户的原话\n不能被摘要替换  ");
  expect(doc.text).toContain("旧回复"); expect(doc.text).toContain("tool"); expect(doc.text).toContain("attachment.bin");
  expect(doc.text).toContain("上级 a");
  expect(view.warnings.join("\n")).toContain("仅保留");
  const store = new LocalMaterialStore(join(root, "materials"));
  const result = await store.import(material);
  expect(fromBase64((await store.get(result.material.id)).base64)).toEqual(archive);
  const backup = await materialBackup(await store.get(result.material.id));
  const restored = await new LocalMaterialStore(join(root, "other-device")).restore(JSON.parse(JSON.stringify(backup)));
  expect(restored.material.id).toBe(material.id);
});
it("deduplicates concurrent retries without rewriting originals, but keeps changed content and known source dates", async () => {
  const directory = join(root, "materials");
  const results = await Promise.all([new LocalMaterialStore(directory).import(input()), new LocalMaterialStore(directory).import(input("  合成情绪原文\r\n哲学与情绪 🌊  ", { name: "renamed.txt" }))]);
  expect(results.map(r => r.duplicate).sort()).toEqual([false, true]);
  const store = new LocalMaterialStore(directory);
  const before = await store.get(results[0].material.id);
  await store.import(input("增加的新内容"));
  await store.import(input(undefined, { source_date: "2020-01-01" }));
  expect(await store.list()).toHaveLength(3);
  expect(await store.get(before.id)).toEqual(before);
});
it("retains unknown JSON structures and binary encodings explicitly without inventing readable messages", async () => {
  const archive = await zip([["conversations.json", bytes("{ future schema")], ["unknown.bin", bytes("synthetic")]]);
  const record = await makeMaterial(input("", { name: "unknown.zip", kind: "zip", origin: "file", base64: toBase64(archive) }));
  const view = await readMaterial(record);
  expect(view.documents).toEqual([]); expect(view.warnings.join("\n")).toContain("JSON 无法展开");
  await new LocalMaterialStore(join(root, "materials")).import(record);
  const opaque = await readMaterial(await makeMaterial(input("", { origin: "file", base64: toBase64(new Uint8Array([0xff, 0x80])) })));
  expect(opaque.documents).toEqual([]); expect(opaque.warnings[0]).toContain("编码未识别");
});
it("rejects damaged, encrypted, traversing and oversized ZIP entries before publishing any material", async () => {
  const store = new LocalMaterialStore(join(root, "materials"));
  const damaged = await zip([["notes.txt", bytes("synthetic clear text")]], { level: 0 });
  const offset = Buffer.from(damaged).indexOf("synthetic clear text"); damaged[offset] ^= 1;
  for (const archive of [damaged, (await zip([["notes.txt", bytes("fine")]])).slice(0, -12), await zip([["../escape.txt", bytes("bad path")]]), await zip([["notes.txt", bytes("encrypted")]], { password: "synthetic" })]) {
    await expect(store.import(input("", { name: "bad.zip", kind: "zip", origin: "file", base64: toBase64(archive) }))).rejects.toThrow();
  }
  // Lie in both headers: actual streaming output must still be bounded/checked.
  const bomb = await zip([["notes.txt", bytes("x".repeat(100000))]]);
  const data = new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength);
  data.setUint32(22, 1, true);
  for (let i = 0; i < bomb.length - 4; i++) if (data.getUint32(i, true) === 0x02014b50) data.setUint32(i + 24, 1, true);
  await expect(store.import(input("", { name: "bomb.zip", kind: "zip", origin: "file", base64: toBase64(bomb) }))).rejects.toThrow();
  expect(await store.list()).toEqual([]);
  await expect(makeMaterial(input("", { base64: "A".repeat(Math.ceil(MAX_FILE_BYTES / 3) * 4 + 4) }))).rejects.toThrow("25 MiB");
});
it("restores full local snapshots with original attachments and metadata, and rejects corrupt sources", async () => {
  const source = join(root, "source"); const store = new LocalMaterialStore(join(source, "materials"));
  const saved = await store.import(input());
  const backups = new LocalBackups(source);
  await backups.run();
  const name = (await readdir(backups.directory)).find(n => n.startsWith("snapshot-"))!;
  const snapshot = join(backups.directory, name);
  const destination = join(root, "recovered");
  expect(await restoreLocalBackup(snapshot, destination)).toBe(1);
  expect(await new LocalMaterialStore(join(destination, "materials")).get(saved.material.id)).toEqual(await store.get(saved.material.id));
  const path = join(source, "materials", `${saved.material.id}.json`);
  const changed = JSON.parse(await readFile(path, "utf8")); changed.base64 = toBase64(bytes("tamper"));
  await writeFile(path, JSON.stringify(changed));
  await expect(backups.run()).rejects.toThrow("校验失败");
  expect((await backups.status()).count).toBe(1);
});
it("checks portable backup provenance and bytes and leaves disk failures safely retryable", async () => {
  const record = await makeMaterial(input()); const backup = await materialBackup(record);
  const damaged = structuredClone(backup); damaged.record.imported_at = "2020-01-01T00:00:00.000Z";
  await expect(readMaterialBackup(damaged)).rejects.toThrow("清单校验失败");
  await writeFile(join(root, "blocked"), "synthetic filesystem failure");
  await expect(new LocalMaterialStore(join(root, "blocked")).import(input())).rejects.toThrow();
  const result = await new LocalMaterialStore(join(root, "retry")).import(input());
  expect(result.duplicate).toBe(false);
  await expect(makeMaterial(input(undefined, { source_date: "2020-02-31" }))).rejects.toThrow("日期无效");
});
