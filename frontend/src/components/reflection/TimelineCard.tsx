import type { Memory } from "../../types";
import { MemoryTag } from "./MemoryTag";
import { SourceBadge } from "./SourceBadge";

interface TimelineCardProps {
  memory: Memory;
  muted?: boolean;
  onOpen: () => void;
}

export function TimelineCard({ memory, muted = false, onOpen }: TimelineCardProps) {
  return (
    <article className="timeline-item">
      <div className={`timeline-marker ${muted ? "timeline-marker--muted" : ""}`} aria-hidden="true" />
      <button className="memory-card memory-card--button" type="button" onClick={onOpen}>
        <div className="memory-card__meta">
          <time>{memory.time}</time>
          <SourceBadge label={memory.source} type={memory.sourceType} />
        </div>

        {memory.image ? <img className="memory-card__image" src={memory.image} alt={memory.imageAlt ?? ""} /> : null}

        <p className="memory-card__content">{memory.summary}</p>

        <div className="memory-card__tags" aria-label="Memory tags">
          {memory.tags.map((tag) => (
            <MemoryTag key={tag} label={tag} />
          ))}
        </div>
      </button>
    </article>
  );
}
