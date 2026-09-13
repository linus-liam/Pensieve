// Browser-safe source format shared by the local server and device storage.
// Only original bytes and provenance are durable. Reading views can be regenerated.
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 36 * 1024 * 1024;
export type MaterialKind = "zip" | "markdown" | "text";
export interface MaterialInput {
  name: string; kind: MaterialKind; origin: "file" | "paste";
  source: string; source_date: string | null; base64: string;
}
export interface RawMaterial extends MaterialInput {
  format: "pensieve-raw-v1"; id: string; imported_at: string;
  original_sha256: string; byte_length: number;
}
export type MaterialSummary = Omit<RawMaterial, "base64">;
export interface MaterialBackup { format: "pensieve-material-backup-v1"; record: RawMaterial; sha256: string }
export class ImportError extends Error {}
export function fail(message: string): never { throw new ImportError(message); }

export async function sha256(bytes: Uint8Array): Promise<string> {
  // Pass a byte view: Node 20 WebCrypto rejects a foreign-realm ArrayBuffer
  // (e.g. jsdom), but accepts its typed-array view, as browsers do.
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes))), b => b.toString(16).padStart(2, "0")).join("");
}
export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(text);
}
export function fromBase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) fail("原件编码无效或超过 25 MiB，未保存。");
  let text: string;
  try { text = atob(value); } catch { fail("原件编码无效，未保存。"); }
  const bytes = Uint8Array.from(text, c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || toBase64(bytes) !== value) fail("原件为空、过大或编码无效，未保存。");
  return bytes;
}
export function inputMetadata(value: unknown): Omit<MaterialInput, "base64"> {
  if (!value || typeof value !== "object") fail("导入信息无效。");
  const v = value as MaterialInput;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 255 || /[\x00-\x1f/\\]/.test(v.name)) fail("文件名称无效。");
  if (!["zip", "markdown", "text"].includes(v.kind) || !["file", "paste"].includes(v.origin) || (v.origin === "paste" && v.kind !== "text")) fail("请选择 ZIP、Markdown 或纯文字。");
  if (typeof v.source !== "string" || v.source.length > 200) fail("来源说明过长。");
  if (v.source_date !== null && (typeof v.source_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.source_date) || !Number.isFinite(Date.parse(v.source_date)) || new Date(v.source_date).toISOString().slice(0, 10) !== v.source_date)) fail("原始日期无效；不确定可以留空。");
  return { name: v.name, kind: v.kind, origin: v.origin, source: v.source, source_date: v.source_date };
}
async function identity(meta: Omit<MaterialInput, "base64">, digest: string) {
  // Names are excluded so renaming a file cannot duplicate it. Known source/date
  // are included: identical words from different occasions must remain distinct.
  return sha256(new TextEncoder().encode(JSON.stringify(["pensieve-raw-v1", digest, meta.kind, meta.origin, meta.source, meta.source_date])));
}
export async function makeMaterial(value: unknown): Promise<RawMaterial> {
  const meta = inputMetadata(value);
  const base64 = (value as MaterialInput).base64;
  const bytes = fromBase64(base64);
  const digest = await sha256(bytes);
  return { format: "pensieve-raw-v1", ...meta, base64, id: await identity(meta, digest), imported_at: new Date().toISOString(), original_sha256: digest, byte_length: bytes.length };
}
export async function verifyMaterial(value: unknown): Promise<RawMaterial> {
  const meta = inputMetadata(value);
  const r = value as RawMaterial;
  if (r.format !== "pensieve-raw-v1" || typeof r.imported_at !== "string" || !Number.isFinite(Date.parse(r.imported_at))) fail("原材料格式或导入时间无效。");
  const bytes = fromBase64(r.base64);
  const digest = await sha256(bytes);
  if (r.original_sha256 !== digest || r.byte_length !== bytes.length || r.id !== await identity(meta, digest)) fail("原件完整性校验失败，未覆盖已有内容。");
  return { format: r.format, ...meta, base64: r.base64, id: r.id, imported_at: r.imported_at, original_sha256: digest, byte_length: bytes.length };
}
export function summary(record: RawMaterial): MaterialSummary {
  const { base64: _bytes, ...meta } = record;
  return meta;
}
export async function materialBackup(record: RawMaterial): Promise<MaterialBackup> {
  const verified = await verifyMaterial(record);
  return { format: "pensieve-material-backup-v1", record: verified, sha256: await sha256(new TextEncoder().encode(JSON.stringify(verified))) };
}
export async function readMaterialBackup(value: unknown): Promise<RawMaterial> {
  const b = value as MaterialBackup;
  if (!b || b.format !== "pensieve-material-backup-v1" || b.sha256 !== await sha256(new TextEncoder().encode(JSON.stringify(b.record)))) fail("原材料备份清单校验失败。");
  return verifyMaterial(b.record);
}
