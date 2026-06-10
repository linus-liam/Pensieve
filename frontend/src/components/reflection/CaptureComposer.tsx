import { useMemo } from "react";

interface CaptureComposerProps {
  value: string;
  canSave: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CaptureComposer({ value, canSave, onChange, onSave }: CaptureComposerProps) {
  const words = useMemo(() => wordCount(value), [value]);

  return (
    <div className="capture-composer" aria-label="Capture actions">
      <form
        className="capture-composer__inner"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="capture-composer__tools">
          <button className="icon-action" type="button" aria-label="Attach photo">
            <span className="material-symbols-outlined" aria-hidden="true">
              image
            </span>
          </button>
          <button className="icon-action" type="button" aria-label="Record voice note">
            <span className="material-symbols-outlined" aria-hidden="true">
              mic
            </span>
          </button>
          <button className="icon-action" type="button" aria-label="Add mood">
            <span className="material-symbols-outlined" aria-hidden="true">
              sentiment_satisfied
            </span>
          </button>
        </div>

        <input
          className="capture-composer__input"
          type="text"
          value={value}
          placeholder="What's on your mind?"
          aria-label="What's on your mind?"
          onChange={(event) => onChange(event.target.value)}
        />

        <span className="capture-composer__count">
          {words} {words === 1 ? "word" : "words"}
        </span>

        <button
          className="icon-action icon-action--primary"
          type="submit"
          disabled={!canSave}
          aria-label="Save memory"
        >
          <span
            className="material-symbols-outlined"
            aria-hidden="true"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            add_circle
          </span>
        </button>
      </form>
    </div>
  );
}
