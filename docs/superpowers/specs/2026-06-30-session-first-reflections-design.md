# Session-First Reflections Design

## Context

Pensieve currently treats each submitted capture message as a memory. The user enters text, the backend summarizes it, and the app immediately inserts a `memory_entries` row. That makes the product behave like a text box with AI polish, not a reflective companion.

The desired MVP is session-first: a reflection is a chat, and a memory is only created when Pensieve identifies a meaningful insight and the user confirms that it is worth saving.

## Goals

- Store reflection chats as resumable sessions.
- Persist user and assistant messages in each session.
- Let the AI decide when a clear insight has emerged.
- Show an inline proposed memory with a title and summary.
- Create a confirmed timeline memory only after the user clicks **Save reflection**.
- Let users open a saved memory and see the source chat that produced it.

## Non-Goals

- No automatic saving of memories without explicit user confirmation.
- No multi-modal capture in this MVP.
- No background summarization after the user leaves the page.
- No complex session search, folders, or tagging beyond the existing lightweight timeline presentation.

## Product Behavior

The Capture page becomes an active reflection session rather than an immediate memory composer.

On first load, the app resumes the most recent active session for the signed-in user. If no active session exists, it creates one and displays the opening assistant prompt:

> Welcome back. What feels worth understanding today?

The user sends messages to Pensieve. Each user message is stored in the current session, then the backend asks the AI for a reflective response. The assistant response is stored as another session message.

When the AI detects a meaningful insight, it returns both a normal assistant reply and a `memoryProposal`. The UI renders that proposal inline in the chat as a compact confirmation card. The user can click **Save reflection** to create a confirmed memory, or **Keep talking** to continue the session without creating a memory.

Unfinished sessions remain resumable even if no memory is confirmed. They are not shown in the main Memories timeline unless a memory has been saved.

## Data Model

Add `reflection_sessions`:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID NOT NULL`
- `title TEXT NOT NULL`
- `status TEXT NOT NULL DEFAULT 'active'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Allowed statuses are `active`, `completed`, and `archived`. The MVP will use `active` and `completed`.

Add `reflection_messages`:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `session_id UUID NOT NULL REFERENCES reflection_sessions(id) ON DELETE CASCADE`
- `user_id UUID NOT NULL`
- `role TEXT NOT NULL`
- `content TEXT NOT NULL`
- `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Allowed roles are `user` and `assistant`. Proposal cards are stored in assistant message metadata so the transcript can be reconstructed later.

Extend `memory_entries`:

- Add `title TEXT`
- Add `session_id UUID REFERENCES reflection_sessions(id) ON DELETE SET NULL`

Existing memories can keep using `ai_summary` and `raw_input`. During migration, `title` can default to the existing summary or a short generated fallback. For new memories, `title` comes from the confirmed AI proposal, `ai_summary` is the proposal summary, and `raw_input` stores a compact transcript excerpt or full session text suitable for legacy display.

## API Design

Keep existing `/api/memory-entries` endpoints for the Memories timeline and detail actions, but update them to return confirmed memories with `title` and optional `session_id`.

Add reflection session endpoints:

- `GET /api/reflection-sessions`
  - Lists the user’s recent sessions, newest first.
- `POST /api/reflection-sessions`
  - Creates a new active session and returns it with its initial assistant message.
- `GET /api/reflection-sessions/:id`
  - Returns one session and ordered messages.
- `POST /api/reflection-sessions/:id/messages`
  - Appends a user message, calls the AI, stores the assistant reply, and returns the new messages plus any proposal.
- `POST /api/reflection-sessions/:id/memory`
  - Confirms a proposal and creates a `memory_entries` row linked to the session.

All endpoints require the existing Supabase session authentication and must scope reads/writes by `user_id`.

## AI Contract

The backend asks the model for structured JSON:

```ts
{
  reply: string;
  memoryProposal?: {
    title: string;
    summary: string;
  };
}
```

The system prompt should make Pensieve behave as a reflective companion:

- Ask one grounded follow-up question when the user is still clarifying.
- Reflect the user’s own words back when useful.
- Avoid generic productivity advice and framework dumping.
- Only propose a memory when the conversation has surfaced a specific insight the user appears to recognize.
- Do not propose a memory for every message.

The backend validates the model response before storing it. Empty replies, empty titles, or empty summaries are treated as AI failures.

## UI Design

Capture view:

- Shows the current session transcript.
- Input label becomes “Message to Pensieve”.
- Button remains “Send”.
- Sending a message no longer marks anything as saved.
- Assistant messages are shown inline as chat bubbles.

Proposal card:

- Appears inline after an assistant message when `memoryProposal` is present.
- Shows a small heading such as “Possible reflection”.
- Shows proposal title and summary.
- Provides **Save reflection** and **Keep talking** actions.
- After saving, the card changes to a saved state and links to the created memory.

Memories view:

- Shows only confirmed memories.
- Cards show title, summary, and time.
- Existing timeline grouping by day can remain.

Memory detail view:

- Shows title and summary first.
- Shows the source chat transcript for linked sessions.
- Keeps edit/delete actions for the memory.
- Provides a way to reopen/resume the source session.

## Error Behavior

If the user message is saved but the AI call fails, the session keeps the user message and adds an error-style assistant message saying Pensieve could not respond. No memory is created.

If confirming a proposal fails, the proposal remains visible and can be retried.

If loading the latest session fails, the app shows an error state without creating duplicate sessions.

If a user attempts to access another user’s session or memory, the API returns `404` to avoid leaking existence.

## Testing Strategy

Backend tests:

- Creating a session stores an initial assistant message.
- Posting a user message stores that message and an assistant reply.
- A model proposal is returned and stored in assistant message metadata but does not create a memory.
- Confirming a proposal creates a memory linked to the session.
- Session and memory access are scoped to the authenticated user.
- AI failure after a user message leaves the user message persisted and creates no memory.
- Oversized messages are rejected before calling AI.

Frontend tests:

- Capture loads or creates a reflection session.
- Sending a chat message calls the session message endpoint, not the memory create endpoint.
- A proposal card appears when the API returns a proposal.
- Clicking **Save reflection** creates a memory.
- Clicking **Keep talking** leaves the session open and creates no memory.
- Memories list shows confirmed reflection titles and summaries.
- Memory detail shows the linked transcript instead of only a raw textbox.

## Implementation Notes

The current `memoryEntryService` and `/api/memory-entries` routes should remain during the transition. New session behavior should live in separate `reflectionSessionService` and `reflectionSessions` route modules so the old memory API does not become a mixed-responsibility layer.

The current frontend `App.tsx` is already handling routing, capture state, memory listing, memory detail, and mutation flows in one file. The implementation should split session-specific state and UI into focused helpers or components while keeping the visible navigation structure familiar.

The first implementation should favor a durable MVP over an elaborate chat product: one active session, ordered messages, proposal confirmation, and linked memory detail are enough.
