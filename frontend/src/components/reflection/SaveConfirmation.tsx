import { useEffect } from "react";

interface SaveConfirmationProps {
  show: boolean;
  onDone: () => void;
}

export function SaveConfirmation({ show, onDone }: SaveConfirmationProps) {
  useEffect(() => {
    if (!show) return;

    const timeout = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timeout);
  }, [onDone, show]);

  return (
    <div className={`save-confirmation ${show ? "save-confirmation--visible" : ""}`} role="status" aria-live="polite">
      <div className="save-confirmation__mark" aria-hidden="true">
        ✓
      </div>
      <div>
        <p>Saved to your memories</p>
        <span>We'll remember this for you.</span>
      </div>
    </div>
  );
}
