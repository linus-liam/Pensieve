import { Badge, Button } from "@mantine/core";

interface UnavailableIconButtonProps {
  label: string;
  icon?: string;
  className?: string;
}

export function UnavailableIconButton(props: UnavailableIconButtonProps) {
  const { label, className } = props;
  const unavailableLabel = `${label} (not available yet)`;

  return (
    <Button
      className={className}
      type="button"
      color="gray"
      disabled
      radius="sm"
      size="xs"
      variant="default"
      aria-disabled="true"
      aria-label={unavailableLabel}
      title={unavailableLabel}
    >
      {label}
      <Badge color="gray" ml="xs" radius="sm" size="xs" variant="light">
        Soon
      </Badge>
    </Button>
  );
}
