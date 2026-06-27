import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppShell,
  Box,
  Button,
  Container,
  Group,
  Loader,
  MantineProvider,
  Stack,
  Text,
} from "@mantine/core";
import { api } from "./api/client";
import { CaptureComposer } from "./components/reflection/CaptureComposer";
import { CaptureDisplay } from "./components/reflection/CaptureDisplay";
import { MemoryDetail } from "./components/reflection/MemoryDetail";
import { SaveConfirmation } from "./components/reflection/SaveConfirmation";
import { SideNav } from "./components/reflection/SideNav";
import { Timeline } from "./components/reflection/Timeline";
import { UnavailableIconButton } from "./components/reflection/UnavailableIconButton";
import type { Memory, MemoryEntry } from "./types";

type Page = "capture" | "memories" | "detail";

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
    day: getDayLabel(entry.created_at),
    time: formatTime(entry.created_at),
    source: "Text",
    sourceType: "text",
    summary: entry.ai_summary,
    rawInput: entry.raw_input,
    tags: inferTags(entry.raw_input),
  };
}

interface AppHeaderProps {
  page: Page;
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
}

function getHeaderTitle(page: Page) {
  if (page === "capture") return "New Entry";
  if (page === "memories") return "Memories";
  return "Detail";
}

function AppHeader({ page, onNavigate, onRefresh }: AppHeaderProps) {
  const backTarget = page === "detail" ? "memories" : "capture";
  const backLabel = page === "detail" ? "Back to memories" : "Back to capture";

  return (
    <AppShell.Header>
      <Group h="100%" gap="sm" px="md" wrap="nowrap">
        {page !== "capture" ? (
          <Button
            aria-label={backLabel}
            radius="sm"
            size="xs"
            variant="subtle"
            onClick={() => onNavigate(backTarget)}
          >
            Back
          </Button>
        ) : null}

        <Button radius="sm" variant="subtle" onClick={() => onNavigate("capture")}>
          Pensieve
        </Button>

        <Text fw={600} size="sm">
          {getHeaderTitle(page)}
        </Text>

        <Box style={{ flex: 1 }} />

        {page === "capture" ? (
          <Button
            aria-label="Open memories"
            radius="sm"
            size="xs"
            variant="default"
            onClick={() => onNavigate("memories")}
          >
            Memories
          </Button>
        ) : null}

        {page === "memories" ? (
          <Group gap="xs" wrap="nowrap">
            <Button radius="sm" size="xs" variant="default" onClick={onRefresh}>
              Refresh
            </Button>
            <UnavailableIconButton label="Settings" icon="settings" />
          </Group>
        ) : null}
      </Group>
    </AppShell.Header>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("capture");
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const memories = useMemo(() => entries.map(toMemory), [entries]);
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedMemory = selectedEntry ? toMemory(selectedEntry) : null;
  const canSave = draft.trim().length > 0;
  const canUpdate = detailDraft.trim().length > 0 && detailDraft.trim() !== selectedEntry?.raw_input;

  const navigate = useCallback((nextPage: Page) => {
    if (nextPage !== "detail") {
      setSelectedId(null);
      setDetailDraft("");
    }
    setPage(nextPage);
  }, []);

  const saveMemory = useCallback(async () => {
    const rawInput = draft.trim();
    if (!rawInput || saving) return;

    setSaving(true);
    setError(null);

    try {
      const entry = await api.createMemoryEntry(rawInput);
      setEntries((current) => [entry, ...current]);
      setDraft("");
      setShowConfirmation(true);
      setPage("memories");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save memory");
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const openMemory = useCallback((memory: Memory) => {
    setSelectedId(memory.id);
    setDetailDraft(memory.rawInput);
    setPage("detail");
  }, []);

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
      setSelectedId(null);
      setDetailDraft("");
      setPage("memories");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete memory");
    } finally {
      setUpdating(false);
    }
  }, [selectedEntry, updating]);

  return (
    <MantineProvider defaultColorScheme="light">
      <AppShell
        header={{ height: 64 }}
        navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: true } }}
        padding="md"
      >
        <AppHeader page={page} onNavigate={navigate} onRefresh={loadEntries} />

        <AppShell.Navbar p="md">
          <SideNav page={page === "detail" ? "memories" : page} onNavigate={navigate} />
        </AppShell.Navbar>

        <AppShell.Main>
          <Container py="lg" size="sm">
            {page === "capture" ? (
              <Stack gap="lg">
                <CaptureDisplay />
                {error ? (
                  <Alert color="red" role="alert" title="Something went wrong">
                    {error}
                  </Alert>
                ) : null}
                <CaptureComposer
                  canSave={canSave}
                  value={draft}
                  onChange={setDraft}
                  onSave={saveMemory}
                />
              </Stack>
            ) : null}

            {page === "memories" ? (
              <Stack gap="md">
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

            {page === "detail" ? (
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
            ) : null}
          </Container>
        </AppShell.Main>
      </AppShell>

      <SaveConfirmation show={showConfirmation} onDone={() => setShowConfirmation(false)} />
    </MantineProvider>
  );
}
