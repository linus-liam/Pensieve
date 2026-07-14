# Button Hierarchy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pensieve's buttons consistent, restrained, responsive, and visually ordered without changing any workflow behavior.

**Architecture:** Keep Mantine's Button and ActionIcon components, establish shared geometry in the theme/CSS, and express hierarchy through existing Mantine variants at each call site. Add focused DOM tests for the primary, secondary, and tertiary contracts, then verify the real app at desktop and mobile sizes.

**Tech Stack:** React 19, TypeScript, Mantine 9, Vitest, Testing Library, CSS.

## Global Constraints

- Keep Mantine and the existing muted slate identity.
- Use one filled action per decision group.
- Use neutral, low-chrome treatment for navigation and tertiary actions.
- Keep interactive targets at least 40px high except explicitly compact inline retry controls.
- Do not change API calls, data flow, copy, or routing.
- Leave all work uncommitted.

---

### Task 1: Lock the hierarchy contract with tests

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: Existing `renderApp`, auth mocks, and reflection response helpers.
- Produces: Assertions for `auth-screen__action`, proposal action grouping, and neutral tertiary variants.

- [ ] **Step 1: Write failing tests**

Add assertions that the Google button has `auth-screen__action`, the proposal group has `memory-proposal__actions`, Save remains filled, and Keep talking/Edit use transparent neutral variants.

- [ ] **Step 2: Verify the tests fail for the missing contracts**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because the new classes and tertiary variants do not exist yet.

### Task 2: Apply consistent geometry and action hierarchy

**Files:**
- Modify: `frontend/src/theme.ts`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/auth/AuthGate.tsx`
- Modify: `frontend/src/components/reflection/MemoryProposalCard.tsx`
- Modify: `frontend/src/components/reflection/CaptureComposer.tsx`
- Modify: `frontend/src/components/reflection/MemoryDetail.tsx`
- Modify: `frontend/src/components/reflection/MemoryTranscript.tsx`
- Modify: `frontend/src/components/reflection/SideNav.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Mantine `Button` variants and existing callbacks.
- Produces: Filled primary actions, bordered secondary actions, neutral transparent tertiary actions, and responsive proposal groups.

- [ ] **Step 1: Update the shared radius and control styling**

Set Button radius to `md`, cap the auth action at 340px, and add responsive proposal action layouts.

- [ ] **Step 2: Correct each action's semantic hierarchy**

Keep Save/View/Delete-confirmation filled; use `default` for secondary actions; use `transparent` with gray coloring for Edit, Keep talking, Back, Retry, transcript toggles, and Sign out.

- [ ] **Step 3: Verify the focused test passes**

Run: `npm test -- src/App.test.tsx`

Expected: 1 test file passed with all tests green.

### Task 3: Verify responsive rendering and regressions

**Files:**
- Verify: `frontend/src/styles.css`
- Verify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: Final rendered frontend.
- Produces: Evidence that buttons remain aligned and the frontend builds.

- [ ] **Step 1: Run complete frontend verification**

Run: `npm test && npm run typecheck && npm run build`

Expected: Tests, TypeScript, and Vite build all exit 0.

- [ ] **Step 2: Inspect desktop and mobile layouts**

Review the auth screen at the default viewport and 390x844. Once authenticated state is available, inspect Capture proposal actions, Memories empty/detail actions, and the delete confirmation.

- [ ] **Step 3: Confirm repository hygiene**

Run: `git diff --check && git status --short`

Expected: No whitespace errors and all changes remain uncommitted.
