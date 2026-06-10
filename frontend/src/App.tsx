import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api/client";
import { CaptureInput } from "./components/reflection/CaptureInput";
import { SaveConfirmation } from "./components/reflection/SaveConfirmation";
import { SideNav } from "./components/reflection/SideNav";
import { Timeline } from "./components/reflection/Timeline";
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
    <div className="app-shell">
      <div className="app-atmosphere" aria-hidden="true" />

      <SideNav page={page === "detail" ? "memories" : page} onNavigate={navigate} />

      <div className="app-content">
        {page === "capture" ? (
          <>
            <header className="top-bar top-bar--capture" aria-label="Primary">
              <button className="brand-button" type="button" onClick={() => navigate("capture")}>
                Pensieve
              </button>
              <button
                className="nav-pill-button"
                type="button"
                aria-label="Open memories"
                onClick={() => navigate("memories")}
              >
                Memories
              </button>
            </header>

            <header className="desktop-top-bar desktop-top-bar--capture" aria-label="Capture header">
              <div className="desktop-top-bar__label">
                <span className="material-symbols-outlined" aria-hidden="true">
                  flare
                </span>
                New Entry
              </div>
            </header>

            <main className="capture-page">
              <CaptureInput
                value={draft}
                onChange={setDraft}
                onSave={saveMemory}
                canSave={canSave}
                saving={saving}
              />
              {error ? <p className="inline-error" role="alert">{error}</p> : null}
            </main>
          </>
        ) : page === "memories" ? (
          <>
            <header className="top-bar top-bar--timeline" aria-label="Memories">
              <div className="timeline-brand">
                <button className="icon-button back-button" type="button" aria-label="Back to capture" onClick={() => navigate("capture")}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    arrow_back
                  </span>
                </button>
                <button className="brand-button brand-button--small" type="button" onClick={() => navigate("capture")}>
                  Pensieve
                </button>
              </div>
              <span className="timeline-title">Memories</span>
            </header>

            <header className="desktop-top-bar desktop-top-bar--memories" aria-label="Memories header">
              <h2 className="desktop-top-bar__title">Memories</h2>
              <div className="desktop-top-bar__actions">
                <button className="icon-button" type="button" aria-label="Refresh memories" onClick={loadEntries}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    refresh
                  </span>
                </button>
                <button className="icon-button" type="button" aria-label="Settings">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    settings
                  </span>
                </button>
              </div>
            </header>

            <main className="timeline-page">
              {error ? <p className="inline-error" role="alert">{error}</p> : null}
              {loading ? <p className="empty-state">Loading memories...</p> : null}
              {!loading && memories.length === 0 ? (
                <p className="empty-state">No memories saved yet.</p>
              ) : null}
              {memories.length > 0 ? (
                <Timeline memories={memories} onOpenMemory={openMemory} />
              ) : null}
            </main>
          </>
        ) : (
          <>
            <header className="top-bar top-bar--timeline" aria-label="Memory detail">
              <div className="timeline-brand">
                <button className="icon-button back-button" type="button" aria-label="Back to memories" onClick={() => navigate("memories")}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    arrow_back
                  </span>
                </button>
                <button className="brand-button brand-button--small" type="button" onClick={() => navigate("capture")}>
                  Pensieve
                </button>
              </div>
              <span className="timeline-title">Detail</span>
            </header>

            <main className="detail-page">
              {selectedMemory ? (
                <article className="detail-panel">
                  <div className="detail-panel__meta">
                    <time>{selectedMemory.day} at {selectedMemory.time}</time>
                  </div>

                  <section className="detail-section" aria-label="AI summary">
                    <h2>Summary</h2>
                    <p>{selectedMemory.summary}</p>
                  </section>

                  <section className="detail-section" aria-label="Original memory">
                    <h2>Original</h2>
                    <textarea
                      className="detail-textarea"
                      value={detailDraft}
                      aria-label="Original memory input"
                      onChange={(event) => setDetailDraft(event.target.value)}
                    />
                  </section>

                  {error ? <p className="inline-error" role="alert">{error}</p> : null}

                  <div className="detail-actions">
                    <button
                      className="detail-button detail-button--danger"
                      type="button"
                      disabled={updating}
                      onClick={deleteMemory}
                    >
                      Delete
                    </button>
                    <button
                      className="detail-button detail-button--primary"
                      type="button"
                      disabled={!canUpdate || updating}
                      onClick={updateMemory}
                    >
                      {updating ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </article>
              ) : (
                <p className="empty-state">Select a memory from the timeline.</p>
              )}
            </main>
          </>
        )}
      </div>

      <SaveConfirmation show={showConfirmation} onDone={() => setShowConfirmation(false)} />
    </div>
  );
}
