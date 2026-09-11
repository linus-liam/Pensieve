import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Checkbox, Group, Paper, Select, Stack, Text, Textarea, Title } from "@mantine/core";
import { api } from "../../api/client";
import type { LocalInfo, ReflectionSession, SessionListItem } from "../../sessionTypes";

function idFromHash() { return new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("session"); }
function label(status: ReflectionSession["status"]) { return { active: "进行中", review: "待确认回顾", completed: "已完成" }[status]; }

export function LocalReflection({ info, onConfirmed, children }: { info: LocalInfo | null; onConfirmed: () => void; children: ReactNode }) {
  const [session, setSession] = useState<ReflectionSession | null>(null);
  const [items, setItems] = useState<SessionListItem[]>([]);
  const [input, setInput] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [manualReview, setManualReview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const pending = useRef<{ sessionId: string; id: string; content: string } | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const reviewPanel = useRef<HTMLElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const focusComposer = useRef(false);
  const focusedReview = useRef<string | null>(null);
  const completed = session?.status === "completed";
  const reviewing = Boolean(session?.current_draft_id || manualReview);
  const canUseAI = Boolean(info?.aiEnabled && consent);

  async function refreshList() { setItems(await api.listSessions()); }
  useEffect(() => {
    let active = true;
    const id = idFromHash();
    Promise.all([api.listSessions(), id ? api.getSession(id) : Promise.resolve(null)])
      .then(([list, current]) => { if (active) { setItems(list); setSession(current); } })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const current = session?.drafts.find(d => d.id === session.current_draft_id);
    if (current) setReviewText(current.text);
  }, [session?.current_draft_id]);
  useEffect(() => {
    if (!reviewing && !completed) messagesEnd.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [session?.messages.length, reviewing, completed]);
  useEffect(() => {
    if (!reviewing || completed) { focusedReview.current = null; return; }
    const current = session?.drafts.find(d => d.id === session.current_draft_id);
    if (!manualReview && reviewText !== current?.text) return;
    const key = `${session?.id}:${session?.current_draft_id ?? "manual"}`;
    if (focusedReview.current === key) return;
    focusedReview.current = key;
    reviewPanel.current?.focus({ preventScroll: true });
    reviewPanel.current?.scrollIntoView?.({ behavior: "auto", block: "start" });
  }, [reviewing, completed, manualReview, session?.id, session?.current_draft_id, reviewText]);
  useEffect(() => {
    if (focusComposer.current && !reviewing && !busy) {
      composer.current?.focus(); focusComposer.current = false;
    }
  }, [reviewing, busy]);

  async function preserveReview() {
    if (!session || !reviewing || completed || !reviewText.trim()) return;
    const current = session.drafts.find(d => d.id === session.current_draft_id);
    if (reviewText !== current?.text) {
      setSession(await api.saveReviewDraft(session.id, reviewText, session.current_draft_id));
      await refreshList();
    }
  }

  async function selectSession(id: string | null) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await preserveReview();
      setSession(id ? await api.getSession(id) : null);
      setInput(""); setConsent(false); setManualReview(false); setReviewText(""); pending.current = null;
      window.history.replaceState(null, "", id ? `#capture?session=${encodeURIComponent(id)}` : "#capture");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function generate(current: ReflectionSession, review = false) {
    if (!canUseAI) return;
    setPhase(review ? "正在整理待确认回顾…" : "正在思考…原文已保存到本机");
    const replied = await api.reply(current.id, crypto.randomUUID(), review);
    setSession(replied);
  }
  async function send() {
    if (!input.trim() || busy || completed || reviewing) return;
    setBusy(true); setError(""); setPhase("正在保存原文…");
    try {
      const sessionId = session?.id ?? pending.current?.sessionId ?? crypto.randomUUID();
      if (!pending.current || pending.current.content !== input) pending.current = { sessionId, id: crypto.randomUUID(), content: input };
      if (!session) {
        const created = await api.createSession(sessionId);
        setSession(created);
        window.history.replaceState(null, "", `#capture?session=${created.id}`);
      }
      const saved = await api.appendMessage(sessionId, pending.current.id, input);
      setSession(saved); setInput(""); pending.current = null; setManualReview(false);
      await generate(saved);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setPhase(""); void refreshList().catch(() => {}); }
  }
  async function retry(review = false) {
    if (!session || !canUseAI || busy) return;
    setBusy(true); setError("");
    try { await generate(session, review); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setPhase(""); void refreshList().catch(() => {}); }
  }
  async function confirm() {
    if (!session || !reviewText.trim() || busy) return;
    setBusy(true); setError("");
    try {
      setSession(await api.confirmReview(session.id, reviewText, session.current_draft_id));
      setManualReview(false); await refreshList(); onConfirmed();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function continueChat() {
    if (!session || busy) return;
    setBusy(true); setError("");
    try {
      await preserveReview();
      setSession(await api.continueSession(session.id)); setManualReview(false); setReviewText("");
      focusComposer.current = true;
      await refreshList();
    }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <Stack gap="md">
    <Group justify="space-between">
      <Title order={2}>聊一会儿</Title>
      <Button variant="default" disabled={busy || Boolean(input.trim())} onClick={() => void selectSession(null)}>新聊天</Button>
    </Group>
    {items.length > 0 && <Select label="过去的聊天" placeholder="选择一段，接着聊或回看原文" searchable disabled={busy || Boolean(input.trim())} value={session?.id ?? null}
      data={items.map(item => ({ value: item.id, label: `${label(item.status)} · ${item.title}` }))} onChange={id => void selectSession(id)} />}
    <Paper withBorder p="sm" radius="md">
      <Stack gap="xs">
        <Text size="sm">完整聊天自动保存在这台电脑。回顾由你确认后进入记忆。</Text>
        {info?.aiEnabled ? <Checkbox checked={consent} disabled={busy || completed} onChange={e => setConsent(e.currentTarget.checked)} label={`本次聊天使用 OpenAI（${info.model}）`} /> :
          <Text size="sm" c="dimmed">尚未连接 AI。你可以先记录原文；配置后可继续这段聊天。</Text>}
        <details><summary>AI 连接与数据说明</summary>
          <Text size="sm" mt="xs">启用后，仅当前会话的完整消息会发送给 OpenAI 生成回复或回顾。其他历史聊天不会自动发送。API 可能按提供商政策保留请求；本地保存不代表完全离线。</Text>
          {!info?.aiEnabled && <Text size="sm" mt="xs">在项目根目录的 .env.local 设置 OPENAI_API_KEY；可用 AI_CHAT_MODEL 指定模型。然后重新运行 npm run local。密钥只由本机后端读取，请勿粘贴进聊天。</Text>}
          <Text component="a" href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer" size="sm">OpenAI 数据处理说明</Text>
        </details>
      </Stack>
    </Paper>
    {error && <Alert color="red" title="这一步没有完成" role="alert">{error}</Alert>}
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <details className="reflection-transcript" open={!reviewing && !completed}>
          <summary hidden={!reviewing && !completed}>回看这段聊天 · {session?.messages.length ?? 0} 条消息</summary>
        <div role="log" aria-label="Reflection conversation" aria-live="polite" style={{ maxHeight: "48vh", overflowY: "auto" }}>
          {!session?.messages.length && <Text c="dimmed">今天有什么想聊的？不用准备话题，也不用先想清楚自己的感受。</Text>}
          {session?.messages.map(message => <Paper key={message.id} p="sm" mb="sm" bg={message.role === "user" ? "gray.0" : undefined} withBorder>
            <Group justify="space-between"><Text size="xs" fw={600}>{message.role === "user" ? "你" : "Pensieve"}</Text><Text size="xs" c="dimmed">{new Date(message.created_at).toLocaleTimeString()}</Text></Group>
            <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</Text>
          </Paper>)}
          <div ref={messagesEnd} />
        </div>
        </details>
        {phase && <Text size="sm" role="status">{phase}</Text>}
        {completed ? <Alert color="teal" title="这段回顾已由你确认，并保存在本机">
          <Text style={{ whiteSpace: "pre-wrap" }}>{session?.memory_revisions.at(-1)?.raw_input}</Text>
          <Text size="sm" mt="xs">原始聊天与 AI 草稿均保留。可以在 Memories 中查看、修改回顾，或开始新聊天。</Text>
        </Alert> : reviewing ? <section ref={reviewPanel} tabIndex={-1} aria-labelledby="reflection-review-heading" className="reflection-review">
          <Stack gap="md">
            <Stack gap={6}>
              <Text size="xs" c="dimmed">本次回顾</Text>
              <Title order={3} id="reflection-review-heading">{manualReview ? "留下一点此刻的理解" : "先聊到这里"}</Title>
              <Text size="sm" c="dimmed">不用现在得出结论，也不用马上确认。原文已保存在本机。</Text>
            </Stack>
            <Textarea aria-label="回顾正文" description="可以改成更贴近自己的表达，确认后才会进入记忆。" autosize minRows={3} maxRows={8} maxLength={20000} value={reviewText} disabled={busy} onChange={e => setReviewText(e.currentTarget.value)} />
            <Group gap="sm" className="reflection-review__actions">
              <Button disabled={busy || !reviewText.trim()} onClick={() => void confirm()}>确认并保存为记忆</Button>
              <Button variant="default" disabled={busy} onClick={() => void selectSession(null)}>稍后再看</Button>
              <Button variant="subtle" disabled={busy} onClick={() => void continueChat()}>继续聊</Button>
            </Group>
            <Text size="xs" c="dimmed">选择「稍后再看」会保留回顾草稿。下次可从「过去的聊天」回来。</Text>
          </Stack>
        </section> : <>
          <Textarea ref={composer} label="此刻想说的话" placeholder="可以从一句话开始…" value={input} autosize minRows={3} maxRows={8} maxLength={20000} disabled={busy}
            onChange={e => setInput(e.currentTarget.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <Group justify="space-between"><Text size="xs" c="dimmed">Shift+Enter 换行 · 原文先保存，再生成回复</Text><Button loading={busy} disabled={!input.trim() || busy} onClick={() => void send()}>{canUseAI ? "发送" : "保存消息到本机"}</Button></Group>
          {session?.messages.length ? <Group>
            {session.messages.at(-1)?.role === "user" && <Button variant="light" disabled={!canUseAI || busy} onClick={() => void retry()}>生成 / 重试 AI 回复</Button>}
            <Button variant="subtle" disabled={!canUseAI || busy || Boolean(input.trim())} onClick={() => void retry(true)}>聊到这里，整理回顾</Button>
            <Button variant="subtle" disabled={busy || Boolean(input.trim())} onClick={() => { setManualReview(true); setReviewText(""); }}>自己写回顾</Button>
          </Group> : null}
        </>}
      </Stack>
    </Paper>
    {!session && <details><summary>直接保存旧文字</summary><Text size="sm" c="dimmed" my="sm">适合粘贴已有笔记或旧聊天原文，按独立文字存档保存。</Text>{children}</details>}
  </Stack>;
}
