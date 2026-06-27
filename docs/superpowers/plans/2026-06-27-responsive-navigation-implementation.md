# Responsive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile segmented page switcher with a compact bottom navigation while preserving desktop sidebar navigation and clearer detail location behavior.

**Architecture:** Keep the existing hash-backed route state in `frontend/src/App.tsx`. Add a focused `MobileBottomNav` component for mobile primary navigation, normalize active nav state with a helper, and update CSS so fixed mobile navigation never overlaps page content. Add `lucide-react` icons for desktop and mobile nav affordances.

**Tech Stack:** React 19, TypeScript, Mantine 9, Vitest, Testing Library, Vite, lucide-react.

---

### Task 1: Navigation Behavior Tests

**Files:**
- Modify: `frontend/src/App.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests that describe the new mobile navigation contract and detail back behavior:

```tsx
it("renders mobile bottom primary navigation instead of a segmented switcher", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

  renderApp();

  const primaryNavigation = await screen.findByRole("navigation", {
    name: "Primary navigation",
  });

  expect(primaryNavigation).toBeInTheDocument();
  expect(
    screen.queryByRole("radiogroup", { name: "Mobile navigation" })
  ).not.toBeInTheDocument();
  expect(
    within(primaryNavigation).getByRole("button", { name: "Capture" })
  ).toHaveAttribute("aria-current", "page");
  expect(
    within(primaryNavigation).getByRole("button", { name: "Memories" })
  ).not.toHaveAttribute("aria-current");
});

it("keeps Memories active on detail and returns to the memories page from Back", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([firstEntry])));

  renderApp();

  await user.click(await screen.findByRole("button", { name: "Memories" }));
  await user.click(
    await screen.findByRole("link", {
      name: /Open memory: Writing the plan down/,
    })
  );

  const primaryNavigation = screen.getByRole("navigation", {
    name: "Primary navigation",
  });

  expect(
    within(primaryNavigation).getByRole("button", { name: "Memories" })
  ).toHaveAttribute("aria-current", "page");
  expect(window.location.hash).toBe(`#memory/${encodeURIComponent(firstEntry.id)}`);

  await user.click(screen.getByRole("button", { name: "Back" }));

  expect(await screen.findByRole("heading", { name: "Memories" })).toBeInTheDocument();
  expect(window.location.hash).toBe("#memories");
});
```

Also import `within` from `@testing-library/react`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: FAIL because `Primary navigation` and the `Back` label do not exist yet.

### Task 2: Mobile Bottom Navigation Component

**Files:**
- Create: `frontend/src/components/reflection/MobileBottomNav.tsx`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Add icon dependency**

Run: `npm install --prefix frontend lucide-react`

- [ ] **Step 2: Implement component**

Create `MobileBottomNav`:

```tsx
import { BookOpen, PenLine } from "lucide-react";
import type { ElementType } from "react";

type NavPage = "capture" | "memories";

interface MobileBottomNavProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const navItems: Array<{ icon: ElementType; label: string; value: NavPage }> = [
  { icon: PenLine, label: "Capture", value: "capture" },
  { icon: BookOpen, label: "Memories", value: "memories" },
];

export function MobileBottomNav({ activePage, onNavigate }: MobileBottomNavProps) {
  return (
    <nav aria-label="Primary navigation" className="mobile-bottom-nav">
      {navItems.map(({ icon: Icon, label, value }) => {
        const active = activePage === value;

        return (
          <button
            aria-current={active ? "page" : undefined}
            className={[
              "mobile-bottom-nav__item",
              active ? "mobile-bottom-nav__item--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={value}
            type="button"
            onClick={() => onNavigate(value)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Run test**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: Still FAIL because `App.tsx` has not rendered the component yet.

### Task 3: App Navigation Wiring

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/reflection/SideNav.tsx`

- [ ] **Step 1: Replace segmented mobile switcher**

In `App.tsx`, remove `SegmentedControl` and `MobileRouteSwitcher`. Import
`MobileBottomNav`, add `getActiveNavPage(page)`, and render:

```tsx
const activeNavPage = getActiveNavPage(page);

<SideNav
  page={activeNavPage}
  signingOut={signingOut}
  userEmail={user?.email ?? null}
  onNavigate={navigateFromNav}
  onSignOut={signOut}
/>

<MobileBottomNav activePage={activeNavPage} onNavigate={navigateFromNav} />
```

Change detail back button labels from `Back to memories` to `Back`.

- [ ] **Step 2: Add desktop nav icons**

In `SideNav.tsx`, import `BookOpen` and `PenLine`, then set each `NavLink`
`leftSection` and `aria-current`:

```tsx
<NavLink
  active={page === "capture"}
  aria-current={page === "capture" ? "page" : undefined}
  component="button"
  label="Capture"
  leftSection={<PenLine aria-hidden="true" size={16} strokeWidth={1.9} />}
  variant="light"
  onClick={() => onNavigate("capture")}
/>
```

Repeat for Memories with `BookOpen`.

- [ ] **Step 3: Run test**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: Tests should pass or fail only for missing CSS-independent details.

### Task 4: Responsive Styling

**Files:**
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Replace old mobile route styles**

Remove `.mobile-route-switcher` styles and add:

```css
.mobile-bottom-nav {
  display: none;
}

.app-content {
  min-height: 100vh;
}

@media (max-width: 47.99em) {
  .app-content {
    padding-bottom: calc(76px + env(safe-area-inset-bottom));
  }

  .mobile-bottom-nav {
    align-items: stretch;
    background: color-mix(in srgb, var(--mantine-color-white) 96%, transparent);
    border-top: 1px solid var(--mantine-color-gray-3);
    bottom: 0;
    box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    left: 0;
    padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
    position: fixed;
    right: 0;
    z-index: 20;
  }

  .mobile-bottom-nav__item {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: var(--mantine-color-gray-7);
    display: flex;
    flex-direction: column;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    gap: 3px;
    justify-content: center;
    min-height: 52px;
    padding: 6px 8px;
  }

  .mobile-bottom-nav__item--active {
    background: var(--mantine-color-blue-0);
    color: var(--mantine-color-blue-7);
  }
}
```

- [ ] **Step 2: Run test**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: PASS.

### Task 5: Verification

**Files:**
- Inspect all modified frontend files.

- [ ] **Step 1: Run focused tests**

Run: `npm test --prefix frontend -- App.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run full frontend checks**

Run:

```bash
npm run typecheck --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

Expected: all commands exit 0.

- [ ] **Step 3: Browser responsive check**

Run the frontend dev server and verify the app at 375px, 768px, and 1280px:

- 375px: bottom nav visible, no segmented control, Capture/Memories reachable.
- 375px detail: Memories active, Back returns to Memories.
- 768px: desktop sidebar appears per Mantine `sm` breakpoint.
- 1280px: sidebar navigation and content layout remain stable.
