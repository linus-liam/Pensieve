import { useEffect, useState } from "react";

const key = "pensieve.cloud-ai-consent.v1";
const changed = "pensieve:ai-consent";
let current: "enabled" | "disabled" | null = null;
function read() {
  try {
    const stored = window.localStorage.getItem(key);
    current = stored === "enabled" || stored === "disabled" ? stored : null;
  } catch { /* This tab still works without browser storage. */ }
  return current;
}

// Only a preference lives in browser storage. Conversation content stays on disk.
export function useLocalAIConsent() {
  const [consent, update] = useState(read);
  useEffect(() => {
    const sync = () => update(read());
    window.addEventListener(changed, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(changed, sync); window.removeEventListener("storage", sync); };
  }, []);
  function setConsent(value: boolean) {
    current = value ? "enabled" : "disabled";
    try { window.localStorage.setItem(key, value ? "enabled" : "disabled"); } catch { /* Keep the choice for this tab. */ }
    update(current);
    window.dispatchEvent(new Event(changed));
  }
  return [consent === "enabled", setConsent, consent !== null] as const;
}
