# PRD: Redesign Stage 5 — Mobile Adaptive + PWA Polish + QA Sweep

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-20 |
| Status | Draft |
| Priority | P0 |
| Source | `handoff/HANDOFF.md §8` (Адаптив), `handoff/PROMPT.md §Этап 5` |
| Related | `docs/prd-redesign-stage-4-command-palette-theme-polish.md` (AC-16 deferred here) |

---

## ⚠️ Pre-Implementation Checklist

**DO NOT skip this section. Follow the Audit Procedure at the bottom before opening the feature branch.**

| Gate | Check | Target |
|------|-------|--------|
| PC-1 | `main` HEAD = Stage 4 squash (`45b989d`) or later `docs:` commits; no pending Stage 4 fixups | Git log clean, at expected SHA |
| PC-2 | Stage 4 files present: `components/command-palette.tsx`, `hooks/use-route-history.ts`, `hooks/use-command-palette.tsx`, `components/theme-aware-toaster.tsx`, `components/layout/app-shell.tsx`, `public/manifest.json`, `app/layout.tsx` | All files exist; sidebar is hamburger-drawer on <md |
| PC-3 | Baseline tests pass locally: `npm test -- --run` = **350/365** (15 pre-existing flakes in `telegram-tab`, `job-detail-tracking`, `prompt-editor`) | Deviation > 0 new failures → investigate before proceeding |
| PC-4 | Baseline build green: `npm run build` succeeds; `npm run lint` = 0 errors / 38 warnings | Any new errors → investigate |
| PC-5 | Dev server smoke on desktop: `/`, `/tasks`, `/jobs`, `/reminders`, `/login` all 200, no runtime errors | Clean dev-server log |
| PC-6 | Kanban components located: `components/tasks/kanban-board.tsx`, `components/jobs/application-kanban.tsx` (or equivalent), both accept `hiddenColumns` prop | If no `hiddenColumns` prop — audit-fail, escalate |
| PC-7 | Mockup reference bookmarked: `handoff/mockups/hub-brutalist-v2.html` § mobile views (if present) | Section found or confirmed not present |

**Only after all PC-1…PC-7 are ✅ may the feature branch be opened.**

---

## Problem Statement

Hub is a **daily-use PWA** on iPhone 14/15 (iOS Safari engine, `display: standalone`). Stages 1-4 shipped the brutalist redesign on desktop, but no stage verified mobile breakpoints or PWA iOS-specific behavior. Symptoms observed during Stage 4 close and entry audit for Stage 5:

1. **`manifest.json` carries pre-Stage-1 palette** (`background_color: #0a0b0e`, `theme_color: #0a0b0e`) — splash screen and standalone statusbar render a slightly different hue from the app itself (`#0e0e0c` in `layout.tsx:26`).
2. **No viewport configuration for safe-area** — iPhone 14/15 Dynamic Island + home indicator not accounted for; in standalone mode, fixed top/bottom elements risk overlap.
3. **`h-screen` (= 100vh) in `app-shell.tsx:36`** — on iOS Safari with dynamic address bar, `100vh` is frozen to the largest viewport; content can overflow when the bar collapses.
4. **No `overscroll-behavior` rule** — rubber-band bounce exposes white/page-background on over-scroll, breaks PWA-native feel.
5. **Kanban boards** (`TasksPage` 6 statuses, `JobsPage` 12 statuses) use `flex gap-4 overflow-x-auto` — on 390px viewport, horizontal scroll across 6-12 columns is hostile for thumb-driven use.
6. **Touch targets not audited** — iOS HIG mandates ≥44×44px hit area; known risks: `<input type="checkbox">` in `ReminderList` (~16px), status dots in `TaskCard`, palette row icons.
7. **Stage 4 AC-16 untested** — `defaultTheme="system"` + `enableSystem` ship untested on a truly fresh browser profile (localStorage empty).
8. **Lighthouse a11y score unknown** for any page.

**Why now:** Stage 5 is the final stage of the redesign initiative (`handoff/HANDOFF.md §9` sequence complete). Subsequent initiatives (backend features, integrations) will inherit any mobile gaps if not closed here.

---

## Goals & Non-Goals

### Goals

- Hub renders correctly and is pleasant to use on iPhone 14/15 in PWA standalone mode (both themes).
- All 12 routes reachable from Command Palette (+ Login) pass a manual QA sweep at ≥960px AND ≤390px, both themes = **48 visual checks**.
- No `console.error` on any route, desktop or mobile.
- Lighthouse accessibility ≥90 on Today (`/`), Tasks (`/tasks`), Reminders (`/reminders`).
- Stage 4 debt closed: AC-16 strict verified.

### Non-Goals

- Bottom tab-bar or any sidebar pattern change — keep the existing hamburger-drawer in `app-shell.tsx`.
- Mobile-specific redesign of Command Palette — cmdk already renders 94vw at <640px per Stage 4 (AC-16 from Stage 4 docs).
- Vitest integration tests for responsive behavior — manual QA only per discovery Q9a.
- Offline strategy / Service Worker improvements — `public/sw.js` stays as-is.
- Push notifications, maskable icon fixes, PWA install prompt UX.
- Visual redesign of any component shipped in Stages 1-4 — only layout tweaks under `max-md:` media.
- Adding a custom Tailwind breakpoint at 960px — use Tailwind defaults (`md:` = 768px, `lg:` = 1024px). Spec's 960px is honored in spirit; anything visibly broken in the 760-960 gray zone is fixed ad hoc.
- Backend, schema, API, or hook signature changes.

---

## User Scenarios

### Scenario 1: Morning Today check on iPhone

**As a** user on iPhone 14/15 opening the Hub PWA icon,
**I want to** see Today (`/` — plan mode if planned, else Stage 2 fallback) render cleanly in the first viewport,
**so that** I can scan my day without zooming, scrolling horizontally, or seeing layout break at safe-area boundaries.

### Scenario 2: Quick Task status change on mobile

**As a** user managing tasks from my phone,
**I want to** open `/tasks`, see a Kanban with a single visible column controlled by filter pills at the top, and tap a task to edit it,
**so that** I don't fight horizontal scroll across 6 columns.

### Scenario 3: Light-mode toggle on fresh device

**As a** user installing Hub PWA on a new iPhone with iOS system-preference "light",
**I want to** see Hub render in light theme on first load without any manual toggle,
**so that** Stage 4's `defaultTheme="system"` promise holds.

### Scenario 4: Reminder check-off

**As a** user on iPhone 390px width,
**I want to** tap the reminder checkbox and have it register cleanly on the first try,
**so that** I don't have to aim carefully at a 16px target.

---

## Functional Requirements

### P0 — PWA Baseline Fixes

- [ ] **FR-1: Viewport meta with safe-area.** Add `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0e0e0c" }` to `frontend/src/app/layout.tsx`. Remove the duplicated `themeColor` from the existing `metadata` object (Next.js 16 App Router deprecates it in `metadata`).
- [ ] **FR-2: Safe-area CSS utilities.** In `globals.css`, reserve padding on fixed-position chrome via `env(safe-area-inset-*)`:
  - Mobile sidebar overlay (`AppShell:47`): `padding-top: env(safe-area-inset-top)`, `padding-bottom: env(safe-area-inset-bottom)`.
  - Header (`components/layout/header.tsx`): top padding bumped by `env(safe-area-inset-top)` on standalone mode (only when `display-mode: standalone`).
  - Main content area: no change needed (scrolls inside header-anchored container).
- [ ] **FR-3: Replace `h-screen` with `h-dvh`.** In `app-shell.tsx:36`, change `flex h-screen overflow-hidden` → `flex h-dvh overflow-hidden`. In `sidebar.tsx:64`, change `flex h-screen flex-col` → `flex h-dvh flex-col` (mobile overlay uses full sidebar). Grep for any other `h-screen` / `min-h-screen` and fix cases where viewport height is expected to track dynamic chrome.
- [ ] **FR-4: Overscroll behavior.** In `globals.css`, add `html, body { overscroll-behavior: none; }` — eliminates rubber-band bounce in PWA standalone.
- [ ] **FR-5: manifest.json palette sync.** `public/manifest.json`: `background_color: #0a0b0e → #0e0e0c`, `theme_color: #0a0b0e → #0e0e0c`. Align with `layout.tsx` themeColor.
- [ ] **FR-6: manifest.json start_url.** `public/manifest.json`: `start_url: "/reminders" → "/"`. Today is the canonical main page after Stage 2.

### P0 — Responsive Layout (≤960px)

- [ ] **FR-7: Verify existing responsive grids.** The following already collapse via Tailwind `md:` / `lg:` prefixes and should be visually verified on 390px + 768px, no code change unless broken:
  - `app/(dashboard)/page.tsx:66` (Plan-mode: FocusQueue | FixedSchedule): `lg:grid-cols-[1.6fr_1fr]` → collapses <1024px.
  - `app/(dashboard)/page.tsx:90` (SignalsFeed row wrapper — already `md:grid-cols-[1.5fr_1fr]`).
  - `app/(dashboard)/page.tsx:98` (No-plan: 2-col): `lg:grid-cols-[1.6fr_1fr]` → collapses <1024px.
  - `app/(dashboard)/reminders/page.tsx:149` (Reminders | Birthdays): `md:grid-cols-[1.7fr_1fr]` → collapses <768px.
  - `components/today/signals-feed.tsx:55`: `sm:grid-cols-2 md:grid-cols-4` → staircase collapse.
  - `components/today/hero-cells.tsx:89`: `grid-cols-2 grid-rows-2` **preserved** per HANDOFF §8 (.stats-grid stays 2×2).
  - `components/today/stats-grid.tsx:75`: `grid-cols-2 grid-rows-2` **preserved**.
  - `components/jobs/jobs-hero.tsx:53`: `grid-cols-2 md:grid-cols-4` → collapses <768px. ✓
- [ ] **FR-8: Global main padding.** `AppShell.tsx:61`: `<main className="flex-1 overflow-y-auto p-6 md:p-6">` → reduce to `p-4 md:p-6` (16px on mobile, 24px desktop).

### P0 — Kanban Mobile Transformation

- [ ] **FR-9: Status filter pills component.** New file `frontend/src/components/shared/status-filter-pills.tsx` (shared across Tasks and Jobs):
  ```ts
  interface Status { value: string; label: string; count: number; }
  interface Props {
    statuses: Status[];
    selected: string | null; // null = show all
    onSelect: (v: string | null) => void;
    className?: string;
  }
  ```
  Renders a horizontally scrollable row of brutalist pills (`border var(--line)`, `uppercase text-xs`, acid-lime active state). Tap a pill → calls `onSelect(value)`. First pill is "ALL" (`selected = null`).
- [ ] **FR-10: Tasks Kanban mobile wiring.** In `app/(dashboard)/tasks/page.tsx`:
  - New state `const [mobileStatusFilter, setMobileStatusFilter] = useState<TaskStatus | null>(null)`.
  - Hook `useMediaQuery("(max-width: 959px)")` from `frontend/src/hooks/use-media-query.ts` (create new file — 20 lines, `useSyncExternalStore` pattern).
  - Conditional rendering:
    - When `!isMobile`: pass `hiddenColumns={hiddenColumns}` as-is to `<KanbanBoard>`.
    - When `isMobile`: render `<StatusFilterPills statuses={...} selected={mobileStatusFilter} onSelect={setMobileStatusFilter} />` above Kanban; compute `const mobileHidden = TASK_STATUS_ORDER.filter(s => mobileStatusFilter !== null && s !== mobileStatusFilter)`; pass merged `hiddenColumns = [...existing, ...mobileHidden]`.
  - When 1 status visible: `KanbanBoard` still uses `flex gap-4 overflow-x-auto`, but with only 1 column the `overflow-x-auto` is harmless.
- [ ] **FR-11: Jobs Kanban mobile wiring.** Mirror FR-10 in `app/(dashboard)/jobs/page.tsx` (or wherever the ApplicationKanban lives — confirm during audit). Same `useMediaQuery`, same pills, same `hiddenColumns` merge.
- [ ] **FR-12: Pills use actual counts.** `StatusFilterPills` receives `count` per status from the board data — mobile user sees `OPEN (3) · IN_PROGRESS (1) · DONE (12)` etc.

### P0 — Touch Targets (global audit)

- [ ] **FR-13: Global audit for <44px interactive elements.** Grep for `<input type="checkbox"`, `<button`, and shadcn `<Checkbox>` across `frontend/src/`. For each match:
  - If the element has explicit `w-`/`h-` < 44px → wrap in `<label className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center">` OR add `p-2` to increase hit area without visual change.
  - Document findings (before → after) in a `docs/stage-5-touch-audit.md` scratch file, gitignored. Fixes go into commits along the way.
- [ ] **FR-14: Known-risk fixes.**
  - `ReminderRow` checkbox in `reminder-list.tsx` — hit area ≥44×44.
  - `TaskCard` status indicator + card itself — card is already tap-large; verify.
  - Command Palette rows — rows are already `py-2` with `h-auto`; verify ≥44.
  - Header theme-toggle button — verify.
  - Sidebar nav items — verify (already `py-[8px]` which is 8px vertical; combined with text height ≈ 28px total, **likely under 44px**; bump to `py-[12px]` under `max-md:`).
  - Mobile menu burger in `header.tsx:83` — `w-7 h-7` = 28px, **fails**; bump to `w-11 h-11` (44px) under `max-md:`.

### P0 — QA Sweep

- [ ] **FR-15: Manual QA checklist executed.** Produce `docs/stage-5-qa-results.md` (gitignored — scratch) listing each of the 48 checks (12 routes × 2 themes × 2 widths) with ✅ / ❌ / N/A + notes. Routes:
  1. `/` Today (plan mode, when planner has plan today)
  1b. `/` Today (no-plan mode, 404 fallback)
  2. `/tasks`
  3. `/jobs`
  4. `/jobs/search`
  5. `/reminders`
  6. `/reminders/birthdays`
  7. `/notes`
  8. `/pulse`
  9. `/vitals` (hidden from nav but route exists per Stage 1 decision)
  10. `/settings`
  11. `/login`
  12. `/profile`
- [ ] **FR-16: Lighthouse a11y ≥90.** Run `npx lighthouse http://localhost:3000/<route> --only-categories=accessibility --view` (or Chrome DevTools Lighthouse panel) on `/`, `/tasks`, `/reminders`. If <90 — fix ARIA/contrast/label issues; if fix would exceed Stage 5 scope, document in "Known items" and link follow-up.
- [ ] **FR-17: iOS Safari live smoke.** Final pass on real iPhone 14/15 in PWA standalone mode (add to home screen → open): test Today, Tasks, Reminders, Jobs. Verify safe-area, no overflow, bottom-sheet dialogs don't get cut, theme matches system preference on first install.

### P0 — Stage 4 Debt

- [ ] **FR-18: AC-16 strict test.** In Chrome Incognito (empty localStorage):
  - macOS system preference → Light. Visit `http://localhost:3000` → Hub renders light.
  - macOS system preference → Dark. Reload. → Hub renders dark.
  - Toggle ThemeToggle manually → persists to `hub-theme` in localStorage → on next reload, user's explicit choice wins over system.
  - Record result in `docs/stage-5-qa-results.md`.

---

## Non-Functional Requirements

- **iOS Safari WebKit compat**: all CSS uses vendor-neutral syntax; avoid `-webkit-` prefixes unless necessary (e.g., `-webkit-overflow-scrolling: touch` is deprecated, skip).
- **No layout shift** between ≥960px and ≤390px at load time — lazy responsive logic must not flash a desktop layout before collapsing.
- **Accessibility**: all interactive elements keyboard-reachable on desktop; screen-reader labels on StatusFilterPills (`aria-label="Filter tasks by status"`).
- **Performance**: no new JS dependencies beyond what Stage 4 introduced. `useMediaQuery` is 20 hand-rolled lines, not a library.

---

## Technical Design

### Stack

- No new dependencies.
- Tailwind 4 utilities: `max-md:`, `lg:`, `env(safe-area-inset-*)` via CSS variables, `h-dvh`.
- Next.js 16 App Router: `export const viewport` pattern (not `metadata.themeColor` which is deprecated).
- React 19: new `useMediaQuery` hook via `useSyncExternalStore` (same pattern as Stage 4's `useRouteHistory`).

### Chosen Approach

**Incremental, surgical, frontend-only.** Zero changes to backend, schema, hooks signatures, or Stage 1-4 components beyond `className` tweaks. All mobile behavior gated behind `max-md:` (Tailwind 768px) or JS `useMediaQuery("(max-width: 959px)")` where a React conditional is required (Kanban rendering).

### Key Components & Files

| File | Change type | Notes |
|------|-------------|-------|
| `frontend/src/app/layout.tsx` | Modify | Add `viewport` export, remove duplicated `themeColor` from `metadata` |
| `frontend/src/app/globals.css` | Modify | Add safe-area utilities, `overscroll-behavior: none`, ensure `.dark` / `html.light` unaffected |
| `frontend/src/components/layout/app-shell.tsx` | Modify | `h-screen → h-dvh`, safe-area on mobile overlay, main padding |
| `frontend/src/components/layout/sidebar.tsx` | Modify | `h-screen → h-dvh`, mobile nav item padding bump |
| `frontend/src/components/layout/header.tsx` | Modify | Burger `w-7 h-7 → max-md:w-11 max-md:h-11`, safe-area top in standalone |
| `frontend/src/components/reminders/reminder-list.tsx` | Modify | Checkbox hit area bump |
| `frontend/src/hooks/use-media-query.ts` | Create | 20-line `useSyncExternalStore` hook |
| `frontend/src/hooks/__tests__/use-media-query.test.tsx` | Create | 3-4 tests (match true/false, listener cleanup, SSR safe) |
| `frontend/src/components/shared/status-filter-pills.tsx` | Create | ~50 lines |
| `frontend/src/components/shared/__tests__/status-filter-pills.test.tsx` | Create | 3-4 tests |
| `frontend/src/app/(dashboard)/tasks/page.tsx` | Modify | Mobile filter state + pills + hiddenColumns merge |
| `frontend/src/app/(dashboard)/jobs/page.tsx` | Modify | Same as tasks |
| `frontend/public/manifest.json` | Modify | Palette sync + start_url |

---

## Acceptance Criteria

- [ ] **AC-1**: On iPhone 14/15 PWA standalone, Hub header does not overlap Dynamic Island; home-indicator area does not overlap mobile menu drawer footer. *(FR-1, FR-2)*
- [ ] **AC-2**: Scrolling `/` at 390px until Safari address bar collapses — no visible content gap below footer-equivalent. *(FR-3)*
- [ ] **AC-3**: Over-scrolling `/tasks` at top on iOS Safari PWA — no white background exposed; scroll just stops. *(FR-4)*
- [ ] **AC-4**: Tap Hub home-screen icon → opens at `/`, splash screen color matches app bg (no hue jump). *(FR-5, FR-6)*
- [ ] **AC-5**: At 390px viewport, `/` no-plan-mode renders all 6 blocks (Hero priority, HeroCells 2×2, Timeline, Stats 2×2, Reminders-today, Signals) in a single scroll column; no horizontal scroll. *(FR-7)*
- [ ] **AC-6**: At 390px viewport, `/reminders` left column (reminders) stacks above right column (birthdays); no 2-col grid visible. *(FR-7)*
- [ ] **AC-7**: At 390px viewport, `/jobs` JobsHero 2×2 (not 1×4). *(FR-7)*
- [ ] **AC-8**: At 390px, `/tasks` shows StatusFilterPills above Kanban; default pill = "ALL" showing all columns via horizontal scroll OR a single named pill shows only that column — both modes work. *(FR-10, FR-12)*
- [ ] **AC-9**: At 390px, `/jobs` shows StatusFilterPills, same behavior. *(FR-11)*
- [ ] **AC-10**: Pill counts match Kanban column counts at time of render. *(FR-12)*
- [ ] **AC-11**: Tapping a Reminder checkbox on 390px works reliably 5/5 times without zoom. *(FR-13, FR-14)*
- [ ] **AC-12**: Tapping mobile menu burger at 390px opens drawer; tapping outside closes; tapping a nav item closes. *(existing behavior, verify)*
- [ ] **AC-13**: All 48 QA-sweep entries in `docs/stage-5-qa-results.md` are ✅ or N/A (no ❌). *(FR-15)*
- [ ] **AC-14**: Lighthouse a11y ≥90 on `/`, `/tasks`, `/reminders`. *(FR-16)*
- [ ] **AC-15**: No `console.error` on any of 12 routes × 2 themes at 960 and 390 widths. *(FR-15)*
- [ ] **AC-16**: iOS Safari PWA live smoke — no visual break on Today, Tasks, Reminders, Jobs. *(FR-17)*
- [ ] **AC-17**: Stage 4 AC-16 strict: Incognito + macOS light → Hub light; macOS dark → Hub dark; manual toggle persists and overrides system. *(FR-18)*

---

## Interface Contracts

These are the fragile code boundaries that the audit procedure must verify against reality before implementation. If any contract is wrong, patch the PRD (rename/signature/layout) before writing code.

| IC | Reality expected at audit | If drift |
|----|--------------------------|----------|
| IC-1 | `AppShell.tsx:36` contains `flex h-screen overflow-hidden` | Adjust FR-3 |
| IC-2 | `sidebar.tsx:64` contains `flex h-screen flex-col` | Adjust FR-3 |
| IC-3 | `header.tsx:83` burger button is `w-7 h-7` with `md:hidden` | Adjust FR-14 |
| IC-4 | `KanbanBoard` accepts prop `hiddenColumns?: TaskStatus[]` | Escalate; rewiring without this prop doubles scope |
| IC-5 | Jobs Kanban (wherever it lives) accepts equivalent `hiddenColumns` prop | Escalate |
| IC-6 | `TASK_STATUS_ORDER` exported from `types/task.ts`; Jobs equivalent exported from `types/job.ts` | Adjust FR-10/11 imports |
| IC-7 | `public/manifest.json` has `background_color`, `theme_color`, `start_url` keys as top-level strings | Adjust FR-5/6 |
| IC-8 | `app/layout.tsx` uses `export const metadata` with `themeColor` inline | Next.js 16 may already have moved this to `viewport` — skip FR-1 removal if not present |
| IC-9 | `ReminderList` checkbox is a native `<input type="checkbox">` (not shadcn `<Checkbox>`) | Adjust FR-14 wrapping strategy |
| IC-10 | No existing `useMediaQuery` hook in `frontend/src/hooks/` | If one exists, use it; skip FR-create |
| IC-11 | `components/shared/` directory exists or is acceptable to create | If not, use `components/ui/` or per-page placement |
| IC-12 | `globals.css` has `html.light` overrides block from Stage 1 | Confirm safe-area additions don't conflict |

---

## Audit Procedure

**Execute before opening the `feat/redesign-stage-5-mobile-qa` branch.**

1. **Git state** (PC-1): `git log --oneline -10 main` — confirm Stage 4 squash `45b989d` present.
2. **File inventory** (PC-2): `ls` check all files in the PRD "Key Components" table. Any unexpected absence/presence → investigate.
3. **Baseline verification** (PC-3, PC-4, PC-5): run the three commands; record deltas.
4. **IC walk** (IC-1…IC-12): for each interface contract, do a `grep -n` or `Read` on the cited line/file. Build a matrix ✅/drift. For each drift, decide: patch PRD (commit on `main` as `docs: stage-5 pre-build audit — <adjustments>`) or escalate.
5. **Mockup check** (PC-7): open `handoff/mockups/hub-brutalist-v2.html` in browser, resize to 390px, note any spec-level guidance not captured above.
6. **Decision**: GO / NO-GO / PATCH. Record in `CLAUDE.md` Current Status under "Stage 5 entry audit".

**Skipping this procedure is forbidden.** Every Stage 1-4 shipped cleanly because drift was caught in audit, not during implementation.

---

## Out of Scope

- Bottom tab bar pattern (explicit — hamburger stays per Q4).
- Custom Tailwind breakpoint at exactly 960px (use defaults).
- Mobile Command Palette redesign (already 94vw per Stage 4).
- Vitest tests for responsive behavior (manual QA per Q9).
- PWA offline improvements, maskable icons, install prompt.
- Any Stage 1-4 component visual redesign beyond `className` tweaks.
- Backend, schema, API, hook-signature changes.
- Touch gestures (swipe-to-close drawer, swipe-to-delete reminder) — backlog candidate.
- Haptics / vibration on tap — iOS limited in PWA, not worth it.
- Bottom-sheet dialog patterns — shadcn Dialog stays centered modal.

---

## Risks & Known Items

1. **iOS Safari `h-dvh` support**: landed in iOS 15.4 (2022). User on iPhone 14/15 — well-covered. Android Chrome: landed in 108 (2022). No fallback needed.
2. **`env(safe-area-inset-*)` support**: iOS 11+. Universal.
3. **Tailwind 4 `max-md:` prefix**: shipped in Tailwind 3.2+. Current project on 4.x. ✓
4. **`useMediaQuery` SSR**: must render "desktop" on first paint to avoid hydration mismatch. The hook returns `false` on server (no window), then snaps to correct value on client. Accept a single-frame flash on mobile; alternative is `window.matchMedia` in a layout effect which delays first paint. Flash is acceptable.
5. **Kanban filter state reset on rotation**: if user turns device from portrait→landscape at 960px boundary, `mobileStatusFilter` persists but filter UI disappears. State becomes orphaned but harmless — clears on page reload.
6. **`overscroll-behavior: none` on body**: on rare Safari bugs, this can prevent pull-to-refresh. Accept — Hub doesn't use pull-to-refresh.
7. **Lighthouse a11y <90 on one route**: known unknown. If SignalsFeed or Pulse renders user-generated content with low-contrast — may need a color-contrast fix. Budget ~1hr for this; exceed → document + follow-up.
8. **iPhone PWA live test requires real device**: author owns iPhone, so not a blocker. If device unavailable at ship-time, defer AC-16 to post-ship and note in status.
9. **`mobile-web-app-capable` meta**: Stage 4 added `"mobile-web-app-capable": "yes"` in `metadata.other`. In Next 16, this belongs on viewport or apple-specific. Verify during audit.
10. **Status filter pill overflow**: 12 statuses on Jobs × ~60px each = 720px of horizontal content. Pills row uses `overflow-x-auto` — user can scroll. Acceptable; if feels bad in smoke, shorten labels.

---

## Open Questions

None at PRD-draft time. Open questions will be logged in the pre-build audit record if any arise during IC walk.

---

## Implementation Phasing

**Single branch, single squash merge.** No sub-phases. Task ordering per the forthcoming plan:

1. **Entry audit** (Task 1) — PC-1…PC-7 + IC walk + PRD patch if needed.
2. **PWA baseline** (Tasks 2-6) — FR-1…FR-6. Small, independent, low-risk.
3. **Layout tweaks** (Tasks 7-8) — FR-7 verification + FR-8 padding.
4. **Kanban mobile** (Tasks 9-13) — FR-9 pills component + tests, FR-10 Tasks wiring, FR-11 Jobs wiring, FR-12 counts, `useMediaQuery` hook + tests.
5. **Touch targets** (Tasks 14-15) — FR-13 global audit + FR-14 known-risk fixes.
6. **Verify + QA** (Tasks 16-19) — lint, build, tests, local dev smoke, FR-15 48-check sweep, FR-16 Lighthouse.
7. **iOS + Stage 4 debt** (Tasks 20-21) — FR-17 live PWA smoke, FR-18 AC-16 strict.
8. **Ship** (Task 22) — squash merge to `main`, push, update `CLAUDE.md`.

---

## References

- Spec: `handoff/HANDOFF.md §8` (Адаптив), `§9 Этап 5`.
- Mockup: `handoff/mockups/hub-brutalist-v2.html`.
- Data map: `handoff/DATA-MAP.md`.
- Tokens: `handoff/TOKENS.md`.
- Prior Stage 4 PRD: `docs/prd-redesign-stage-4-command-palette-theme-polish.md` (AC-16 deferral documented).
- Stage 4 shipped: commit `45b989d` on `main`.
