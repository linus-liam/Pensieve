import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mobileRequest } from "./api";
import { all, get, restoreBackup, snapshot } from "./store";
import { makeMaterial, materialBackup, toBase64, type RawMaterial } from "../../../backend/src/imports/materials";

const input = (text = "  合成手机原话\r\n不能丢失  ") => ({ name: "手机原话.txt", kind: "text", origin: "paste", source: "ChatGPT", source_date: null, base64: toBase64(new TextEncoder().encode(text)) });
const send = <T = { material: RawMaterial; duplicate: boolean }>(path: string, body?: unknown) => mobileRequest<T>(path, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
async function erase() { await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase("pensieve-phone-v1"); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); }); }
beforeEach(async () => { vi.stubGlobal("crypto", webcrypto); await erase(); });
afterEach(() => vi.unstubAllGlobals());

it("imports locally while offline, deduplicates retries, reopens exact bytes and restores complete device backups", async () => {
  const network = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", network);
  const [a, b] = await Promise.all([send("/materials", input()), send("/materials", input())]);
  expect([a.duplicate, b.duplicate].sort()).toEqual([false, true]);
  const record = await send<RawMaterial>(`/materials/${a.material.id}`);
  expect(record.base64).toBe(input().base64);
  const backup = JSON.parse(JSON.stringify(await snapshot()));
  expect(backup.format).toBe("pensieve-phone-v2");
  expect(backup.materials[0].record).toEqual(record);
  await erase(); await restoreBackup(backup);
  expect(await get("materials", record.id)).toEqual(record);
  expect(network).not.toHaveBeenCalled();
  expect(await send("/memory-entries")).toEqual([]);
});
it("upgrades an existing v1 database without losing writing, and accepts legacy backups", async () => {
  const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("pensieve-phone-v1", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("sessions", { keyPath: "id" }); r.result.createObjectStore("entries", { keyPath: "id" }); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  const entryId = crypto.randomUUID(); const time = new Date().toISOString();
  const entry = { id: entryId, revisions: [{ id: entryId, user_id: "local", raw_input: "旧版合成文字", ai_summary: "旧版", created_at: time, updated_at: time, revision: 1, archived: false, action: "created" }] };
  await new Promise<void>(resolve => { const tx = legacy.transaction("entries", "readwrite"); tx.objectStore("entries").add(entry); tx.oncomplete = () => resolve(); });
  legacy.close();
  await send("/materials", input());
  expect(await get("entries", entryId)).toEqual(entry);
  await restoreBackup({ format: "pensieve-phone-v1", exported_at: time, sessions: [], entries: [entry] });
  expect(await all("materials")).toHaveLength(1);
});
it("rejects a corrupt final original before restoring any record and rolls back conflicting full backups", async () => {
  const a = await materialBackup(await makeMaterial(input("first")));
  const b = await materialBackup(await makeMaterial(input("second")));
  const broken = structuredClone(b); broken.record.base64 = "Yg==";
  const empty = await snapshot();
  await expect(restoreBackup({ ...empty, materials: [a, broken] })).rejects.toThrow("校验失败");
  expect(await all("materials")).toEqual([]);
  await send("/materials/restore", b);
  // Same identity with conflicting historical metadata is never silently overwritten by a full restore.
  const changed = await materialBackup({ ...b.record, name: "different-name.txt" });
  await expect(restoreBackup({ ...empty, materials: [a, changed] })).rejects.toThrow("不同版本");
  expect(await get("materials", a.record.id)).toBeUndefined();
  expect(await get("materials", b.record.id)).toEqual(b.record);
});
it("restores a portable Mac-format original without changing its provenance", async () => {
  const original = await makeMaterial(input());
  original.imported_at = "2020-01-01T00:00:00.000Z";
  const envelope = await materialBackup(original);
  await send("/materials/restore", envelope);
  expect(await send<RawMaterial>(`/materials/${original.id}`)).toEqual(original);
  expect((await send("/materials/restore", envelope)).duplicate).toBe(true);
});
