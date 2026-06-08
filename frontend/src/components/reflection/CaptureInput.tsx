import { useEffect, useMemo, useRef } from "react";

interface CaptureInputProps {
  value: string;
  canSave: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function CaptureInput({ value, canSave, onChange, onSave }: CaptureInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const words = useMemo(() => wordCount(value), [value]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <>
      <section className="capture-field" aria-label="Capture a thought">
        <div className="capture-prompt">
          <h2>What do you want to put down?</h2>
        </div>

        <textarea
          ref={textareaRef}
          className="capture-textarea"
          value={value}
          rows={4}
          placeholder="What's on your mind?"
          aria-label="What's on your mind?"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onSave();
            }
          }}
        />
      </section>

      <div className="capture-floating-bar" aria-label="Capture actions">
        <div className="capture-floating-bar__inner">
          <input
            className="capture-floating-bar__input"
            type="text"
            value={value}
            placeholder="Type anything..."
            aria-label="Quick capture"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
          />
          <div className="capture-floating-bar__actions">
            <button className="icon-action" type="button" aria-label="Record voice note">
              <span className="material-symbols-outlined" aria-hidden="true">
                mic
              </span>
            </button>
            <button className="icon-action" type="button" aria-label="Attach photo">
              <span className="material-symbols-outlined" aria-hidden="true">
                image
              </span>
            </button>
            <span className="capture-floating-bar__divider" aria-hidden="true" />
            <button
              className="icon-action icon-action--primary"
              type="button"
              disabled={!canSave}
              aria-label="Save memory"
              onClick={onSave}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                add_circle
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="capture-dock" aria-label="Capture toolbar">
        <div className="capture-dock__inner">
          <div className="capture-dock__tools">
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
          <div className="capture-dock__save">
            <span className="capture-dock__count">
              {words} {words === 1 ? "word" : "words"}
            </span>
            <button
              className="capture-dock__button"
              type="button"
              disabled={!canSave}
              aria-label="Save memory"
              onClick={onSave}
            >
              Save Thought
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
