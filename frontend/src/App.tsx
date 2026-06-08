import { useCallback, useMemo, useState } from "react";
import { CaptureInput } from "./components/reflection/CaptureInput";
import { SaveConfirmation } from "./components/reflection/SaveConfirmation";
import { SideNav } from "./components/reflection/SideNav";
import { Timeline } from "./components/reflection/Timeline";
import type { Memory } from "./types";

type Page = "capture" | "memories";

const sampleImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 900 560'%3E%3Cdefs%3E%3ClinearGradient id='wall' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23d7d5cc'/%3E%3Cstop offset='.55' stop-color='%23f4f1e8'/%3E%3Cstop offset='1' stop-color='%23b3aa99'/%3E%3C/linearGradient%3E%3ClinearGradient id='desk' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop stop-color='%23b58d64'/%3E%3Cstop offset='1' stop-color='%2372533b'/%3E%3C/linearGradient%3E%3Cfilter id='soft' x='-20%25' y='-20%25' width='140%25' height='140%25'%3E%3CfeDropShadow dx='0' dy='14' stdDeviation='18' flood-color='%23516052' flood-opacity='.18'/%3E%3C/filter%3E%3C/defs%3E%3Crect width='900' height='560' fill='url(%23wall)'/%3E%3Cpath d='M430 0h470v430H270z' fill='%23fffaf1' opacity='.45'/%3E%3Cpath d='M0 374h900v186H0z' fill='url(%23desk)'/%3E%3Cg filter='url(%23soft)'%3E%3Cellipse cx='233' cy='398' rx='88' ry='14' fill='%234c3e31' opacity='.25'/%3E%3Cpath d='M166 314h119l-14 88h-91z' fill='%23e3d3bd'/%3E%3Cpath d='M174 314h104l-8 28h-88z' fill='%23b89f80'/%3E%3Cpath d='M178 402h92l-9 18h-74z' fill='%23d8c2a3'/%3E%3Cpath d='M216 310c-64-2-94-40-72-76 20-33 54-10 61 8 9-47 60-61 84-25 19 29-5 66-73 93z' fill='%234f694f'/%3E%3Cpath d='M220 312c42-20 73-20 87 5 17 32-33 54-87 28-26 33-78 31-90-1-10-27 26-44 90-32z' fill='%235b7659'/%3E%3Cpath d='M219 315c-19-28-12-76 19-81 38-6 58 50-19 81z' fill='%236f8c68'/%3E%3C/g%3E%3Cg filter='url(%23soft)'%3E%3Cpath d='M452 405c72-35 145-32 214 0v53c-70-29-142-29-214 0z' fill='%23f7f1e4'/%3E%3Cpath d='M666 405c68-31 132-26 193 8v48c-61-30-126-31-193-3z' fill='%23eee4d3'/%3E%3Cpath d='M666 405v53' stroke='%23b9aa93' stroke-width='4'/%3E%3Cpath d='M474 425c48-13 93-13 139 0M704 426c41-11 82-8 123 8' stroke='%23cfc2ad' stroke-width='5' stroke-linecap='round' opacity='.8'/%3E%3C/g%3E%3C/svg%3E";

const initialMemories: Memory[] = [
  {
    id: "memory-1",
    day: "Today",
    time: "10:42 AM",
    source: "Text",
    sourceType: "text",
    content:
      "Reflected on the anxiety surrounding the upcoming presentation, realizing it stems from a desire to perfect the narrative rather than fear of public speaking.",
    tags: ["reflection", "work"],
  },
  {
    id: "memory-2",
    day: "Today",
    time: "2:15 PM",
    source: "Screenshot",
    sourceType: "screenshot",
    image: sampleImage,
    imageAlt: "A quiet desk with a plant and an open notebook in warm light.",
    content:
      "Saved an inspiring quote about finding stillness during chaotic days. Need to remember this when feeling overwhelmed by context-switching.",
    tags: ["inspiration", "mindfulness"],
  },
  {
    id: "memory-3",
    day: "Yesterday",
    time: "8:30 PM",
    source: "Voice note",
    sourceType: "voice",
    content:
      "Talked through a complex emotional response to a friend's feedback. Realized I was projecting past insecurities onto a genuinely helpful suggestion.",
    tags: ["growth", "relationships"],
  },
  {
    id: "memory-4",
    day: "This Week",
    time: "7:12 AM",
    source: "Photo",
    sourceType: "photo",
    content:
      "A small reminder that the morning felt lighter after clearing the table and opening the windows.",
    tags: ["home", "stillness"],
  },
];

function getCurrentTime() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function inferTags(content: string) {
  const text = content.toLowerCase();
  if (text.includes("work") || text.includes("presentation")) return ["reflection", "work"];
  if (text.includes("calm") || text.includes("breath")) return ["mindfulness"];
  if (text.includes("idea") || text.includes("inspire")) return ["inspiration"];
  return ["reflection"];
}

export function App() {
  const [page, setPage] = useState<Page>("capture");
  const [draft, setDraft] = useState("");
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const canSave = draft.trim().length > 0;

  const saveMemory = useCallback(() => {
    const content = draft.trim();
    if (!content) return;

    if ("vibrate" in navigator) {
      navigator.vibrate(10);
    }

    const memory: Memory = {
      id: crypto.randomUUID(),
      day: "Today",
      time: getCurrentTime(),
      source: "Text",
      sourceType: "text",
      content,
      tags: inferTags(content),
    };

    setMemories((current) => [memory, ...current]);
    setDraft("");
    setShowConfirmation(true);
  }, [draft]);

  const groupedMemories = useMemo(() => memories, [memories]);

  return (
    <div className="app-shell">
      <div className="app-atmosphere" aria-hidden="true" />

      <SideNav page={page} onNavigate={setPage} />

      <div className="app-content">
        {page === "capture" ? (
          <>
            <header className="top-bar top-bar--capture" aria-label="Primary">
              <button className="brand-button" type="button" onClick={() => setPage("capture")}>
                Pensieve
              </button>
              <button
                className="nav-pill-button"
                type="button"
                aria-label="Open memories"
                onClick={() => setPage("memories")}
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
              <CaptureInput value={draft} onChange={setDraft} onSave={saveMemory} canSave={canSave} />
            </main>
          </>
        ) : (
          <>
            <header className="top-bar top-bar--timeline" aria-label="Memories">
              <div className="timeline-brand">
                <button className="icon-button back-button" type="button" aria-label="Back to capture" onClick={() => setPage("capture")}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    arrow_back
                  </span>
                </button>
                <button className="brand-button brand-button--small" type="button" onClick={() => setPage("capture")}>
                  Pensieve
                </button>
              </div>
              <span className="timeline-title">Memories</span>
            </header>

            <header className="desktop-top-bar desktop-top-bar--memories" aria-label="Memories header">
              <h2 className="desktop-top-bar__title">Memories</h2>
              <div className="desktop-top-bar__actions">
                <button className="icon-button" type="button" aria-label="Search memories">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    search
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
              <Timeline memories={groupedMemories} />
            </main>

            <nav className="memories-floating-nav" aria-label="Quick capture">
              <button className="icon-action" type="button" aria-label="Record voice note">
                <span className="material-symbols-outlined" aria-hidden="true">
                  mic
                </span>
              </button>
              <button
                className="icon-action icon-action--primary-container"
                type="button"
                aria-label="New capture"
                onClick={() => setPage("capture")}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  add_circle
                </span>
              </button>
              <button className="icon-action" type="button" aria-label="Attach photo">
                <span className="material-symbols-outlined" aria-hidden="true">
                  image
                </span>
              </button>
            </nav>
          </>
        )}
      </div>

      <SaveConfirmation show={showConfirmation} onDone={() => setShowConfirmation(false)} />
    </div>
  );
}
