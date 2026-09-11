import { LocalReflection } from "./components/reflection/LocalReflection";
import { LocalSettings } from "./components/reflection/LocalSettings";
import type { LocalInfo } from "./sessionTypes";
import { localMode } from "./local";
import { pensieveTheme } from "./theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppShell,
  Button,
  Container,
  Group,
  Loader,
  MantineProvider,
  Text,
  Stack,
  Title,
  TextInput,
} from "@mantine/core";
import { api } from "./api/client";
import { AuthGate } from "./auth/AuthGate";
import { useAuth } from "./auth/AuthProvider";
import {
  CaptureComposer,
  type CaptureChatMessage,
} from "./components/reflection/CaptureComposer";
import { MemoryDetail } from "./components/reflection/MemoryDetail";
import { MobileBottomNav } from "./components/reflection/MobileBottomNav";
import { SideNav } from "./components/reflection/SideNav";
import { Timeline } from "./components/reflection/Timeline";
import type { Memory, MemoryEntry } from "./types";

type Page = "capture" | "memories" | "detail";
type NavPage = "capture" | "memories";

interface RouteState {
  page: Page;
  selectedId: string | null;
}

const initialCaptureMessages: CaptureChatMessage[] = [
  {
    id: "capture-greeting",
    role: "assistant",
    content: localMode ? "今天有什么值得留下？可以记录想法，也可以粘贴过去的文字。原文会保存在本机，不会发送给 AI。" : "I'm here. What feels worth remembering right now?",
  },
];

function createChatMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return localMode ? "今天" : "Today";
  if (isSameDay(date, yesterday)) return localMode ? "昨天" : "Yesterday";

  const diffMs = today.getTime() - date.getTime();
  if (diffMs < 1000 * 60 * 60 * 24 * 7) return localMode ? "最近一周" : "This Week";

  return new Intl.DateTimeFormat(localMode ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: today.getFullYear() === date.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function inferTags(content: string) {
  const text = content.toLowerCase();
  if (text.includes("work") || text.includes("presentation")) return ["reflection", "work"];
  if (text.includes("calm") || text.includes("breath")) return ["mindfulness"];
  if (text.includes("idea") || text.includes("inspire")) return ["inspiration"];
  return ["reflection"];
}

function toMemory(entry: MemoryEntry): Memory {
  return {
    id: entry.id,
    sourceSessionId: entry.source_session_id,
    day: getDayLabel(entry.created_at),
    time: formatTime(entry.created_at),
    source: "Text",
    sourceType: "text",
    summary: entry.ai_summary,
    rawInput: entry.raw_input,
    tags: localMode ? [] : inferTags(entry.raw_input),
  };
}

function getRouteFromHash(): RouteState {
  if (typeof window === "undefined") return { page: "capture", selectedId: null };

  const hash = window.location.hash.replace(/^#\/?/, "");

  if (hash === "memories") return { page: "memories", selectedId: null };
  if (hash.startsWith("memory/")) {
    const id = hash.slice("memory/".length);
    return id
      ? { page: "detail", selectedId: decodeURIComponent(id) }
      : { page: "memories", selectedId: null };
  }

  return { page: "capture", selectedId: null };
}

function getHashForRoute(page: Page, selectedId: string | null) {
  if (page === "memories") return "#memories";
  if (page === "detail" && selectedId) return `#memory/${encodeURIComponent(selectedId)}`;
  return "#capture";
}

function getActiveNavPage(page: Page): NavPage {
  return page === "capture" ? "capture" : "memories";
}

function AuthenticatedApp() {
  const { signOut, signingOut, user } = useAuth();
  const initialRoute = useMemo(getRouteFromHash, []);
  const [page, setPage] = useState<Page>(initialRoute.page);
  const [draft, setDraft] = useState("");
  const [captureMessages, setCaptureMessages] = useState<CaptureChatMessage[]>(() => [
    ...initialCaptureMessages,
  ]);
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [localInfo, setLocalInfo] = useState<LocalInfo | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    if (localMode) void api.localInfo().then(info => setLocalInfo(info)).catch(() => {});
  }, []);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoute.selectedId);
  const [detailDraft, setDetailDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedDetailId = useRef<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextEntries = await api.listMemoryEntries(archived);
      setEntries(nextEntries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load memories");
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const memories = useMemo(() => entries.filter(entry => !localMode || `${entry.raw_input} ${entry.ai_summary}`.toLowerCase().includes(search.toLowerCase())).map(toMemory), [entries, search]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedMemory = selectedEntry ? toMemory(selectedEntry) : null;
  const canSave = draft.trim().length > 0;
  const canUpdate = detailDraft.trim().length > 0 && (localMode ? detailDraft : detailDraft.trim()) !== selectedEntry?.raw_input;
  const activeNavPage = getActiveNavPage(page);

  const applyRoute = useCallback((route: RouteState) => {
    setPage(route.page);
    setSelectedId(route.selectedId);

    if (route.page !== "detail") {
      setSelectedId(null);
      setDetailDraft("");
      hydratedDetailId.current = null;
    } else {
      hydratedDetailId.current = null;
    }
  }, []);

  useEffect(() => {
    const handleRouteChange = () => applyRoute(getRouteFromHash());

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, [applyRoute]);

  useEffect(() => {
    if (page !== "detail" || !selectedEntry) return;
    if (hydratedDetailId.current === selectedEntry.id) return;

    setDetailDraft(selectedEntry.raw_input);
    hydratedDetailId.current = selectedEntry.id;
  }, [page, selectedEntry]);

  const navigate = useCallback(
    (nextPage: Page, memoryId?: string) => {
      const nextSelectedId = nextPage === "detail" ? memoryId ?? selectedId : null;
      if (nextPage === "detail" && !nextSelectedId) return;

      setPage(nextPage);
      setSelectedId(nextSelectedId);

      if (nextPage !== "detail") {
        setDetailDraft("");
        hydratedDetailId.current = null;
      }

      const nextHash = getHashForRoute(nextPage, nextSelectedId);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    },
    [selectedId]
  );

  const navigateFromNav = useCallback(
    (nextPage: NavPage) => {
      if (localMode && nextPage === "capture" && page === "capture") return;
      navigate(nextPage);
    },
    [navigate, page]
  );

  const openHistory = () => {
    if (page !== "capture") navigate("capture");
    setHistoryOpen(true);
  };

  const saveMemory = useCallback(async () => {
    const rawInput = localMode ? draft : draft.trim();
    if (!rawInput.trim() || saving) return;

    const userMessageId = createChatMessageId("user");
    setSaving(true);
    setError(null);
    setDraft("");
    setCaptureMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: rawInput, status: "sending" },
    ]);

    try {
      const entry = await api.createMemoryEntry(rawInput);
      if (archived) setArchived(false);
      setEntries((current) => archived ? [entry] : [entry, ...current]);
      setCaptureMessages((current) => [
        ...current.map((message) =>
          message.id === userMessageId ? { ...message, status: undefined } : message
        ),
        {
          id: `assistant-${entry.id}`,
          role: "assistant",
          content: entry.acknowledgement.trim() || "I hear you. I've saved this memory.",
        },
      ]);
    } catch (saveError) {
      setDraft(rawInput);
      setError(saveError instanceof Error ? saveError.message : "Could not save memory");
      setCaptureMessages((current) => [
        ...current.map((message) =>
          message.id === userMessageId ? { ...message, status: "error" as const } : message
        ),
        {
          id: createChatMessageId("assistant-error"),
          role: "assistant",
          content: "I couldn't save that just now. Your words are still here.",
          status: "error",
        },
      ]);
    } finally {
      setSaving(false);
    }
  }, [draft, saving, archived]);

  const openMemory = useCallback((memory: Memory) => {
    setSelectedId(memory.id);
    setDetailDraft(memory.rawInput);
    hydratedDetailId.current = memory.id;
    navigate("detail", memory.id);
  }, [navigate]);

  const updateMemory = useCallback(async () => {
    if (!selectedEntry || !canUpdate || updating) return;

    setUpdating(true);
    setError(null);

    try {
      const updated = await api.updateMemoryEntry(selectedEntry.id, localMode ? detailDraft : detailDraft.trim());
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setDetailDraft(updated.raw_input);
      hydratedDetailId.current = updated.id;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update memory");
    } finally {
      setUpdating(false);
    }
  }, [canUpdate, detailDraft, selectedEntry, updating]);

  const deleteMemory = useCallback(async () => {
    if (!selectedEntry || updating) return;

    setUpdating(true);
    setError(null);

    try {
      await api.deleteMemoryEntry(selectedEntry.id);
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id));
      navigate("memories");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete memory");
    } finally {
      setUpdating(false);
    }
  }, [navigate, selectedEntry, updating]);

  return (
    <>
      <AppShell
        navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: true } }}
        padding="md"
      >
        <AppShell.Navbar p="md">
          <SideNav
            page={activeNavPage}
            signingOut={signingOut}
            userEmail={user?.email ?? null}
            onNavigate={navigateFromNav}
            onSignOut={signOut}
            onHistory={openHistory}
            onSettings={() => setSettingsOpen(true)}
          />
        </AppShell.Navbar>

        <AppShell.Main className="app-content">
          <Container py="lg" size="sm">
            <Stack gap="md">
              {!localMode && <Group className="account-bar" gap="sm" justify="space-between" wrap="nowrap">
                <Text c="dimmed" lineClamp={1} size="sm">
                  {localMode ? "聊天与历史保存在本机" : user?.email ?? "Google account"}
                </Text>
                {!localMode && <Button
                  loading={signingOut}
                  radius="sm"
                  size="xs"
                  variant="default"
                  onClick={signOut}
                >
                  Sign out
                </Button>}
              </Group>}

              {page === "capture" ? (
                <Stack gap="lg">
                  {error ? (
                    <Alert color="red" role="alert" title="Something went wrong">
                      {error}
                    </Alert>
                  ) : null}
                  {localMode ? <LocalReflection info={localInfo} onConfirmed={() => void loadEntries()} historyOpen={historyOpen} onHistoryClose={() => setHistoryOpen(false)}>
                    <CaptureComposer canSave={canSave} messages={captureMessages} saving={saving} value={draft} onChange={setDraft} onSave={saveMemory} />
                  </LocalReflection> : <CaptureComposer
                    canSave={canSave}
                    messages={captureMessages}
                    saving={saving}
                    value={draft}
                    onChange={setDraft}
                    onSave={saveMemory}
                  />}
                </Stack>
              ) : null}

              {page === "memories" ? (
                <Stack gap="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Title order={2} size="h2">
                      {localMode ? "记忆" : "Memories"}
                    </Title>
                    <Button radius="sm" size="xs" variant="default" onClick={loadEntries}>
                      {localMode ? "刷新" : "Refresh"}
                    </Button>
                  </Group>

                  {error ? (
                    <Alert color="red" role="alert" title="Something went wrong">
                      {error}
                    </Alert>
                  ) : null}

                  {localMode && <Group>
                    <TextInput aria-label="搜索记忆" placeholder="搜索原文与摘录" value={search} onChange={e => setSearch(e.currentTarget.value)} style={{ flex: 1 }} />
                    <Button variant="default" onClick={() => setArchived(value => !value)}>{archived ? "返回记忆" : "查看归档"}</Button>
                  </Group>}
                  {loading ? (
                    <Group gap="xs">
                      <Loader size="sm" />
                      <Text c="dimmed">Loading memories...</Text>
                    </Group>
                  ) : null}

                  {!loading && memories.length === 0 ? (
                    <Text c="dimmed">{localMode ? "确认过的回顾，会留在这里。" : "No memories saved yet."}</Text>
                  ) : null}

                  {memories.length > 0 ? (
                    <Timeline memories={memories} onOpenMemory={openMemory} />
                  ) : null}
                </Stack>
              ) : null}

              {page === "detail" && loading && !selectedMemory ? (
                <Stack gap="md">
                  <Button
                    radius="sm"
                    size="xs"
                    variant="subtle"
                    w="fit-content"
                    onClick={() => navigate("memories")}
                  >
                    Back
                  </Button>
                  <Group gap="xs">
                    <Loader size="sm" />
                    <Text c="dimmed">Loading memory...</Text>
                  </Group>
                </Stack>
              ) : null}

              {page === "detail" && (!loading || selectedMemory) ? (
                <Stack gap="md">
                  <Button
                    radius="sm"
                    size="xs"
                    variant="subtle"
                    w="fit-content"
                    onClick={() => navigate("memories")}
                  >
                    Back
                  </Button>
                  <Title order={2} size="h2">
                    {localMode ? "这段记忆" : "Memory detail"}
                  </Title>
                  {localMode && archived && selectedEntry && <Button onClick={() => { void api.restore(selectedEntry.id).then(() => { setArchived(false); navigate("memories"); }).catch(e => setError(e.message)); }}>恢复到记忆列表</Button>}
                  {selectedEntry?.source_session_id && <Button variant="light" onClick={() => {
                    window.location.hash = `capture?session=${selectedEntry.source_session_id}`;
                    setPage("capture"); setSelectedId(null);
                  }}>查看这条回顾的完整聊天</Button>}
                  <MemoryDetail
                    canUpdate={canUpdate}
                    error={error}
                    memory={selectedMemory}
                    updating={updating}
                    value={detailDraft}
                    onChange={setDetailDraft}
                    onDelete={deleteMemory}
                    onUpdate={updateMemory}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Container>
        </AppShell.Main>

        <MobileBottomNav activePage={activeNavPage} onNavigate={navigateFromNav} onHistory={openHistory} onSettings={() => setSettingsOpen(true)} />
        {localMode && <LocalSettings opened={settingsOpen} onClose={() => setSettingsOpen(false)} info={localInfo} onInfo={setLocalInfo} />}
      </AppShell>
    </>
  );
}

export function App() {
  return (
    <MantineProvider theme={pensieveTheme} defaultColorScheme="light">
      <AuthGate>
        <AuthenticatedApp />
      </AuthGate>
    </MantineProvider>
  );
}
