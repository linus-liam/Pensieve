# Conversation-First UI Facelift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pensieve feel like a focused, natural memory conversation while simplifying navigation, saved-memory browsing, detail views, and supporting states.

**Architecture:** Keep the existing React, Mantine, hash routing, API, and durable reflection flow. Put global visual decisions in a small Mantine theme plus semantic CSS, and keep interaction state inside the existing feature components. No backend contract changes are required.

**Tech Stack:** React 19, TypeScript, Mantine 9, Lucide React, Vitest, Testing Library, Vite.

## Global Constraints

- Keep Mantine and add no dependencies.
- Do not change the reflection model, prompts, workflow contract, APIs, or persistence.
- Use no gradients, glow, glass effects, neon accents, sparkle imagery, nested cards, decorative badges, or inferred metadata.
- Keep copy short; do not repeat visible context with labels or helper text.
- Maintain 44-by-44-pixel touch targets, keyboard focus, mobile safe areas, and reduced-motion support.
- Review the running UI at desktop and mobile sizes after each coherent area.
- Do not commit or push facelift changes; leave the working tree available for local review.

## File Map

- Create `frontend/src/theme.ts`: Mantine colors, type, radii, and component defaults.
- Modify `frontend/src/App.tsx`: theme, shell, page states, retry, and post-save actions.
- Modify `frontend/src/App.test.tsx`: revised interaction and semantic coverage.
- Modify `frontend/src/styles.css`: shell, conversation, list, detail, focus, and responsive styles.
- Modify `frontend/src/auth/AuthGate.tsx`: simplified authentication layouts.
- Modify `frontend/src/components/reflection/SideNav.tsx`: quieter desktop navigation.
- Modify `frontend/src/components/reflection/MobileBottomNav.tsx`: accessible mobile navigation.
- Modify `frontend/src/components/reflection/CaptureComposer.tsx`: continuous chat and docked composer.
- Modify `frontend/src/components/reflection/MemoryProposalCard.tsx`: progressive proposal editing and saved actions.
- Modify `frontend/src/components/reflection/Timeline.tsx`: grouped memory list.
- Modify `frontend/src/components/reflection/TimelineCard.tsx`: clickable memory row.
- Modify `frontend/src/components/reflection/MemoryDetail.tsx`: document-like detail.
- Modify `frontend/src/components/reflection/MemoryTranscript.tsx`: collapsed source conversation.
- Delete `frontend/src/components/reflection/MemoryTag.tsx` and `SourceBadge.tsx`: obsolete metadata UI.

---

### Task 1: Theme, Authentication, and Shell

**Files:**
- Create: `frontend/src/theme.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/auth/AuthGate.tsx`
- Modify: `frontend/src/components/reflection/SideNav.tsx`
- Modify: `frontend/src/components/reflection/MobileBottomNav.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `pensieveTheme` consumed by `MantineProvider`.
- Preserves: existing navigation and authentication callback signatures.
- Produces CSS landmarks: `.app-content`, `.auth-screen`, `.side-nav`, `.mobile-app-header`, `.mobile-bottom-nav`.

- [ ] **Step 1: Write failing shell tests**

Add to `App.test.tsx`:

```tsx
it("shows a concise sign-in screen", async () => {
  authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  vi.stubGlobal("fetch", vi.fn());
  renderApp();

  expect(await screen.findByRole("heading", { name: "Pensieve" })).toBeInTheDocument();
  expect(screen.getByText("A quiet place for the moments you want to keep.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  expect(screen.queryByText("Memory capture")).not.toBeInTheDocument();
});

it("keeps account actions outside primary navigation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
  renderApp();

  const navigation = await findMainNavigation();
  expect(within(navigation).getByRole("button", { name: "Capture" })).toBeInTheDocument();
  expect(within(navigation).getByRole("button", { name: "Memories" })).toBeInTheDocument();
  expect(within(navigation).queryByText("Signed in")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Confirm the tests fail**

Run:

```bash
cd frontend && npm test -- App.test.tsx -t "concise sign-in|account actions"
```

Expected: FAIL because the old sign-in copy and **Signed in** label remain.

- [ ] **Step 3: Add the theme**

Create `frontend/src/theme.ts`:

```ts
import { createTheme } from "@mantine/core";

export const pensieveTheme = createTheme({
  primaryColor: "slate",
  primaryShade: 7,
  colors: {
    slate: [
      "#f2f5f4", "#e4eae8", "#cad6d2", "#a9bdb6", "#7e9c92",
      "#5f8277", "#486a60", "#38554d", "#2f4640", "#293b37",
    ],
  },
  defaultRadius: "sm",
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: "600",
  },
  components: {
    Button: { defaultProps: { radius: "sm" } },
    TextInput: { defaultProps: { radius: "sm" } },
    Textarea: { defaultProps: { radius: "md" } },
  },
});
```

Apply it in `App.tsx`:

```tsx
import { pensieveTheme } from "./theme";

<MantineProvider defaultColorScheme="light" theme={pensieveTheme}>
  <AuthGate><AuthenticatedApp /></AuthGate>
</MantineProvider>
```

- [ ] **Step 4: Simplify authentication and navigation markup**

Replace the unauthenticated card in `AuthGate.tsx` with:

```tsx
<Center className="auth-screen" component="main" mih="100dvh" p="xl">
  <Stack className="auth-screen__content" gap="xl" maw={400} w="100%">
    <Stack gap="xs">
      <Title order={1}>Pensieve</Title>
      <Text c="dimmed">A quiet place for the moments you want to keep.</Text>
    </Stack>
    {error ? <Alert color="red" role="alert">{error}</Alert> : null}
    <Button fullWidth loading={submitting} size="md" onClick={handleGoogleSignIn}>
      Continue with Google
    </Button>
  </Stack>
</Center>
```

Use the same unboxed layout for loading and configuration states. Replace the `SideNav.tsx` return value with:

```tsx
<Stack className="side-nav" h="100%" justify="space-between">
  <Stack gap="xl">
    <Title order={1} size="h3">Pensieve</Title>
    <Stack aria-label="Main navigation" component="nav" gap={4}>
      <NavLink active={page === "capture"} aria-current={page === "capture" ? "page" : undefined}
        className="side-nav__link" component="button" label="Capture"
        leftSection={<PenLine aria-hidden="true" size={16} />} onClick={() => onNavigate("capture")} />
      <NavLink active={page === "memories"} aria-current={page === "memories" ? "page" : undefined}
        className="side-nav__link" component="button" label="Memories"
        leftSection={<BookOpen aria-hidden="true" size={16} />} onClick={() => onNavigate("memories")} />
    </Stack>
  </Stack>
  <Stack className="side-nav__account" gap={4}>
    <Text c="dimmed" lineClamp={1} size="xs">{userEmail ?? "Google account"}</Text>
    <Button fullWidth loading={signingOut} size="xs" variant="subtle" onClick={onSignOut}>Sign out</Button>
  </Stack>
</Stack>
```

Change the desktop navbar width from 240 to 220 pixels. Replace the mobile account bar with:

```tsx
<Group className="mobile-app-header" wrap="nowrap">
  <Text fw={600}>Pensieve</Text>
  <Button aria-label="Sign out" loading={signingOut} size="compact-sm" variant="subtle" onClick={signOut}>
    Sign out
  </Button>
</Group>
```

Keep the two existing `MobileBottomNav` destinations and add a minimum 48-pixel item height in CSS.

- [ ] **Step 5: Add the visual foundation**

Replace root and shell rules in `styles.css` with:

```css
:root {
  color-scheme: light;
  --pensieve-canvas: #f7f6f2;
  --pensieve-surface: #fffefa;
  --pensieve-ink: #202522;
  --pensieve-muted: #68716c;
  --pensieve-border: #dedfd9;
  --pensieve-user: #e8eeeb;
}
html, body, #root { min-height: 100%; }
body { min-width: 320px; margin: 0; background: var(--pensieve-canvas); color: var(--pensieve-ink); }
* { box-sizing: border-box; }
.app-content { min-height: 100dvh; }
.auth-screen { background: var(--pensieve-canvas); }
.auth-screen__content { padding-block: clamp(32px, 8vh, 88px); }
.side-nav { padding: 20px 16px; }
.side-nav__link { border-radius: 6px; min-height: 44px; }
.side-nav__account { border-top: 1px solid var(--pensieve-border); padding-top: 14px; }
.mobile-app-header, .mobile-bottom-nav { display: none; }
:where(a, button, textarea, input, summary):focus-visible {
  outline: 2px solid var(--mantine-color-slate-6);
  outline-offset: 3px;
}
```

- [ ] **Step 6: Verify and review**

Run:

```bash
cd frontend && npm test -- App.test.tsx && npm run typecheck
```

Expected: all App tests PASS and TypeScript exits 0 after updating old copy assertions to **Capture a memory**. Review sign-in and shell at desktop and mobile widths. Do not commit.

---

### Task 2: Natural Capture Conversation

**Files:**
- Modify: `frontend/src/components/reflection/CaptureComposer.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Adds to `CaptureComposerProps`: `onRetry: () => void`.
- Preserves: `CaptureChatMessage.status?: "sending" | "error"`.
- Produces: Enter submits; Shift+Enter inserts a newline.
- Produces CSS landmarks: `.capture-workspace`, `.capture-conversation`, `.capture-message`, `.capture-composer`.

- [ ] **Step 1: Replace obsolete composer tests**

Remove word-count and Ctrl+Enter tests. Add:

```tsx
it("submits with Enter and keeps Shift+Enter as a line break", async () => {
  const user = userEvent.setup();
  const fetchMock = createSessionFetch([
    reflectionPair("A quiet\nthought", earlyReflectionReply.reply),
  ]);
  vi.stubGlobal("fetch", fetchMock);
  renderApp();

  const composer = await screen.findByLabelText("Message to Pensieve");
  await user.type(composer, "A quiet{Shift>}{Enter}{/Shift}thought");
  expect(composer).toHaveValue("A quiet\nthought");
  await user.keyboard("{Enter}");
  expect(await screen.findByText(earlyReflectionReply.reply)).toBeInTheDocument();
});

it("shows failed delivery beside the message and retries it", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", createRetryFetchMock());
  renderApp();

  await user.type(await screen.findByLabelText("Message to Pensieve"), "The room was very quiet.");
  await user.keyboard("{Enter}");
  expect(await screen.findByText("Not sent")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("What could you hear in the room?")).toBeInTheDocument();
});
```

Add this helper beside `createSessionFetch` and use it in both retry tests:

```tsx
function createRetryFetchMock() {
  let attempts = 0;
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
    if (url === "/api/reflection-sessions/active") {
      return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
    }
    if (url === `/api/reflection-sessions/${reflectionSession.id}/messages`) {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse({ error: "AI provider unavailable", code: "ai_unavailable" }, { status: 503 });
      }
      return jsonResponse(
        reflectionPair("The room was very quiet.", "What could you hear in the room?"),
        { status: 201 }
      );
    }
    return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
  });
}
```

- [ ] **Step 2: Confirm the tests fail**

Run:

```bash
cd frontend && npm test -- App.test.tsx -t "Shift\+Enter|failed delivery"
```

Expected: FAIL because retry currently depends on the general send button and the old chat chrome remains.

- [ ] **Step 3: Flatten `CaptureComposer`**

Remove `Paper`, `wordCount`, `useMemo`, and speaker labels. Keep message/proposal mapping inside this structure:

```tsx
<section aria-labelledby="capture-heading" className="capture-workspace">
  <Stack gap={0} h="100%">
    <header className="capture-workspace__header">
      <Title id="capture-heading" order={1} size="h2">Capture a memory</Title>
    </header>
    <Box ref={messagesRef} aria-label="Memory capture conversation" aria-live="polite"
      className="capture-conversation" role="log">
      <Stack gap="lg">
        {messages.map((message) => (
          <Box className={`capture-message capture-message--${message.role}`}
            data-status={message.status} key={message.id}>
            {message.role === "assistant" ? <span aria-hidden="true" className="capture-message__mark" /> : null}
            <Text className="capture-message__text">{message.content}</Text>
            {message.status === "sending" ? <Text c="dimmed" role="status" size="xs">Sending…</Text> : null}
            {message.status === "error" ? (
              <Group gap="xs">
                <Text c="red" size="xs">Not sent</Text>
                <Button size="compact-xs" variant="subtle" onClick={onRetry}>Try again</Button>
              </Group>
            ) : null}
            {message.proposal && message.proposalStatus !== "dismissed" ? (
              <MemoryProposalCard
                proposal={message.proposal}
                saved={message.proposalStatus === "saved"}
                saving={proposalSavingId === message.id}
                onChange={(proposal) => onChangeProposal(message.id, proposal)}
                onDismiss={() => onDismissProposal(message.id)}
                onSave={() => onSaveProposal(message.id)}
              />
            ) : null}
          </Box>
        ))}
      </Stack>
    </Box>
    <Box className="capture-composer" component="form" onSubmit={submitForm}>
      <Textarea aria-label="Message to Pensieve" autosize maxRows={7} minRows={1}
        placeholder="Share what you remember…" value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSave(); }
        }}
        rightSection={<ActionIcon aria-label="Send message" disabled={!canSave || saving}
          loading={saving} size={40} type="submit"><ArrowUp aria-hidden="true" size={18} /></ActionIcon>}
        rightSectionPointerEvents="all" />
      <Text className="capture-composer__hint" c="dimmed" size="xs">
        Enter to send · Shift+Enter for a new line
      </Text>
    </Box>
  </Stack>
</section>
```

Define `submitForm` to prevent default and call `onSave`. In `App.tsx`, extract the current retry path into `retryReflectionMessage` and pass it as `onRetry`; it must reuse `retryMessage.clientMessageId` and not depend on composer contents.

- [ ] **Step 4: Add conversation styles**

```css
.capture-workspace { height: calc(100dvh - 48px); }
.capture-workspace__header { padding: 8px 0 24px; }
.capture-conversation { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 4px 32px; }
.capture-message { max-width: min(78%, 580px); position: relative; }
.capture-message--assistant { align-self: flex-start; padding-left: 22px; }
.capture-message--user { align-self: flex-end; background: var(--pensieve-user); border-radius: 14px 14px 4px; padding: 10px 13px; }
.capture-message__mark { background: var(--mantine-color-slate-6); border-radius: 50%; height: 7px; left: 1px; position: absolute; top: 9px; width: 7px; }
.capture-message__text { line-height: 1.58; white-space: pre-wrap; }
.capture-composer { background: color-mix(in srgb, var(--pensieve-canvas) 94%, transparent); border-top: 1px solid var(--pensieve-border); bottom: 0; padding: 16px 0 8px; position: sticky; }
.capture-composer__hint { margin-top: 6px; text-align: right; }
```

Delete old bubble, speaker, footer, and word-count styles.

- [ ] **Step 5: Verify and review**

Run `cd frontend && npm test -- App.test.tsx && npm run typecheck`.

Expected: all tests PASS and TypeScript exits 0. Review greeting, multi-turn, sending, failure, and retry states at desktop and mobile sizes. Confirm the latest message stays above the sticky composer and mobile nav. Do not commit.

---

### Task 3: Progressive Proposal and Saved Completion

**Files:**
- Modify: `frontend/src/components/reflection/CaptureComposer.tsx`
- Modify: `frontend/src/components/reflection/MemoryProposalCard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Adds to `CaptureChatMessage`: `savedMemoryId?: string`.
- Adds to `MemoryProposalCardProps`: `messageId`, `savedMemoryId`, `startingNew`, `onStartNew`, and `onViewMemory`.
- Produces: `startNewReflection(): Promise<void>` using the existing `api.createReflectionSession()`.
- Preserves edited title and summary exactly when calling `api.confirmReflectionMemory`.

- [ ] **Step 1: Write proposal progression tests**

Replace the always-editable proposal expectations with:

```tsx
it("shows a readable proposal before revealing edit fields", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", createSessionFetch([
    reflectionPair(firstEntry.raw_input, proposalReflectionReply.reply, reflectionProposal),
  ]));
  renderApp();

  await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("heading", { name: "Memory ready" })).toBeInTheDocument();
  expect(screen.getByText(reflectionProposal.title)).toBeInTheDocument();
  expect(screen.queryByLabelText("Memory title")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByLabelText("Memory title")).toHaveValue(reflectionProposal.title);
  expect(screen.getByLabelText("Memory summary")).toHaveValue(reflectionProposal.summary);
});

it("offers the saved memory and a fresh capture after saving", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", createSessionFetch([
    reflectionPair(firstEntry.raw_input, proposalReflectionReply.reply, reflectionProposal),
  ]));
  renderApp();

  await user.type(await screen.findByLabelText("Message to Pensieve"), firstEntry.raw_input);
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("button", { name: "Save memory" }));

  expect(await screen.findByText("Memory saved")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "View memory" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start a new memory" })).toBeInTheDocument();
});
```

Extend `createSessionFetch` so `POST /api/reflection-sessions` returns a second session with a new greeting. Add a test clicking **Start a new memory** and asserting that greeting replaces the completed session.

- [ ] **Step 2: Confirm the tests fail**

Run:

```bash
cd frontend && npm test -- App.test.tsx -t "readable proposal|saved memory|fresh capture"
```

Expected: FAIL because proposal inputs are always open and saved proposals have no next actions.

- [ ] **Step 3: Implement readable and editable modes**

In `MemoryProposalCard.tsx`, add `const [editing, setEditing] = useState(false)` and render:

```tsx
<section aria-labelledby={`proposal-${messageId}`} className="memory-proposal">
  <Stack gap="md">
    <Title id={`proposal-${messageId}`} order={3} size="h4">
      {saved ? "Memory saved" : "Memory ready"}
    </Title>
    {editing && !saved ? (
      <Stack gap="sm">
        <TextInput aria-label="Memory title" maxLength={120} value={proposal.title}
          onChange={(event) => onChange({ ...proposal, title: event.currentTarget.value })} />
        <Textarea aria-label="Memory summary" autosize maxLength={600} minRows={3}
          value={proposal.summary}
          onChange={(event) => onChange({ ...proposal, summary: event.currentTarget.value })} />
      </Stack>
    ) : (
      <Stack gap={6}>
        <Text fw={600}>{proposal.title}</Text>
        <Text>{proposal.summary}</Text>
      </Stack>
    )}
    {!saved ? (
      <Group gap="xs">
        <Button disabled={!proposal.title.trim() || !proposal.summary.trim()} loading={saving} onClick={onSave}>Save memory</Button>
        <Button disabled={saving} variant="subtle" onClick={onDismiss}>Keep talking</Button>
        <Button disabled={saving} variant="subtle" onClick={() => setEditing((value) => !value)}>
          {editing ? "Done editing" : "Edit"}
        </Button>
      </Group>
    ) : (
      <Group gap="xs">
        <Button disabled={!savedMemoryId} onClick={() => savedMemoryId && onViewMemory(savedMemoryId)}>View memory</Button>
        <Button loading={startingNew} variant="default" onClick={onStartNew}>Start a new memory</Button>
      </Group>
    )}
  </Stack>
</section>
```

- [ ] **Step 4: Connect saved and new-session state**

After `confirmReflectionMemory` resolves in `App.tsx`, retain the returned id:

```tsx
setCaptureMessages((current) => current.map((message) =>
  message.id === messageId
    ? { ...message, proposalStatus: "saved" as const, savedMemoryId: entry.id }
    : message
));
```

Add:

```tsx
const [startingNew, setStartingNew] = useState(false);

const startNewReflection = useCallback(async () => {
  if (startingNew) return;
  setStartingNew(true);
  setError(null);
  try {
    const detail = await api.createReflectionSession();
    setReflectionSession(detail.session);
    setCaptureMessages(detail.messages.map(toCaptureMessage));
    setDraft("");
    setRetryMessage(null);
  } catch (startError) {
    setError(startError instanceof Error ? startError.message : "Could not start a new memory");
  } finally {
    setStartingNew(false);
  }
}, [startingNew]);
```

Pass `startingNew`, `startNewReflection`, and an `onViewMemory` callback through `CaptureComposer`. The view callback must find the saved entry already inserted into `entries`, call `toMemory`, then use existing `openMemory` routing.

- [ ] **Step 5: Restyle the proposal**

```css
.memory-proposal {
  background: var(--pensieve-surface);
  border: 1px solid var(--pensieve-border);
  border-radius: 10px;
  margin-top: 14px;
  max-width: 580px;
  padding: 18px;
}
.memory-proposal .mantine-Button-root { min-height: 40px; }
```

Delete the yellow warning background and border.

- [ ] **Step 6: Verify and review**

Run `cd frontend && npm test -- App.test.tsx && npm run typecheck`.

Expected: all tests PASS and TypeScript exits 0. Review proposal read, edit, keep talking, save progress/error, View memory, and Start a new memory states at desktop and mobile widths. Confirm no automatic redirect. Do not commit.

---

### Task 4: Memories List and Document Detail

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/reflection/Timeline.tsx`
- Modify: `frontend/src/components/reflection/TimelineCard.tsx`
- Modify: `frontend/src/components/reflection/MemoryDetail.tsx`
- Modify: `frontend/src/components/reflection/MemoryTranscript.tsx`
- Delete: `frontend/src/components/reflection/MemoryTag.tsx`
- Delete: `frontend/src/components/reflection/SourceBadge.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Preserves `TimelineProps`, `TimelineCardProps`, memory hash URLs, legacy editing, and linked transcript loading.
- `MemoryTranscript` gains only local disclosure state; its props remain unchanged.
- Produces CSS landmarks: `.memory-list`, `.memory-row`, `.memory-detail`, `.memory-transcript`.

- [ ] **Step 1: Write simplified list/detail tests**

Move these fixtures immediately after `reflectionGreeting` so the transcript test can reuse them:

```tsx
const linkedEntry = {
  ...firstEntry,
  session_id: reflectionSession.id,
  title: "The collapsed tent",
};
const sourceUserMessage = {
  ...reflectionGreeting,
  id: "99999999-9999-4999-8999-999999999999",
  role: "user" as const,
  content: "Dad laughed when our tent collapsed.",
};
const sourceAssistantMessage = {
  ...reflectionGreeting,
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  content: "What made that moment feel important to you?",
  metadata: { state: "exploring" },
};
```

```tsx
it("shows an empty state that returns to capture", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
  renderApp();
  await user.click(within(await findMainNavigation()).getByRole("button", { name: "Memories" }));

  expect(await screen.findByText("No memories yet")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Capture a memory" }));
  expect(await screen.findByRole("heading", { name: "Capture a memory" })).toBeInTheDocument();
});

it("keeps implementation metadata out of memory rows", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));
  renderApp();
  await userEvent.setup().click(within(await findMainNavigation()).getByRole("button", { name: "Memories" }));

  const row = await screen.findByRole("link", { name: new RegExp(firstEntry.ai_summary) });
  expect(within(row).queryByText("Text")).not.toBeInTheDocument();
  expect(within(row).queryByText("reflection")).not.toBeInTheDocument();
  expect(within(row).queryByText("Open memory")).not.toBeInTheDocument();
});

it("keeps a linked conversation collapsed until requested", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/memory-entries?limit=100") return jsonResponse([linkedEntry]);
    if (url === "/api/reflection-sessions/active") {
      return jsonResponse({ session: reflectionSession, messages: [reflectionGreeting] });
    }
    if (url === `/api/reflection-sessions/${reflectionSession.id}`) {
      return jsonResponse({
        session: { ...reflectionSession, status: "completed" },
        messages: [reflectionGreeting, sourceUserMessage, sourceAssistantMessage],
      });
    }
    return jsonResponse({ error: `Unexpected ${url}` }, { status: 500 });
  }));
  renderApp();
  await user.click(within(await findMainNavigation()).getByRole("button", { name: "Memories" }));
  await user.click(await screen.findByRole("link", { name: /The collapsed tent/ }));

  expect(await screen.findByRole("button", { name: "Show conversation" })).toBeInTheDocument();
  expect(screen.queryByText(sourceUserMessage.content)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Show conversation" }));
  expect(await screen.findByText(sourceUserMessage.content)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Hide conversation" })).toBeInTheDocument();
});
```

Delete the duplicate fixture declarations from the older transcript test. Rename the detail back action assertion to **Back to memories**.

- [ ] **Step 2: Confirm the tests fail**

Run:

```bash
cd frontend && npm test -- App.test.tsx -t "empty state|implementation metadata|collapsed"
```

Expected: FAIL because cards and metadata remain and transcripts open immediately.

- [ ] **Step 3: Convert timeline cards to grouped rows**

Keep `groupMemories` in `Timeline.tsx`, remove its divider/footer, and render each group as:

```tsx
<section aria-labelledby={`timeline-${day}`} key={day}>
  <Text c="dimmed" fw={600} id={`timeline-${day}`} mb="xs" size="xs">{day}</Text>
  <Stack gap={0}>
    {dayMemories.map((memory) => (
      <TimelineCard key={memory.id} memory={memory} onOpen={() => onOpenMemory(memory)} />
    ))}
  </Stack>
</section>
```

Replace `TimelineCard` with:

```tsx
<Box aria-label={`${memory.title}, ${memory.time}`} className="memory-row" component="a"
  href={`#memory/${encodeURIComponent(memory.id)}`} onClick={onOpen}>
  <Stack gap={4}>
    <Group align="baseline" justify="space-between" wrap="nowrap">
      <Title order={3} size="h4">{memory.title}</Title>
      <Text c="dimmed" component="time" size="xs">{memory.time}</Text>
    </Group>
    <Text c="dimmed" lineClamp={2}>{memory.summary}</Text>
  </Stack>
</Box>
```

Remove all tag/source imports and delete `MemoryTag.tsx` and `SourceBadge.tsx`.

- [ ] **Step 4: Simplify list states**

Remove the permanent Refresh button from `App.tsx`. Render loading with three Mantine `Skeleton` rows labelled **Loading memories**. Render empty and error states as:

```tsx
{error ? (
  <Group gap="sm" role="alert">
    <Text c="red" size="sm">{error}</Text>
    <Button size="compact-sm" variant="subtle" onClick={loadEntries}>Try again</Button>
  </Group>
) : null}
{!loading && memories.length === 0 ? (
  <Stack align="flex-start" gap="sm">
    <Text c="dimmed">No memories yet</Text>
    <Button variant="subtle" onClick={() => navigate("capture")}>Capture a memory</Button>
  </Stack>
) : null}
```

Keep existing rows visible during refresh.

- [ ] **Step 5: Make detail document-like and transcript collapsible**

Remove the detail `Paper` and use this complete article body while retaining the current delete modal below it:

```tsx
<article className="memory-detail">
  <Stack gap="xl">
    <Stack gap="sm">
      <Text c="dimmed" component="time" size="sm">{memory.day} · {memory.time}</Text>
      <Title order={1}>{memory.title}</Title>
      {memory.summary !== memory.title ? (
        <Text className="memory-detail__summary">{memory.summary}</Text>
      ) : null}
    </Stack>
    {memory.sessionId ? (
      transcript ? <MemoryTranscript messages={transcript} /> : (
        <Text c="dimmed" role="status">Loading conversation…</Text>
      )
    ) : (
      <Textarea aria-label="Original memory input" label="Original" minRows={6} value={value}
        onChange={(event) => onChange(event.currentTarget.value)} />
    )}
    {error ? <Alert color="red" role="alert">{error}</Alert> : null}
    <Group className="memory-detail__actions" justify="space-between">
      <Button className="memory-detail__delete" color="red" disabled={updating}
        variant="subtle" onClick={() => setDeleteOpen(true)}>Delete memory</Button>
      {!memory.sessionId ? (
        <Button disabled={!canUpdate || updating} loading={updating} onClick={onUpdate}>Save changes</Button>
      ) : null}
    </Group>
  </Stack>
</article>
```

Remove the extra **Memory detail** heading from `App.tsx` and rename its back control **Back to memories**.

In `MemoryTranscript.tsx`, add `const [opened, setOpened] = useState(false)` and use:

```tsx
<section className="memory-transcript">
  <Button aria-expanded={opened} variant="subtle" onClick={() => setOpened((value) => !value)}>
    {opened ? "Hide conversation" : "Show conversation"}
  </Button>
  <Collapse in={opened}>
    <Stack aria-label="Source conversation" gap="md" pt="md">
      {messages.map((message) => (
        <Box className={`transcript-message transcript-message--${message.role}`} key={message.id}>
          <Text size="sm">{message.content}</Text>
        </Box>
      ))}
    </Stack>
  </Collapse>
</section>
```

- [ ] **Step 6: Add list and detail styles**

```css
.memory-row { border-top: 1px solid var(--pensieve-border); color: inherit; display: block; padding: 16px 2px; text-decoration: none; }
.memory-row:last-child { border-bottom: 1px solid var(--pensieve-border); }
.memory-row:hover { background: color-mix(in srgb, var(--pensieve-surface) 62%, transparent); }
.memory-detail { max-width: 720px; }
.memory-detail__summary { font-size: 1.05rem; line-height: 1.7; }
.memory-detail__delete { align-self: flex-start; margin-top: 32px; }
.memory-transcript { border-top: 1px solid var(--pensieve-border); padding-top: 12px; }
.transcript-message { max-width: min(82%, 560px); }
.transcript-message--assistant { padding-left: 20px; }
.transcript-message--user { align-self: flex-end; background: var(--pensieve-user); border-radius: 12px 12px 4px; padding: 9px 12px; }
```

Delete obsolete timeline-card, action, tag, and source rules.

- [ ] **Step 7: Verify and review**

Run `cd frontend && npm test -- App.test.tsx && npm run typecheck`.

Expected: all tests PASS and TypeScript exits 0. Review loading, empty, error, populated, linked detail, legacy edit, transcript, and delete states. Check long titles and summaries. Do not commit.

---

### Task 5: Responsive Polish and Full Verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/auth/AuthGate.tsx`
- Modify: `frontend/src/components/reflection/SideNav.tsx`
- Modify: `frontend/src/components/reflection/MobileBottomNav.tsx`
- Modify: `frontend/src/components/reflection/CaptureComposer.tsx`
- Modify: `frontend/src/components/reflection/MemoryProposalCard.tsx`
- Modify: `frontend/src/components/reflection/Timeline.tsx`
- Modify: `frontend/src/components/reflection/TimelineCard.tsx`
- Modify: `frontend/src/components/reflection/MemoryDetail.tsx`
- Modify: `frontend/src/components/reflection/MemoryTranscript.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- No new public interfaces.
- Confirms the entire feature through existing APIs and hash routes.

- [ ] **Step 1: Add semantic regression tests**

```tsx
it("exposes one current destination in each navigation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
  renderApp();
  const desktop = await findMainNavigation();
  const mobile = await findPrimaryNavigation();
  expect(within(desktop).getAllByRole("button").filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1);
  expect(within(mobile).getAllByRole("button").filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1);
});

it("keeps conversation controls labelled", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
  renderApp();
  expect(await screen.findByRole("log", { name: "Memory capture conversation" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message to Pensieve" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
});
```

- [ ] **Step 2: Run the semantic tests**

Run:

```bash
cd frontend && npm test -- App.test.tsx -t "current destination|controls labelled"
```

Expected: PASS if earlier tasks preserved semantics; fix any named role before continuing.

- [ ] **Step 3: Finish responsive and reduced-motion CSS**

```css
@media (max-width: 47.99em) {
  .app-content { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
  .mobile-app-header { align-items: center; display: flex; justify-content: space-between; min-height: 48px; }
  .mobile-bottom-nav {
    background: color-mix(in srgb, var(--pensieve-surface) 96%, transparent);
    border-top: 1px solid var(--pensieve-border);
    bottom: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
    left: 0; padding: 6px 10px calc(6px + env(safe-area-inset-bottom));
    position: fixed; right: 0; z-index: 30;
  }
  .mobile-bottom-nav__item { min-height: 48px; }
  .capture-workspace { height: calc(100dvh - 72px - env(safe-area-inset-bottom)); }
  .capture-message { max-width: 92%; }
  .capture-composer__hint { display: none; }
  .memory-row { padding-block: 15px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Remove remaining blue-default, yellow-warning, shadow-heavy, transform-on-hover, and obsolete account-bar rules.

- [ ] **Step 4: Run React best-practices review**

Read and apply `vercel-plugin:react-best-practices` because multiple TSX components changed. Check unnecessary effects, unstable callback props, avoidable rerenders, and client-rendering pitfalls. Apply only findings relevant to this Vite app.

Run `cd frontend && npm test -- App.test.tsx && npm run typecheck`.

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 5: Run full frontend verification**

Run:

```bash
cd frontend && npm test && npm run typecheck && npm run build
```

Expected: the complete Vitest suite passes, TypeScript exits 0, and Vite creates `frontend/dist` without errors.

- [ ] **Step 6: Perform browser review checkpoints**

At approximately 1440×900, 900×700, and 390×844, inspect:

1. session loading, sign-in, and sign-in error;
2. desktop and mobile navigation;
3. greeting, long conversation, Enter/Shift+Enter, sending, and retry;
4. proposal read, edit, keep talking, save, View memory, and Start a new memory;
5. Memories loading, empty, populated, and retry;
6. detail with collapsed/expanded transcript and legacy editing;
7. complete capture → save → browse → reopen flow.

At every checkpoint confirm no clipped text, covered messages, horizontal scrolling, duplicate headings, unnecessary copy, or inaccessible focus state. Fix and re-review defects immediately.

- [ ] **Step 7: Verify scope and leave changes uncommitted**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: `git diff --check` exits 0, only approved UI/spec/plan files appear, no commit is created, and nothing is pushed.
