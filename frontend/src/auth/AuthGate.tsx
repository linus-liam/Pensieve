import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useState, type FormEvent, type ReactNode } from "react";
import { isSupabaseConfigured } from "./supabaseClient";
import { useAuth } from "./AuthProvider";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { error, loading, session, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const ok = await signInWithEmail(email.trim());
    if (ok) setEmailSent(true);

    setSubmitting(false);
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

            {emailSent ? (
              <Alert color="green" title="Check your email">
                Open the sign-in link in the message from Supabase.
              </Alert>
            ) : null}

            <form onSubmit={handleSubmit}>
              <Stack gap="sm">
                <TextInput
                  autoComplete="email"
                  label="Email"
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
                <Button fullWidth loading={submitting} radius="sm" type="submit">
                  Send sign-in link
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Center>
    );
  }

  return children;
}
