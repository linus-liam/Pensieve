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
} from "@mantine/core";
import { api, ApiError } from "./api/client";
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
import type {
  Memory,
  MemoryEntry,
  MemoryProposal,
  ReflectionMessage,
  ReflectionSession,
} from "./types";

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
    content: "I'm here. What feels worth remembering right now?",
  },
];
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

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  const diffMs = today.getTime() - date.getTime();
  if (diffMs < 1000 * 60 * 60 * 24 * 7) return "This Week";

  return new Intl.DateTimeFormat("en-US", {
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
    sessionId: entry.session_id ?? null,
    title: entry.title || entry.ai_summary,
    day: getDayLabel(entry.created_at),
    time: formatTime(entry.created_at),
    source: "Text",
    sourceType: "text",
    summary: entry.ai_summary,
    rawInput: entry.raw_input,
    tags: inferTags(entry.raw_input),
  };
}

function toCaptureMessage(message: ReflectionMessage): CaptureChatMessage {
  const proposal = message.metadata.memoryProposal;
  return {
    id: message.id,
    clientMessageId: message.client_message_id ?? undefined,
    role: message.role,
    content: message.content,
    proposal,
    proposalStatus: proposal
      ? message.metadata.proposalState === "saved"
        ? "saved"
        : message.metadata.proposalState === "dismissed"
          ? "dismissed"
          : "pending"
      : undefined,
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
  const [reflectionSession, setReflectionSession] = useState<ReflectionSession | null>(null);
  const [retryMessage, setRetryMessage] = useState<{
    clientMessageId: string;
    content: string;
  } | null>(null);
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialRoute.selectedId);
  const [detailDraft, setDetailDraft] = useState("");
  const [detailTranscript, setDetailTranscript] = useState<ReflectionMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposalSavingId, setProposalSavingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedDetailId = useRef<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextEntries = await api.listMemoryEntries();
      setEntries(nextEntries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load memories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        let detail;
        try {
          detail = await api.getActiveReflectionSession();
        } catch (sessionError) {
          if (!(sessionError instanceof ApiError) || sessionError.status !== 404) throw sessionError;
          detail = await api.createReflectionSession();
        }
        if (cancelled) return;
        setReflectionSession(detail.session);
        setCaptureMessages(detail.messages.map(toCaptureMessage));
      } catch (sessionError) {
        if (cancelled) return;
        setError(
          sessionError instanceof Error ? sessionError.message : "Could not load reflection"
        );
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const memories = useMemo(() => entries.map(toMemory), [entries]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedMemory = selectedEntry ? toMemory(selectedEntry) : null;
  const canSave = draft.trim().length > 0;
  const canUpdate = detailDraft.trim().length > 0 && detailDraft.trim() !== selectedEntry?.raw_input;
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

  useEffect(() => {
    if (page !== "detail" || !selectedEntry?.session_id) {
      setDetailTranscript(null);
      return;
    }

    let cancelled = false;
    setDetailTranscript(null);
    api.getReflectionSession(selectedEntry.session_id)
      .then((detail) => {
        if (!cancelled) setDetailTranscript(detail.messages);
      })
      .catch((transcriptError) => {
        if (!cancelled) {
          setError(
            transcriptError instanceof Error
              ? transcriptError.message
              : "Could not load source conversation"
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, selectedEntry?.session_id]);

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
      navigate(nextPage);
    },
    [navigate]
  );

  const sendReflectionMessage = useCallback(async () => {
    const rawInput = draft.trim();
    if (!rawInput || saving || !reflectionSession) return;

    const clientMessageId =
      retryMessage?.content === rawInput ? retryMessage.clientMessageId : crypto.randomUUID();
    const userMessageId = `pending-${clientMessageId}`;
    const userMessage: CaptureChatMessage = {
      id: userMessageId,
      clientMessageId,
      role: "user",
      content: rawInput,
      status: "sending",
    };
    setSaving(true);
    setError(null);
    setDraft("");
    setCaptureMessages((current) => [
      ...current.filter(
        (message) =>
          message.clientMessageId !== clientMessageId &&
          message.id !== `assistant-error-${clientMessageId}`
      ),
      userMessage,
    ]);

    try {
      const reflection = await api.sendReflectionMessage(
        reflectionSession.id,
        rawInput,
        clientMessageId
      );
      setCaptureMessages((current) => [
        ...current
          .filter(
            (message) =>
              message.id !== userMessageId &&
              message.clientMessageId !== clientMessageId &&
              message.id !== `assistant-error-${clientMessageId}`
          )
          .concat(toCaptureMessage(reflection.userMessage)),
        toCaptureMessage(reflection.assistantMessage),
      ]);
      setRetryMessage(null);
    } catch (saveError) {
      setDraft(rawInput);
      setError(
        saveError instanceof Error ? saveError.message : "Could not continue reflection"
      );
      setRetryMessage({ clientMessageId, content: rawInput });
      setCaptureMessages((current) => [
        ...current.map((message) =>
          message.id === userMessageId ? { ...message, status: "error" as const } : message
        ),
        {
          id: `assistant-error-${clientMessageId}`,
          role: "assistant",
          content: "I couldn't send that just now. Your words are still here.",
          status: "error",
        },
      ]);
    } finally {
      setSaving(false);
    }
  }, [draft, reflectionSession, retryMessage, saving]);

  const dismissProposal = useCallback((messageId: string) => {
    setCaptureMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, proposalStatus: "dismissed" as const } : message
      )
    );
  }, []);

  const changeProposal = useCallback((messageId: string, proposal: MemoryProposal) => {
    setCaptureMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, proposal } : message))
    );
  }, []);

  const saveProposal = useCallback(
    async (messageId: string) => {
      if (proposalSavingId) return;

      const proposalMessage = captureMessages.find((message) => message.id === messageId);
      const proposal = proposalMessage?.proposal;
      if (!proposal) return;

      setProposalSavingId(messageId);
      setError(null);

      try {
        if (!reflectionSession) return;
        const entry = await api.confirmReflectionMemory(reflectionSession.id, {
          assistantMessageId: messageId,
          title: proposal.title,
          summary: proposal.summary,
        });
        setEntries((current) => [entry, ...current]);
        setCaptureMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, proposalStatus: "saved" as const }
              : message
          )
        );
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save reflection");
      } finally {
        setProposalSavingId(null);
      }
    },
    [captureMessages, proposalSavingId, reflectionSession]
  );

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
      const updated = await api.updateMemoryEntry(selectedEntry.id, detailDraft.trim());
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
          />
        </AppShell.Navbar>

        <AppShell.Main className="app-content">
          <Container py="lg" size="sm">
            <Stack gap="md">
              <Group className="account-bar" gap="sm" justify="space-between" wrap="nowrap">
                <Text c="dimmed" lineClamp={1} size="sm">
                  {user?.email ?? "Google account"}
                </Text>
                <Button
                  loading={signingOut}
                  radius="sm"
                  size="xs"
                  variant="default"
                  onClick={signOut}
                >
                  Sign out
                </Button>
              </Group>

              {page === "capture" ? (
                <Stack gap="lg">
                  {error ? (
                    <Alert color="red" role="alert" title="Something went wrong">
                      {error}
                    </Alert>
                  ) : null}
                  <CaptureComposer
                    canSave={canSave}
                    messages={captureMessages}
                    proposalSavingId={proposalSavingId}
                    saving={saving}
                    value={draft}
                    onChange={setDraft}
                    onChangeProposal={changeProposal}
                    onDismissProposal={dismissProposal}
                    onSave={sendReflectionMessage}
                    onSaveProposal={saveProposal}
                  />
                </Stack>
              ) : null}

              {page === "memories" ? (
                <Stack gap="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Title order={2} size="h2">
                      Memories
                    </Title>
                    <Button radius="sm" size="xs" variant="default" onClick={loadEntries}>
                      Refresh
                    </Button>
                  </Group>

                  {error ? (
                    <Alert color="red" role="alert" title="Something went wrong">
                      {error}
                    </Alert>
                  ) : null}

                  {loading ? (
                    <Group gap="xs">
                      <Loader size="sm" />
                      <Text c="dimmed">Loading memories...</Text>
                    </Group>
                  ) : null}

                  {!loading && memories.length === 0 ? (
                    <Text c="dimmed">No memories saved yet.</Text>
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
                    Memory detail
                  </Title>
                  <MemoryDetail
                    canUpdate={canUpdate}
                    error={error}
                    memory={selectedMemory}
                    transcript={detailTranscript}
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

        <MobileBottomNav activePage={activeNavPage} onNavigate={navigateFromNav} />
      </AppShell>
    </>
  );
}

export function App() {
  return (
    <MantineProvider defaultColorScheme="light">
      <AuthGate>
        <AuthenticatedApp />
      </AuthGate>
    </MantineProvider>
  );
}
