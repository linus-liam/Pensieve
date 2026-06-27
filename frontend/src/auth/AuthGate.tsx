import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useState, type ReactNode } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { useAuth } from "./AuthProvider";

interface AuthGateProps {
  children: ReactNode;
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
      <Center mih="100vh" p="md">
        <Stack align="center" gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Checking your session...</Text>
        </Stack>
      </Center>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <Center mih="100vh" p="md">
        <Paper maw={420} p="lg" radius="md" shadow="none" withBorder>
          <Stack gap="sm">
            <Title order={1} size="h3">
              Configure Supabase
            </Title>
            <Text c="dimmed" size="sm">
              Add your Supabase URL and anon key to the frontend environment before signing in.
            </Text>
          </Stack>
        </Paper>
      </Center>
    );
  }

  if (!session) {
    return (
      <Center mih="100vh" p="md">
        <Paper maw={420} p="lg" radius="md" shadow="none" withBorder>
          <Stack gap="md">
            <Stack gap={4}>
              <Title order={1} size="h3">
                Pensieve
              </Title>
              <Text c="dimmed" size="sm">
                Sign in to keep your memories private.
              </Text>
            </Stack>

            {error ? (
              <Alert color="red" role="alert" title="Could not sign in">
                {error}
              </Alert>
            ) : null}

            <Button fullWidth loading={submitting} radius="sm" onClick={handleGoogleSignIn}>
              Continue with Google
            </Button>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return children;
}
