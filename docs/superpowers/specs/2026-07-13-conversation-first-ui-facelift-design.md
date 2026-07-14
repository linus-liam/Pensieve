# Conversation-First UI Facelift Design

## Context

Pensieve already supports a complete guided-memory workflow, but the interface makes that workflow feel more complicated than it is. Capture is presented as a card containing message cards and a proposal card. The memory list shows source labels, inferred tags, explicit open actions, and repeated borders. The detail view repeats headings and exposes the entire transcript at once. These layers create visual noise, obscure the primary action, and make unfinished states feel like implementation details.

The facelift keeps Mantine and the existing product behavior. It changes the information hierarchy, interaction design, responsive layout, and visual system so Pensieve feels like a focused place to talk and remember.

## Goals

- Make Capture feel like a natural, familiar conversation.
- Reduce visible text, controls, borders, badges, and nested surfaces.
- Make the next action obvious in every state.
- Present saved memories as readable personal writing rather than records in a database.
- Complete empty, loading, error, proposal, and saved states.
- Work cleanly on desktop and mobile with accessible keyboard and touch behavior.
- Give Pensieve a restrained identity without using generic AI-product styling.

## Non-Goals

- No change to the reflection model, prompts, workflow contract, APIs, or persistence.
- No new memory taxonomy, search, filtering, settings area, or onboarding flow.
- No decorative illustration system, animation language, or large branding exercise.
- No attempt to resemble a messaging product with timestamps, delivery receipts, or contact chrome.

## Design Guardrails

The interface will avoid patterns commonly associated with generic AI-generated UI:

- no purple gradients, glow, glass effects, neon accents, or sparkle imagery;
- no card inside card layouts;
- no large icon-led headings or decorative feature grids;
- no excessive pills, badges, shadows, or uniformly rounded containers;
- no redundant coaching copy, section introductions, or labels that repeat visible context;
- no equal visual emphasis for primary actions and secondary metadata.

Hierarchy will come from typography, spacing, alignment, and occasional dividers. Surfaces are reserved for interactive elements or a genuinely distinct state, such as a memory proposal.

## Information Architecture

The primary navigation remains deliberately small:

1. **Capture** — start or continue one active reflection.
2. **Memories** — browse saved memories and open a detail view.

Memory detail remains nested under Memories. Account actions stay out of the main content hierarchy.

## Application Shell

### Desktop

- Use a quiet fixed sidebar approximately 220 pixels wide.
- Place the Pensieve wordmark at the top, the two navigation items beneath it, and the account control at the bottom.
- Show the active navigation item through a subtle tinted background and stronger text, not a heavy filled button.
- Remove the separate account bar from the content area.
- Allow content width to vary by screen: Capture uses a focused 760–820 pixel conversation column; Memories and detail may be slightly wider.

### Mobile

- Remove the desktop sidebar and keep a two-item bottom navigation.
- Keep the bottom bar visually quiet and respect device safe areas.
- Put the account action in a compact header menu rather than adding a third persistent navigation destination.
- Keep the capture composer above the bottom navigation and virtual keyboard.

## Capture Experience

### Default layout

- Use a short page heading: **Capture a memory**.
- Do not wrap the entire conversation in a card.
- Render the conversation as one continuous vertical stream with comfortable line length.
- Render assistant messages as plain left-aligned text with a small, consistent Pensieve marker.
- Render user messages as compact right-aligned bubbles using a muted surface.
- Remove repeated **Pensieve** and **You** labels. Alignment and styling already identify the speaker.
- Do not show timestamps, word counts, workflow state names, or model information.

### Composer

- Dock the composer to the bottom of the capture workspace so it remains available as the conversation grows.
- Use a single expanding textarea with the placeholder **Share what you remember…**.
- Submit with Enter and insert a line break with Shift+Enter.
- Use one icon send button with an accessible label. Disable it for empty input and while sending.
- Show the keyboard hint only on desktop and keep it visually secondary.
- Preserve the user's draft while a send is pending or fails.

### Sending and errors

- Show a restrained activity indicator as the next assistant turn is being prepared.
- Mark a failed user message inline with a short **Not sent** status and **Try again** action.
- Keep broader session-loading errors close to the conversation rather than in a global page alert.
- Never replace the conversation with a loading screen after initial hydration.

### Proposal state

When the workflow returns a proposal, place one calm inline surface after the assistant response:

- heading: **Memory ready**;
- title and summary are readable by default, not immediately presented as form fields;
- primary action: **Save memory**;
- secondary actions: **Keep talking** and **Edit**;
- selecting Edit reveals the existing title and summary fields in place;
- saving shows progress without clearing the proposal;
- save failures remain inline and retryable.

The proposal is visually distinct but does not use a warning color. Internal evidence and workflow diagnostics remain hidden.

### Saved state

After a successful save, replace the proposal controls with a compact confirmation and two clear routes:

- **View memory** opens the saved memory;
- **Start a new memory** begins or loads a fresh capture session.

The completed conversation may remain visible until the user chooses one of those actions. This avoids an abrupt redirect and makes completion explicit.

## Memories List

- Use the heading **Memories** with no explanatory paragraph.
- Group memories by human-readable date labels.
- Present each memory as a full-width clickable row separated by whitespace or a thin divider, not an individual card.
- Show only title, a one- or two-line summary, and date/time when useful.
- Remove source badges, inferred tags, and the repeated **Open memory** action.
- Keep hover and keyboard-focus treatments subtle but visible.
- Use a short empty state: **No memories yet** and one **Capture a memory** action.
- Show lightweight row skeletons during initial loading; retain existing content during refreshes.
- Place a compact retry action beside a load error.

## Memory Detail

- Present a saved memory as a document-like page rather than a bordered card.
- Use a compact back action to Memories, followed by the title, date, and summary.
- Avoid repeating **Memory detail** when the memory title already names the page.
- Keep editing available only where the current data model supports it, using a secondary action rather than permanent form fields.
- Put destructive actions in an overflow menu or a visually separated final area.
- Hide the source conversation behind a collapsed **Show conversation** disclosure.
- When opened, render the transcript using the same simplified message styling as Capture.
- If a legacy memory has no linked conversation, omit the disclosure entirely.

## Authentication

- Keep sign-in sparse but intentional: Pensieve wordmark, one sentence, and the Google sign-in action.
- Use a centered column with a comfortable maximum width rather than a small card floating in a large gray canvas.
- Remove borders and secondary copy that do not help the sign-in decision.
- Preserve clear progress and error feedback in the same column.

## Visual System

Mantine remains the component foundation. A small custom theme and semantic CSS variables will provide consistency.

- **Canvas:** warm off-white rather than neutral gray.
- **Primary text:** near-black ink.
- **Secondary text:** warm gray with accessible contrast.
- **Accent:** one muted blue-green or slate tone used for focus, active navigation, links, and primary actions.
- **Surfaces:** white or lightly tinted only when interaction or state requires separation.
- **Borders:** low-contrast and used sparingly.
- **Radius:** moderate; smaller for controls and message bubbles, with no universal pill treatment.
- **Elevation:** at most one subtle shadow level, primarily for sticky UI where separation is necessary.
- **Typography:** a readable, restrained sans-serif stack with stronger size and weight contrast instead of more labels.
- **Motion:** brief functional transitions only and reduced when `prefers-reduced-motion` is enabled.

## Responsive and Accessibility Requirements

- Maintain at least 44-by-44-pixel touch targets for primary controls.
- Preserve visible keyboard focus on navigation, rows, disclosures, and composer actions.
- Keep message text and controls at accessible contrast levels.
- Use semantic landmarks, headings, buttons, and a live conversation log.
- Announce sending, retry, proposal, and saved states without reading the entire transcript again.
- Keep the composer usable at narrow widths and when the mobile keyboard is open.
- Prevent sticky composer and bottom navigation from covering the latest message.
- Test desktop, narrow desktop, and mobile layouts rather than relying on component-level responsiveness alone.

## Component Impact

- `App.tsx`: centralize the Mantine theme, simplify shell state, and support post-save navigation.
- `SideNav.tsx` and `MobileBottomNav.tsx`: reduce chrome and clarify responsive account placement.
- `CaptureComposer.tsx`: implement the continuous message stream, docked composer, and inline states.
- `MemoryProposalCard.tsx`: replace the warning-card treatment with readable, progressively editable content.
- `Timeline.tsx` and `TimelineCard.tsx`: become a grouped list of clickable rows.
- `MemoryDetail.tsx` and `MemoryTranscript.tsx`: become document-like content with a collapsed source conversation.
- `AuthGate.tsx`: replace the floating generic card with the simplified sign-in composition.
- `styles.css`: replace scattered default overrides with semantic page, conversation, list, and responsive styles.

Existing API behavior and data types should be reused. Components should not manufacture new metadata simply to fill the interface.

## Testing and Review

### Automated tests

- Preserve existing capture, navigation, authentication, retry, edit, and save behavior tests.
- Add tests for Enter versus Shift+Enter behavior.
- Add tests for readable-to-editable proposal transitions.
- Add tests for saved-state actions and empty-memory navigation.
- Add tests for collapsed and expanded source conversation behavior.
- Prefer roles, labels, and visible text over styling selectors.

### Visual review checkpoints

Review the running app after each coherent area rather than waiting until the end:

1. shell, sign-in, and navigation on desktop and mobile;
2. Capture in empty, active, sending, failed, proposal, edit, and saved states;
3. Memories in loading, empty, populated, and error states;
4. memory detail with and without a linked transcript;
5. final end-to-end capture, save, browse, and reopen flow.

At every checkpoint, check content density, keyboard focus, overflow, sticky elements, and whether any visible copy can be removed without losing meaning.

## Completion Criteria

The facelift is complete when:

1. Capture reads as a natural conversation and the composer remains available throughout it.
2. Every workflow state has one obvious next action and useful recovery behavior.
3. Memories and detail no longer expose decorative or inferred metadata.
4. The application shell works at desktop and mobile sizes without obscuring content.
5. Automated tests, typechecking, and production build pass.
6. The authenticated browser flow is visually reviewed at all listed checkpoints.
7. UI changes remain uncommitted so they can be reviewed locally, as requested.
