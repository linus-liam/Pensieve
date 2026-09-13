import { useEffect, useState } from "react";
import { Alert, Button, Divider, FileButton, Group, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { download, mobileRemote } from "./api";
import { MAX_PHONE_BACKUP_BYTES, restoreBackup, snapshot } from "./store";
import type { LocalInfo } from "../sessionTypes";

export function PhoneSettings({ info, onConnected }: { info: LocalInfo | null; onConnected: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [splitBackup, setSplitBackup] = useState(false);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => { void navigator.storage?.persisted?.().then(setPersistent).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.ready.then(() => { if (active) setOfflineReady(true); }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Stack gap="md">
    <Title order={3} size="h4">私人 AI 连接</Title>
    <Text size="sm">{info?.authenticated ? "此设备已连接。" : "首次使用，请输入你的试用口令。口令只用于连接 AI，聊天仍保存在这台设备。"}</Text>
    {!info?.authenticated && <>
      <PasswordInput label="试用口令" autoComplete="current-password" value={code} onChange={e => setCode(e.currentTarget.value)} />
      <Button loading={busy} disabled={!code.trim()} onClick={() => void run(async () => { await mobileRemote("login", { code }); setCode(""); await onConnected(); setNotice("AI 已连接，可以回到聊天继续。"); })}>连接 AI</Button>
    </>}
    {info?.authenticated && <Button variant="subtle" loading={busy} onClick={() => void run(async () => { await mobileRemote("logout", {}); await onConnected(); })}>断开此设备的 AI 连接</Button>}
    <Divider />
    <Title order={3} size="h4">设备备份</Title>
    <Text size="sm">聊天、草稿、确认历史和导入的原材料保存在当前浏览器或主屏幕 App 中，不会自动同步到 Mac。请定期把完整备份保存到“文件”或独立设备，以应对网站数据清除或设备损坏。</Text>
    <Text size="sm" c="dimmed">Safari 与添加到主屏幕后可能使用不同的存储空间。建议先添加到主屏幕，再在那里开始记录；已有内容可用备份转移。</Text>
    <Group>
      <Button variant="default" loading={busy} onClick={() => void run(async () => { const json = JSON.stringify(await snapshot()); if (new Blob([json]).size > MAX_PHONE_BACKUP_BYTES) { setSplitBackup(true); throw new Error("完整备份超过 200 MiB。请用下方按钮单独备份聊天，并在原材料页面逐份下载可恢复备份。"); } download(json, `pensieve-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json"); setNotice("含全部原材料的备份已交给浏览器，请确认保存到“文件”或独立设备。"); })}>下载完整备份</Button>
      <FileButton accept="application/json,.json" onChange={file => { if (file) void run(async () => { if (file.size > MAX_PHONE_BACKUP_BYTES) throw new Error("备份超过本版 200 MiB 限制。"); await restoreBackup(JSON.parse(await file.text())); setNotice("备份已恢复，刷新页面即可查看。"); }); }}>
        {props => <Button {...props} variant="default" disabled={busy}>恢复手机备份</Button>}
      </FileButton>
    </Group>
    {splitBackup && <Button variant="default" disabled={busy} onClick={() => void run(async () => { const json = JSON.stringify(await snapshot(false)); if (new Blob([json]).size > MAX_PHONE_BACKUP_BYTES) throw new Error("聊天备份也超过 200 MiB，当前版本暂不能生成此规模的可恢复文件。请保留设备数据。"); download(json, `pensieve-chat-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json"); setNotice("聊天、记忆和全部修改历史的备份已交给浏览器。这份文件不含导入原件，请另行逐份备份原材料。"); })}>单独备份聊天与记忆</Button>}
    <Text size="sm" c="dimmed">恢复只合并新记录；遇到同一记录的不同版本会取消整次恢复，不覆盖当前内容。备份含完整原文，请只交给自己信任的位置。</Text>
    {persistent !== true && navigator.storage?.persist && <Button variant="subtle" onClick={() => void run(async () => { const granted = await navigator.storage.persist(); setPersistent(granted); setNotice(granted ? "浏览器已允许持久保存，仍请保留独立备份。" : "浏览器暂未授予持久保存，仍可使用；请及时备份。"); })}>请求浏览器保留数据</Button>}
    <Divider />
    <Title order={3} size="h4">添加到 iPhone 主屏幕</Title>
    <Text size="sm">在 Safari 的共享菜单中选择“添加到主屏幕”，再从桌面图标打开。离线准备完成后，无网络也能记录和查看；AI 回复需要网络。</Text>
    <Text size="sm" c="dimmed">{offlineReady ? "离线准备已完成。" : "离线准备尚未完成。请保持联网；若一直未完成，请使用 Safari 打开。"}</Text>
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {notice && <Alert color="blue" role="status">{notice}</Alert>}
  </Stack>;
}
