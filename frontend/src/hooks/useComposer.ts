import { useState, useRef, useEffect, type RefObject } from "react";

interface ComposerState {
  value: string;
  setValue: (v: string) => void;
  ref: RefObject<HTMLTextAreaElement>;
  handleKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  submit: () => Promise<void>;
}

export function useComposer(
  onSubmit: (text: string) => boolean | Promise<boolean>,
  maxRows = 6
): ComposerState {
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

  const submit = async () => {
    const current = value;
    if (!current.trim()) return;

    const sent = await onSubmit(current);
    if (sent) setValue("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return { value, setValue, ref, handleKey, submit };
}
