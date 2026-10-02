import { useEffect, useState } from "react";
import { Alert, Button, Checkbox, Divider, Drawer, Group, Stack, Text, Title } from "@mantine/core";
import { api } from "../../api/client";
import type { LocalInfo } from "../../sessionTypes";
import { useLocalAIConsent } from "./useLocalAIConsent";
import { mobileMode } from "../../local";
import { PhoneSettings } from "../../mobile/PhoneSettings";

export function LocalSettings({ opened, onClose, info, onInfo }: {
  opened: boolean; onClose: () => void; info: LocalInfo | null; onInfo: (value: LocalInfo) => void;
}) {
  const [consent, setConsent] = useLocalAIConsent();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (opened) void api.localInfo().then(onInfo).catch(e => setError(e.message));
  }, [opened, onInfo]);
  async function backup() {
    setBusy(true); setError("");
    try { await api.backup(); onInfo(await api.localInfo()); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Drawer opened={opened} onClose={onClose} title="设置" position="right" size="md" closeButtonProps={{ "aria-label": "关闭设置" }}>
    <Stack gap="xl">
      {error && <Alert color="red" role="alert">{error}</Alert>}
      <Stack gap="sm">
        <Title order={3} size="h4">AI 聊天</Title>
        <Text size="sm" c="dimmed">{info?.aiEnabled ? `OpenAI · ${info.model}` : "尚未连接 AI"}</Text>
        <Checkbox checked={consent} disabled={!info?.aiEnabled} onChange={e => setConsent(e.currentTarget.checked)} label="使用 OpenAI 生成回复与回顾" />
        <Text size="sm">开启后，这个浏览器中的后续聊天会使用 AI。每次只发送当前会话的完整消息，其他历史不会自动发送。关闭后仍可在本机记录。</Text>
        <Text size="sm" c="dimmed">{mobileMode ? "聊天保存在当前设备；启用 AI 后，当前会话会经 Pensieve 的 Vercel 服务发送到 OpenAI。服务不建立聊天数据库，托管平台仍可能处理运行日志。" : "聊天保存在本机；AI 推理在云端完成，API 请求仍受提供商的数据保留政策约束。"}</Text>
        <Text component="a" href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer" size="sm">OpenAI 数据处理说明</Text>
        {!info?.aiEnabled && <Text size="sm">{mobileMode ? "AI 服务暂未就绪，仍可先保存原文。" : "在项目根目录的 .env.local 设置 OPENAI_API_KEY，然后重启本地服务。密钥不要粘贴进聊天。"}</Text>}
      </Stack>
      <Divider />
      <Stack gap="sm">
        <Title order={3} size="h4">本机存储</Title>
        <Text size="sm">完整聊天会自动保存；回顾经你确认后进入记忆。</Text>
        <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>存储目录：{info?.directory ?? "正在连接…"}</Text>
        <Button variant="default" onClick={() => void api.exportMarkdown().catch(e => setError(e.message))}>导出全部记忆与历史（Markdown）</Button>
      </Stack>
      {mobileMode ? <PhoneSettings info={info} onConnected={async () => onInfo(await api.localInfo())} /> : <Stack gap="sm">
        <Title order={3} size="h4">自动备份</Title>
        <Text size="sm">{info?.backup?.lastBackupAt ? `最近备份：${new Date(info.backup.lastBackupAt).toLocaleString("zh-CN")}` : "尚无备份"}</Text>
        {info?.backup?.error && <Alert color="orange">{info.backup.error}</Alert>}
        <Text size="sm" c="dimmed">内容保存后会在本机生成快照，保留最近 20 份，以及最近 30 个有备份日期的每日最后一份。</Text>
        {info?.backup && <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>备份目录：{info.backup.directory}</Text>}
        <Group><Button variant="default" loading={busy} disabled={!info?.backup} onClick={() => void backup()}>立即备份</Button></Group>
        <Text size="sm" c="dimmed">这些快照也在这台电脑上。为了应对电脑丢失或硬盘损坏，可另行复制到外置硬盘。恢复步骤见项目 README。</Text>
      </Stack>}
    </Stack>
  </Drawer>;
}
