# Phase 11: Light Theme Redesign — Implementation Plan

**PRD:** docs/prd-dashboard-redesign.md (Phase 2: Light Theme Redesign)
**Design Reference:** docs/design-brief.md + Linear/Vercel light theme patterns
**Phase:** 11
**Depends on:** Phase 10 (Dark Theme & Components — merged)

---

## Overview

Phase 10 delivered a polished dark theme. The current light theme uses placeholder/basic values that feel like a different product when you toggle themes. Phase 11 redesigns the light theme to the same quality level — cohesive palette, proper contrast, and consistent component styling across both modes.

**Key issues to fix:**
1. Light theme CSS variables are basic placeholders — need purposeful Linear/Vercel-style design
2. Multiple components have **hard-coded dark-theme hex colors** that break in light mode (ApplicationCard, RecentActivity, QuickActions, APPLICATION_STATUS_COLORS)
3. Theme toggle feels jarring — dark and light should feel like the same product

---

## Task 1: Redesign Light Theme CSS Variables

**FR:** FR-31
**Files:** `frontend/src/app/globals.css`

### Changes

Replace `:root` CSS variables with a purposefully designed light palette following Linear/Vercel light theme principles:

```css
:root {
  --background: #fafbfc;        /* Clean off-white page background */
  --foreground: #1a1c23;        /* Near-black for max readability */
  --surface: #f3f4f7;           /* Subtle warm gray for sidebar/surfaces */
  --surface-hover: #ecedf1;     /* Slightly darker surface on hover */
  --card: #ffffff;              /* Pure white cards — pop against bg */
  --card-hover: #f8f9fb;        /* Subtle tint on card hover */
  --card-foreground: #1a1c23;
  --popover: #ffffff;
  --popover-foreground: #1a1c23;
  --primary: #4f8fea;           /* Same accent blue — consistent across themes */
  --primary-foreground: #ffffff;
  --secondary: #ecedf1;
  --secondary-foreground: #1a1c23;
  --muted: #f3f4f7;
  --muted-foreground: #6b7084;  /* Medium gray for secondary text */
  --accent: rgba(79, 143, 234, 0.08);
  --accent-foreground: #4f8fea;
  --accent-muted: rgba(79, 143, 234, 0.10);
  --accent-teal: #2aba76;       /* Slightly darker green for light bg contrast */
  --accent-teal-muted: rgba(42, 186, 118, 0.10);
  --accent-violet: #7c3aed;
  --accent-amber: #d9a23b;      /* Slightly darker amber for light bg contrast */
  --accent-amber-muted: rgba(217, 162, 59, 0.10);
  --destructive: #dc5454;       /* Slightly darker red for light bg */
  --destructive-muted: rgba(220, 84, 84, 0.10);
  --border: #e2e4ea;            /* Light gray borders */
  --border-subtle: #ecedf1;     /* Very subtle separators */
  --tertiary: #9196a8;          /* Lighter muted text */
  --input: #e2e4ea;
  --ring: #4f8fea;
  --warning: #d9a23b;
  --success: #2aba76;
  --chart-1: #4f8fea;
  --chart-2: #2aba76;
  --chart-3: #d9a23b;
  --chart-4: #dc5454;
  --chart-5: #7c3aed;
  --sidebar: #f3f4f7;           /* Match surface tone */
  --sidebar-foreground: #6b7084;
  --sidebar-primary: #4f8fea;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(79, 143, 234, 0.08);
  --sidebar-accent-foreground: #4f8fea;
  --sidebar-border: #e2e4ea;
  --sidebar-ring: #4f8fea;
}
```

### Design Principles
- **3-level hierarchy:** `background (#fafbfc)` → `surface (#f3f4f7)` → `card (#ffffff)` — cards pop, surfaces recede
- **Primary accent stays #4f8fea** — same blue in both themes for brand consistency
- **Semantic colors darkened** for light bg: green `#2aba76`, amber `#d9a23b`, red `#dc5454` — better contrast than dark-theme variants
- **Muted backgrounds use 0.08–0.10 opacity** — subtle on white without washing out

### Acceptance Criteria
- [ ] All `:root` variables updated with new palette
- [ ] Background hierarchy visible: page → surface → card
- [ ] Text readable on all backgrounds (foreground on bg, muted-foreground on card)
- [ ] No build errors

### Verification
- `npm run build` in frontend/
- Toggle to light mode — verify page background, sidebar, cards have distinct tones

---

## Task 2: Fix Hard-coded Colors in ApplicationCard

**FR:** FR-34 (no regressions)
**Files:** `frontend/src/components/jobs/application-card.tsx`

### Problem
ApplicationCard has 8+ hard-coded dark-theme hex colors:
- `bg-[#171b26]` → should be `bg-card`
- `border-[#252a3a]` → should be `border-border-subtle`
- `border-[#374151]` → should be `border-border`
- `text-[#e8eaf0]` → should be `text-foreground`
- `text-[#6b7280]` → should be `text-muted-foreground`
- `text-[#4b5563]` → should be `text-tertiary`
- `text-[#4f8fea]` → should be `text-primary`

### Changes
Replace all hard-coded hex values with semantic Tailwind theme classes.

### Acceptance Criteria
- [ ] Zero hard-coded hex colors in application-card.tsx
- [ ] Card looks correct in dark theme (visual parity with current)
- [ ] Card looks correct in light theme
- [ ] Drag-and-drop still works on Job Hunt kanban

### Verification
- Open /jobs in dark mode — verify cards look unchanged
- Toggle to light mode — verify cards are readable and styled

---

## Task 3: Fix Hard-coded Colors in Dashboard Components

**FR:** FR-33 (dashboard components render correctly in light theme)
**Files:**
- `frontend/src/components/dashboard/recent-activity.tsx`
- `frontend/src/components/dashboard/quick-actions.tsx`
- `frontend/src/components/dashboard/summary-cards.tsx`

### Problem
- **RecentActivity:** Hard-coded icon colors `text-[#4f8fea]`, `text-[#f0b849]`, `text-[#3dd68c]`
- **QuickActions:** Hard-coded colors in action definitions `#4f8fea`, `#3dd68c`, `#f0b849`
- **SummaryCards:** Color constants defined inline — need light-theme-aware values

### Changes
1. Replace hard-coded hex icon colors with CSS variable references (`text-primary`, `text-accent-amber`, `text-accent-teal`) or inline `var()` syntax where Tailwind classes aren't available
2. For inline style colors (icon badges with dynamic opacity backgrounds), use CSS variables: `var(--primary)`, `var(--accent-teal)`, `var(--accent-amber)`
3. Verify muted backgrounds (rgba with 0.12 opacity) contrast well on light theme — may need conditional opacity

### Acceptance Criteria
- [ ] No hard-coded hex colors for theme-dependent values
- [ ] Dashboard looks correct in dark theme (visual parity)
- [ ] Dashboard looks correct in light theme
- [ ] Stagger animations still work

### Verification
- Open / (dashboard) in both themes — verify cards, empty state, quick actions

---

## Task 4: Theme-aware Status & Priority Colors

**FR:** FR-34 (all existing pages render correctly)
**Files:**
- `frontend/src/types/job.ts` — `APPLICATION_STATUS_COLORS`
- `frontend/src/types/task.ts` — `PRIORITY_COLORS`, `PRIORITY_BG_COLORS`
- `frontend/src/components/jobs/application-column.tsx`
- `frontend/src/components/jobs/application-detail.tsx`
- `frontend/src/components/jobs/application-timeline.tsx`
- `frontend/src/components/jobs/status-change-dialog.tsx`

### Problem
`APPLICATION_STATUS_COLORS` uses hard-coded dark-theme hex values (#4f8ef7, #fbbf24, #34d399, #f87171, #4b5563). These are used as inline `style={{ color }}` — won't adapt to light theme.

`PRIORITY_COLORS` uses Tailwind color classes (text-red-500, text-orange-500) which mostly work but inconsistently. `PRIORITY_BG_COLORS` mixes Tailwind colors with CSS var syntax.

### Changes

1. **APPLICATION_STATUS_COLORS:** Replace hard-coded hex with CSS variable references:
   - Use `var(--tertiary)` for neutral (found, ghosted, withdrawn)
   - Use `var(--primary)` for active (saved, resume_generated, applied)
   - Use `var(--accent-amber)` for in-progress (screening)
   - Use `var(--accent-amber)` or orange for interviews
   - Use `var(--accent-teal)` for success (offer, accepted)
   - Use `var(--destructive)` for rejected

2. **PRIORITY_COLORS & PRIORITY_BG_COLORS:** Standardize to use CSS variables consistently. Replace `text-red-400/500` etc. with `text-destructive`, `text-warning`, etc. where possible, or keep Tailwind colors that already work in both themes.

### Acceptance Criteria
- [ ] APPLICATION_STATUS_COLORS uses CSS variable references
- [ ] Status colors render correctly in dark and light themes
- [ ] Job Hunt kanban shows correct status colors in both themes
- [ ] Application detail/timeline shows correct colors
- [ ] Priority badges in Task Manager correct in both themes

### Verification
- Open /jobs with applications — verify status colors in dark/light
- Open /tasks — verify priority badges in dark/light
- Open application detail page — verify timeline colors

---

## Task 5: Sidebar & Header Light Theme Polish

**FR:** FR-33, FR-35
**Files:**
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/components/layout/header.tsx`
- `frontend/src/components/layout/app-shell.tsx`

### Changes

1. **Sidebar:** Check avatar gradient (currently hard-coded `linear-gradient(135deg, #4f8fea, #7c5ce0)`) — works for both themes or needs light variant
2. **Sidebar active indicator:** Verify accent bar renders visibly on light surface background
3. **Header border:** Verify `border-border` is visible but subtle in light theme
4. **Scrollbar:** Update light-theme scrollbar colors if needed (thumb should be visible on white)

### Acceptance Criteria
- [ ] Sidebar looks cohesive in light theme — surface bg distinct from card/page bg
- [ ] Active nav indicator visible in both themes
- [ ] Avatar gradient visible in both themes
- [ ] Header border visible in light theme
- [ ] Scrollbar visible in light theme

### Verification
- Navigate between pages in light mode — verify sidebar active state
- Scroll long pages — verify scrollbar visible

---

## Task 6: Auth Pages & UI Components Light Theme Check

**FR:** FR-34
**Files:**
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/change-password/page.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/input.tsx`

### Changes

1. **Login page:** Verify background, card, form inputs, and button styles in light theme
2. **Change password page:** Same verification
3. **UI components with `dark:` modifiers:** Check button.tsx and input.tsx `dark:` utilities — ensure light equivalents are correct
4. Fix any issues found

### Acceptance Criteria
- [ ] Login page renders correctly in light theme
- [ ] Change-password page renders correctly in light theme
- [ ] All shadcn/ui components (buttons, inputs, dialogs, selects) work in light theme
- [ ] No `dark:` styles without corresponding light-theme styles

### Verification
- Open /login in light mode — verify appearance
- Navigate through app in light mode — test dialogs, dropdowns, forms

---

## Task 7: WCAG Contrast & Cross-Theme Regression Check

**FR:** FR-32, FR-33, FR-34, FR-35
**Files:** All modified files

### Changes

1. **WCAG AA Contrast Verification:**
   - foreground (#1a1c23) on background (#fafbfc) — must be ≥ 4.5:1
   - muted-foreground (#6b7084) on card (#ffffff) — must be ≥ 4.5:1
   - tertiary (#9196a8) on background (#fafbfc) — ≥ 3:1 for UI elements
   - primary (#4f8fea) on background — ≥ 3:1 for UI elements
   - accent colors on their muted backgrounds — verify readability

2. **Full page verification (both themes):**
   - / (Dashboard) — cards, empty state, quick actions
   - /tasks — kanban board, task cards, task detail
   - /jobs — job cards, application kanban, application detail
   - /calendar — event list, event detail
   - /settings — forms, inputs
   - /profile — user info

3. **Theme toggle transition test:**
   - Switch between themes — no flash of wrong colors
   - Both themes feel like the same product with adapted colors

4. **Build + Lint + Tests:**
   ```bash
   cd frontend && npm run lint && npm run build && npm test
   cd backend && python -m pytest tests/
   ```

### Acceptance Criteria
- [ ] All text meets WCAG AA contrast ratios in light theme
- [ ] All pages render without visual regressions in both themes
- [ ] Theme toggle feels cohesive — same product, different palette
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Frontend tests pass
- [ ] Backend tests pass

### Verification
- Manual contrast check with calculated ratios
- Navigate every page in both themes
- `npm run lint && npm run build && npm test`
- `python -m pytest tests/`

---

## Execution Order

```
Task 1 (CSS tokens) ──► Task 2 (ApplicationCard) ──┐
                    ├──► Task 3 (Dashboard)      ──┤
                    ├──► Task 4 (Status colors)  ──┤
                    └──► Task 5 (Sidebar/Header) ──┤
                                                    ├──► Task 6 (Auth + UI) ──► Task 7 (Regression)
```

Tasks 2, 3, 4, 5 can be parallelized after Task 1.
Task 6 verifies edge cases.
Task 7 is the final comprehensive check.

---

## Estimated Scope
- 7 tasks
- ~15 files modified
- Pure CSS/JSX changes — no API, no DB, no new dependencies
- Focus: CSS variables, replacing hard-coded hex colors, verification
