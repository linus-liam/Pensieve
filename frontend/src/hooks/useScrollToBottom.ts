import { useEffect, type RefObject } from "react";

export function useScrollToBottom(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
