import {
  Alert,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useState, type ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { isSupabaseConfigured } from "./supabaseClient";
import { useAuth } from "./AuthProvider";

interface AuthGateProps {
  children: ReactNode;
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="auth-google-mark" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z"
        fill="#4285f4"
      />
      <path
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.97-3.39.97-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
        fill="#34a853"
      />
      <path
        d="M6.39 13.87A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.62Z"
        fill="#fbbc05"
      />
      <path
        d="M12 6c1.47 0 2.79.51 3.82 1.5l2.88-2.88A9.66 9.66 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z"
        fill="#ea4335"
      />
    </svg>
  );
}

export function AuthGate({ children }: AuthGateProps) {
  const { error, loading, session, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Center className="auth-screen" component="main" mih="100dvh" p="xl">
        <Stack align="center" className="auth-loading" gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Checking your session…</Text>
        </Stack>
      </Center>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <Center className="auth-screen" component="main" mih="100dvh" p="xl">
        <Stack className="auth-screen__content" gap="sm" maw={420} w="100%">
          <Title order={1} size="h3">
            Configure Supabase
          </Title>
          <Text c="dimmed" size="sm">
            Add your Supabase URL and anon key to the frontend environment before signing in.
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!session) {
    return (
      <Box className="auth-screen auth-screen--signin" component="main" mih="100dvh">
        <section aria-hidden="true" className="auth-visual">
          <span className="auth-visual__monogram">P</span>
        </section>

        <Center className="auth-panel" p="xl">
          <Stack className="auth-screen__content" gap="xl" maw={400} w="100%">
            <Stack gap="xs">
              <Title className="auth-screen__title" order={1}>Pensieve</Title>
              <Text className="auth-screen__intro">
                A quiet place for the moments you want to keep.
              </Text>
            </Stack>

            {error ? (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            ) : null}

            <Button
              className="auth-screen__action"
              fullWidth
              leftSection={<GoogleMark />}
              loading={submitting}
              size="md"
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </Button>

            <Group align="flex-start" className="auth-screen__privacy" gap="sm" wrap="nowrap">
              <LockKeyhole aria-hidden="true" size={17} strokeWidth={1.8} />
              <Text size="sm">
                Your memories are stored privately in your account and are never public. Google
                is used only to secure your sign-in.
              </Text>
            </Group>
          </Stack>
        </Center>
      </Box>
    );
  }

  return children;
}
