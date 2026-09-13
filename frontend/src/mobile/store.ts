import type { ReflectionSession } from "../sessionTypes";
import type { MemoryRevision } from "../api/client";
import { materialBackup, readMaterialBackup, type MaterialBackup, type RawMaterial } from "../../../backend/src/imports/materials";

export interface StoredEntry { id: string; revisions: MemoryRevision[] }
export interface PhoneBackup { format: "pensieve-phone-v1" | "pensieve-phone-v2"; exported_at: string; sessions: ReflectionSession[]; entries: StoredEntry[]; materials?: MaterialBackup[] }
export const MAX_PHONE_BACKUP_BYTES = 200 * 1024 * 1024;
const databaseName = "pensieve-phone-v1";
type Collection = "sessions" | "entries" | "materials";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onupgradeneeded = () => {
      for (const name of ["sessions", "entries", "materials"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onerror = () => reject(new Error("未能打开设备存储。请使用普通浏览模式，并检查可用空间。"));
    request.onblocked = () => reject(new Error("请关闭其他 Pensieve 页面，再重新打开以完成存储升级。"));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
export async function all<T>(collection: Collection): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readonly");
    const read = tx.objectStore(collection).getAll();
    tx.oncomplete = () => { db.close(); resolve(read.result as T[]); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("读取未完成")); };
  });
}
export async function get<T>(collection: Collection, id: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readonly");
    const read = tx.objectStore(collection).get(id);
    tx.oncomplete = () => { db.close(); resolve(read.result as T | undefined); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("读取未完成")); };
  });
}
// The mutation is synchronous inside one read/write transaction. Resolve only on commit.
export async function change<T>(collection: Collection, id: string, mutate: (value: T | undefined) => T): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(collection, "readwrite", { durability: "strict" });
    let result: T;
    let error: unknown;
    const store = tx.objectStore(collection);
    const read = store.get(id);
    read.onsuccess = () => {
      try { result = mutate(read.result); store.put(result); }
      catch (failure) { error = failure; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(error ?? new Error("保存未完成，请检查设备空间；这次输入还在页面中。")); };
  });
}
export async function snapshot(includeMaterials = true): Promise<PhoneBackup> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(includeMaterials ? ["sessions", "entries", "materials"] : ["sessions", "entries"], "readonly");
    const sessions = tx.objectStore("sessions").getAll();
    const entries = tx.objectStore("entries").getAll();
    const materials = includeMaterials ? tx.objectStore("materials").getAll() : null;
    tx.oncomplete = () => {
      db.close();
      void Promise.all((materials?.result ?? []).map((record: RawMaterial) => materialBackup(record))).then(backups => resolve({ format: "pensieve-phone-v2", exported_at: new Date().toISOString(), sessions: sessions.result, entries: entries.result, materials: backups }), reject);
    };
    tx.onabort = () => { db.close(); reject(new Error("备份读取未完成")); };
  });
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const text = (v: unknown, max = 500000) => typeof v === "string" && v.length <= max;
export function validateBackup(value: unknown): PhoneBackup {
  const fail = () => { throw new Error("这不是有效的 Pensieve 手机备份，原有内容未修改。"); };
  if (!value || typeof value !== "object") return fail();
  const b = value as PhoneBackup;
  if (!["pensieve-phone-v1", "pensieve-phone-v2"].includes(b.format) || !date(b.exported_at) || !Array.isArray(b.sessions) || !Array.isArray(b.entries) || b.sessions.length + b.entries.length > 10000) return fail();
  if (b.format === "pensieve-phone-v2" ? !Array.isArray(b.materials) || b.materials.length > 10000 : b.materials !== undefined) return fail();
  const revision = (r: MemoryRevision, id: string) => r && r.id === id && r.user_id === "local" && text(r.raw_input) && text(r.ai_summary) && date(r.created_at) && date(r.updated_at) && Number.isInteger(r.revision) && r.revision > 0 && ["created", "edited", "archived", "restored"].includes(r.action) && typeof r.archived === "boolean";
  const ids = new Set<string>();
  for (const s of b.sessions) {
    if (!s || !uuid(s.id) || ids.has(s.id) || !date(s.created_at) || !date(s.updated_at) || !["active", "review", "completed"].includes(s.status) || !Array.isArray(s.messages) || !Array.isArray(s.drafts) || !Array.isArray(s.memory_revisions)) return fail();
    ids.add(s.id);
    const messageIds = new Set<string>();
    for (const m of s.messages) {
      if (!m || !uuid(m.id) || messageIds.has(m.id) || !["user", "assistant"].includes(m.role) || !date(m.created_at) || !text(m.content, 20000)) return fail();
      messageIds.add(m.id);
    }
    const draftIds = new Set<string>();
    for (const d of s.drafts) {
      if (!d || !uuid(d.id) || draftIds.has(d.id) || !text(d.text, 20000) || !date(d.created_at) || !Array.isArray(d.source_message_ids) || !d.source_message_ids.every(id => messageIds.has(id)) || (d.author !== undefined && d.author !== "user")) return fail();
      draftIds.add(d.id);
    }
    if (s.current_draft_id !== null && !draftIds.has(s.current_draft_id)) return fail();
    if (s.status === "review" && !s.current_draft_id || s.status === "active" && s.current_draft_id !== null) return fail();
    if (!s.memory_revisions.every((r, i) => revision(r as MemoryRevision, s.id) && (r as MemoryRevision).revision === i + 1 && r.source_session_id === s.id)) return fail();
    if ((s.status === "completed") !== (s.memory_revisions.length > 0)) return fail();
  }
  for (const e of b.entries) {
    if (!e || !uuid(e.id) || ids.has(e.id) || !Array.isArray(e.revisions) || !e.revisions.length || !e.revisions.every((r, i) => revision(r, e.id) && r.revision === i + 1 && !r.source_session_id)) return fail();
    ids.add(e.id);
  }
  return b;
}
export async function restoreBackup(value: unknown) {
  const backup = validateBackup(value);
  // Verify every original before opening the write transaction. A bad final record
  // must not leave earlier records partially restored.
  const materials: RawMaterial[] = [];
  const materialIds = new Set<string>();
  for (const envelope of backup.materials ?? []) {
    const record = await readMaterialBackup(envelope);
    if (materialIds.has(record.id)) throw new Error("备份中有重复原件，未恢复。");
    materialIds.add(record.id); materials.push(record);
  }
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["sessions", "entries", "materials"], "readwrite", { durability: "strict" });
    let conflict = false;
    const records = { sessions: backup.sessions, entries: backup.entries, materials };
    for (const collection of ["sessions", "entries", "materials"] as const) for (const record of records[collection]) {
      const store = tx.objectStore(collection);
      const read = store.get(record.id);
      read.onsuccess = () => {
        if (read.result && JSON.stringify(read.result) !== JSON.stringify(record)) { conflict = true; tx.abort(); }
        else if (!read.result) store.add(record);
      };
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error(conflict ? "备份与本机存在不同版本，为避免覆盖已取消整次恢复。" : "恢复未完成，原有内容未修改。")); };
  });
}
