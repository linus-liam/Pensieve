import { useEffect } from "react";
import { Box, Notification } from "@mantine/core";

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

  if (!show) return null;

  return (
    <Box
      bottom="md"
      pos="fixed"
      right="md"
      style={{ width: "min(360px, calc(100vw - 32px))", zIndex: 1000 }}
    >
      <Notification
        color="green"
        role="status"
        title="Saved to your memories"
        withCloseButton={false}
        aria-live="polite"
      >
        We'll remember this for you.
      </Notification>
    </Box>
  );
}
