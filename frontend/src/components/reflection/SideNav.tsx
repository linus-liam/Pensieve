import { localMode } from "../../local";
import { Button, NavLink, Stack, Text, Title } from "@mantine/core";
import { BookOpen, History, PenLine, Settings } from "lucide-react";

type Page = "capture" | "memories";

interface SideNavProps {
  page: Page;
  signingOut: boolean;
  userEmail: string | null;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  onHistory?: () => void;
  onSettings?: () => void;
}

export function SideNav({
  page,
  signingOut,
  userEmail,
  onNavigate,
  onSignOut,
  onHistory,
  onSettings,
}: SideNavProps) {
  return (
    <Stack aria-label="Main navigation" component="nav" gap="lg" h="100%" justify="space-between">
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={1} size="h3">
            Pensieve
          </Title>
          <Text c="dimmed" size="sm">
            {localMode ? "留一点空间给自己" : "Memory capture"}
          </Text>
        </Stack>

        <Stack gap="xs">
          <NavLink
            active={page === "capture"}
            aria-current={page === "capture" ? "page" : undefined}
            component="button"
            label={localMode ? "聊一会儿" : "Capture"}
            leftSection={<PenLine aria-hidden="true" size={16} strokeWidth={1.9} />}
            variant="light"
            onClick={() => onNavigate("capture")}
          />
          {localMode && <NavLink component="button" label="过去的聊天" leftSection={<History size={16} />} onClick={onHistory} />}
          <NavLink
            active={page === "memories"}
            aria-current={page === "memories" ? "page" : undefined}
            component="button"
            label={localMode ? "记忆" : "Memories"}
            leftSection={<BookOpen aria-hidden="true" size={16} strokeWidth={1.9} />}
            variant="light"
            onClick={() => onNavigate("memories")}
          />
        </Stack>
      </Stack>

      <Stack gap={6}>
        {localMode && <NavLink component="button" label="设置" leftSection={<Settings size={16} />} onClick={onSettings} />}
        <Text c="dimmed" size="xs">
          {localMode ? "本地个人空间" : "Signed in"}
        </Text>
        <Text lineClamp={1} size="sm">
          {localMode ? "内容保存在这台电脑" : userEmail ?? "Google account"}
        </Text>
        {!localMode && <Button
          fullWidth
          loading={signingOut}
          radius="sm"
          size="xs"
          variant="default"
          onClick={onSignOut}
        >
          Sign out
        </Button>}
      </Stack>
    </Stack>
  );
}
