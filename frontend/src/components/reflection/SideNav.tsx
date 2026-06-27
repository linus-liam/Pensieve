import { Button, NavLink, Stack, Text, Title } from "@mantine/core";

type Page = "capture" | "memories";

interface SideNavProps {
  page: Page;
  signingOut: boolean;
  userEmail: string | null;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}

export function SideNav({
  page,
  signingOut,
  userEmail,
  onNavigate,
  onSignOut,
}: SideNavProps) {
  return (
    <Stack aria-label="Main navigation" component="nav" gap="lg" h="100%" justify="space-between">
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={1} size="h3">
            Pensieve
          </Title>
          <Text c="dimmed" size="sm">
            Memory capture
          </Text>
        </Stack>

        <Stack gap="xs">
          <NavLink
            active={page === "capture"}
            component="button"
            label="Capture"
            variant="light"
            onClick={() => onNavigate("capture")}
          />
          <NavLink
            active={page === "memories"}
            component="button"
            label="Memories"
            variant="light"
            onClick={() => onNavigate("memories")}
          />
        </Stack>
      </Stack>

      <Stack gap={6}>
        <Text c="dimmed" size="xs">
          Signed in
        </Text>
        <Text lineClamp={1} size="sm">
          {userEmail ?? "Google account"}
        </Text>
        <Button
          fullWidth
          loading={signingOut}
          radius="sm"
          size="xs"
          variant="default"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      </Stack>
    </Stack>
  );
}
