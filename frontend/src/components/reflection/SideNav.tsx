import { Button, NavLink, Stack, Text } from "@mantine/core";
import { BookOpen, LogOut, PenLine } from "lucide-react";

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
    <Stack className="side-nav" h="100%" justify="space-between">
      <Stack gap={42}>
        <Text className="brand-wordmark">Pensieve</Text>

        <Stack aria-label="Main navigation" component="nav" gap={6}>
          <NavLink
            active={page === "capture"}
            aria-current={page === "capture" ? "page" : undefined}
            className="side-nav__link"
            component="button"
            label="Capture"
            leftSection={<PenLine aria-hidden="true" size={17} strokeWidth={1.8} />}
            variant="light"
            onClick={() => onNavigate("capture")}
          />
          <NavLink
            active={page === "memories"}
            aria-current={page === "memories" ? "page" : undefined}
            className="side-nav__link"
            component="button"
            label="Memories"
            leftSection={<BookOpen aria-hidden="true" size={17} strokeWidth={1.8} />}
            variant="light"
            onClick={() => onNavigate("memories")}
          />
        </Stack>
      </Stack>

      <Stack className="side-nav__account" gap="xs">
        <Text className="side-nav__email" lineClamp={1}>
          {userEmail ?? "Google account"}
        </Text>
        <Button
          className="button-secondary side-nav__sign-out"
          fullWidth
          leftSection={<LogOut aria-hidden="true" size={15} strokeWidth={1.8} />}
          loading={signingOut}
          size="sm"
          variant="subtle"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      </Stack>
    </Stack>
  );
}
