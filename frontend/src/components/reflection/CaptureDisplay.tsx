import { Stack, Title } from "@mantine/core";

export function CaptureDisplay() {
  return (
    <section aria-label="Capture a thought">
      <Stack gap="xs">
        <Title order={2} size="h2">
          What do you want to put down?
        </Title>
      </Stack>
    </section>
  );
}
