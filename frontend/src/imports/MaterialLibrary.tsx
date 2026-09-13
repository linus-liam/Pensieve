import { useEffect, useState } from "react";
import { Alert, Badge, Button, Divider, FileButton, Group, Loader, Pagination, Paper, Stack, Text, Textarea, TextInput, Title } from "@mantine/core";
import { api } from "../api/client";
import { download } from "../mobile/api";
import { mobileMode } from "../local";
import { fromBase64, makeMaterial, materialBackup, MAX_BACKUP_BYTES, MAX_FILE_BYTES, readMaterialBackup, toBase64, verifyMaterial, type MaterialBackup, type MaterialKind, type MaterialSummary, type RawMaterial } from "../../../backend/src/imports/materials";
import type { MaterialView } from "../../../backend/src/imports/readMaterial";
import { readInWorker } from "./readInWorker";

type OpenMaterial = { record: RawMaterial; view: MaterialView; backup?: MaterialBackup };
const date = (value: string) => new Date(value).toLocaleString("zh-CN");
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

function Reading({ record, view }: OpenMaterial) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(view.documents[0]?.key ?? "");
  const documents = view.documents.filter(d => `${d.title}\n${d.text}`.toLowerCase().includes(query.toLowerCase()));
  const doc = documents.find(d => d.key === selected) ?? documents[0];
  return <Stack gap="sm">
    <Text size="sm">{view.files.length} 个文件 · {view.documents.length} 篇可读内容 · 原件 {size(record.byte_length)}</Text>
    {view.warnings.map((warning, i) => <Alert key={i} color="yellow">{warning}</Alert>)}
    <details><summary>查看文件范围</summary><ul className="material-files">{view.files.map(f => <li key={f.path}>{f.path} · {size(f.bytes)} · {f.readable ? "可阅读" : "保留在原件中"}</li>)}</ul></details>
    {view.documents.length > 1 && <>
      <TextInput label="在这份材料中查找" placeholder="搜索标题或原文" value={query} onChange={e => { setQuery(e.currentTarget.value); setPage(1); }} />
      <Stack gap={4}>{documents.slice((page - 1) * 10, page * 10).map(d => <Button key={d.key} variant={doc?.key === d.key ? "light" : "subtle"} justify="flex-start" className="material-document-button" onClick={() => setSelected(d.key)}>{d.title}</Button>)}</Stack>
      {documents.length > 10 && <Pagination size="sm" total={Math.ceil(documents.length / 10)} value={page} onChange={setPage} />}
      {!documents.length && <Text c="dimmed">没有找到相符的内容。</Text>}
    </>}
    {doc && <Paper withBorder p="md" className="material-reading">
      <Stack gap="sm">
        <Title order={3} size="h4">{doc.title}</Title>
        <Text size="xs" c="dimmed">原始时间：{doc.source_created_at ? date(doc.source_created_at) : record.source_date ?? "未知"} · {record.source || (doc.source_id ? "ChatGPT" : "来源未注明")}</Text>
        <Text size="xs" c="dimmed" className="material-path">{doc.path}{doc.source_id ? ` · 会话 ${doc.source_id}` : ""}</Text>
        <pre className="material-text">{doc.text.slice(0, 60000)}</pre>
        {doc.text.length > 60000 && <Text size="sm">这篇内容较长，页面展示前 60,000 字符；完整文字保留在原件和下方下载中。</Text>}
        <Button variant="subtle" onClick={() => download(doc.text, "pensieve-reading.txt", "text/plain;charset=utf-8")}>下载这篇完整文字</Button>
      </Stack>
    </Paper>}
    {!view.documents.length && <Text>原件可以保存和下载，当前版本尚不能将其中的内容展开阅读。</Text>}
  </Stack>;
}

export function MaterialLibrary({ onSettings }: { onSettings: () => void }) {
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [sourceDate, setSourceDate] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<OpenMaterial | null>(null);
  const [opened, setOpened] = useState<OpenMaterial | null>(null);
  async function refresh() { setMaterials(await api.listMaterials()); }
  useEffect(() => { let active = true; void api.listMaterials().then(values => { if (active) setMaterials(values); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (e) { setError((e as Error).message || "未能完成，请重试。"); }
    finally { setBusy(false); }
  }
  async function prepare(bytes: Uint8Array, filename: string, kind: MaterialKind, origin: "paste" | "file") {
    const record = await makeMaterial({ name: filename, kind, origin, source, source_date: sourceDate || null, base64: toBase64(bytes) });
    const view = await readInWorker(record);
    setOpened(null); setPreview({ record, view });
  }
  function choose(file: File | null) {
    if (!file) return;
    void run(async () => {
      if (file.size > MAX_FILE_BYTES) throw new Error("本版每份原件最多 25 MiB，请拆分文件后导入。");
      const extension = file.name.split(".").at(-1)?.toLowerCase();
      const kind = extension === "zip" ? "zip" : extension === "md" || extension === "markdown" ? "markdown" : extension === "txt" ? "text" : null;
      if (!kind) throw new Error("请选择 .zip、.md、.markdown 或 .txt 文件。");
      await prepare(new Uint8Array(await file.arrayBuffer()), file.name, kind, "file");
    });
  }
  async function open(id: string) {
    const record = await verifyMaterial(await api.getMaterial(id));
    setOpened({ record, view: await readInWorker(record) });
  }
  async function save() {
    if (!preview) return;
    const result = preview.backup ? await api.restoreMaterial(preview.backup) : await api.importMaterial(preview.record);
    setPreview(null);
    if (preview.record.origin === "paste") setText("");
    // Saving and refreshing are separate outcomes: a later read failure must not imply lost data.
    setNotice(result.duplicate ? "这份内容与来源已保存过，保留已有原件，没有新增副本。" : "原件已保存，并通过完整性校验。请下载可恢复备份，另存到安全位置。");
    await refresh();
    await open(result.material.id);
  }
  async function downloadOriginal() {
    if (!opened) return;
    const record = await verifyMaterial(await api.getMaterial(opened.record.id));
    const blob = new Blob([new Uint8Array(fromBase64(record.base64)).buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = record.name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice("原件已交给浏览器，请确认文件已保存。下载成功不等于已完成独立备份。");
  }
  const visible = materials.filter(m => `${m.name} ${m.source} ${m.source_date ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return <Stack gap="lg">
    <Group justify="space-between"><Title order={2}>原材料</Title><Button variant="subtle" onClick={onSettings}>存储与备份</Button></Group>
    <Text c="dimmed">把过去的讨论带过来。先留下完整原文，以后再慢慢整理。</Text>
    <Text size="sm">{mobileMode ? "导入内容保存在当前设备的浏览器中。" : "导入内容保存在这台 Mac 的 Pensieve 数据目录中。"}导入和预览在本机完成，不发送给 AI。</Text>
    {error && <Alert role="alert" color="red">{error}</Alert>}
    {notice && <Alert role="status" color="blue">{notice}</Alert>}
    {busy && <Group><Loader size="sm" /><Text size="sm">正在读取或保存，请稍候…</Text></Group>}
    {!preview && <Paper withBorder p="md"><Stack gap="md">
      <Title order={3} size="h4">导入一份材料</Title>
      <details><summary>补充来源与原始日期（选填）</summary><Stack gap="sm" mt="sm">
        <TextInput label="来源" placeholder="例如 ChatGPT；不知道可以留空" value={source} disabled={busy} onChange={e => setSource(e.currentTarget.value)} maxLength={200} />
        <TextInput label="原始日期" type="date" value={sourceDate} disabled={busy} onChange={e => setSourceDate(e.currentTarget.value)} description="只填写你确定的日期。不同日期的相同文字会分开保留。" />
      </Stack></details>
      <FileButton accept=".zip,.md,.markdown,.txt,application/zip,text/markdown,text/plain" onChange={choose}>{props => <Button {...props} disabled={busy}>选择 ZIP / Markdown / TXT</Button>}</FileButton>
      <Text size="xs" c="dimmed">每份原件最多 25 MiB。ZIP 最多 2,000 个条目、解压合计 100 MiB，单个文件最多 25 MiB；支持 ChatGPT 会话 JSON 和压缩包内的 Markdown、TXT，其他附件随原包保留。</Text>
      <Divider label="或者直接粘贴" />
      <TextInput label="这份文字的名称（选填）" value={name} disabled={busy} onChange={e => setName(e.currentTarget.value)} maxLength={240} />
      <Textarea label="粘贴原文" placeholder="旧聊天、笔记，或者还没有整理的想法…" autosize minRows={5} maxRows={12} value={text} disabled={busy} onChange={e => setText(e.currentTarget.value)} />
      <Button variant="light" disabled={busy || !text.trim()} onClick={() => void run(async () => { const bytes = new TextEncoder().encode(text); if (bytes.length > MAX_FILE_BYTES) throw new Error("文字超过 25 MiB，请分段导入。"); await prepare(bytes, name.trim() ? `${name}.txt` : "粘贴的文字.txt", "text", "paste"); })}>预览这段文字</Button>
    </Stack></Paper>}
    {preview && <Paper withBorder p="md"><Stack gap="md">
      <Title order={3} size="h4">保存前预览 · {preview.record.name}</Title>
      <Text size="sm">来源：{preview.record.source || "未注明"} · 补充的原始日期：{preview.record.source_date || "未知"}</Text>
      {preview.record.kind === "zip" && <Alert color="blue">将保存整个 ZIP，包括其中所有聊天、账号资料和附件。这里只提供阅读预览；如果只想保留部分内容，请先准备只含这些材料的文件再导入。</Alert>}
      {preview.record.origin === "paste" && <Text size="sm">按本次粘贴的片段原样保存，不推断发言人或补齐上下文。</Text>}
      <Reading key={preview.record.id} {...preview} />
      <Group><Button loading={busy} onClick={() => void run(save)}>{preview.backup ? "恢复这份原件" : preview.record.kind === "zip" ? "保存整个 ZIP" : "保存原件"}</Button><Button variant="default" disabled={busy} onClick={() => setPreview(null)}>返回修改</Button></Group>
    </Stack></Paper>}
    {opened && <Paper withBorder p="md"><Stack gap="md">
      <Group justify="space-between"><Title order={3} size="h4">{opened.record.name}</Title><Badge color="teal">原件已校验</Badge></Group>
      <Text size="sm" c="dimmed">导入于 {date(opened.record.imported_at)} · {opened.record.source || "来源未注明"}</Text>
      <Group>
        <Button variant="default" disabled={busy} onClick={() => void run(downloadOriginal)}>下载原始文件</Button>
        <Button variant="light" disabled={busy} onClick={() => void run(async () => { const backup = await materialBackup(await api.getMaterial(opened.record.id)); download(JSON.stringify(backup), `${opened.record.name}.pensieve.json`, "application/json"); setNotice("含原件、来源和校验清单的备份已交给浏览器。请另存到独立设备；可用下方“恢复原材料备份”在 Mac 或手机恢复。"); })}>下载可恢复备份</Button>
      </Group>
      <Reading key={opened.record.id} {...opened} />
    </Stack></Paper>}
    <Divider />
    <Title order={3} size="h4">已保存的材料 · {materials.length}</Title>
    <TextInput label="查找已保存的材料" placeholder="文件名、来源或原始日期" value={query} onChange={e => setQuery(e.currentTarget.value)} />
    {loading && <Loader size="sm" />}
    {!loading && !visible.length && <Text c="dimmed">{materials.length ? "没有找到相符的材料。" : "保存后的原件会留在这里。"}</Text>}
    {visible.map(m => <Paper key={m.id} withBorder p="sm"><Group justify="space-between" wrap="nowrap"><Stack gap={2} style={{ minWidth: 0 }}><Text fw={500} className="material-path">{m.name}</Text><Text size="xs" c="dimmed">{m.source || "来源未注明"} · {size(m.byte_length)} · 导入于 {date(m.imported_at)}</Text></Stack><Button variant="subtle" disabled={busy} onClick={() => void run(async () => { setPreview(null); await open(m.id); })}>打开</Button></Group></Paper>)}
    <FileButton accept=".json,application/json" onChange={file => { if (file) void run(async () => { if (file.size > MAX_BACKUP_BYTES) throw new Error("单份原材料备份超过 36 MiB。"); const backup = JSON.parse(await file.text()) as MaterialBackup; const record = await readMaterialBackup(backup); const view = await readInWorker(record); setOpened(null); setPreview({ record, view, backup }); }); }}>{props => <Button {...props} variant="default" disabled={busy}>恢复原材料备份</Button>}</FileButton>
    <Text size="xs" c="dimmed">完整设备备份在「存储与备份」。Mac 与手机目前各自保存；单份原材料备份可以在两端恢复。相同内容、来源和日期的重复导入不会增加副本，更新过的内容会另存。</Text>
  </Stack>;
}
