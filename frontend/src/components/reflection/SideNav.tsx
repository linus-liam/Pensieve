import { NavLink, Stack, Text, Title } from "@mantine/core";

type Page = "capture" | "memories";

interface SideNavProps {
  page: Page;
  onNavigate: (page: Page) => void;
}

export function SideNav({ page, onNavigate }: SideNavProps) {
  return (
    <Stack aria-label="Main navigation" component="nav" gap="lg">
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
  );
}
