# Guided Memory Capture Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a durable guided-memory workflow that uses `gpt-5.4-mini`, asks one grounded question at a time, proposes only evidence-backed memories, and measures proposal timing empirically.

**Architecture:** Persist reflection sessions and messages in PostgreSQL, let the backend own transcript history, and expose session-oriented APIs to React. Use one strict Structured Outputs call per assistant turn, validate proposal evidence against stored user messages, and save the user's approved proposal directly without another model call. Add deterministic contract/integration tests plus an opt-in live evaluation harness.

**Tech Stack:** TypeScript, Express, PostgreSQL via `pg`, Supabase Auth, OpenAI Chat Completions Structured Outputs, React 19, Mantine, Vitest, Testing Library.

## Global Constraints

- The default reflection model is exactly `gpt-5.4-mini` through `AI_REFLECTION_MODEL`.
- There is no fixed turn-count proposal trigger and no automatic session termination.
- Every `exploring` reply contains exactly one focused question.
- A `proposal_ready` response includes exact excerpts from stored user messages as grounding evidence.
- Saving uses the exact user-approved title and summary and performs no AI call.
- The client sends only a session id, new user text, and idempotency key; it never sends assistant history.
- Existing uncommitted work belongs to the user; stage only task-specific files and never revert unrelated edits.
- Live evaluations are opt-in, repeatable, excluded from normal unit-test and CI runs, and default to three repetitions.

---

## File Structure

Backend:

- Create `backend/src/db/migrations/003_guided_reflection_sessions.sql`: durable sessions, messages, memory linkage, and indexes.
- Modify `backend/src/db/schema.ts`: idempotent serverless equivalent of migration 003.
- Modify `backend/src/types.ts`: reflection state, evidence, session, message, and titled-memory DTOs.
- Modify `backend/src/services/aiService.ts`: strict reflection schema, `gpt-5.4-mini`, prompt, parsing, and evidence validation.
- Create `backend/src/services/reflectionSessionService.ts`: session lifecycle, idempotent message creation, assistant persistence, and exact proposal confirmation.
- Create `backend/src/routes/reflectionSessions.ts`: authenticated session endpoints and input validation.
- Modify `backend/src/services/memoryEntryService.ts`: titled/linked memory reads while preserving the legacy API.
- Modify `backend/src/app.ts`: mount session routes.
- Modify `backend/tests/aiService.test.ts`: deterministic AI contract and negative-workflow cases.
- Modify `backend/tests/app.test.ts`: database-backed session ownership, retry, and save tests.
- Create `backend/evals/reflectionScenarios.ts`: versioned positive and negative scenario fixtures.
- Create `backend/evals/runReflectionWorkflow.ts`: repeated live runner and human-readable report.
- Modify `backend/package.json`: `eval:reflection` script.

Frontend:

- Modify `frontend/src/types.ts`: session/message/proposal/evidence and titled-memory DTOs.
- Modify `frontend/src/api/client.ts`: session API methods.
- Modify `frontend/src/components/reflection/CaptureComposer.tsx`: render persisted messages and editable proposal actions.
- Modify `frontend/src/components/reflection/MemoryProposalCard.tsx`: controlled title/summary editing.
- Create `frontend/src/components/reflection/MemoryTranscript.tsx`: source transcript for linked memories.
- Modify `frontend/src/components/reflection/MemoryDetail.tsx`: title, summary, and linked transcript.
- Modify `frontend/src/components/reflection/TimelineCard.tsx`: show the saved title.
- Modify `frontend/src/App.tsx`: replace client-owned reflection turns with load/create/send/confirm session flow.
- Modify `frontend/src/App.test.tsx`: session-first browser contract tests.

### Task 1: Strict AI Workflow Contract and Model Upgrade

**Files:**

- Modify: `backend/src/types.ts`
- Modify: `backend/src/services/aiService.ts`
- Modify: `backend/tests/aiService.test.ts`

**Interfaces:**

- Consumes: stored messages shaped as `{ id, role, content }`.
- Produces: `continueReflection(messages): Promise<ReflectionTurnResponse>`, where state is `exploring` or `proposal_ready` and proposal evidence references exact user text.

- [ ] **Step 1: Write failing tests for the model, schema, question rule, and evidence**

Add tests that assert the OpenAI payload uses `gpt-5.4-mini` and a strict `json_schema`, that valid exploration parses, that zero/multiple-question exploration is rejected, and that proposal evidence must match user text:

```ts
it("uses gpt-5.4-mini with strict structured outputs", async () => {
  openAIMocks.createCompletion.mockResolvedValueOnce(exploringCompletion("What happened next?"));
  const { continueReflection } = await import("../src/services/aiService.js");
  await continueReflection([{ id: "u1", role: "user", content: "I found an old photo." }]);
  const [payload] = openAIMocks.createCompletion.mock.calls[0];
  expect(payload.model).toBe("gpt-5.4-mini");
  expect(payload.response_format).toMatchObject({
    type: "json_schema",
    json_schema: { name: "reflection_turn", strict: true },
  });
});

it.each(["Tell me more.", "Who was there? What happened next?"])(
  "rejects exploring reply with invalid question count: %s",
  async (reply) => {
    openAIMocks.createCompletion.mockResolvedValueOnce(exploringCompletion(reply));
    const { continueReflection } = await import("../src/services/aiService.js");
    await expect(continueReflection([{ id: "u1", role: "user", content: "I feel off." }]))
      .rejects.toMatchObject({ code: "invalid_ai_response" });
  }
);

it("rejects proposal evidence not found in the referenced user message", async () => {
  openAIMocks.createCompletion.mockResolvedValueOnce(proposalCompletion({
    userMessageId: "u1",
    excerpt: "words the user never said",
  }));
  const { continueReflection } = await import("../src/services/aiService.js");
  await expect(continueReflection([{ id: "u1", role: "user", content: "I found an old photo." }]))
    .rejects.toMatchObject({ code: "invalid_ai_response" });
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test --prefix backend -- aiService.test.ts`

Expected: FAIL because the old response has no state/evidence and still uses JSON mode.

- [ ] **Step 3: Add discriminated reflection types**

Define these public shapes in `backend/src/types.ts`:

```ts
export interface ReflectionAIMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export interface ProposalEvidence {
  userMessageId: string;
  excerpt: string;
}

export interface MemoryProposal {
  title: string;
  summary: string;
  evidence: ProposalEvidence[];
}

export type ReflectionTurnResponse =
  | { state: "exploring"; reply: string; memoryProposal: null }
  | { state: "proposal_ready"; reply: string; memoryProposal: MemoryProposal };
```

- [ ] **Step 4: Implement strict Structured Outputs and validation**

In `aiService.ts`, default `AI_REFLECTION_MODEL` to `gpt-5.4-mini`, remove the minimum-turn constant, and send a strict schema with required nullable proposal fields. Validate normalized lengths, discriminated state/proposal consistency, exactly one `?` in exploration, unique evidence, user-role ids, and exact excerpt inclusion:

```ts
const REFLECTION_MODEL = process.env.AI_REFLECTION_MODEL ?? "gpt-5.4-mini";

function validateEvidence(
  evidence: ProposalEvidence[],
  messages: ReflectionAIMessage[]
): ProposalEvidence[] {
  const users = new Map(messages.filter((m) => m.role === "user").map((m) => [m.id, m.content]));
  if (evidence.length === 0) throw new Error("Proposal evidence is required");
  for (const item of evidence) {
    const content = users.get(item.userMessageId);
    if (!content || !content.includes(item.excerpt.trim())) {
      throw new Error("Proposal evidence must quote the user");
    }
  }
  return evidence;
}
```

The system prompt must state the four readiness requirements from the approved spec and explicitly forbid fixed-turn readiness, option menus, diagnoses, hidden motives, and unsupported causes.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test --prefix backend -- aiService.test.ts && npm run typecheck --prefix backend`

Expected: all AI tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the AI contract**

```bash
git add backend/src/types.ts backend/src/services/aiService.ts backend/tests/aiService.test.ts
git commit -m "feat: guard guided reflection responses"
```

### Task 2: Durable Session Schema and Session APIs

**Files:**

- Create: `backend/src/db/migrations/003_guided_reflection_sessions.sql`
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/src/types.ts`
- Create: `backend/src/services/reflectionSessionService.ts`
- Create: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/app.test.ts`

**Interfaces:**

- Consumes: `continueReflection(messages)` from Task 1 and authenticated `req.authUser.id`.
- Produces: `GET/POST /api/reflection-sessions`, `GET /api/reflection-sessions/:id`, and `POST /api/reflection-sessions/:id/messages`.

- [ ] **Step 1: Write failing integration tests**

Add database-backed tests for creating/resuming an active session, posting a user message with `clientMessageId`, returning stored assistant output, idempotently replaying the same key, and returning `404` for another user's session:

```ts
it("creates and resumes one active reflection session", async () => {
  const created = await authed(userAToken).post("/api/reflection-sessions").expect(201);
  const resumed = await authed(userAToken).get("/api/reflection-sessions/active").expect(200);
  expect(resumed.body.session.id).toBe(created.body.session.id);
  expect(resumed.body.messages[0].role).toBe("assistant");
});

it("posts a message idempotently and stores both turns", async () => {
  const created = await createSession(userAToken);
  const body = { content: "Dad laughed when the tent fell down.", clientMessageId: crypto.randomUUID() };
  const first = await authed(userAToken).post(`/api/reflection-sessions/${created.id}/messages`).send(body).expect(201);
  const replay = await authed(userAToken).post(`/api/reflection-sessions/${created.id}/messages`).send(body).expect(200);
  expect(replay.body).toEqual(first.body);
});
```

- [ ] **Step 2: Run database tests and verify failure**

Run: `TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend -- app.test.ts`

Expected: FAIL with missing `/api/reflection-sessions` routes/tables.

- [ ] **Step 3: Add idempotent schema and migration**

Create tables with these critical columns and constraints in both migration 003 and `schemaSql`:

```sql
CREATE TABLE IF NOT EXISTS reflection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled reflection',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reflection_sessions_one_active_per_user
  ON reflection_sessions(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS reflection_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES reflection_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  client_message_id UUID,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, client_message_id)
);
```

Add session/user/time indexes and add nullable `title` and `session_id` columns to `memory_entries`. Backfill legacy titles from `ai_summary`.

Enable Row Level Security on `reflection_sessions`, `reflection_messages`, and `memory_entries` without adding Data API policies. The application accesses these tables only through its authenticated backend, whose ownership predicates are tested; no browser-side Supabase Data API access is required.

- [ ] **Step 4: Implement the session service transaction boundaries**

Create service functions with exact signatures:

```ts
export function getActiveReflectionSession(userId: string): Promise<ReflectionSessionDetail | null>;
export function createReflectionSession(userId: string): Promise<ReflectionSessionDetail>;
export function getReflectionSession(userId: string, sessionId: string): Promise<ReflectionSessionDetail>;
export function appendReflectionMessage(input: {
  userId: string;
  sessionId: string;
  content: string;
  clientMessageId: string;
}): Promise<{ userMessage: ReflectionMessage; assistantMessage: ReflectionMessage; replayed: boolean }>;
```

Use ownership predicates in every query. Insert the user message before calling OpenAI, load ordered stored history, store the assistant response metadata, and on duplicate `(session_id, client_message_id)` return the previously stored pair without calling OpenAI again.

- [ ] **Step 5: Add authenticated routes and mount them**

Validate UUIDs and message text with existing utilities. Route statuses are 201 for creates, 200 for resume/idempotent replay, and 404 for missing/foreign resources. Mount the router at both API prefixes using the lazy-router pattern already in `app.ts`.

- [ ] **Step 6: Run migration, database tests, and typecheck**

Run:

```bash
npm run db:migrate --prefix backend
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend -- app.test.ts
npm run typecheck --prefix backend
```

Expected: migration 003 applies, integration tests pass, and TypeScript exits 0.

- [ ] **Step 7: Commit durable sessions**

```bash
git add backend/src/db/migrations/003_guided_reflection_sessions.sql backend/src/db/schema.ts backend/src/types.ts backend/src/services/reflectionSessionService.ts backend/src/routes/reflectionSessions.ts backend/src/app.ts backend/tests/app.test.ts
git commit -m "feat: persist guided reflection sessions"
```

### Task 3: Exact Proposal Confirmation and Linked Memories

**Files:**

- Modify: `backend/src/services/reflectionSessionService.ts`
- Modify: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/src/services/memoryEntryService.ts`
- Modify: `backend/src/types.ts`
- Modify: `backend/tests/app.test.ts`

**Interfaces:**

- Consumes: a stored assistant message whose metadata contains a pending, evidence-validated proposal.
- Produces: `POST /api/reflection-sessions/:id/memory` and memory DTOs with `title`, `session_id`, and optional source transcript.

- [ ] **Step 1: Write failing save/ownership/no-extra-AI tests**

```ts
it("saves the approved proposal exactly without another AI call", async () => {
  const proposal = await createProposalReadyTurn(userAToken);
  const saved = await authed(userAToken)
    .post(`/api/reflection-sessions/${proposal.sessionId}/memory`)
    .send({ assistantMessageId: proposal.messageId, title: "Camping with Dad", summary: "I remember Dad laughing when our tent collapsed." })
    .expect(201);
  expect(saved.body).toMatchObject({ title: "Camping with Dad", ai_summary: "I remember Dad laughing when our tent collapsed." });
  expect(aiMocks.continueReflection).toHaveBeenCalledTimes(1);
  expect(aiMocks.summarizeMemory).not.toHaveBeenCalled();
  expect(aiMocks.acknowledgeMemory).not.toHaveBeenCalled();
});
```

Also test that a foreign user, a non-proposal assistant message, or an already-saved proposal cannot create a memory.

- [ ] **Step 2: Run focused database tests and verify failure**

Run: `TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend -- app.test.ts`

Expected: FAIL because the confirmation endpoint and linked memory fields do not exist.

- [ ] **Step 3: Implement confirmation in one database transaction**

Add:

```ts
export function confirmReflectionMemory(input: {
  userId: string;
  sessionId: string;
  assistantMessageId: string;
  title: string;
  summary: string;
}): Promise<MemoryEntry>;
```

Lock the owned session and assistant message, require `metadata.proposalState = 'pending'`, insert `memory_entries(user_id, session_id, title, raw_input, ai_summary)` using the approved text, update assistant metadata to saved with `memoryEntryId`, mark the session completed, and commit. Build `raw_input` from stored user messages without invoking OpenAI.

- [ ] **Step 4: Return linked fields from the legacy memory service**

Update list/get/insert/update projections to include `title` and `session_id`. Legacy creates use the generated summary as the title; linked session memories preserve their explicit title.

- [ ] **Step 5: Run tests and typecheck**

Run: `TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend && npm run typecheck --prefix backend`

Expected: backend suite passes with no extra AI call during confirmation.

- [ ] **Step 6: Commit confirmation flow**

```bash
git add backend/src/services/reflectionSessionService.ts backend/src/routes/reflectionSessions.ts backend/src/services/memoryEntryService.ts backend/src/types.ts backend/tests/app.test.ts
git commit -m "feat: confirm grounded reflection memories"
```

### Task 4: Session-First React Capture and Editable Proposal

**Files:**

- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/reflection/CaptureComposer.tsx`
- Modify: `frontend/src/components/reflection/MemoryProposalCard.tsx`
- Modify: `frontend/src/components/reflection/TimelineCard.tsx`
- Modify: `frontend/src/components/reflection/MemoryDetail.tsx`
- Create: `frontend/src/components/reflection/MemoryTranscript.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**

- Consumes: session endpoints from Tasks 2–3.
- Produces: resumable capture UI, controlled proposal editing, exact confirmation, and linked-memory presentation.

- [ ] **Step 1: Rewrite frontend tests around session APIs**

Tests must prove Capture loads `/reflection-sessions/active`, creates when it receives 404, sends only `{ content, clientMessageId }`, resumes returned messages after remount, renders a proposal immediately when backend state is `proposal_ready`, edits its title/summary, confirms through `/reflection-sessions/:id/memory`, and never calls legacy `POST /memory-entries` for a reflection.

```ts
expect(fetchMock).toHaveBeenCalledWith(
  `/api/reflection-sessions/${session.id}/messages`,
  expect.objectContaining({
    method: "POST",
    body: expect.stringMatching(/"content":"Dad laughed".*"clientMessageId":"[0-9a-f-]+"/),
  })
);
expect(fetchMock).not.toHaveBeenCalledWith(
  "/api/memory-entries",
  expect.objectContaining({ method: "POST" })
);
```

- [ ] **Step 2: Run frontend tests and verify failure**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: FAIL because the app still uses `/reflection-turns` and client-owned history.

- [ ] **Step 3: Add frontend DTOs and API methods**

Define types matching backend JSON and add:

```ts
getActiveReflectionSession: () => request<ReflectionSessionDetail>("/reflection-sessions/active"),
createReflectionSession: () => request<ReflectionSessionDetail>("/reflection-sessions", { method: "POST" }),
getReflectionSession: (sessionId: string) =>
  request<ReflectionSessionDetail>(`/reflection-sessions/${sessionId}`),
sendReflectionMessage: (sessionId: string, content: string, clientMessageId: string) =>
  request<ReflectionMessagePair>(`/reflection-sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, clientMessageId }),
  }),
confirmReflectionMemory: (sessionId: string, input: ConfirmReflectionMemoryInput) =>
  request<MemoryEntry>(`/reflection-sessions/${sessionId}/memory`, {
    method: "POST",
    body: JSON.stringify(input),
  }),
```

- [ ] **Step 4: Replace local reflection history with persisted session state**

On authenticated mount, load the active session and create one only for a typed 404 response. Map stored messages directly to the composer. Optimistically display only the newest user message; replace it from the server pair on success. Preserve its idempotency UUID for retry.

Remove `MIN_USER_TURNS_FOR_MEMORY_PROPOSAL`, `toReflectionTurnMessages`, and `buildReflectionMemoryInput` from `App.tsx`. Trust the backend's validated `proposal_ready` state rather than counting turns in the browser.

- [ ] **Step 5: Make proposal title and summary editable**

Change `MemoryProposalCard` to controlled fields and save the edited values:

```tsx
<TextInput aria-label="Memory title" value={title} onChange={(event) => onTitleChange(event.currentTarget.value)} />
<Textarea aria-label="Memory summary" value={summary} onChange={(event) => onSummaryChange(event.currentTarget.value)} />
```

**Keep talking** hides the pending card locally but does not complete the session. **Save reflection** calls only the confirmation endpoint.

- [ ] **Step 6: Show titles and source transcript for linked memories**

Add `MemoryTranscript` rendering ordered user/assistant messages, show the saved title in timeline/detail, and retain legacy raw-input editing only when `session_id` is null.

- [ ] **Step 7: Run frontend tests, typecheck, and build**

Run: `npm test --prefix frontend && npm run typecheck --prefix frontend && npm run build --prefix frontend`

Expected: all frontend tests pass, TypeScript exits 0, and Vite builds successfully.

- [ ] **Step 8: Commit the session-first frontend**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts frontend/src/App.tsx frontend/src/components/reflection/CaptureComposer.tsx frontend/src/components/reflection/MemoryProposalCard.tsx frontend/src/components/reflection/MemoryTranscript.tsx frontend/src/components/reflection/MemoryDetail.tsx frontend/src/components/reflection/TimelineCard.tsx frontend/src/App.test.tsx frontend/src/styles.css
git commit -m "feat: add resumable guided memory capture"
```

### Task 5: Empirical Workflow Evaluation Harness

**Files:**

- Create: `backend/evals/reflectionScenarios.ts`
- Create: `backend/evals/runReflectionWorkflow.ts`
- Modify: `backend/package.json`
- Create: `backend/tests/reflectionEvalHarness.test.ts`

**Interfaces:**

- Consumes: real `continueReflection` calls and scripted user scenario turns.
- Produces: console/JSON report with proposal timing, question counts, evidence validity, lengths, repetitions, model, and transcripts.

- [ ] **Step 1: Write failing metric tests**

```ts
it("measures questions and first proposal turn", () => {
  expect(summarizeRun([
    { state: "exploring", reply: "Who was there?", memoryProposal: null },
    proposalTurn,
  ])).toMatchObject({ turnToFirstProposal: 2, questionCounts: [1, 0] });
});

it("marks a negative scenario failed when it produces any proposal", () => {
  expect(scoreScenario({ expectedProposal: false }, [proposalTurn]).passed).toBe(false);
});
```

- [ ] **Step 2: Run the harness unit test and verify failure**

Run: `npm test --prefix backend -- reflectionEvalHarness.test.ts`

Expected: FAIL because metric helpers do not exist.

- [ ] **Step 3: Add versioned fixtures and pure metric helpers**

Include at least nine scenarios from the approved spec. Negative scenarios contain six user turns. Positive scenarios define a two-to-six-turn proposal window. Export pure `summarizeRun` and `scoreScenario` helpers so ordinary tests remain deterministic.

- [ ] **Step 4: Add the opt-in repeated live runner**

The command reads `EVAL_REPETITIONS` with default `3`, prints each transcript, aggregates scenario pass rates, and exits nonzero when a hard target fails. It never writes user data to the database and never runs without `OPENAI_API_KEY`.

Add to `backend/package.json`:

```json
"eval:reflection": "tsx evals/runReflectionWorkflow.ts"
```

- [ ] **Step 5: Run metric tests and one live evaluation repetition**

Run:

```bash
npm test --prefix backend -- reflectionEvalHarness.test.ts
EVAL_REPETITIONS=1 npm run eval:reflection --prefix backend
```

Expected: deterministic tests pass; the live command prints per-scenario metrics and an aggregate summary. Record any model-quality misses without weakening structural contract tests.

- [ ] **Step 6: Commit the evaluation harness**

```bash
git add backend/evals/reflectionScenarios.ts backend/evals/runReflectionWorkflow.ts backend/tests/reflectionEvalHarness.test.ts backend/package.json
git commit -m "test: measure guided reflection behavior"
```

### Task 6: Full Verification and Browser Flow

**Files:**

- Modify only files required by failures found during verification.

**Interfaces:**

- Consumes: the complete implementation.
- Produces: passing automated checks, a clean local migration, and verified end-to-end capture/resume/edit/save/detail behavior.

- [ ] **Step 1: Run all automated verification**

```bash
npm run typecheck --prefix backend
npm test --prefix backend
npm run typecheck --prefix frontend
npm test --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Verify local schema and ownership**

Run migration 003 against the local database, confirm both new tables and indexes exist, and run the two-user integration tests with `TEST_DATABASE_URL`.

- [ ] **Step 3: Restart services and perform the browser story**

Verify an authenticated user can create/resume a session, send enough concrete detail for a proposal, keep talking, edit the proposal, save it, open it from Memories, and view its source transcript. Reload before saving to prove the session resumes.

- [ ] **Step 4: Run the live eval with three repetitions**

Run: `EVAL_REPETITIONS=3 npm run eval:reflection --prefix backend`

Expected: report includes every scenario/repetition, negative proposal rate, positive timing, question-count compliance, model name, and transcripts. Report empirical misses honestly in the handoff.

- [ ] **Step 5: Review the final diff**

```bash
git status --short
git diff --stat
git diff --check
```

Expected: no whitespace errors, no unrelated files staged, and every source change accounted for by Tasks 1–5. If verification exposes a defect, return to the owning task's failing test, fix it there, rerun that task's verification command, and amend only that task's source files in a new focused commit.
