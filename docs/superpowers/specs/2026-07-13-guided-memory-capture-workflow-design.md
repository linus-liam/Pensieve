# Guided Memory Capture Workflow Design

## Context

Pensieve is a memory-elicitation companion. Users often begin with an incomplete thought and need a few relevant prompts before they can describe what happened, how it felt, or why it matters. Pensieve should help them say more without behaving like a therapist, diagnosing them, or manufacturing an insight.

The current reflection-turn prototype uses `gpt-5.4-nano`, sends the browser-owned transcript to a stateless endpoint, and suppresses proposals only until a fixed minimum of three user turns. Live trials showed that concrete conversations can produce useful proposals, but low-information conversations such as “I feel off” consistently produced an unsupported memory as soon as the third turn was reached. The fixed turn count has become a de facto proposal trigger.

This design refines the AI behavior in the existing [Session-First Reflections Design](./2026-06-30-session-first-reflections-design.md). The durable session model, explicit confirmation, and linked source transcript remain part of the intended workflow. This document supersedes that design's AI contract and expands its testing strategy.

## Goals

- Help users recall and articulate memories through short, grounded questions.
- Keep exploring while the user has not supplied enough substance for a faithful memory.
- Propose a memory only when the proposal is grounded in the user's own details and meaning.
- Never end or save a conversation automatically.
- Let users continue talking, edit a proposal, or explicitly save it.
- Persist active sessions and messages so a reload does not erase the reflection.
- Measure workflow behavior empirically, including question quality and proposal timing.
- Upgrade the reflection model to `gpt-5.4-mini` while keeping cost controlled.

## Non-Goals

- Pensieve is not a therapist, coach, diagnostic system, or advice engine.
- The MVP does not need multiple capture modes, tool use, web search, or long-form reasoning.
- The system will not force every reflection to become a saved memory.
- The system will not impose a fixed conversation length or automatically close a session.
- The first implementation will not add model routing, fine-tuning, or a second model call to judge every response.

## Considered Approaches

### Prompt and model swap only

Changing to a more capable model and improving the prompt is the smallest change. It should improve question quality, but it leaves proposal readiness entirely to unvalidated model judgment and retains browser-owned conversation state. The low-signal failure can therefore recur.

### Guarded workflow without durable sessions

An explicit `exploring` / `proposal_ready` contract, Structured Outputs, server validation, and an eval suite make the behavior substantially more reliable. Keeping the full transcript in React state would still lose unfinished reflections on reload and would continue trusting assistant messages supplied by the client.

### Guarded, durable workflow (selected)

Combine the explicit state contract and validation with the previously designed session/message persistence. This is more work than a prompt-only change, but it gives the backend ownership of history, makes reload/resume reliable, preserves the source of saved memories, and creates a stable surface for empirical evaluation.

## Product Behavior

### Starting and resuming

When Capture opens, Pensieve resumes the signed-in user's most recent active reflection session. If none exists, it creates one with a short opening prompt. Messages are loaded from the backend in creation order.

### Exploring

Each user message is stored before the AI is called. While the memory is still unclear, the assistant returns an `exploring` response containing a brief acknowledgement or reflection and exactly one focused question.

Useful questions draw out one missing dimension at a time:

- what specifically happened;
- who was present;
- what the user noticed or remembers;
- what happened immediately before or after;
- what the user felt at the time or feels now;
- why the experience matters to the user.

The assistant should prefer the user's vocabulary, avoid lists of possible answers, and avoid interpretations the user has not expressed. If the user says they do not know, the assistant may make the next question easier and more concrete, but uncertainty is not itself a memory insight.

There is no turn-count trigger. A detailed first message may need only one follow-up, while a vague conversation may remain exploratory indefinitely.

### Proposal readiness

The assistant may enter `proposal_ready` only when the transcript supports all of the following:

1. A concrete event, experience, scene, or recurring pattern is identifiable.
2. The user has supplied specific detail rather than only a broad mood or label.
3. The user has expressed an emotion, realization, personal meaning, or reason the memory matters.
4. The proposed title and first-person summary can be written without adding a cause, diagnosis, motive, or conclusion that the user did not supply.

The model must return exact excerpts from user messages as private grounding evidence. The backend verifies that every excerpt occurs in the referenced user message before accepting a proposal. Grounding evidence is stored with the assistant message for traceability but is not shown as part of the saved memory.

A proposal is an invitation, not a termination. The user can:

- keep talking, which returns the session to normal exploration;
- edit the title or summary;
- save the proposal explicitly.

### Saving

Saving writes the exact user-approved title and summary to `memory_entries`, links the memory to its reflection session, and marks the session completed in one service operation. Saving does not call the model again. The full source transcript remains available from memory detail.

## AI Contract

Reflection calls use `gpt-5.4-mini` through the existing OpenAI client. The model is configurable through `AI_REFLECTION_MODEL`, whose default is `gpt-5.4-mini`; summary and acknowledgement defaults remain separate during legacy migration.

The response uses Structured Outputs with a strict JSON schema equivalent to:

```ts
type ReflectionTurn =
  | {
      state: "exploring";
      reply: string;
      memoryProposal: null;
    }
  | {
      state: "proposal_ready";
      reply: string;
      memoryProposal: {
        title: string;
        summary: string;
        evidence: Array<{
          userMessageId: string;
          excerpt: string;
        }>;
      };
    };
```

Prompt requirements:

- Ask exactly one question in `exploring` responses.
- Ask about one missing detail at a time.
- Keep replies concise and conversational.
- Do not provide advice unless the user explicitly asks for it.
- Do not diagnose, use clinical language, infer hidden motives, or claim bodily/psychological mechanisms.
- Do not offer menus of interpretations or multiple questions joined together.
- Do not ask whether to save; the UI owns that decision.
- Treat “I don't know,” “maybe,” and other uncertainty as a reason to keep exploring unless the rest of the transcript independently meets all readiness criteria.
- Use only user-authored content as proposal evidence.

The backend rejects malformed output, invalid states, empty fields, excessive field lengths, evidence that is not present in the referenced message, proposals without evidence, and state/proposal mismatches. Invalid model output returns a retryable AI error and creates no memory.

## Data and API Flow

The session-first schema and ownership policies remain as specified in the earlier design:

- `reflection_sessions` belongs to one authenticated user and has `active`, `completed`, or `archived` status.
- `reflection_messages` belongs to a session and stores the role, content, and assistant metadata.
- `memory_entries.session_id` links an explicitly saved memory to its source session.
- Row Level Security and backend queries scope every session, message, and memory by authenticated `user_id`.

The client sends only the session identifier and newest user text. It does not submit assistant history. The backend loads the ordered transcript, stores the user message, calls the model, validates the result, stores the assistant message, and returns the newly created messages.

If the AI call fails after the user message is stored, the session remains resumable and no synthetic assistant message or memory is created. Retrying must not duplicate the user message; the message endpoint therefore accepts a client-generated idempotency key.

## Empirical Evaluation Design

The test suite has two layers.

### Deterministic contract tests

Mocked provider responses verify:

- `gpt-5.4-mini` is the default reflection model.
- Strict structured output configuration is sent to OpenAI.
- `exploring` requires exactly one question and no proposal.
- `proposal_ready` requires a complete proposal and verified user-message evidence.
- Unsupported, missing, or mismatched evidence is rejected.
- A fixed number of turns never makes a proposal valid by itself.
- Vague and uncertain transcripts remain exploratory.
- Saving preserves the approved title and summary without another model call.
- Sessions and messages remain scoped to their authenticated owner.

### Live workflow evaluations

An opt-in evaluation command uses the configured OpenAI key and runs a versioned fixture set against the real model. It does not run as part of ordinary unit tests or CI by default. Each scenario contains simulated user replies and an expected behavior profile.

The initial fixture set includes:

- a concrete positive memory;
- a difficult work experience;
- a relationship misunderstanding;
- a recurring personal pattern;
- a detailed memory provided in the first message;
- a vague low-signal conversation;
- repeated uncertainty such as “I don't know”;
- a user who keeps adding details after a proposal;
- a user who explicitly asks for advice, to distinguish advice from unsolicited coaching.

The harness records every assistant response and produces a compact report containing:

- `turn_to_first_proposal`, or `none`;
- number of questions per assistant turn;
- percentage of exploring turns with exactly one question;
- whether proposal evidence exactly matches user-authored text;
- whether a proposal appeared in a negative/vague scenario;
- response length;
- model name and token usage when returned by the API;
- the transcript for human review.

Initial acceptance targets:

- 100% of `exploring` responses contain exactly one question.
- 0 proposals across all negative/vague scenarios through at least six user turns.
- 0 proposals with invalid or non-user-authored evidence.
- At least 80% of positive scenarios reach a grounded proposal within two to six user turns.
- No response contains more than one question mark or exceeds the configured concise-reply limit.
- Human review finds no unsupported diagnosis, hidden motive, or invented causal claim in accepted proposals.

The timing target is a benchmark, not a runtime rule. Pensieve does not force a proposal at turn six, and a conversation can continue after a proposal. The report makes regressions visible so prompts or models can be compared using the same cases.

Live model outputs are probabilistic. The evaluation command should support repeated runs and aggregate results so a single lucky response does not hide a systematic failure. A practical default is three repetitions per scenario, with an override for cheaper local iteration.

## UI Changes

The existing Capture layout remains familiar. It gains:

- loading and resuming of an active session;
- persisted assistant and user messages;
- a proposal card driven by `proposal_ready`;
- editable proposal title and summary before saving;
- a visible retry action after a failed AI turn;
- unchanged **Keep talking** and **Save reflection** decisions, with neither action occurring automatically.

The UI does not display internal grounding evidence or workflow diagnostics. The live evaluation report is a developer artifact, not an end-user screen.

## Error and Safety Behavior

- Authentication or ownership failures return `404` for inaccessible session resources.
- Invalid user text is rejected before storage or model invocation.
- AI timeouts and invalid output preserve the user's stored message and allow an idempotent retry.
- A failed save leaves the proposal editable and retryable.
- The assistant does not claim therapeutic expertise or provide crisis assessment. Existing application-wide safety handling can be designed separately if Pensieve is later positioned for mental-health use.

## Verification

Implementation is complete only when:

1. Backend and frontend unit/integration tests pass.
2. Typechecking passes.
3. Local Supabase migrations apply cleanly and ownership behavior is verified with two users.
4. The live evaluation command completes against `gpt-5.4-mini` and writes a human-readable report.
5. The negative fixtures produce no proposals in the configured repeated run.
6. At least one complete browser flow creates, resumes, continues, edits, saves, and reopens a reflection with its source transcript.
