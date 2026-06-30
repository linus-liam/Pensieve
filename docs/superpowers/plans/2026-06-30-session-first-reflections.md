# Session-First Reflections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace immediate message-to-memory capture with persisted reflection sessions where AI-proposed memories require user confirmation.

**Architecture:** Add `reflection_sessions` and `reflection_messages` as the durable chat layer, keep `memory_entries` as confirmed timeline artifacts, and link confirmed memories back to their source session. Add a separate reflection route/service boundary instead of folding session behavior into the existing memory-entry service. Update the React capture view to load a session transcript, send chat messages, render proposal cards, and create a memory only when the user confirms.

**Tech Stack:** Express, PostgreSQL via `pg`, OpenAI chat completions, Supabase Auth, Vite, React, Mantine, Vitest, Testing Library.

---

## Current Worktree Note

The worktree currently has unrelated unstaged frontend auth/config edits:

- `frontend/.env.example`
- `frontend/src/App.test.tsx`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/vite-env.d.ts`

Do not revert them. When committing implementation tasks, stage only the files touched for that task.

## File Structure

Backend files:

- Modify `backend/src/db/migrations/003_reflection_sessions.sql`: new migration for reflection tables and memory-entry extensions.
- Modify `backend/src/db/schema.ts`: add idempotent schema SQL for serverless schema bootstrapping.
- Modify `backend/src/types.ts`: shared backend DTO/database row types for sessions, messages, proposals, and titled memories.
- Modify `backend/src/services/aiService.ts`: add structured reflection-turn generation and parser.
- Create `backend/src/services/reflectionSessionService.ts`: session creation, listing, detail loading, message posting, proposal confirmation.
- Create `backend/src/routes/reflectionSessions.ts`: Express route module for `/api/reflection-sessions`.
- Modify `backend/src/routes/memoryEntries.ts`: return titled memories and linked session fields.
- Modify `backend/src/services/memoryEntryService.ts`: select/return `title` and `session_id`.
- Modify `backend/src/app.ts`: lazy mount `reflectionSessions` routes.
- Modify `backend/tests/app.test.ts`: add backend integration coverage in the existing database-backed suite.
- Create `backend/tests/aiService.test.ts`: parser coverage without hitting OpenAI.

Frontend files:

- Modify `frontend/src/types.ts`: add session/message/proposal types and titled memory fields.
- Modify `frontend/src/api/client.ts`: add reflection session API calls.
- Create `frontend/src/components/reflection/ReflectionChat.tsx`: transcript, message input, loading state.
- Create `frontend/src/components/reflection/MemoryProposalCard.tsx`: inline proposal confirmation UI.
- Create `frontend/src/components/reflection/MemoryTranscript.tsx`: read-only source transcript for memory detail.
- Modify `frontend/src/components/reflection/TimelineCard.tsx`: show memory title before summary.
- Modify `frontend/src/components/reflection/MemoryDetail.tsx`: show title/summary/transcript instead of raw-input-first editing.
- Modify `frontend/src/App.tsx`: replace immediate capture-save flow with session-first state and routing.
- Modify `frontend/src/App.test.tsx`: update tests for session-first behavior.
- Modify `frontend/src/styles.css`: proposal card and transcript styles.

## Database Test Prerequisite

Before backend integration tests:

```bash
createdb -U pensieve pensieve_test || true
```

Use:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected once tasks pass: backend Vitest exits `0` with all database-backed tests passing.

---

### Task 1: Backend Schema, Types, and Session Creation

**Files:**

- Create: `backend/src/db/migrations/003_reflection_sessions.sql`
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/src/types.ts`
- Create: `backend/src/services/reflectionSessionService.ts`
- Create: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/app.test.ts`

- [ ] **Step 1: Write the failing session creation test**

Add this test inside the existing `runDbTests("memory entries API", () => { ... })` block in `backend/tests/app.test.ts`.

```ts
it("creates a reflection session with an initial assistant message", async () => {
  const response = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  expect(response.body.session.user_id).toBe(userAId);
  expect(response.body.session.title).toBe("Untitled reflection");
  expect(response.body.session.status).toBe("active");
  expect(response.body.messages).toHaveLength(1);
  expect(response.body.messages[0]).toMatchObject({
    role: "assistant",
    content: "Welcome back. What feels worth understanding today?",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: the new test fails with `404` for `/api/reflection-sessions`.

- [ ] **Step 3: Add schema SQL**

Create `backend/src/db/migrations/003_reflection_sessions.sql` with:

```sql
CREATE TABLE IF NOT EXISTS reflection_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  title       TEXT NOT NULL DEFAULT 'Untitled reflection',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reflection_sessions_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT reflection_sessions_status_valid CHECK (status IN ('active', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS reflection_sessions_user_updated_idx
  ON reflection_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS reflection_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES reflection_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reflection_messages_role_valid CHECK (role IN ('user', 'assistant')),
  CONSTRAINT reflection_messages_content_not_blank CHECK (length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS reflection_messages_session_created_idx
  ON reflection_messages(session_id, created_at ASC);

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS title TEXT;

UPDATE memory_entries
SET title = left(ai_summary, 120)
WHERE title IS NULL OR length(trim(title)) = 0;

ALTER TABLE memory_entries
  ALTER COLUMN title SET DEFAULT 'Untitled reflection';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memory_entries_title_not_blank'
  ) THEN
    ALTER TABLE memory_entries
      ADD CONSTRAINT memory_entries_title_not_blank CHECK (length(trim(title)) > 0) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE memory_entries
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES reflection_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS memory_entries_session_idx
  ON memory_entries(session_id);

CREATE OR REPLACE FUNCTION update_reflection_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reflection_sessions_update_timestamp ON reflection_sessions;
CREATE TRIGGER reflection_sessions_update_timestamp
  BEFORE UPDATE ON reflection_sessions
  FOR EACH ROW EXECUTE FUNCTION update_reflection_session_timestamp();
```

Also append equivalent idempotent SQL to `schemaSql` in `backend/src/db/schema.ts`. Keep the existing memory table definition, but add `title TEXT NOT NULL DEFAULT 'Untitled reflection'` and `session_id UUID` for fresh databases, plus the same table/index/trigger statements.

- [ ] **Step 4: Extend backend types**

Replace `backend/src/types.ts` with:

```ts
export interface MemoryEntry {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  raw_input: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export interface CapturedMemoryEntry extends MemoryEntry {
  acknowledgement: string;
}

export type ReflectionMessageRole = "assistant" | "user";
export type ReflectionSessionStatus = "active" | "completed" | "archived";

export interface MemoryProposal {
  title: string;
  summary: string;
}

export interface ReflectionMessageMetadata {
  memoryProposal?: MemoryProposal;
  proposalState?: "pending" | "saved" | "dismissed";
  memoryEntryId?: string;
  errorCode?: string;
}

export interface ReflectionSession {
  id: string;
  user_id: string;
  title: string;
  status: ReflectionSessionStatus;
  created_at: string;
  updated_at: string;
}

export interface ReflectionMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: ReflectionMessageRole;
  content: string;
  metadata: ReflectionMessageMetadata;
  created_at: string;
}

export interface ReflectionSessionDetail {
  session: ReflectionSession;
  messages: ReflectionMessage[];
}
```

- [ ] **Step 5: Add minimal session service**

Create `backend/src/services/reflectionSessionService.ts` with:

```ts
import { pool } from "../db/client.js";
import { AppError } from "../errors.js";
import type { ReflectionMessage, ReflectionSession, ReflectionSessionDetail } from "../types.js";

export const INITIAL_REFLECTION_PROMPT = "Welcome back. What feels worth understanding today?";

export async function createReflectionSession(userId: string): Promise<ReflectionSessionDetail> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sessionResult = await client.query<ReflectionSession>(
      `INSERT INTO reflection_sessions (user_id, title, status)
       VALUES ($1, 'Untitled reflection', 'active')
       RETURNING id, user_id, title, status, created_at, updated_at`,
      [userId]
    );
    const session = sessionResult.rows[0];
    const messageResult = await client.query<ReflectionMessage>(
      `INSERT INTO reflection_messages (session_id, user_id, role, content)
       VALUES ($1, $2, 'assistant', $3)
       RETURNING id, session_id, user_id, role, content, metadata, created_at`,
      [session.id, userId, INITIAL_REFLECTION_PROMPT]
    );
    await client.query("COMMIT");
    return { session, messages: messageResult.rows };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getReflectionSession(
  userId: string,
  sessionId: string
): Promise<ReflectionSessionDetail> {
  const sessionResult = await pool.query<ReflectionSession>(
    `SELECT id, user_id, title, status, created_at, updated_at
     FROM reflection_sessions
     WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  const session = sessionResult.rows[0];
  if (!session) throw new AppError(404, "reflection session not found", "not_found");

  const messagesResult = await pool.query<ReflectionMessage>(
    `SELECT id, session_id, user_id, role, content, metadata, created_at
     FROM reflection_messages
     WHERE session_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [sessionId, userId]
  );

  return { session, messages: messagesResult.rows };
}
```

- [ ] **Step 6: Add routes and mount them**

Create `backend/src/routes/reflectionSessions.ts` with:

```ts
import { Router } from "express";
import type { Request } from "express";
import { AppError } from "../errors.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createReflectionSession, getReflectionSession } from "../services/reflectionSessionService.js";
import { requireUuid } from "../utils/validation.js";

const router = Router();

function requireAuthUserId(req: Request) {
  const userId = req.authUser?.id;
  if (!userId) throw new AppError(401, "authentication required", "auth_required");
  return userId;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const detail = await createReflectionSession(requireAuthUserId(req));
    res.status(201).json(detail);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const detail = await getReflectionSession(requireAuthUserId(req), id);
    res.json(detail);
  })
);

export default router;
```

Modify `backend/src/app.ts` to add a lazy route, mirroring the memory route:

```ts
let reflectionSessionsRouter: RequestHandler | null = null;

const handleReflectionSessions: RequestHandler = async (req, res, next) => {
  try {
    reflectionSessionsRouter ??= (await import("./routes/reflectionSessions.js")).default;
    reflectionSessionsRouter(req, res, next);
  } catch (error) {
    next(error);
  }
};
```

Inside `mountApi`, add:

```ts
app.use(`${prefix}/reflection-sessions`, requireAuth, handleReflectionSessions);
```

- [ ] **Step 7: Run the test and verify it passes**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: the new reflection session test passes. Existing memory tests may fail because they still truncate only `memory_entries`; if so, update `beforeEach` to truncate all involved tables:

```ts
await pool.query("TRUNCATE reflection_messages, reflection_sessions, memory_entries RESTART IDENTITY CASCADE");
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/db/migrations/003_reflection_sessions.sql backend/src/db/schema.ts backend/src/types.ts backend/src/services/reflectionSessionService.ts backend/src/routes/reflectionSessions.ts backend/src/app.ts backend/tests/app.test.ts
git commit -m "feat: add reflection session creation"
```

---

### Task 2: Backend Message Posting and AI Reflection Replies

**Files:**

- Modify: `backend/src/services/aiService.ts`
- Modify: `backend/src/services/reflectionSessionService.ts`
- Modify: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/tests/app.test.ts`
- Create: `backend/tests/aiService.test.ts`

- [ ] **Step 1: Extend AI mocks and write failing message test**

In `backend/tests/app.test.ts`, extend `aiMocks`:

```ts
const aiMocks = vi.hoisted(() => ({
  acknowledgeMemory: vi.fn(),
  continueReflection: vi.fn(),
  summarizeMemory: vi.fn(),
}));
```

Add `aiMocks.continueReflection.mockReset()` and default:

```ts
aiMocks.continueReflection.mockResolvedValue({
  reply: "It sounds like the uncertainty matters more than the workload.",
});
```

Add this test:

```ts
it("stores user and assistant reflection messages without creating a memory", async () => {
  const created = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  const response = await request(app)
    .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
    .set("Authorization", `Bearer ${userAToken}`)
    .send({ content: "I keep switching priorities because everything feels urgent." })
    .expect(201);

  expect(aiMocks.continueReflection).toHaveBeenCalledWith([
    expect.objectContaining({ role: "assistant" }),
    expect.objectContaining({
      role: "user",
      content: "I keep switching priorities because everything feels urgent.",
    }),
  ]);
  expect(response.body.userMessage.content).toBe(
    "I keep switching priorities because everything feels urgent."
  );
  expect(response.body.assistantMessage).toMatchObject({
    role: "assistant",
    content: "It sounds like the uncertainty matters more than the workload.",
    metadata: {},
  });

  const memories = await request(app)
    .get("/api/memory-entries")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);
  expect(memories.body).toHaveLength(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: the new test fails with `404` for the messages endpoint or missing `continueReflection`.

- [ ] **Step 3: Add AI response types and parser tests**

Create `backend/tests/aiService.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseReflectionResponse } from "../src/services/aiService.js";

describe("parseReflectionResponse", () => {
  it("parses a reply without a proposal", () => {
    expect(parseReflectionResponse('{"reply":"Tell me more about that moment."}')).toEqual({
      reply: "Tell me more about that moment.",
    });
  });

  it("parses and normalizes a memory proposal", () => {
    expect(
      parseReflectionResponse(
        '{"reply":"That sounds important.","memoryProposal":{"title":"Fear of Commitment","summary":"Choosing one direction feels like losing every other possibility."}}'
      )
    ).toEqual({
      reply: "That sounds important.",
      memoryProposal: {
        title: "Fear of Commitment",
        summary: "Choosing one direction feels like losing every other possibility.",
      },
    });
  });

  it("rejects empty proposal fields", () => {
    expect(() =>
      parseReflectionResponse(
        '{"reply":"That sounds important.","memoryProposal":{"title":"","summary":"  "}}'
      )
    ).toThrow("Invalid reflection response");
  });
});
```

- [ ] **Step 4: Implement AI reflection function**

In `backend/src/services/aiService.ts`, add imports and types:

```ts
import type { MemoryProposal, ReflectionMessage } from "../types.js";

export interface ReflectionAIResponse {
  reply: string;
  memoryProposal?: MemoryProposal;
}
```

Add parser:

```ts
export function parseReflectionResponse(content: string): ReflectionAIResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid reflection response");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Invalid reflection response");
  const candidate = parsed as {
    reply?: unknown;
    memoryProposal?: { title?: unknown; summary?: unknown };
  };

  const reply = typeof candidate.reply === "string" ? normalizeShortText(candidate.reply) : "";
  if (!reply) throw new Error("Invalid reflection response");

  if (!candidate.memoryProposal) return { reply };

  const title =
    typeof candidate.memoryProposal.title === "string"
      ? normalizeShortText(candidate.memoryProposal.title)
      : "";
  const summary =
    typeof candidate.memoryProposal.summary === "string"
      ? normalizeShortText(candidate.memoryProposal.summary)
      : "";

  if (!title || !summary) throw new Error("Invalid reflection response");
  return { reply, memoryProposal: { title, summary } };
}
```

Add the model call:

```ts
export async function continueReflection(
  messages: Pick<ReflectionMessage, "role" | "content">[]
): Promise<ReflectionAIResponse> {
  const safeTranscript = messages
    .slice(-12)
    .map((message) => `${message.role === "assistant" ? "Pensieve" : "User"}: ${message.content}`)
    .join("\n")
    .slice(0, MAX_SUMMARY_INPUT_CHARS * 4);

  const response = await withAIErrorHandling(() =>
    getClient().chat.completions.create(
      {
        model: SUMMARY_MODEL,
        ...getTokenLimitParam(SUMMARY_MODEL, 220),
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are Pensieve, a reflective companion. Ask grounded questions, avoid generic frameworks, and help the user understand what is actually going on. Return JSON only. Shape: {\"reply\":\"short assistant message\",\"memoryProposal\":{\"title\":\"short title\",\"summary\":\"first-person memory summary\"}}. Omit memoryProposal unless the conversation has surfaced a specific insight the user appears to recognize.",
          },
          {
            role: "user",
            content: `Continue this reflection transcript:\n\n${safeTranscript}`,
          },
        ],
      },
      { timeout: AI_TIMEOUT_MS }
    )
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Unexpected response type");
  return parseReflectionResponse(text);
}
```

- [ ] **Step 5: Implement message posting service**

In `backend/src/services/reflectionSessionService.ts`, import `continueReflection`, `memoryWriteRateLimit` stays in route, and add:

```ts
import { continueReflection } from "./aiService.js";
import type { MemoryProposal, ReflectionMessageMetadata } from "../types.js";

export interface PostReflectionMessageResult {
  userMessage: ReflectionMessage;
  assistantMessage: ReflectionMessage;
  memoryProposal?: MemoryProposal;
}
```

Add:

```ts
export async function postReflectionMessage(
  userId: string,
  sessionId: string,
  content: string
): Promise<PostReflectionMessageResult> {
  await getReflectionSession(userId, sessionId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userMessageResult = await client.query<ReflectionMessage>(
      `INSERT INTO reflection_messages (session_id, user_id, role, content)
       VALUES ($1, $2, 'user', $3)
       RETURNING id, session_id, user_id, role, content, metadata, created_at`,
      [sessionId, userId, content]
    );
    await client.query("UPDATE reflection_sessions SET updated_at = NOW() WHERE id = $1", [
      sessionId,
    ]);
    await client.query("COMMIT");
    const userMessage = userMessageResult.rows[0];

    const transcript = (await getReflectionSession(userId, sessionId)).messages;
    const aiResponse = await continueReflection(transcript);
    const metadata: ReflectionMessageMetadata = aiResponse.memoryProposal
      ? { memoryProposal: aiResponse.memoryProposal, proposalState: "pending" }
      : {};

    const assistantResult = await pool.query<ReflectionMessage>(
      `INSERT INTO reflection_messages (session_id, user_id, role, content, metadata)
       VALUES ($1, $2, 'assistant', $3, $4)
       RETURNING id, session_id, user_id, role, content, metadata, created_at`,
      [sessionId, userId, aiResponse.reply, metadata]
    );

    await pool.query("UPDATE reflection_sessions SET updated_at = NOW() WHERE id = $1", [
      sessionId,
    ]);

    return {
      userMessage,
      assistantMessage: assistantResult.rows[0],
      memoryProposal: aiResponse.memoryProposal,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 6: Add messages route**

In `backend/src/routes/reflectionSessions.ts`, import `memoryWriteRateLimit`, `postReflectionMessage`, and `requireText`. Add:

```ts
const MAX_REFLECTION_MESSAGE_CHARS = Number(process.env.MEMORY_RAW_INPUT_MAX_CHARS ?? 2000);
```

Add route before `/:id` if using more specific paths, or after `/:id` is fine because method/path differ:

```ts
router.post(
  "/:id/messages",
  memoryWriteRateLimit,
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const content = requireText(req.body?.content, "content", MAX_REFLECTION_MESSAGE_CHARS);
    const result = await postReflectionMessage(requireAuthUserId(req), id, content);
    res.status(201).json(result);
  })
);
```

- [ ] **Step 7: Run backend tests and verify**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
npm run typecheck --prefix backend
```

Expected: backend tests pass, typecheck exits `0`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/aiService.ts backend/src/services/reflectionSessionService.ts backend/src/routes/reflectionSessions.ts backend/tests/app.test.ts backend/tests/aiService.test.ts
git commit -m "feat: add reflection chat replies"
```

---

### Task 3: Backend Proposal Confirmation and Titled Memories

**Files:**

- Modify: `backend/src/services/reflectionSessionService.ts`
- Modify: `backend/src/services/memoryEntryService.ts`
- Modify: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/src/routes/memoryEntries.ts`
- Modify: `backend/tests/app.test.ts`

- [ ] **Step 1: Write failing proposal and confirmation tests**

Add:

```ts
it("returns a memory proposal without persisting a memory until confirmation", async () => {
  aiMocks.continueReflection.mockResolvedValue({
    reply: "It sounds like choosing feels expensive because every path has a cost.",
    memoryProposal: {
      title: "Fear of Commitment, Not Lack of Focus",
      summary:
        "Today I realized my attention keeps shifting because committing to one direction feels like losing every other possibility.",
    },
  });

  const created = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  const posted = await request(app)
    .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
    .set("Authorization", `Bearer ${userAToken}`)
    .send({ content: "Maybe I am afraid of making the wrong choice." })
    .expect(201);

  expect(posted.body.memoryProposal.title).toBe("Fear of Commitment, Not Lack of Focus");
  expect(posted.body.assistantMessage.metadata.proposalState).toBe("pending");

  const beforeConfirm = await request(app)
    .get("/api/memory-entries")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);
  expect(beforeConfirm.body).toHaveLength(0);
});

it("confirms the latest proposal into a titled memory linked to the session", async () => {
  aiMocks.continueReflection.mockResolvedValue({
    reply: "It sounds like choosing feels expensive because every path has a cost.",
    memoryProposal: {
      title: "Fear of Commitment, Not Lack of Focus",
      summary:
        "Today I realized my attention keeps shifting because committing to one direction feels like losing every other possibility.",
    },
  });

  const created = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  await request(app)
    .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
    .set("Authorization", `Bearer ${userAToken}`)
    .send({ content: "Maybe I am afraid of making the wrong choice." })
    .expect(201);

  const confirmed = await request(app)
    .post(`/api/reflection-sessions/${created.body.session.id}/memory`)
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  expect(confirmed.body).toMatchObject({
    user_id: userAId,
    session_id: created.body.session.id,
    title: "Fear of Commitment, Not Lack of Focus",
    ai_summary:
      "Today I realized my attention keeps shifting because committing to one direction feels like losing every other possibility.",
  });

  const detail = await request(app)
    .get(`/api/reflection-sessions/${created.body.session.id}`)
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);
  const proposalMessage = detail.body.messages.find(
    (message: { metadata: { memoryEntryId?: string } }) =>
      message.metadata.memoryEntryId === confirmed.body.id
  );
  expect(proposalMessage.metadata.proposalState).toBe("saved");
});
```

- [ ] **Step 2: Run backend tests and verify failure**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: confirmation route fails with `404` or memory response lacks title/session fields.

- [ ] **Step 3: Update memory entry selects**

In `backend/src/services/memoryEntryService.ts`, update every `SELECT` and `RETURNING` field list to include:

```sql
id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at
```

Update `createMemoryEntry` legacy insert to set title from the generated summary:

```ts
`INSERT INTO memory_entries (user_id, title, raw_input, ai_summary)
 VALUES ($1, $2, $3, $4)
 RETURNING id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at`,
[userId, aiSummary, rawInput, aiSummary]
```

This keeps the old endpoint functional while the capture UI moves away from it.

- [ ] **Step 4: Add confirmation service**

In `backend/src/services/reflectionSessionService.ts`, add:

```ts
import type { MemoryEntry } from "../types.js";

function transcriptToRawInput(messages: ReflectionMessage[]) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Pensieve" : "User"}: ${message.content}`)
    .join("\n\n");
}

export async function confirmLatestMemoryProposal(
  userId: string,
  sessionId: string
): Promise<MemoryEntry> {
  const detail = await getReflectionSession(userId, sessionId);
  const proposalMessage = [...detail.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        message.metadata.memoryProposal &&
        message.metadata.proposalState !== "saved"
    );

  if (!proposalMessage?.metadata.memoryProposal) {
    throw new AppError(400, "no pending memory proposal", "no_pending_proposal");
  }

  const proposal = proposalMessage.metadata.memoryProposal;
  const rawInput = transcriptToRawInput(detail.messages);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const memoryResult = await client.query<MemoryEntry>(
      `INSERT INTO memory_entries (user_id, session_id, title, raw_input, ai_summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, session_id, title, raw_input, ai_summary, created_at, updated_at`,
      [userId, sessionId, proposal.title, rawInput, proposal.summary]
    );
    const memory = memoryResult.rows[0];

    await client.query(
      `UPDATE reflection_messages
       SET metadata = jsonb_set(
         jsonb_set(metadata, '{proposalState}', '"saved"'::jsonb, true),
         '{memoryEntryId}',
         to_jsonb($1::text),
         true
       )
       WHERE id = $2 AND user_id = $3`,
      [memory.id, proposalMessage.id, userId]
    );

    await client.query(
      `UPDATE reflection_sessions
       SET status = 'completed', title = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [proposal.title, sessionId, userId]
    );

    await client.query("COMMIT");
    return memory;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 5: Add confirmation route**

In `backend/src/routes/reflectionSessions.ts`, import `confirmLatestMemoryProposal` and add:

```ts
router.post(
  "/:id/memory",
  memoryWriteRateLimit,
  asyncHandler(async (req, res) => {
    const id = requireUuid(req.params.id, "id");
    const memory = await confirmLatestMemoryProposal(requireAuthUserId(req), id);
    res.status(201).json(memory);
  })
);
```

- [ ] **Step 6: Run backend tests and typecheck**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
npm run typecheck --prefix backend
```

Expected: backend tests pass and typecheck exits `0`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/reflectionSessionService.ts backend/src/services/memoryEntryService.ts backend/src/routes/reflectionSessions.ts backend/src/routes/memoryEntries.ts backend/tests/app.test.ts
git commit -m "feat: confirm reflection proposals as memories"
```

---

### Task 4: Frontend Types and API Client

**Files:**

- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing frontend API behavior test in App**

In `frontend/src/App.test.tsx`, add fixture data:

```ts
const firstSession = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: firstEntry.user_id,
  title: "Untitled reflection",
  status: "active",
  created_at: "2026-06-10T10:00:00.000Z",
  updated_at: "2026-06-10T10:00:00.000Z",
};

const welcomeMessage = {
  id: "33333333-3333-4333-8333-333333333333",
  session_id: firstSession.id,
  user_id: firstEntry.user_id,
  role: "assistant",
  content: "Welcome back. What feels worth understanding today?",
  metadata: {},
  created_at: "2026-06-10T10:00:00.000Z",
};

const userReflectionMessage = {
  id: "44444444-4444-4444-8444-444444444444",
  session_id: firstSession.id,
  user_id: firstEntry.user_id,
  role: "user",
  content: "I keep switching because every direction feels urgent.",
  metadata: {},
  created_at: "2026-06-10T10:01:00.000Z",
};

const assistantReflectionMessage = {
  id: "55555555-5555-4555-8555-555555555555",
  session_id: firstSession.id,
  user_id: firstEntry.user_id,
  role: "assistant",
  content: "It sounds like uncertainty is pulling your attention around.",
  metadata: {},
  created_at: "2026-06-10T10:01:10.000Z",
};
```

Add a test:

```ts
it("sends capture messages to the reflection session endpoint instead of creating a memory", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
    if (url === "/api/reflection-sessions" && method === "GET") return jsonResponse([]);
    if (url === "/api/reflection-sessions" && method === "POST") {
      return jsonResponse({ session: firstSession, messages: [welcomeMessage] }, { status: 201 });
    }
    if (url === `/api/reflection-sessions/${firstSession.id}/messages` && method === "POST") {
      return jsonResponse(
        {
          userMessage: userReflectionMessage,
          assistantMessage: assistantReflectionMessage,
        },
        { status: 201 }
      );
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  renderApp();

  await user.type(await screen.findByLabelText("Message to Pensieve"), userReflectionMessage.content);
  await user.click(screen.getByRole("button", { name: "Send" }));

  await screen.findByText(assistantReflectionMessage.content);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/reflection-sessions/${firstSession.id}/messages`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ content: userReflectionMessage.content }),
    })
  );
  expect(fetchMock).not.toHaveBeenCalledWith(
    "/api/memory-entries",
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Run frontend test and verify failure**

Run:

```bash
npm test --prefix frontend -- src/App.test.tsx
```

Expected: the test fails because the UI still uses `Message to save as a memory` and `api.createMemoryEntry`.

- [ ] **Step 3: Update frontend types**

Extend `frontend/src/types.ts`:

```ts
export interface MemoryEntry {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  raw_input: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryProposal {
  title: string;
  summary: string;
}

export interface ReflectionMessageMetadata {
  memoryProposal?: MemoryProposal;
  proposalState?: "pending" | "saved" | "dismissed";
  memoryEntryId?: string;
  errorCode?: string;
}

export interface ReflectionSession {
  id: string;
  user_id: string;
  title: string;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ReflectionMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "assistant" | "user";
  content: string;
  metadata: ReflectionMessageMetadata;
  created_at: string;
}

export interface ReflectionSessionDetail {
  session: ReflectionSession;
  messages: ReflectionMessage[];
}

export interface PostReflectionMessageResponse {
  userMessage: ReflectionMessage;
  assistantMessage: ReflectionMessage;
  memoryProposal?: MemoryProposal;
}
```

Keep `CapturedMemoryEntry` temporarily for legacy tests until capture no longer uses it.

- [ ] **Step 4: Add API client methods**

Modify `frontend/src/api/client.ts` imports and `api` object:

```ts
import type {
  CapturedMemoryEntry,
  MemoryEntry,
  PostReflectionMessageResponse,
  ReflectionSessionDetail,
} from "../types";
```

Add:

```ts
  listReflectionSessions: () =>
    request<ReflectionSessionDetail[]>("/reflection-sessions"),

  createReflectionSession: () =>
    request<ReflectionSessionDetail>("/reflection-sessions", { method: "POST" }),

  getReflectionSession: (id: string, signal?: AbortSignal) =>
    request<ReflectionSessionDetail>(`/reflection-sessions/${id}`, { signal }),

  postReflectionMessage: (sessionId: string, content: string) =>
    request<PostReflectionMessageResponse>(`/reflection-sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  confirmReflectionMemory: (sessionId: string) =>
    request<MemoryEntry>(`/reflection-sessions/${sessionId}/memory`, { method: "POST" }),
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck --prefix frontend
```

Expected: typecheck still fails because App has not moved to session state. That failure is acceptable at this checkpoint if errors point at missing App usage.

- [ ] **Step 6: Commit after App task, not now**

Do not commit this task alone if the repo does not typecheck. Carry these changes into Task 5.

---

### Task 5: Frontend Capture Session Chat

**Files:**

- Create: `frontend/src/components/reflection/ReflectionChat.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Add ReflectionChat component**

Create `frontend/src/components/reflection/ReflectionChat.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import { Box, Button, Group, Paper, Stack, Text, Textarea, Title } from "@mantine/core";
import type { ReflectionMessage } from "../../types";

interface ReflectionChatProps {
  canSend: boolean;
  loading: boolean;
  messages: ReflectionMessage[];
  sending: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function ReflectionChat({
  canSend,
  loading,
  messages,
  sending,
  value,
  onChange,
  onSend,
}: ReflectionChatProps) {
  const words = useMemo(() => wordCount(value), [value]);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messageList = messagesRef.current;
    if (!messageList) return;
    messageList.scrollTo?.({ top: messageList.scrollHeight, behavior: "smooth" });
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, sending]);

  return (
    <section aria-label="Reflection chat">
      <Stack gap="sm">
        <Title order={2} size="h2">
          Capture
        </Title>

        <Paper aria-label="Reflection session" p="md" radius="md" shadow="none" withBorder>
          <Stack gap="md">
            <Box
              ref={messagesRef}
              aria-label="Reflection conversation"
              aria-live="polite"
              mah="min(54vh, 520px)"
              pr={4}
              role="log"
              style={{ overflowY: "auto" }}
            >
              <Stack gap="sm">
                {loading ? (
                  <Text c="dimmed" size="sm">
                    Loading reflection...
                  </Text>
                ) : null}

                {messages.map((message) => (
                  <Box
                    className={[
                      "capture-chat__bubble",
                      `capture-chat__bubble--${message.role}`,
                      message.metadata.errorCode ? "capture-chat__bubble--error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={message.id}
                  >
                    <Text className="capture-chat__speaker" fw={600} size="xs">
                      {message.role === "assistant" ? "Pensieve" : "You"}
                    </Text>
                    <Text size="sm">{message.content}</Text>
                  </Box>
                ))}

                {sending ? (
                  <Box className="capture-chat__bubble capture-chat__bubble--assistant">
                    <Text className="capture-chat__speaker" fw={600} size="xs">
                      Pensieve
                    </Text>
                    <Text c="dimmed" size="sm">
                      Thinking...
                    </Text>
                  </Box>
                ) : null}
              </Stack>
            </Box>

            <Box
              component="form"
              pt="md"
              style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}
              onSubmit={(event) => {
                event.preventDefault();
                onSend();
              }}
            >
              <Stack gap="sm">
                <Textarea
                  aria-label="Message to Pensieve"
                  placeholder="Tell Pensieve what you are noticing..."
                  rows={3}
                  value={value}
                  onChange={(event) => onChange(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      onSend();
                    }
                  }}
                />

                <Group className="capture-composer__footer" gap="sm" justify="space-between">
                  <Text c="dimmed" size="sm" style={{ whiteSpace: "nowrap" }}>
                    {words} {words === 1 ? "word" : "words"}
                  </Text>

                  <Button disabled={!canSend || sending || loading} loading={sending} radius="sm" type="submit">
                    Send
                  </Button>
                </Group>
              </Stack>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </section>
  );
}
```

- [ ] **Step 2: Update App session state**

In `frontend/src/App.tsx`, replace `captureMessages`, `saveMemory`, `saving`, and `draft` semantics with:

```ts
const [draft, setDraft] = useState("");
const [reflectionSession, setReflectionSession] = useState<ReflectionSession | null>(null);
const [reflectionMessages, setReflectionMessages] = useState<ReflectionMessage[]>([]);
const [sessionLoading, setSessionLoading] = useState(true);
const [sending, setSending] = useState(false);
```

Add loader:

```ts
const loadOrCreateSession = useCallback(async () => {
  setSessionLoading(true);
  setError(null);
  try {
    const sessions = await api.listReflectionSessions();
    const active = sessions.find((detail) => detail.session.status === "active");
    const detail = active ?? (await api.createReflectionSession());
    setReflectionSession(detail.session);
    setReflectionMessages(detail.messages);
  } catch (sessionError) {
    setError(sessionError instanceof Error ? sessionError.message : "Could not load reflection");
  } finally {
    setSessionLoading(false);
  }
}, []);
```

Call it next to `loadEntries`:

```ts
useEffect(() => {
  void loadOrCreateSession();
}, [loadOrCreateSession]);
```

Add sender:

```ts
const sendReflectionMessage = useCallback(async () => {
  const content = draft.trim();
  if (!content || !reflectionSession || sending) return;

  setSending(true);
  setError(null);
  setDraft("");

  try {
    const response = await api.postReflectionMessage(reflectionSession.id, content);
    setReflectionMessages((current) => [
      ...current,
      response.userMessage,
      response.assistantMessage,
    ]);
  } catch (sendError) {
    setDraft(content);
    setError(sendError instanceof Error ? sendError.message : "Could not continue reflection");
  } finally {
    setSending(false);
  }
}, [draft, reflectionSession, sending]);
```

Render:

```tsx
<ReflectionChat
  canSend={draft.trim().length > 0 && Boolean(reflectionSession)}
  loading={sessionLoading}
  messages={reflectionMessages}
  sending={sending}
  value={draft}
  onChange={setDraft}
  onSend={sendReflectionMessage}
/>
```

- [ ] **Step 3: Run frontend test**

Run:

```bash
npm test --prefix frontend -- src/App.test.tsx
```

Expected: the session send test passes. Existing capture tests fail where they still look for “Message to save as a memory” or `Send memory`.

- [ ] **Step 4: Update existing capture tests**

Change expectations:

```ts
expect(screen.getByText("Welcome back. What feels worth understanding today?")).toBeInTheDocument();
expect(screen.getByLabelText("Message to Pensieve")).toBeInTheDocument();
expect(screen.queryByLabelText("Message to save as a memory")).not.toBeInTheDocument();
```

Change button lookups from:

```ts
screen.getAllByRole("button", { name: "Send memory" })[0]
```

to:

```ts
screen.getByRole("button", { name: "Send" })
```

Remove or rewrite the old test named `"saves a memory in place and shows the AI summary on the timeline"` because session send no longer creates a memory.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
npm run typecheck --prefix frontend
npm test --prefix frontend -- src/App.test.tsx
```

Expected: App tests pass for session loading/sending. Proposal-related tests are not present yet.

- [ ] **Step 6: Commit Tasks 4 and 5 together**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts frontend/src/components/reflection/ReflectionChat.tsx frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/styles.css
git commit -m "feat: use reflection sessions for capture chat"
```

---

### Task 6: Frontend Proposal Card and Confirmation Flow

**Files:**

- Create: `frontend/src/components/reflection/MemoryProposalCard.tsx`
- Modify: `frontend/src/components/reflection/ReflectionChat.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write failing proposal UI tests**

Add fixture:

```ts
const proposalAssistantMessage = {
  ...assistantReflectionMessage,
  id: "66666666-6666-4666-8666-666666666666",
  content: "Here is what I think we discovered together today.",
  metadata: {
    proposalState: "pending",
    memoryProposal: {
      title: "Fear of Commitment, Not Lack of Focus",
      summary:
        "Today I realized my attention keeps shifting because committing to one direction feels like losing every other possibility.",
    },
  },
};

const confirmedMemory = {
  ...firstEntry,
  session_id: firstSession.id,
  title: "Fear of Commitment, Not Lack of Focus",
  raw_input: "Pensieve: Welcome back. What feels worth understanding today?",
  ai_summary:
    "Today I realized my attention keeps shifting because committing to one direction feels like losing every other possibility.",
};
```

Add test:

```ts
it("shows a proposal card and only creates a memory when Save reflection is clicked", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url === "/api/memory-entries?limit=100") return jsonResponse([]);
    if (url === "/api/reflection-sessions" && method === "GET") return jsonResponse([]);
    if (url === "/api/reflection-sessions" && method === "POST") {
      return jsonResponse({ session: firstSession, messages: [welcomeMessage] }, { status: 201 });
    }
    if (url === `/api/reflection-sessions/${firstSession.id}/messages` && method === "POST") {
      return jsonResponse(
        {
          userMessage: userReflectionMessage,
          assistantMessage: proposalAssistantMessage,
          memoryProposal: proposalAssistantMessage.metadata.memoryProposal,
        },
        { status: 201 }
      );
    }
    if (url === `/api/reflection-sessions/${firstSession.id}/memory` && method === "POST") {
      return jsonResponse(confirmedMemory, { status: 201 });
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  renderApp();

  await user.type(await screen.findByLabelText("Message to Pensieve"), userReflectionMessage.content);
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByText("Possible reflection")).toBeInTheDocument();
  expect(screen.getByText("Fear of Commitment, Not Lack of Focus")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalledWith(
    `/api/reflection-sessions/${firstSession.id}/memory`,
    expect.any(Object)
  );

  await user.click(screen.getByRole("button", { name: "Save reflection" }));
  await screen.findByText("Reflection saved");
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/reflection-sessions/${firstSession.id}/memory`,
    expect.objectContaining({ method: "POST" })
  );
});
```

- [ ] **Step 2: Run frontend test and verify failure**

Run:

```bash
npm test --prefix frontend -- src/App.test.tsx
```

Expected: proposal card text is missing.

- [ ] **Step 3: Create proposal card component**

Create `frontend/src/components/reflection/MemoryProposalCard.tsx`:

```tsx
import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { MemoryProposal } from "../../types";

interface MemoryProposalCardProps {
  proposal: MemoryProposal;
  saved: boolean;
  saving: boolean;
  onDismiss: () => void;
  onSave: () => void;
}

export function MemoryProposalCard({
  proposal,
  saved,
  saving,
  onDismiss,
  onSave,
}: MemoryProposalCardProps) {
  return (
    <Paper className="memory-proposal" p="md" radius="sm" shadow="none" withBorder>
      <Stack gap="sm">
        <Text c="dimmed" fw={600} size="xs">
          {saved ? "Reflection saved" : "Possible reflection"}
        </Text>
        <Stack gap={4}>
          <Title order={3} size="h4">
            {proposal.title}
          </Title>
          <Text size="sm">{proposal.summary}</Text>
        </Stack>
        {!saved ? (
          <Group gap="sm" justify="flex-end">
            <Button disabled={saving} radius="sm" size="xs" variant="default" onClick={onDismiss}>
              Keep talking
            </Button>
            <Button loading={saving} radius="sm" size="xs" onClick={onSave}>
              Save reflection
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}
```

- [ ] **Step 4: Render proposal cards from ReflectionChat**

Extend `ReflectionChatProps`:

```ts
  confirmingProposalId: string | null;
  dismissedProposalIds: Set<string>;
  onDismissProposal: (messageId: string) => void;
  onSaveProposal: (messageId: string) => void;
```

Inside the message map, after the bubble:

```tsx
{message.metadata.memoryProposal && !dismissedProposalIds.has(message.id) ? (
  <MemoryProposalCard
    proposal={message.metadata.memoryProposal}
    saved={message.metadata.proposalState === "saved"}
    saving={confirmingProposalId === message.id}
    onDismiss={() => onDismissProposal(message.id)}
    onSave={() => onSaveProposal(message.id)}
  />
) : null}
```

Import `MemoryProposalCard`.

- [ ] **Step 5: Wire confirmation in App**

In `App.tsx`, add:

```ts
const [confirmingProposalId, setConfirmingProposalId] = useState<string | null>(null);
const [dismissedProposalIds, setDismissedProposalIds] = useState<Set<string>>(() => new Set());
```

Add:

```ts
const dismissProposal = useCallback((messageId: string) => {
  setDismissedProposalIds((current) => new Set(current).add(messageId));
}, []);

const saveProposal = useCallback(
  async (messageId: string) => {
    if (!reflectionSession || confirmingProposalId) return;
    setConfirmingProposalId(messageId);
    setError(null);
    try {
      const memory = await api.confirmReflectionMemory(reflectionSession.id);
      setEntries((current) => [memory, ...current]);
      setReflectionMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                metadata: {
                  ...message.metadata,
                  proposalState: "saved",
                  memoryEntryId: memory.id,
                },
              }
            : message
        )
      );
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : "Could not save reflection");
    } finally {
      setConfirmingProposalId(null);
    }
  },
  [confirmingProposalId, reflectionSession]
);
```

Pass props to `ReflectionChat`.

- [ ] **Step 6: Add styles**

In `frontend/src/styles.css`:

```css
.memory-proposal {
  align-self: flex-start;
  background: var(--mantine-color-yellow-0);
  border-color: var(--mantine-color-yellow-3);
  max-width: min(92%, 620px);
}
```

- [ ] **Step 7: Run checks**

Run:

```bash
npm run typecheck --prefix frontend
npm test --prefix frontend -- src/App.test.tsx
```

Expected: proposal test and existing App tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/reflection/MemoryProposalCard.tsx frontend/src/components/reflection/ReflectionChat.tsx frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/styles.css
git commit -m "feat: confirm proposed reflection memories"
```

---

### Task 7: Memories Timeline Titles and Source Transcript Detail

**Files:**

- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/reflection/TimelineCard.tsx`
- Modify: `frontend/src/components/reflection/MemoryDetail.tsx`
- Create: `frontend/src/components/reflection/MemoryTranscript.tsx`
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing memory display test**

Update `firstEntry` fixture to include:

```ts
session_id: firstSession.id,
title: "Writing the Plan Down",
```

Add a detail fetch path for linked session in existing detail tests:

```ts
if (url === `/api/reflection-sessions/${firstSession.id}` && method === "GET") {
  return jsonResponse({ session: firstSession, messages: [welcomeMessage, userReflectionMessage, assistantReflectionMessage] });
}
```

Add expectation in the detail test:

```ts
expect(await screen.findByText("Source conversation")).toBeInTheDocument();
expect(screen.getByText(welcomeMessage.content)).toBeInTheDocument();
expect(screen.getByText(userReflectionMessage.content)).toBeInTheDocument();
```

Change timeline card expectation to find the title:

```ts
expect(await screen.findByText("Writing the Plan Down")).toBeInTheDocument();
```

- [ ] **Step 2: Run frontend tests and verify failure**

Run:

```bash
npm test --prefix frontend -- src/App.test.tsx
```

Expected: detail transcript heading/text missing.

- [ ] **Step 3: Update memory mapping and timeline card**

In `frontend/src/types.ts`, add `title: string` and `session_id: string | null` to `Memory`.

In `App.tsx`, update `toMemory`:

```ts
function toMemory(entry: MemoryEntry): Memory {
  return {
    id: entry.id,
    day: getDayLabel(entry.created_at),
    time: formatTime(entry.created_at),
    source: "Reflection",
    sourceType: "text",
    title: entry.title,
    summary: entry.ai_summary,
    rawInput: entry.raw_input,
    sessionId: entry.session_id,
    tags: inferTags(entry.raw_input),
  };
}
```

In `TimelineCard.tsx`, update aria-label and body:

```tsx
aria-label={`Open memory: ${memory.title} ${memory.time}`}
```

Render:

```tsx
<Stack gap={4}>
  <Text fw={700}>{memory.title}</Text>
  <Text c="dimmed" size="sm">
    {memory.summary}
  </Text>
</Stack>
```

- [ ] **Step 4: Load linked session in detail**

In `App.tsx`, add:

```ts
const [selectedSessionMessages, setSelectedSessionMessages] = useState<ReflectionMessage[]>([]);
```

Add effect:

```ts
useEffect(() => {
  if (page !== "detail" || !selectedEntry?.session_id) {
    setSelectedSessionMessages([]);
    return;
  }

  const controller = new AbortController();
  api
    .getReflectionSession(selectedEntry.session_id, controller.signal)
    .then((detail) => setSelectedSessionMessages(detail.messages))
    .catch((detailError) => {
      if (!controller.signal.aborted) {
        setError(detailError instanceof Error ? detailError.message : "Could not load source chat");
      }
    });

  return () => controller.abort();
}, [page, selectedEntry?.session_id]);
```

- [ ] **Step 5: Create MemoryTranscript component**

Create `frontend/src/components/reflection/MemoryTranscript.tsx`:

```tsx
import { Paper, Stack, Text, Title } from "@mantine/core";
import type { ReflectionMessage } from "../../types";

interface MemoryTranscriptProps {
  messages: ReflectionMessage[];
}

export function MemoryTranscript({ messages }: MemoryTranscriptProps) {
  if (messages.length === 0) return null;

  return (
    <section aria-labelledby="source-conversation-heading">
      <Stack gap="sm">
        <Title id="source-conversation-heading" order={3} size="h4">
          Source conversation
        </Title>
        <Paper p="md" radius="sm" shadow="none" withBorder>
          <Stack gap="sm">
            {messages.map((message) => (
              <Stack gap={2} key={message.id}>
                <Text c="dimmed" fw={600} size="xs">
                  {message.role === "assistant" ? "Pensieve" : "You"}
                </Text>
                <Text size="sm">{message.content}</Text>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>
    </section>
  );
}
```

- [ ] **Step 6: Update MemoryDetail**

Add prop:

```ts
sessionMessages: ReflectionMessage[];
```

Render title/summary first:

```tsx
<Stack gap="xs">
  <Title order={2} size="h3">
    {memory.title}
  </Title>
  <Text>{memory.summary}</Text>
</Stack>
```

Render:

```tsx
<MemoryTranscript messages={sessionMessages} />
```

Keep the existing textarea under a heading such as “Memory text” so editing/deleting remains available.

- [ ] **Step 7: Run frontend checks**

Run:

```bash
npm run typecheck --prefix frontend
npm test --prefix frontend -- src/App.test.tsx
```

Expected: all frontend tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types.ts frontend/src/App.tsx frontend/src/components/reflection/TimelineCard.tsx frontend/src/components/reflection/MemoryDetail.tsx frontend/src/components/reflection/MemoryTranscript.tsx frontend/src/App.test.tsx
git commit -m "feat: show reflection transcripts on memories"
```

---

### Task 8: Backend Session Listing, Ownership, and Failure Behavior

**Files:**

- Modify: `backend/src/services/reflectionSessionService.ts`
- Modify: `backend/src/routes/reflectionSessions.ts`
- Modify: `backend/tests/app.test.ts`

- [ ] **Step 1: Write failing tests for list, ownership, and AI failure**

Add:

```ts
it("lists reflection sessions newest first for the authenticated user", async () => {
  const first = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);
  const second = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userBToken}`)
    .expect(201);

  const response = await request(app)
    .get("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);

  expect(response.body.map((detail: { session: { id: string } }) => detail.session.id)).toEqual([
    second.body.session.id,
    first.body.session.id,
  ]);
});

it("does not expose another user's reflection session", async () => {
  const userBSession = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userBToken}`)
    .expect(201);

  await request(app)
    .get(`/api/reflection-sessions/${userBSession.body.session.id}`)
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(404);
});

it("keeps the user message and creates no memory when reflection AI fails", async () => {
  aiMocks.continueReflection.mockRejectedValue(
    new AppError(503, "AI provider unavailable", "ai_unavailable")
  );

  const created = await request(app)
    .post("/api/reflection-sessions")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(201);

  await request(app)
    .post(`/api/reflection-sessions/${created.body.session.id}/messages`)
    .set("Authorization", `Bearer ${userAToken}`)
    .send({ content: "This should still be saved." })
    .expect(503);

  const detail = await request(app)
    .get(`/api/reflection-sessions/${created.body.session.id}`)
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);
  expect(detail.body.messages.some((message: { content: string }) => message.content === "This should still be saved.")).toBe(true);

  const memories = await request(app)
    .get("/api/memory-entries")
    .set("Authorization", `Bearer ${userAToken}`)
    .expect(200);
  expect(memories.body).toHaveLength(0);
});
```

- [ ] **Step 2: Run backend tests and verify failure**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: list route missing or ordering wrong. AI failure persistence test may pass if Task 2 already commits the user message before calling AI.

- [ ] **Step 3: Implement list service**

In `reflectionSessionService.ts`:

```ts
export async function listReflectionSessions(userId: string): Promise<ReflectionSessionDetail[]> {
  const sessionsResult = await pool.query<ReflectionSession>(
    `SELECT id, user_id, title, status, created_at, updated_at
     FROM reflection_sessions
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 50`,
    [userId]
  );

  const details: ReflectionSessionDetail[] = [];
  for (const session of sessionsResult.rows) {
    details.push(await getReflectionSession(userId, session.id));
  }
  return details;
}
```

- [ ] **Step 4: Add list route**

In `reflectionSessions.ts`:

```ts
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const sessions = await listReflectionSessions(requireAuthUserId(req));
    res.json(sessions);
  })
);
```

Place this before `router.get("/:id", ...)`.

- [ ] **Step 5: Run backend checks**

Run:

```bash
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
npm run typecheck --prefix backend
```

Expected: backend tests pass and typecheck exits `0`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/reflectionSessionService.ts backend/src/routes/reflectionSessions.ts backend/tests/app.test.ts
git commit -m "feat: list and protect reflection sessions"
```

---

### Task 9: Final Verification and Cleanup

**Files:**

- Modify only files required by failures discovered during verification.

- [ ] **Step 1: Run backend verification**

Run:

```bash
npm run typecheck --prefix backend
TEST_DATABASE_URL=postgres://pensieve:pensieve@localhost:5433/pensieve_test npm test --prefix backend
```

Expected: both commands exit `0`.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
npm run typecheck --prefix frontend
npm test --prefix frontend
```

Expected: both commands exit `0`. Vitest may print the existing Node localStorage experimental warning; tests still pass.

- [ ] **Step 3: Run full app smoke check**

Restart the app services if needed:

```bash
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:5173`, sign in, send a message, and verify:

- Sending a message shows an assistant reply.
- No memory appears in Memories after a plain reply without a proposal.
- When a proposal appears, **Save reflection** creates a Memories card.
- Opening that memory shows title, summary, and source conversation.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentional implementation files are modified. The pre-existing auth/config edits may still be present if they were not committed separately.

- [ ] **Step 5: Resolve any verification failure through its owning task**

If a verification command fails, return to the task that owns the failing file or behavior, add a focused failing test when the gap is behavioral, fix that task’s implementation, rerun that task’s verification command, and use that task’s commit command. Do not create a vague final cleanup commit.

## Self-Review Against Spec

- Resumable sessions: Tasks 1, 5, and 8.
- Persisted messages: Tasks 1, 2, and 8.
- AI insight detection: Task 2.
- User-confirmed memories: Tasks 3 and 6.
- Memories timeline stays confirmed-only: Tasks 2, 3, and 7.
- Memory detail shows source chat: Task 7.
- Auth scoping: Tasks 1, 3, and 8.
- AI failure persistence: Task 8.
- TDD coverage: every behavior task starts with a failing backend or frontend test.
