import { useState, useRef, useEffect, type RefObject } from "react";

interface ComposerState {
  value: string;
  setValue: (v: string) => void;
  ref: RefObject<HTMLTextAreaElement>;
  handleKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useComposer(onSubmit: (text: string) => void, maxRows = 6): ComposerState {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const max = lineHeight * maxRows + 16;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [value, maxRows]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const v = value;
      setValue("");
      onSubmit(v);
    }
  };

  return { value, setValue, ref, handleKey };
}
