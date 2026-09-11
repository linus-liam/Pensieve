import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Drawer, Group, Modal, Paper, Stack, Text, Textarea, TextInput, Title, UnstyledButton } from "@mantine/core";
import { api } from "../../api/client";
import type { LocalInfo, ReflectionSession, SessionListItem } from "../../sessionTypes";
import { useLocalAIConsent } from "./useLocalAIConsent";

function idFromHash() { return new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("session"); }
function label(status: ReflectionSession["status"]) { return { active: "可以接着聊", review: "回顾待确认", completed: "已存为记忆" }[status]; }

export function LocalReflection({ info, onConfirmed, children, historyOpen = false, onHistoryClose = () => {} }: { info: LocalInfo | null; onConfirmed: () => void; children: ReactNode; historyOpen?: boolean; onHistoryClose?: () => void }) {
  const [session, setSession] = useState<ReflectionSession | null>(null);
  const [items, setItems] = useState<SessionListItem[]>([]);
  const [input, setInput] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [manualReview, setManualReview] = useState(false);
  const [consent, setConsent, hasConsentChoice] = useLocalAIConsent();
  const [consentOpen, setConsentOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
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
      setInput(""); setManualReview(false); setReviewText(""); pending.current = null;
      window.history.replaceState(null, "", id ? `#capture?session=${encodeURIComponent(id)}` : "#capture");
      onHistoryClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function generate(current: ReflectionSession, review = false) {
    setPhase(review ? "正在整理回顾…" : "正在思考…");
    const replied = await api.reply(current.id, crypto.randomUUID(), review);
    setSession(replied);
  }
  async function send(useAI = canUseAI) {
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
      if (useAI) await generate(saved);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setPhase(""); void refreshList().catch(() => {}); }
  }
  function requestSend() {
    if (!input.trim() || busy || !info) return;
    if (info.aiEnabled && !hasConsentChoice) setConsentOpen(true);
    else void send();
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

  return <Stack gap="xl" className={`local-reflection ${!session ? "local-reflection--empty" : ""}`}>
    <Drawer opened={historyOpen} onClose={onHistoryClose} title="过去的聊天" position="left" size="sm" closeButtonProps={{ "aria-label": "关闭聊天历史" }}>
      <Stack gap="md">
        <Button variant="light" disabled={busy || Boolean(input.trim())} onClick={() => void selectSession(null)}>新聊天</Button>
        <TextInput aria-label="搜索聊天" placeholder="搜索聊天开头" value={historySearch} onChange={e => setHistorySearch(e.currentTarget.value)} />
        {input.trim() && <Text size="sm" c="dimmed">先发送或清空正在写的话，再切换聊天。</Text>}
        {error && <Alert color="red" role="alert">{error}</Alert>}
        {!items.length && <Text size="sm" c="dimmed">聊过的内容会留在这里。</Text>}
        {items.filter(item => item.title.toLowerCase().includes(historySearch.toLowerCase())).map(item => <UnstyledButton key={item.id} className="reflection-history-item" data-active={session?.id === item.id || undefined} disabled={busy || Boolean(input.trim())} onClick={() => void selectSession(item.id)}>
          <Stack gap={6}>
            <Text size="sm" lineClamp={2}>{item.title}</Text>
            <Group justify="space-between" gap="xs"><Text size="xs" c="dimmed">{new Date(item.updated_at).toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" })}</Text><Text size="xs" c={item.status === "review" ? "blue.7" : "dimmed"}>{label(item.status)}</Text></Group>
          </Stack>
        </UnstyledButton>)}
      </Stack>
    </Drawer>
    <Modal opened={consentOpen} onClose={() => setConsentOpen(false)} title="让 AI 陪你聊聊" centered closeButtonProps={{ "aria-label": "关闭 AI 说明" }}>
      <Stack gap="md">
        <Text>开启后，当前会话的完整消息会发送给 OpenAI，生成回复与回顾。其他历史聊天不会自动发送。</Text>
        <Text size="sm" c="dimmed">这个浏览器会记住你的选择，后续聊天也会使用 AI；可随时在设置中关闭。内容保存在本机，云端请求仍受 OpenAI 数据保留政策约束。</Text>
        <Text component="a" href="https://developers.openai.com/api/docs/guides/your-data" target="_blank" rel="noreferrer" size="sm">查看数据处理说明</Text>
        <Button onClick={() => { setConsent(true); setConsentOpen(false); void send(true); }}>开启 AI 并发送</Button>
        <Button variant="default" onClick={() => { setConsent(false); setConsentOpen(false); void send(false); }}>先只保存原文</Button>
      </Stack>
    </Modal>
    {session ? <Group justify="space-between"><Title order={2} size="h3">聊一会儿</Title><Button variant="subtle" disabled={busy || Boolean(input.trim())} onClick={() => void selectSession(null)}>新聊天</Button></Group> :
      <Stack gap="sm" className="reflection-greeting"><Title order={2}>今天，想聊些什么？</Title><Text c="dimmed">从一句话开始就好。</Text></Stack>}
    {error && <Alert color="red" title="这一步没有完成" role="alert">{error}</Alert>}
      <Stack gap="lg">
        {Boolean(session?.messages.length) &&
        <details className="reflection-transcript" open={!reviewing && !completed}>
          <summary hidden={!reviewing && !completed}>回看这段聊天 · {session?.messages.length ?? 0} 条消息</summary>
        <div role="log" aria-label="Reflection conversation" aria-live="polite" className="reflection-messages">
          {session?.messages.map(message => <div key={message.id} className={`reflection-message reflection-message--${message.role}`}>
            <Group justify="space-between" mb={8}><Text size="xs" c="dimmed">{message.role === "user" ? "你" : "Pensieve"}</Text><Text size="xs" c="dimmed">{new Date(message.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Text></Group>
            <Text lh={1.85} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content}</Text>
          </div>)}
          <div ref={messagesEnd} />
        </div>
        </details>}
        {phase && <Text size="sm" role="status">{phase}</Text>}
        {completed ? <Alert color="teal" title="这段回顾已由你确认，并保存在本机">
          <Text style={{ whiteSpace: "pre-wrap" }}>{session?.memory_revisions.at(-1)?.raw_input}</Text>
          <Text size="sm" mt="xs">原始聊天与草稿均保留。可以在「记忆」中查看、修改回顾。</Text>
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
          <Paper withBorder p="md" radius="lg" className="reflection-composer">
            <Textarea ref={composer} aria-label="此刻想说的话" placeholder="此刻想说的话…" value={input} variant="unstyled" autosize minRows={3} maxRows={8} maxLength={20000} disabled={busy}
              onChange={e => setInput(e.currentTarget.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); requestSend(); } }} />
            <Group justify="space-between" mt="sm"><Text size="xs" c="dimmed">{session?.messages.length && !input ? "已保存到本机" : "Enter 发送 · Shift+Enter 换行"}</Text><Button loading={busy} disabled={!input.trim() || busy || !info} onClick={requestSend}>{info?.aiEnabled && (!hasConsentChoice || consent) ? "发送" : "保存"}</Button></Group>
          </Paper>
          {!canUseAI && <Text size="xs" c="dimmed">{info?.aiEnabled ? hasConsentChoice ? "当前只在本机记录。可在设置中开启 AI。" : "首次使用 AI 时，会先说明内容的去向。" : "尚未连接 AI，可以先写下来。连接方式在设置里。"}</Text>}
          {session?.messages.length ? <Group>
            {session.messages.at(-1)?.role === "user" && <Button variant="light" disabled={!canUseAI || busy} onClick={() => void retry()}>生成 / 重试 AI 回复</Button>}
            <Button variant="subtle" disabled={!canUseAI || busy || Boolean(input.trim())} onClick={() => void retry(true)}>聊到这里，整理回顾</Button>
            <Button variant="subtle" disabled={busy || Boolean(input.trim())} onClick={() => { setManualReview(true); setReviewText(""); }}>自己写回顾</Button>
          </Group> : null}
        </>}
      </Stack>
    {!session && <details className="reflection-import"><summary>留存已有文字</summary><Text size="sm" c="dimmed" my="sm">粘贴旧笔记或聊天原文，按独立文字存档保存。</Text>{children}</details>}
  </Stack>;
}
