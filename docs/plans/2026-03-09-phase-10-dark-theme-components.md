# Phase 10: Dark Theme & Components — Implementation Plan

**PRD:** docs/prd-dashboard-redesign.md
**Design Reference:** docs/dashboard-redesign-brief.md + docs/personal-hub-dashboard.jsx
**Phase:** 10 of 11

---

## Task 1: Update Global Design Tokens (Dark Theme)

**FR:** FR-1, FR-2, FR-3, FR-29, FR-30
**Files:** `frontend/src/app/globals.css`

### Changes

1. Replace `.dark` CSS variables with new palette:
   - `--background: #0c0e14` (was `#0f1117`)
   - `--surface: #13161f` (was `#171b26`)
   - `--surface-hover: #1a1d28` (was `#1e2333`)
   - Add `--card: #171a24` and `--card-hover: #1c2030`
   - `--border: #23273a`, add `--border-subtle: #1c2033`
   - `--foreground: #e8eaf0` (keep)
   - `--muted-foreground: #8b8fa4`
   - Add `--tertiary: #565a6e`
   - `--primary: #4f8fea` (was `#4f8ef7`)
   - Add `--accent-muted: rgba(79,143,234,0.12)`
   - `--accent-teal: #3dd68c`, add `--accent-teal-muted: rgba(61,214,140,0.12)`
   - `--accent-amber: #f0b849`, add `--accent-amber-muted: rgba(240,184,73,0.12)`
   - `--destructive: #ef6464`, add `--destructive-muted: rgba(239,100,100,0.12)`

2. Update `@theme inline` block — expose new tokens as Tailwind utilities:
   - `--color-card-hover`, `--color-border-subtle`, `--color-tertiary`
   - `--color-accent-muted`, `--color-*-muted` variants

3. Placeholder light theme (`:root`) — add missing token names with current light values to prevent breakage (card, card-hover, border-subtle, tertiary, accent-muted, *-muted variants)

4. Add `@keyframes` for animations:
   - `fadeSlideUp`: translateY(8px) → 0, opacity 0 → 1, duration 0.5s ease
   - `fadeIn`: opacity 0 → 1, duration 0.4s ease

5. Add custom scrollbar styles:
   - Width: 6px
   - Track: transparent
   - Thumb: var(--border), border-radius 3px

### Acceptance Criteria
- [ ] Dark theme renders with new palette — background #0c0e14, surface #13161f
- [ ] All new CSS variables defined in .dark and :root
- [ ] @theme block exposes all new tokens
- [ ] Keyframe animations defined
- [ ] Scrollbar styled
- [ ] No build/lint errors

### Verification
- `npm run build && npm run lint` in frontend/
- Visual check: open app in dark mode, verify bg colors changed

---

## Task 2: Sidebar Redesign

**FR:** FR-5, FR-6, FR-7, FR-8, FR-9
**Files:** `frontend/src/components/layout/sidebar.tsx`
**Depends on:** Task 1 (needs new CSS tokens)

### Changes

1. Background: `bg-surface` with `border-r border-border-subtle`
2. Active nav item:
   - Background: `bg-surface-hover`
   - Remove current `border-r-2 border-primary`
   - Add vertical accent indicator: 3px × 16px, bg-primary, borderRadius 2px, positioned right side
3. Logo section:
   - "Personal Hub": 15px, font-weight 600, text-foreground
   - "PORTAL": 11px, uppercase, text-tertiary, letter-spacing 0.06em
4. Bottom user section:
   - Gradient avatar badge: bg-gradient (primary → accent-violet), 30×30, rounded-lg
   - Show display_name + email (text-sm + text-tertiary)
5. Add `animate-[fadeIn_0.4s_ease_both]` to sidebar container

### Acceptance Criteria
- [ ] Sidebar bg matches surface (#13161f in dark)
- [ ] Active item has vertical accent indicator on right
- [ ] Logo shows "Personal Hub" + "PORTAL" (uppercase)
- [ ] User badge has gradient background
- [ ] Sidebar fades in on load
- [ ] All pages accessible via sidebar

### Verification
- Navigate to each page (Dashboard, Tasks, Job Hunt, Calendar, Settings, Profile)
- Verify active state indicator moves correctly

---

## Task 3: Stat Cards Redesign

**FR:** FR-10, FR-11, FR-12, FR-13, FR-14, FR-15
**Files:** `frontend/src/components/dashboard/summary-cards.tsx`
**Depends on:** Task 1 (needs new CSS tokens)

### Changes

1. Remove dashed borders — no `border-dashed` anywhere
2. Card style: `bg-card`, `border border-border-subtle`, `rounded-xl` (12px)
3. Add 2px accent line at top:
   - `before:` pseudo-element or div at top of card
   - Color = accent variant color, opacity 0.7
   - Rounded top corners
4. Icon badge:
   - 32×32px container, rounded-lg (8px)
   - Background: category color with muted opacity (e.g., `bg-accent-muted`)
   - Icon 16px inside
5. Hover state:
   - `hover:bg-card-hover hover:border-border hover:-translate-y-px`
   - Transition: `transition-all duration-200 ease-in-out`
6. Staggered fade-in:
   - Card 1: `animate-[fadeSlideUp_0.5s_ease_0.15s_both]`
   - Card 2: delay 0.2s
   - Card 3: delay 0.25s
   - Card 4: delay 0.3s
7. Update accent color mapping:
   - Active Tasks: primary (#4f8fea)
   - Overdue Tasks: green (#3dd68c) when 0, red (#ef6464) when > 0
   - Open Applications: amber (#f0b849)
   - Upcoming Events: red (#ef6464)
   (Match reference JSX component colors)

### Acceptance Criteria
- [ ] No dashed borders visible
- [ ] Each card has thin colored line at top
- [ ] Icon in 32×32 muted badge
- [ ] Hover lifts card 1px + changes bg/border
- [ ] Cards animate in staggered sequence on load
- [ ] Value display: 32px, font-weight 600
- [ ] Skeleton loading state still works

### Verification
- Open Dashboard, verify cards appearance
- Hover each card, verify lift effect
- Refresh page, verify staggered animation

---

## Task 4: Dashboard Header & Layout

**FR:** FR-16, FR-17, FR-18
**Files:** `frontend/src/app/(dashboard)/page.tsx`, `frontend/src/components/layout/header.tsx`

### Changes

#### page.tsx
1. Update page header:
   - H1 "Dashboard": text-2xl (24px), font-semibold (600), text-foreground
   - Subtitle: "Your personal hub overview", text-tertiary (not muted-foreground)
   - Add fadeSlideUp animation with 0.1s delay
2. Header right side actions:
   - Theme toggle button (ghost style, already exists in header.tsx)
   - "New Task" button: bg-primary, text-white, rounded-lg, with Plus icon
   - Move these to page header area (inline with title)
3. Content grid below cards:
   - `grid grid-cols-[1fr_260px] gap-5`
   - Left: RecentActivity, Right: QuickActions
   - On mobile: single column (1fr)

#### header.tsx
- No major structural changes needed — theme toggle already there
- May simplify if actions move to page-level header

### Acceptance Criteria
- [ ] Dashboard title: 24px, semibold, correct color
- [ ] Subtitle: uses tertiary color
- [ ] "New Task" button visible with accent color
- [ ] Content area uses 2-column grid layout
- [ ] Responsive: single column on mobile

### Verification
- Visual check at desktop and mobile widths

---

## Task 5: Empty State Redesign

**FR:** FR-19, FR-20, FR-21, FR-22, FR-23
**Files:** `frontend/src/components/dashboard/recent-activity.tsx`
**Depends on:** Task 1 (needs new CSS tokens)

### Changes

1. Replace Clock icon with Zap icon from lucide-react
2. Icon container: 48×48px, rounded-xl (12px), bg-accent-muted, text-primary
3. Title: "No recent activity" — text-[15px], font-medium
4. Subtitle: "Start by creating a task or adding a job application to see your activity here" — text-tertiary, text-[13px], text-center, max-w-[300px]
5. Two CTA buttons:
   - "New Task": bg-primary, text-white, rounded-lg, with Plus icon, links to /tasks
   - "Add Application": ghost, border border-border, text-muted-foreground, with Briefcase icon, links to /jobs
   - Both: text-[13px], font-medium, gap-1.5, padding 8px 16px
   - Hover states matching reference
6. Container: bg-card, border border-border-subtle, rounded-xl, padding 48px 32px
7. Add `animate-[fadeSlideUp_0.5s_ease_0.5s_both]`

### Acceptance Criteria
- [ ] Zap icon in accent badge (not clock)
- [ ] Title + subtitle with correct typography
- [ ] Two CTA buttons with correct styles
- [ ] "New Task" navigates to /tasks
- [ ] "Add Application" navigates to /jobs
- [ ] Container matches card style
- [ ] Fade-in animation on load

### Verification
- Open Dashboard with no data — verify empty state
- Click both buttons — verify navigation

---

## Task 6: Quick Actions Component

**FR:** FR-24, FR-25, FR-26, FR-27, FR-28
**Files:** `frontend/src/components/dashboard/quick-actions.tsx` (NEW)
**Depends on:** Task 1 (needs new CSS tokens), Task 4 (grid layout)

### Changes

Create new component:

1. Section header: "Quick actions"
   - text-[13px], font-medium, text-tertiary, uppercase, tracking-[0.06em], mb-3
2. Three action rows:
   - "Create task": primary icon, links to /tasks
   - "Log application": green icon (accent-teal), links to /jobs
   - "View calendar": amber icon, links to /calendar
3. Each row:
   - Icon badge: 28×28px, rounded-[7px], muted bg of color, icon 14px
   - Label: text-sm, text-muted-foreground
   - Arrow icon (ArrowRight or ChevronRight) at right, opacity-30
   - Full-width button, text-left, rounded-lg, padding 10px 12px
4. Hover: bg-surface-hover, text-foreground
5. Transitions: all 0.15s ease
6. Container animation: `animate-[fadeSlideUp_0.5s_ease_0.6s_both]`

### Acceptance Criteria
- [ ] "Quick actions" header uppercase
- [ ] Three action rows with correct icons and colors
- [ ] Each row navigable (links to correct page)
- [ ] Hover changes background and text color
- [ ] Fade-in animation with 0.6s delay

### Verification
- Open Dashboard — verify quick actions appear in right column
- Click each action — verify navigation
- Hover — verify visual feedback

---

## Task 7: Visual Regression Check & Cleanup

**FR:** FR-4
**Files:** All modified files
**Depends on:** Tasks 1–6

### Changes

1. Navigate to each page and verify no visual regressions:
   - /tasks (Kanban board, task cards)
   - /jobs (pipeline, application cards)
   - /calendar (event cards)
   - /settings (forms, inputs)
   - /profile (user info)
2. Check that existing shadcn components (buttons, dialogs, dropdowns) work with new tokens
3. Run full test suite + build + lint
4. Fix any issues found

### Acceptance Criteria
- [ ] All pages render without visual glitches
- [ ] No mismatched colors or broken layouts
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (frontend)
- [ ] Backend tests pass (python -m pytest)

### Verification
- `cd frontend && npm run lint && npm run build && npm test`
- `cd backend && python -m pytest tests/`

---

## Execution Order

```
Task 1 (tokens) ──► Task 2 (sidebar) ──┐
                ├──► Task 3 (cards)  ──┤
                └──► Task 5 (empty)  ──┤
                                       ├──► Task 4 (layout) ──► Task 6 (quick actions) ──► Task 7 (regression)
```

Tasks 2, 3, 5 can be parallelized after Task 1.
Task 4 integrates layout changes.
Task 6 depends on Task 4 (grid layout).
Task 7 is final verification.

---

## Estimated Scope
- 7 tasks
- 7 files modified + 1 new file
- Pure CSS/JSX changes — no API, no DB, no new dependencies
