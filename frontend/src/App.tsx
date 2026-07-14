import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionIcon,
  Alert,
  AppShell,
  Button,
  Container,
  Divider,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Modal,
  SegmentedControl,
  Skeleton,
  Text,
  TextInput,
  Stack,
  Title,
} from "@mantine/core";
import { ArrowLeft, CircleUserRound, LogOut, Search, X } from "lucide-react";
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
import { pensieveTheme } from "./theme";

type Page = "capture" | "memories" | "detail";
type NavPage = "capture" | "memories";
type MemoryPeriod = "all" | "earlier" | "week";

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
  if (diffMs >= 0 && diffMs < 1000 * 60 * 60 * 24 * 7) return "This Week";

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

function getMemoryEntryTitle(entry: MemoryEntry) {
  return entry.title || entry.ai_summary;
}

function toMemory(entry: MemoryEntry): Memory {
  return {
    id: entry.id,
    sessionId: entry.session_id ?? null,
    title: getMemoryEntryTitle(entry),
    day: getDayLabel(entry.created_at),
    time: formatTime(entry.created_at),
    source: "Text",
    sourceType: "text",
    summary: entry.ai_summary,
    rawInput: entry.raw_input,
    createdAt: entry.created_at,
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
          ? "deferred"
          : "pending"
      : undefined,
    savedMemoryId: message.metadata.memoryEntryId,
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
  const [detailTitleDraft, setDetailTitleDraft] = useState("");
  const [detailSummaryDraft, setDetailSummaryDraft] = useState("");
  const [detailEditing, setDetailEditing] = useState(false);
  const [detailSuccess, setDetailSuccess] = useState<string | null>(null);
  const [detailTranscript, setDetailTranscript] = useState<ReflectionMessage[] | null>(null);
  const [memoryQuery, setMemoryQuery] = useState("");
  const [memoryPeriod, setMemoryPeriod] = useState<MemoryPeriod>("all");
  const [pendingRoute, setPendingRoute] = useState<RouteState | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposalSavingId, setProposalSavingId] = useState<string | null>(null);
  const [startingNew, setStartingNew] = useState(false);
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
  const deferredMemoryQuery = useDeferredValue(memoryQuery.trim().toLocaleLowerCase());
  const filteredMemories = useMemo(() => {
    const weekMs = 1000 * 60 * 60 * 24 * 7;
    const now = Date.now();

    return memories.filter((memory) => {
      const ageMs = now - new Date(memory.createdAt).getTime();
      const matchesPeriod =
        memoryPeriod === "all" ||
        (memoryPeriod === "week" && ageMs >= 0 && ageMs < weekMs) ||
        (memoryPeriod === "earlier" && ageMs >= weekMs);
      if (!matchesPeriod) return false;
      if (!deferredMemoryQuery) return true;

      return [memory.title, memory.summary, memory.rawInput, memory.day, ...memory.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(deferredMemoryQuery);
    });
  }, [deferredMemoryQuery, memories, memoryPeriod]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedMemory = selectedEntry ? toMemory(selectedEntry) : null;
  const canSave = draft.trim().length > 0;
  const detailHasChanges = Boolean(
    selectedEntry &&
      (detailTitleDraft.trim() !== getMemoryEntryTitle(selectedEntry) ||
        detailSummaryDraft.trim() !== selectedEntry.ai_summary ||
        (!selectedEntry.session_id && detailDraft.trim() !== selectedEntry.raw_input))
  );
  const canUpdate = Boolean(
    selectedEntry &&
      detailEditing &&
      detailTitleDraft.trim() &&
      detailSummaryDraft.trim() &&
      (selectedEntry.session_id || detailDraft.trim()) &&
      detailHasChanges
  );
  const activeNavPage = getActiveNavPage(page);

  const applyRoute = useCallback((route: RouteState) => {
    setPage(route.page);
    setSelectedId(route.selectedId);

    if (route.page !== "detail") {
      setSelectedId(null);
      setDetailDraft("");
      setDetailTitleDraft("");
      setDetailSummaryDraft("");
      setDetailEditing(false);
      setDetailSuccess(null);
      hydratedDetailId.current = null;
    } else {
      setDetailEditing(false);
      setDetailSuccess(null);
      hydratedDetailId.current = null;
    }
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      const nextRoute = getRouteFromHash();
      const routeChanged = nextRoute.page !== page || nextRoute.selectedId !== selectedId;

      if (!routeChanged) return;

      if (page === "detail" && detailEditing && detailHasChanges) {
        setPendingRoute(nextRoute);
        window.history.replaceState(null, "", getHashForRoute(page, selectedId));
        return;
      }

      applyRoute(nextRoute);
    };

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);

    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, [applyRoute, detailEditing, detailHasChanges, page, selectedId]);

  useEffect(() => {
    if (!detailEditing || !detailHasChanges) return;

    const protectUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedChanges);
    return () => window.removeEventListener("beforeunload", protectUnsavedChanges);
  }, [detailEditing, detailHasChanges]);

  useEffect(() => {
    if (page !== "detail" || !selectedEntry) return;
    if (hydratedDetailId.current === selectedEntry.id) return;

    setDetailDraft(selectedEntry.raw_input);
    setDetailTitleDraft(getMemoryEntryTitle(selectedEntry));
    setDetailSummaryDraft(selectedEntry.ai_summary);
    setDetailEditing(false);
    setDetailSuccess(null);
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

  const commitNavigate = useCallback(
    (nextPage: Page, memoryId?: string) => {
      const nextSelectedId = nextPage === "detail" ? memoryId ?? selectedId : null;
      if (nextPage === "detail" && !nextSelectedId) return;

      setPage(nextPage);
      setSelectedId(nextSelectedId);

      if (nextPage !== "detail") {
        setDetailDraft("");
        setDetailTitleDraft("");
        setDetailSummaryDraft("");
        setDetailEditing(false);
        setDetailSuccess(null);
        hydratedDetailId.current = null;
      }

      const nextHash = getHashForRoute(nextPage, nextSelectedId);
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
    },
    [selectedId]
  );

  const requestNavigate = useCallback(
    (nextPage: Page, memoryId?: string) => {
      const nextSelectedId = nextPage === "detail" ? memoryId ?? selectedId : null;
      const routeChanged = nextPage !== page || nextSelectedId !== selectedId;

      if (routeChanged && page === "detail" && detailEditing && detailHasChanges) {
        setPendingRoute({ page: nextPage, selectedId: nextSelectedId });
        return;
      }

      commitNavigate(nextPage, memoryId);
    },
    [commitNavigate, detailEditing, detailHasChanges, page, selectedId]
  );

  const navigateFromNav = useCallback(
    (nextPage: NavPage) => {
      requestNavigate(nextPage);
    },
    [requestNavigate]
  );

  const sendReflectionMessage = useCallback(async (retry?: {
    clientMessageId: string;
    content: string;
  }) => {
    const rawInput = retry?.content ?? draft.trim();
    if (!rawInput || saving || !reflectionSession) return;

    const clientMessageId = retry?.clientMessageId ?? crypto.randomUUID();
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
        (message) => message.clientMessageId !== clientMessageId
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
              message.clientMessageId !== clientMessageId
          )
          .concat(toCaptureMessage(reflection.userMessage)),
        toCaptureMessage(reflection.assistantMessage),
      ]);
      setRetryMessage(null);
    } catch {
      setDraft((current) => current.trim() || rawInput);
      setError(null);
      setRetryMessage({ clientMessageId, content: rawInput });
      setCaptureMessages((current) =>
        current.map((message) =>
          message.id === userMessageId ? { ...message, status: "error" as const } : message
        )
      );
    } finally {
      setSaving(false);
    }
  }, [draft, reflectionSession, saving]);

  const dismissProposal = useCallback((messageId: string) => {
    setCaptureMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, proposalStatus: "deferred" as const } : message
      )
    );
  }, []);

  const restoreProposal = useCallback((messageId: string) => {
    setCaptureMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, proposalStatus: "pending" as const } : message
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
              ? {
                  ...message,
                  proposalStatus: "saved" as const,
                  savedMemoryId: entry.id,
                }
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

  const startNewReflection = useCallback(async () => {
    if (startingNew) return;

    setStartingNew(true);
    setError(null);
    try {
      const detail = await api.startNewReflectionSession();
      setReflectionSession(detail.session);
      setCaptureMessages(detail.messages.map(toCaptureMessage));
      setDraft("");
      setRetryMessage(null);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Could not start a new memory"
      );
    } finally {
      setStartingNew(false);
    }
  }, [startingNew]);

  const openMemory = useCallback((memory: Memory) => {
    setSelectedId(memory.id);
    setDetailDraft(memory.rawInput);
    setDetailTitleDraft(memory.title);
    setDetailSummaryDraft(memory.summary);
    setDetailEditing(false);
    setDetailSuccess(null);
    hydratedDetailId.current = memory.id;
    commitNavigate("detail", memory.id);
  }, [commitNavigate]);

  const viewSavedMemory = useCallback(
    (memoryId: string) => {
      const entry = entries.find((item) => item.id === memoryId);
      if (!entry) return;
      openMemory(toMemory(entry));
    },
    [entries, openMemory]
  );

  const updateMemory = useCallback(async () => {
    if (!selectedEntry || !canUpdate || updating) return;

    setUpdating(true);
    setError(null);
    setDetailSuccess(null);

    try {
      const input = {
        ...(detailTitleDraft.trim() !== getMemoryEntryTitle(selectedEntry)
          ? { title: detailTitleDraft.trim() }
          : {}),
        ...(detailSummaryDraft.trim() !== selectedEntry.ai_summary
          ? { summary: detailSummaryDraft.trim() }
          : {}),
        ...(!selectedEntry.session_id && detailDraft.trim() !== selectedEntry.raw_input
          ? { rawInput: detailDraft.trim() }
          : {}),
      };
      const updated = await api.updateMemoryEntry(selectedEntry.id, input);
      setEntries((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      setDetailDraft(updated.raw_input);
      setDetailTitleDraft(getMemoryEntryTitle(updated));
      setDetailSummaryDraft(updated.ai_summary);
      setDetailEditing(false);
      setDetailSuccess("Changes saved.");
      hydratedDetailId.current = updated.id;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update memory");
    } finally {
      setUpdating(false);
    }
  }, [
    canUpdate,
    detailDraft,
    detailSummaryDraft,
    detailTitleDraft,
    selectedEntry,
    updating,
  ]);

  const cancelMemoryEdit = useCallback(() => {
    if (!selectedEntry) return;
    setDetailDraft(selectedEntry.raw_input);
    setDetailTitleDraft(getMemoryEntryTitle(selectedEntry));
    setDetailSummaryDraft(selectedEntry.ai_summary);
    setDetailEditing(false);
    setDetailSuccess(null);
  }, [selectedEntry]);

  const deleteMemory = useCallback(async () => {
    if (!selectedEntry || updating) return;

    setUpdating(true);
    setError(null);

    try {
      await api.deleteMemoryEntry(selectedEntry.id);
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id));
      setDetailEditing(false);
      commitNavigate("memories");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete memory");
    } finally {
      setUpdating(false);
    }
  }, [commitNavigate, selectedEntry, updating]);

  return (
    <>
      <AppShell
        className="app-shell"
        navbar={{ width: 248, breakpoint: "sm", collapsed: { mobile: true } }}
        padding={0}
      >
        <AppShell.Navbar>
          <SideNav
            page={activeNavPage}
            signingOut={signingOut}
            userEmail={user?.email ?? null}
            onNavigate={navigateFromNav}
            onSignOut={signOut}
          />
        </AppShell.Navbar>

        <AppShell.Main className="app-content">
          <Container className="app-container" fluid>
            <Stack gap="md">
              <Group className="mobile-app-header" justify="space-between" wrap="nowrap">
                <Text className="mobile-app-header__brand">Pensieve</Text>
                <Menu position="bottom-end" shadow="md" width={220}>
                  <Menu.Target>
                    <ActionIcon
                      aria-label="Open account menu"
                      className="mobile-account-button"
                      variant="subtle"
                    >
                      <CircleUserRound aria-hidden="true" size={22} strokeWidth={1.7} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Signed in as</Menu.Label>
                    <Text className="mobile-account-email" lineClamp={1} px="sm" pb="xs" size="sm">
                      {user?.email ?? "Google account"}
                    </Text>
                    <Divider />
                    <Menu.Item
                      color="red"
                      leftSection={<LogOut aria-hidden="true" size={15} />}
                      onClick={signOut}
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>

              {page === "capture" ? (
                <Stack className="capture-page" gap="lg">
                  {error ? (
                    <Alert className="page-alert" color="red" role="alert" title="Something went wrong">
                      {error}
                    </Alert>
                  ) : null}
                  <CaptureComposer
                    canSave={canSave}
                    messages={captureMessages}
                    proposalSavingId={proposalSavingId}
                    saving={saving}
                    startingNew={startingNew}
                    value={draft}
                    onChange={setDraft}
                    onChangeProposal={changeProposal}
                    onDismissProposal={dismissProposal}
                    onRestoreProposal={restoreProposal}
                    onRetry={() => {
                      if (retryMessage) void sendReflectionMessage(retryMessage);
                    }}
                    onSave={() => void sendReflectionMessage()}
                    onSaveProposal={saveProposal}
                    onStartNew={() => void startNewReflection()}
                    onViewMemory={viewSavedMemory}
                  />
                </Stack>
              ) : null}

              {page === "memories" ? (
                <Stack className="memories-page" gap="xl">
                  <header className="memories-page__header">
                    <Title className="memories-page__title" order={1}>Memories</Title>
                  </header>

                  {error ? (
                    <Group gap="sm" role="alert">
                      <Text c="red" size="sm">
                        {error}
                      </Text>
                      <Button
                        className="button-secondary"
                        size="compact-sm"
                        variant="default"
                        onClick={loadEntries}
                      >
                        Try again
                      </Button>
                    </Group>
                  ) : null}

                  {memories.length > 0 ? (
                    <Stack className="memories-tools" gap="sm">
                      <Group align="stretch" gap="sm" wrap="wrap">
                        <TextInput
                          aria-label="Search memories"
                          className="memories-search"
                          leftSection={<Search aria-hidden="true" size={17} />}
                          placeholder="Search memories"
                          rightSection={
                            memoryQuery ? (
                              <ActionIcon
                                aria-label="Clear memory search"
                                className="memories-search__clear"
                                variant="subtle"
                                onClick={() => setMemoryQuery("")}
                              >
                                <X aria-hidden="true" size={17} />
                              </ActionIcon>
                            ) : null
                          }
                          rightSectionPointerEvents="all"
                          value={memoryQuery}
                          onChange={(event) => setMemoryQuery(event.currentTarget.value)}
                        />
                        <SegmentedControl
                          aria-label="Filter memories by date"
                          className="memories-period-filter"
                          data={[
                            { label: "All", value: "all" },
                            { label: "This week", value: "week" },
                            { label: "Earlier", value: "earlier" },
                          ]}
                          value={memoryPeriod}
                          onChange={(value) => setMemoryPeriod(value as MemoryPeriod)}
                        />
                      </Group>
                      <Text aria-live="polite" className="memories-results" size="sm">
                        {filteredMemories.length === memories.length && !deferredMemoryQuery
                          ? `${memories.length} ${memories.length === 1 ? "memory" : "memories"}`
                          : `${filteredMemories.length} of ${memories.length} memories`}
                      </Text>
                    </Stack>
                  ) : null}

                  {loading && memories.length === 0 ? (
                    <Stack aria-label="Loading memories" className="memory-skeletons" gap="xl" role="status">
                      {[0, 1, 2].map((item) => (
                        <Stack className="memory-skeleton" gap="xs" key={item}>
                          <Skeleton height={18} radius="sm" width="46%" />
                          <Skeleton height={14} radius="sm" width="82%" />
                        </Stack>
                      ))}
                    </Stack>
                  ) : null}

                  {!loading && memories.length === 0 ? (
                    <Stack align="flex-start" className="memories-empty" gap="md">
                      <Title order={2} size="h3">No memories yet</Title>
                      <Button className="button-primary" onClick={() => requestNavigate("capture")}>
                        Capture a memory
                      </Button>
                    </Stack>
                  ) : null}

                  {!loading && memories.length > 0 && filteredMemories.length === 0 ? (
                    <Stack align="flex-start" className="memories-empty" gap="md">
                      <Title order={2} size="h3">No matching memories</Title>
                      <Text className="memories-empty__copy">
                        Try another search or clear the date filter.
                      </Text>
                      <Button
                        className="button-secondary"
                        variant="default"
                        onClick={() => {
                          setMemoryQuery("");
                          setMemoryPeriod("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </Stack>
                  ) : null}

                  {filteredMemories.length > 0 ? (
                    <Timeline memories={filteredMemories} onOpenMemory={openMemory} />
                  ) : null}
                </Stack>
              ) : null}

              {page === "detail" && loading && !selectedMemory ? (
                <Stack gap="md">
                  <Button
                    className="button-secondary page-back"
                    leftSection={<ArrowLeft aria-hidden="true" size={16} />}
                    variant="subtle"
                    w="fit-content"
                    onClick={() => requestNavigate("memories")}
                  >
                    Back to memories
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
                    className="button-secondary page-back"
                    leftSection={<ArrowLeft aria-hidden="true" size={16} />}
                    variant="subtle"
                    w="fit-content"
                    onClick={() => requestNavigate("memories")}
                  >
                    Back to memories
                  </Button>
                  <MemoryDetail
                    canUpdate={canUpdate}
                    editing={detailEditing}
                    error={error}
                    memory={selectedMemory}
                    rawInputValue={detailDraft}
                    success={detailSuccess}
                    summaryValue={detailSummaryDraft}
                    titleValue={detailTitleDraft}
                    transcript={detailTranscript}
                    updating={updating}
                    onCancelEdit={cancelMemoryEdit}
                    onChangeRawInput={setDetailDraft}
                    onChangeSummary={setDetailSummaryDraft}
                    onChangeTitle={setDetailTitleDraft}
                    onDelete={deleteMemory}
                    onEdit={() => {
                      setDetailSuccess(null);
                      setDetailEditing(true);
                    }}
                    onUpdate={updateMemory}
                  />
                </Stack>
              ) : null}
            </Stack>
          </Container>
        </AppShell.Main>

        <MobileBottomNav activePage={activeNavPage} onNavigate={navigateFromNav} />
      </AppShell>

      <Modal
        centered
        opened={pendingRoute !== null}
        title="Discard unsaved changes?"
        onClose={() => setPendingRoute(null)}
      >
        <Stack gap="md">
          <Text size="sm">Your edits to this memory have not been saved.</Text>
          <Group justify="flex-end">
            <Button
              className="button-secondary"
              variant="default"
              onClick={() => setPendingRoute(null)}
            >
              Keep editing
            </Button>
            <Button
              color="red"
              onClick={() => {
                const nextRoute = pendingRoute;
                setPendingRoute(null);
                setDetailEditing(false);
                if (nextRoute) {
                  commitNavigate(nextRoute.page, nextRoute.selectedId ?? undefined);
                }
              }}
            >
              Discard changes
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export function App() {
  return (
    <MantineProvider defaultColorScheme="light" theme={pensieveTheme}>
      <AuthGate>
        <AuthenticatedApp />
      </AuthGate>
    </MantineProvider>
  );
}
