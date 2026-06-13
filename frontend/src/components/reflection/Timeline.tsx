import type { Memory } from "../../types";
import { TimelineCard } from "./TimelineCard";

interface TimelineProps {
  memories: Memory[];
  onOpenMemory: (memory: Memory) => void;
}

const dayOrder = ["Today", "Yesterday"];

function groupMemories(memories: Memory[]) {
  const groups = new Map<string, Memory[]>();

  for (const memory of memories) {
    groups.set(memory.day, [...(groups.get(memory.day) ?? []), memory]);
  }

  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = dayOrder.indexOf(a);
    const bIndex = dayOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

export function Timeline({ memories, onOpenMemory }: TimelineProps) {
  const groups = groupMemories(memories);

  return (
    <>
      <div className="timeline">
        {groups.map(([day, dayMemories]) => (
          <section className="timeline-section" key={day} aria-labelledby={`timeline-${day}`}>
            <h2 id={`timeline-${day}`}>{day}</h2>
            <div className="timeline-stack">
              {dayMemories.map((memory) => (
                <TimelineCard
                  key={memory.id}
                  memory={memory}
                  muted={day !== "Today"}
                  onOpen={() => onOpenMemory(memory)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="timeline-end">
        <span className="material-symbols-outlined timeline-end__icon" aria-hidden="true">
          all_inclusive
        </span>
        <p>That's all for now. Take a breath.</p>
      </footer>
    </>
  );
}
