# Responsive Navigation Design

## Context

Pensieve is a Vite React app using Mantine. The authenticated app currently has
three hash-backed states:

- `#capture`
- `#memories`
- `#memory/:id`

Desktop uses an `AppShell.Navbar` with `Capture` and `Memories`. Mobile hides
the sidebar and shows a top segmented control for the same two destinations.
Memory detail is a child state of Memories and currently uses a `Back to
memories` button.

The latest baseline also changes Capture into a chat-style composer. That makes
mobile navigation placement more important because the message input and send
action need clear space near the bottom of the screen.

## Goals

- Make switching between Capture and Memories fast on small screens.
- Make the current location clear, including when viewing memory detail.
- Keep the navigation model consistent across mobile, tablet, and desktop.
- Preserve the existing hash routes and in-place state model.
- Avoid broad layout changes that are not needed for this workflow.

## Non-Goals

- Replace hash routing with a router library.
- Add search, filters, settings, or new primary pages.
- Redesign the memory timeline or capture chat content model.
- Build a desktop split-pane memory detail layout in this pass.

## Recommended UX

### Desktop

The left sidebar remains the primary navigation on desktop and tablet widths
where Mantine's `sm` breakpoint shows the navbar.

The sidebar should show `Capture` and `Memories` as the canonical app
destinations. When the current page is memory detail, `Memories` remains active
because detail is nested under Memories in the user's mental model.

The account/sign-out block stays in the sidebar. This keeps the desktop content
area focused on the current workflow.

### Mobile

Replace the mobile top segmented control with a fixed bottom navigation bar.
The bottom nav has two primary destinations:

- Capture
- Memories

The active state follows the same rule as desktop: Capture is active only on
`#capture`; Memories is active on both `#memories` and `#memory/:id`.

The content area gets enough bottom padding to keep the capture composer,
timeline cards, detail actions, and modal triggers clear of the fixed bottom
nav. The capture chat should still feel like the main action, so the bottom nav
should be compact and visually quieter than the message composer.

The mobile account row stays at the top as a compact secondary utility area.
Primary page movement belongs to the bottom nav, not the account row.

### Memory Detail

Memory detail keeps a top back action that returns to `#memories`. The label can
be shortened to `Back` on mobile if space is tight, but the behavior remains
explicit.

The detail page heading stays `Memory detail`. The date/time metadata inside
`MemoryDetail` continues to anchor the user in the selected memory.

The bottom nav remains visible on mobile detail pages with Memories active. This
gives users both a local back path and global app movement.

## Component Design

### Navigation Model

Keep the existing route state:

```ts
type Page = "capture" | "memories" | "detail";
type NavPage = "capture" | "memories";
```

Add a small helper for nav active state:

```ts
function getActiveNavPage(page: Page): NavPage {
  return page === "capture" ? "capture" : "memories";
}
```

Use that helper in both desktop and mobile navigation so active-state behavior
cannot drift between screen sizes.

### SideNav

`SideNav` remains responsible for desktop navigation and account actions.

It can accept the already-normalized active page, or continue receiving a
`NavPage` from `App`.

Add `lucide-react` for simple navigation icons rather than introducing manual
SVGs. Use:

- `PenLine` for Capture
- `BookOpen` for Memories

### MobileBottomNav

Create a dedicated `MobileBottomNav` component instead of keeping the
segmented-control component in `App.tsx`.

Responsibilities:

- Render only on mobile through CSS.
- Provide two large touch targets for Capture and Memories.
- Expose semantic navigation with `aria-label="Primary navigation"`.
- Use `aria-current="page"` on the active item.
- Call `onNavigate("capture")` or `onNavigate("memories")`.

The component should be visually compact: a border-top, white background, two
equal-width targets, and an icon plus label for each destination.

### Layout CSS

Replace `.mobile-route-switcher` styles with bottom nav styles.

Add mobile-only bottom padding to the main content area or a wrapper inside
`AppShell.Main`. This padding should account for the fixed nav height plus safe
area inset:

```css
padding-bottom: calc(72px + env(safe-area-inset-bottom));
```

The fixed nav should also include `env(safe-area-inset-bottom)` so it works on
phones with home indicators.

## Data Flow

Navigation continues to use the existing `navigate` callback and hash helpers.

The mobile bottom nav uses `navigateFromNav`, just like the current segmented
control. Opening a memory still calls `navigate("detail", memory.id)`. Deleting
a memory still returns to `navigate("memories")`.

No API changes are required.

## Error Handling

No new async behavior is introduced. Existing memory load, save, update, and
delete errors remain unchanged.

Navigation should still be resilient to invalid hashes:

- Unknown hashes fall back to Capture.
- Empty `#memory/` falls back to Memories.
- Detail with a missing memory shows the current not-found message.

## Testing

Update frontend tests around the navigation workflow:

- Capture remains the default page.
- Desktop/main navigation still exposes Capture and Memories.
- Clicking Memories changes the visible page and hash.
- Opening a timeline card shows detail and keeps Memories as the active nav
  destination.
- Clicking Back from detail returns to Memories.
- The mobile bottom nav renders as primary navigation and has Capture/Memories
  destinations.
- The old mobile segmented-control behavior is no longer expected.

CSS layout should be verified manually at representative widths:

- 375px mobile
- 768px tablet
- 1280px desktop

## Implementation Notes

Keep this pass scoped to navigation and page movement. The chat composer,
timeline cards, and memory detail content should only receive spacing changes
needed to prevent overlap with the mobile bottom nav.

Add the icon dependency through npm so `frontend/package.json` and
`frontend/package-lock.json` stay consistent.
