# PRD: Dashboard Redesign — Linear/Vercel Style

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P0 |
| Type | Feature (Visual Redesign) |

## Problem Statement

The current Personal Hub Portal has visual inconsistencies: mismatched dark tones between sidebar and content area, dashed colored borders on stat cards, and a generic "AI aesthetic" feel. The redesign aims for a clean, professional theme inspired by Linear/Vercel — unified tone hierarchy, subtle accents, and polished micro-interactions — applied consistently to **both dark and light themes**.

**This is a purely visual change.** No business logic, routing, API calls, or data models are modified.

## Current State

### What exists
- Next.js 16 frontend with Tailwind CSS v4 + shadcn/ui
- CSS variables in `globals.css` with `:root` (light) and `.dark` (dark) themes
- `next-themes` for light/dark toggle (default: dark)
- Collapsible sidebar (220px/48px) in `components/layout/sidebar.tsx`
- Header with theme toggle + avatar in `components/layout/header.tsx`
- Dashboard page with 4 summary cards + recent activity feed
- Fonts: Onest (headings/body) + JetBrains Mono (labels/mono)
- Accent colors: blue (`#4f8ef7`), teal (`#2dd4bf`), violet (`#a78bfa`), amber (`#fbbf24`)

### What's wrong
- Background tones clash: sidebar (`#171b26`) vs content area (`#0f1117`) — visible seam
- Stat cards use dashed colored borders — looks dated
- Empty state is plain (clock icon + gray text, no CTA)
- No entry animations — page feels static
- No quick actions section on dashboard
- Light theme has not been designed with the same level of care — switching themes feels like two different products

## Reference

- **Design brief:** `docs/dashboard-redesign-brief.md`
- **Reference JSX component:** `docs/personal-hub-dashboard.jsx` (source of truth for colors, structure, behavior)

## Functional Requirements

### P0 (Must Have)

#### Phase 1: Dark Theme & Components

##### Global Design Tokens (Dark)
- [ ] FR-1: Replace dark theme CSS variables in `globals.css` with new palette:
  - `--background: #0c0e14` (was `#0f1117`)
  - `--surface: #13161f` (was `#171b26`)
  - `--surface-hover: #1a1d28` (was `#1e2333`)
  - `--card: #171a24` (new)
  - `--card-hover: #1c2030` (new)
  - `--border: #23273a` (update)
  - `--border-subtle: #1c2033` (new)
  - `--foreground: #e8eaf0` (keep)
  - `--muted-foreground: #8b8fa4` (update)
  - `--tertiary: #565a6e` (new)
  - `--primary: #4f8fea` (update from `#4f8ef7`)
  - `--accent-muted: rgba(79,143,234,0.12)` (new)
  - `--green: #3dd68c` / `--green-muted: rgba(61,214,140,0.12)` (new)
  - `--amber: #f0b849` / `--amber-muted: rgba(240,184,73,0.12)` (update)
  - `--red: #ef6464` / `--red-muted: rgba(239,100,100,0.12)` (update from `#f87171`)
- [ ] FR-2: Update Tailwind `@theme` block to expose all new tokens as utility classes
- [ ] FR-3: Placeholder light theme tokens — ensure `:root` (light) variables don't break with new token names (temporary compatibility values, full redesign in Phase 2)
- [ ] FR-4: Verify all existing pages (Tasks, Job Hunt, Calendar, Settings, Profile) render correctly with new tokens — no visual regressions in both themes

##### Sidebar Redesign
- [ ] FR-5: Update sidebar background to `--surface` with right border `--border-subtle`
- [ ] FR-6: Update active nav item: `--surface-hover` background + 3px×16px vertical accent indicator on the right (borderRadius: 2px)
- [ ] FR-7: Update logo section: "Personal Hub" (15px, 600 weight) + "PORTAL" (11px, uppercase, `--tertiary`, letter-spacing: 0.06em)
- [ ] FR-8: Update bottom user section: gradient avatar badge (accent → violet), name + email
- [ ] FR-9: Add sidebar fade-in animation (0.4s ease)

##### Stat Cards Redesign
- [ ] FR-10: Remove all dashed borders from stat cards
- [ ] FR-11: Apply card style: bg `--card`, border 1px solid `--border-subtle`, borderRadius 12px
- [ ] FR-12: Add 2px colored accent line at top of each card (opacity: 0.7)
- [ ] FR-13: Add icon badge: 32×32px, borderRadius 8px, muted background of category color
- [ ] FR-14: Hover state: bg → `--card-hover`, border → `--border`, translateY(-1px)
- [ ] FR-15: Staggered fade-in animation: delays 0.15s, 0.2s, 0.25s, 0.3s (translateY 8px → 0, opacity 0 → 1, duration 0.5s)

##### Dashboard Layout
- [ ] FR-16: Update header: "Dashboard" (24px, 600 weight) + subtitle "Your personal hub overview" (`--tertiary`)
- [ ] FR-17: Header right side: theme toggle (ghost button) + "New Task" button (accent, primary style)
- [ ] FR-18: Content grid below cards: 2-column layout (1fr 260px) for activity + quick actions

##### Empty State Redesign
- [ ] FR-19: Replace clock icon with zap icon in accent badge (48×48, borderRadius 12px, `--accent-muted` bg)
- [ ] FR-20: Title: "No recent activity" (15px, 500 weight)
- [ ] FR-21: Subtitle with call-to-action text
- [ ] FR-22: Two CTA buttons: "New Task" (accent, primary) + "Add Application" (ghost with border)
- [ ] FR-23: Fade-in animation with 0.5s delay

##### Quick Actions (New Component)
- [ ] FR-24: Add "Quick actions" section header (uppercase, 13px, `--tertiary`, letter-spacing 0.06em)
- [ ] FR-25: Three action rows: "Create task" (accent icon), "Log application" (green icon), "View calendar" (amber icon)
- [ ] FR-26: Each row: muted color icon badge (28×28, borderRadius 7px) + label + arrow icon
- [ ] FR-27: Hover: `--surface-hover` background, text → `--foreground`
- [ ] FR-28: Fade-in animation with 0.6s delay

#### Phase 2: Light Theme Redesign

##### Global Design Tokens (Light)
- [ ] FR-31: Design and implement light theme palette in `:root` with the same token structure as dark, following Linear/Vercel light theme principles:
  - `--background`: clean white/off-white (e.g. `#fafbfc` or `#ffffff`)
  - `--surface`: subtle warm gray (e.g. `#f4f5f7`)
  - `--surface-hover`: slightly darker surface (e.g. `#edeef1`)
  - `--card`: white or near-white (e.g. `#ffffff`)
  - `--card-hover`: subtle tint on hover (e.g. `#f8f9fb`)
  - `--border`: light gray (e.g. `#e2e4ea`)
  - `--border-subtle`: very light separator (e.g. `#ecedf1`)
  - `--foreground`: near-black for readability (e.g. `#1a1c23`)
  - `--muted-foreground`: medium gray (e.g. `#6b7084`)
  - `--tertiary`: lighter muted text (e.g. `#9196a8`)
  - `--primary`: same accent blue `#4f8fea` (keep consistent across themes)
  - `--accent-muted`, `--green-muted`, `--amber-muted`, `--red-muted`: adjusted rgba values for light background contrast (higher opacity, e.g. 0.08–0.10)
  - `--green`, `--amber`, `--red`: slightly darkened vs dark theme for contrast on white (e.g. `#2aba76`, `#d9a23b`, `#dc5454`)
- [ ] FR-32: Ensure all accent/muted color combinations meet WCAG AA contrast ratios (4.5:1 for text, 3:1 for UI elements) in light mode
- [ ] FR-33: Verify sidebar, stat cards, empty state, quick actions, and header all render correctly in light theme with the new tokens — visual consistency between themes
- [ ] FR-34: Verify all existing pages (Tasks, Job Hunt, Calendar, Settings, Profile) render correctly in light theme — no regressions
- [ ] FR-35: Theme toggle transition should feel cohesive — switching between dark and light should feel like the same product with adapted colors, not a jarring change

### P1 (Should Have)
- [ ] FR-29: Smooth hover transitions on all interactive elements (0.15–0.2s ease)
- [ ] FR-30: Custom scrollbar styling (6px width, `--border` thumb color)

## Non-Functional Requirements
- Performance: No new JS dependencies. CSS-only animations (no framer-motion).
- Compatibility: Must work on Chrome, Safari, Firefox latest.
- Accessibility: Maintain existing keyboard navigation and ARIA attributes. Light theme must meet WCAG AA contrast ratios.
- Font: Keep Onest + JetBrains Mono. Do NOT add Geist or other fonts.

## Technical Design

### Files to Modify
| File | Change |
|------|--------|
| `frontend/src/app/globals.css` | Replace CSS variables (dark + light), add keyframe animations, scrollbar styles |
| `frontend/src/components/layout/sidebar.tsx` | New styling, active indicator, logo section, user badge |
| `frontend/src/components/layout/header.tsx` | Layout update, button styles |
| `frontend/src/components/dashboard/summary-cards.tsx` | Remove dashed borders, add accent line + icon badge + hover + stagger animation |
| `frontend/src/components/dashboard/recent-activity.tsx` | Empty state redesign (zap icon, CTA buttons) |
| `frontend/src/app/(dashboard)/page.tsx` | Add QuickActions component, update grid layout |
| `frontend/src/components/ui/card.tsx` | Update default card styles if needed |

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/components/dashboard/quick-actions.tsx` | Quick actions component (3 action rows) |

### Approach
1. Update dark theme CSS variables globally → verify no regressions
2. Refactor sidebar → verify all pages look correct in dark mode
3. Redesign stat cards → verify dashboard in dark mode
4. Add empty state + quick actions → verify dashboard in dark mode
5. Add animations → verify performance
6. Design and implement light theme palette → verify all components in light mode
7. Cross-theme verification: toggle between themes, verify all pages in both modes — no jarring transitions, consistent visual quality

## Out of Scope
- Routing changes
- API / backend changes
- New npm dependencies
- Data model changes
- Other page layouts (Tasks, Job Hunt, Calendar pages — only verify they don't break)
- Font changes (keep Onest + JetBrains Mono)

## Acceptance Criteria
- [ ] AC-1: Dark theme uses new unified palette — no tonal clashes between sidebar and content
- [ ] AC-2: Stat cards have subtle accent line at top, icon badges, no dashed borders
- [ ] AC-3: Sidebar has proper active state indicator (vertical accent bar)
- [ ] AC-4: Dashboard shows staggered fade-in animation on load
- [ ] AC-5: Empty state has zap icon, CTA buttons, and action-oriented copy
- [ ] AC-6: Quick actions section appears on dashboard with 3 action rows
- [ ] AC-7: All existing pages (Tasks, Job Hunt, Calendar, Settings, Profile) render without visual regressions in dark theme
- [ ] AC-8: Build passes (`npm run build`) with no errors
- [ ] AC-9: Lint passes (`npm run lint`) with no errors
- [ ] AC-10: Existing tests pass
- [ ] AC-11: Light theme uses a cohesive, purposefully designed palette — matching the quality and consistency level of the dark theme redesign
- [ ] AC-12: All components (sidebar, stat cards, empty state, quick actions, header) look correct in both themes
- [ ] AC-13: Switching between dark and light feels like the same product — no jarring visual contrast or "two different apps" feel

## Open Questions
- OQ-1: Exact light theme color values — should be finalized during Phase 2 implementation. The values in FR-31 are starting points based on Linear/Vercel patterns; adjust during visual testing.
