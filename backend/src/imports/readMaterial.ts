import { ZipReader, Uint8ArrayReader } from "@zip.js/zip.js";
import { fail, fromBase64, ImportError, MAX_FILE_BYTES, type RawMaterial } from "./materials.js";

export interface SourceDocument {
  key: string; title: string; path: string; source_id: string | null;
  source_created_at: string | null; text: string;
}
export interface MaterialView {
  parser_version: 1; documents: SourceDocument[];
  files: { path: string; bytes: number; readable: boolean }[]; warnings: string[];
}
const MAX_EXPANDED = 100 * 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_DOCUMENTS = 5000;
const object = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;
const sourceTime = (v: unknown): string | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const date = new Date(v * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};
function decode(bytes: Uint8Array): string | null {
  try {
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
    // Keep BOM/line endings in the reading view too. Invalid encodings never get replacement characters.
    const text = new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes);
    return text.includes("\0") ? null : text;
  } catch { return null; }
}
function conversationDocuments(value: unknown, path: string, view: MaterialView): boolean {
  const wrapper = object(value);
  const conversations = Array.isArray(value) ? value : Array.isArray(wrapper?.conversations) ? wrapper.conversations : wrapper?.mapping ? [wrapper] : null;
  if (!conversations) return false;
  let recognized = false;
  let unknown = false;
  for (const [index, v] of conversations.entries()) {
    const c = object(v); const mapping = object(c?.mapping);
    if (!c || !mapping) { unknown = true; continue; }
    recognized = true;
    if (view.documents.length >= MAX_DOCUMENTS) { unknown = true; continue; }
    // Every branch/node is included in source order, including system/tool/unknown roles.
    // Do not mistake a tree for one chronological conversation or drop non-text content.
    const sections = Object.entries(mapping).map(([nodeId, value]) => {
      const node = object(value); const m = object(node?.message);
      if (!m) return `节点 ${nodeId}\n${JSON.stringify(value, null, 2)}`;
      const author = object(m.author);
      const role = typeof author?.role === "string" ? author.role : "未知角色";
      const content = object(m.content);
      const body = content?.content_type === "text" && Array.isArray(content.parts) && content.parts.every(p => typeof p === "string")
        ? content.parts.join("\n") : JSON.stringify(m.content ?? m, null, 2);
      return `${role} · ${sourceTime(m.create_time) ?? "原始时间未知"}\n节点 ${nodeId} · 上级 ${typeof node?.parent === "string" ? node.parent : "无或未知"}\n\n${body}`;
    });
    view.documents.push({ key: `${path}#${index}`, path, title: typeof c.title === "string" && c.title ? c.title : `ChatGPT 讨论 ${index + 1}`, source_id: typeof c.id === "string" ? c.id : typeof c.conversation_id === "string" ? c.conversation_id : null, source_created_at: sourceTime(c.create_time), text: sections.join("\n\n——\n\n") });
  }
  if (recognized) view.warnings.push(`${path}：阅读视图按原件节点顺序列出所有分支；节点关系、附件引用及其他元数据以原件为准。`);
  if (unknown) view.warnings.push(`${path}：部分结构尚未展开，或超过 ${MAX_DOCUMENTS} 篇的阅读上限；完整 JSON 仍在原件中。`);
  return recognized;
}
function readFile(path: string, bytes: Uint8Array, view: MaterialView, forceText = false) {
  const plain = forceText || /\.(md|markdown|txt)$/i.test(path);
  const chatgpt = /(^|\/)conversations(?:[-_ ]?\d+)?\.json$/i.test(path);
  let readable = false;
  if (plain || chatgpt) {
    const text = decode(bytes);
    if (text === null) view.warnings.push(`${path}：文字编码未识别；已保留原始字节。请用 UTF-8 或带 BOM 的 UTF-16 文件查看。`);
    else if (plain && view.documents.length < MAX_DOCUMENTS) {
      view.documents.push({ key: path, path, title: path.split("/").at(-1)!, source_id: null, source_created_at: null, text });
      readable = true;
    } else if (chatgpt) {
      try { readable = conversationDocuments(JSON.parse(text.replace(/^\uFEFF/, "")), path, view); }
      catch { view.warnings.push(`${path}：JSON 无法展开；原件仍完整保留。`); }
      if (!readable) view.warnings.push(`${path}：未识别到支持的 ChatGPT 会话结构，已保留原件，暂不生成阅读视图。`);
    }
  }
  view.files.push({ path, bytes: bytes.length, readable });
}
export async function readMaterial(record: RawMaterial): Promise<MaterialView> {
  const bytes = fromBase64(record.base64);
  const view: MaterialView = { parser_version: 1, documents: [], files: [], warnings: [] };
  if (record.kind !== "zip") {
    readFile(record.name, bytes, view, true);
    if (record.origin === "paste" && !view.documents[0]?.text.trim()) fail("请先粘贴需要留存的文字。");
    return view;
  }
  // No entry is ever extracted to a filesystem or interpreted as HTML/script.
  const reader = new ZipReader(new Uint8ArrayReader(bytes), { useWebWorkers: false, checkSignature: true, strictness: "strict" });
  let total = 0; let declared = 0; let count = 0;
  const paths = new Set<string>();
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      const path = entry.filename;
      if (++count > MAX_ENTRIES) fail(`ZIP 超过 ${MAX_ENTRIES} 个条目，请分成较小的文件。`);
      if (!path || path.length > 1024 || /[\x00-\x1f\\]/.test(path) || /^(\/|[a-z]:)/i.test(path) || path.split("/").some(p => p === ".." || p === ".") || paths.has(path)) fail("ZIP 含不安全或重复路径，未保存；请重新打包。");
      paths.add(path);
      if (entry.encrypted) fail("暂不支持加密 ZIP，请先在本机解密后再导入。");
      if (entry.directory) continue;
      declared += entry.uncompressedSize;
      if (entry.uncompressedSize > MAX_FILE_BYTES || declared > MAX_EXPANDED) fail("ZIP 解压后超过限制（单文件 25 MiB，总计 100 MiB），请拆分导入。");
      const readable = /\.(md|markdown|txt)$/i.test(path) || /(^|\/)conversations(?:[-_ ]?\d+)?\.json$/i.test(path);
      const chunks: Uint8Array[] = [];
      let size = 0;
      await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
        size += chunk.length; total += chunk.length;
        // Check actual output, not only ZIP header sizes. Attachments are CRC-checked but not retained twice.
        if (size > MAX_FILE_BYTES || total > MAX_EXPANDED || size > entry.uncompressedSize) fail("ZIP 解压数据超过声明大小或存储限制，未保存。");
        if (readable) chunks.push(chunk.slice());
      } }), { checkSignature: true, useWebWorkers: false });
      if (size !== entry.uncompressedSize) fail("ZIP 文件长度校验失败，未保存。");
      if (readable) {
        const content = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
        readFile(path, content, view);
      } else view.files.push({ path, bytes: size, readable: false });
    }
    if (!view.files.length) fail("ZIP 中没有文件，未保存。");
    const opaque = view.files.filter(f => !f.readable).length;
    if (opaque) view.warnings.push(`${opaque} 个文件仅保留在 ZIP 原件中，未展开阅读，包括未支持的格式、图片或其他附件。`);
    return view;
  } catch (e) {
    if (e instanceof ImportError) throw e;
    fail("ZIP 无法完整读取或校验失败，未保存。请重新下载或打包为标准 ZIP。");
  } finally { await reader.close(); }
}
