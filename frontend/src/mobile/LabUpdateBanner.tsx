import { useEffect, useState } from "react";
import { Alert, Button, Group, Text } from "@mantine/core";
import { labUpdateReadyEvent } from "./lab";

export function LabUpdateBanner() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const show = () => setReady(true);
    window.addEventListener(labUpdateReadyEvent, show);
    return () => window.removeEventListener(labUpdateReadyEvent, show);
  }, []);

  if (!ready) return null;
  return <Alert color="blue" title="Pensieve Lab 有新版" role="status">
    <Group justify="space-between" align="center" gap="sm">
      <Text size="sm">刷新后立即使用；当前设备里的聊天不会被清除。</Text>
      <Button size="xs" onClick={() => window.location.reload()}>刷新到新版</Button>
    </Group>
  </Alert>;
}
