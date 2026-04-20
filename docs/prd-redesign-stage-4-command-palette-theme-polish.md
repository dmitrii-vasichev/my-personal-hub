# PRD: Redesign Stage 4 — Command Palette + Theme Toggle Polish

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-20 |
| Status | Draft |
| Priority | P1 |
| Size | Medium (~1.5 days) |
| Source | `handoff/PROMPT.md` §Этап 4, mockup `handoff/mockups/hub-brutalist-v2.html` |

---

## ⚠️ Before starting Build — run the Pre-Implementation Checklist below

This PRD assumes specific current state. That state may drift between PRD authoring
and Build kickoff (other branches can land; cmdk API can change). **Run PC-1…PC-6
and the Audit Procedure before opening the feature branch.** Skipping this step
is a leading cause of plan drift in Stage 2a and Stage 3 and is explicitly forbidden.

---

## Problem Statement

After Stages 1–3 the frontend has a polished brutalist shell (tokens, sidebar, Today,
Tasks/Reminders/Jobs re-skin), but two keyboard-first affordances from the handoff
spec are missing or half-shipped:

1. **No Command Palette.** There is no ⌘K overlay for quick navigation or actions.
   `handoff/PROMPT.md` §Этап 4 and `handoff/mockups/hub-brutalist-v2.html` L308–322
   + L847–864 lock the shape: a 620px centered modal with acid-lime border, an
   input with `▸` prompt, and sectioned rows (`QUICK ACTIONS`, `JUMP TO`,
   `RECENT`). Today's only fast navigation is mouse-clicking the sidebar.
2. **Theme toggle is half-shipped.** Stage 1 delivered a click-flip via
   `next-themes` (`frontend/src/components/theme-toggle.tsx`), but:
   - localStorage key is the `next-themes` default (`theme`), not `hub-theme` as
     spec requires — isolation and portability issue.
   - `defaultTheme="dark"` — system preference is ignored on the first visit.
   - `sonner` `<Toaster />` in `layout.tsx` is not synced with `next-themes`
     `resolvedTheme`, so toasts in light theme render against a dark chrome and
     vice versa if the visitor's system defaults differ.

This is the last chunk of the redesign handoff before mobile adaptation (Stage 5).
Delivering it cleanly unblocks the Stage 5 QA sweep (`⌘K работает из любой
страницы` is an explicit Stage 5 checklist item).

---

## Goals & Non-Goals

### Goals

- Ship a keyboard-first Command Palette that opens from anywhere with ⌘K/Ctrl+K
  and supports arrow navigation, Enter to select, Esc to close.
- Make palette discoverable on non-keyboard entry paths (trigger button in header).
- Let the palette **jump** between all 10 sidebar routes and trigger the two
  most-common create actions (task / reminder). ~~(note)~~ — removed in PRD
  patch 2026-04-20: `/notes` is a Google Drive viewer, not a create-a-note
  surface, so a `New note…` quick action would be misleading.
- Surface recently-visited routes so returning to the previous context is one step.
- Align theme toggle with handoff spec: `hub-theme` localStorage key, respect
  system preference on first visit, keep `sonner` Toaster in sync.

### Non-Goals (explicit, driven by Q1…Q13 discovery)

- ❌ Backend search endpoint or query across entities (tasks/jobs/notes). v1 is
  client-side filter over the static palette rows only. **Backlog.**
- ❌ Global hotkeys beyond ⌘K — no `⌘N` / `⌘R` / `⌘⇧N` / `G T` wired. Mockup's
  shortcut-hint column in rows is **removed** (Q4a-i): showing a non-working
  shortcut is an anti-UX.
- ❌ RECENT section tracking **entities** (open task #123, job Stripe, etc.).
  v1 tracks **routes only**. Entity-level RECENT is a separate feature
  requiring detail-page instrumentation and stale-entity handling. **Backlog.**
- ❌ A "Follow system" third state for the theme toggle — the button stays
  2-state (dark ↔ light). System preference only affects the first-visit default.
- ❌ Migration of the old `theme` localStorage value → `hub-theme` — solo dev,
  one-time re-pick is fine.
- ❌ Full mobile redesign of the palette — the mockup's `max-width: 94vw` rule
  already handles small viewports acceptably (Q10c). Stage 5 will cover any
  remaining mobile polish.
- ❌ Any backend / schema / FastAPI changes. Frontend-only, consistent with
  Stages 1–3.
- ❌ `New note…` quick action (patch 2026-04-20). `/notes` is a Google Drive
  viewer — no create-a-note dialog or inline-form exists in UI. Adding a
  fake quick action that just routes to `/notes` would be UX-misleading.
  Re-surfaces only if / when Notes gains a first-class create flow.

---

## User Scenarios

### Scenario 1 — Jump between pages by keyboard

**As a** solo developer using the Hub daily, **I want to** press ⌘K from any
page and type a few letters of a destination (`"tsk"` → `Tasks`, `"job"` →
`Jobs`, `"rem"` → `Reminders`), **so that** I can switch context without
mousing to the sidebar.

### Scenario 2 — Quick action from anywhere

**As a** user mid-task on `/jobs`, **I want to** press ⌘K → highlight
`New task…` → Enter, **so that** I end up on `/tasks` with the task-create
dialog already open, without breaking flow.

### Scenario 3 — Return to previous context

**As a** user who just finished reviewing a Pulse digest, **I want to** open
⌘K and see my last 5 visited routes at the top, **so that** one down-arrow +
Enter takes me back to the Task I was working on.

### Scenario 4 — First-time system theme

**As a** user visiting the Hub for the first time on a light-mode macOS,
**I want** the Hub to render in light theme without a flash of dark, **so
that** it matches my OS chrome. Subsequent explicit theme toggles should
persist across reloads.

### Scenario 5 — Toast readability after theme toggle

**As a** user who toggled the theme to light, **I want** `sonner` toasts
(`toast.error`, `toast.success`) to render with a light chrome matching the
page, **so that** there's no visual seam between the toast and the page
background.

---

## Functional Requirements

### P0 (Must Have)

- [ ] **FR-1:** `⌘K` (macOS) / `Ctrl+K` (Windows/Linux) opens the Command
      Palette from anywhere in the authenticated shell. Works even when focus
      is inside a text input, textarea, or contenteditable (Q12a-i).
      `event.preventDefault()` is called so browser defaults don't interfere.
- [ ] **FR-2:** Palette renders as a centered modal: 620px wide on desktop,
      `max-width: 94vw` on narrow viewports (Q10c). Dimmed backdrop
      (`rgba(0,0,0,0.55)` + `backdrop-filter: blur(4px)`), 2px `var(--accent)`
      border, matches mockup §.cmd-b / §.cmd-m. Input row at top with `▸`
      prompt indicator, placeholder `"search or type a command…"`, and a
      small `ESC` hint at the right edge.
- [ ] **FR-3:** Palette contains three sections rendered in this order:
      `QUICK ACTIONS` (**2** rows — patch 2026-04-20, was 3),
      `JUMP TO` (10 rows — all sidebar routes),
      `RECENT` (0–5 rows — recently visited routes, section is hidden when
      the history is empty). Section headers match mockup §.cmd-s (uppercase,
      2px letter-spacing, `var(--ink-3)` color). Row height and gap match
      mockup §.cmd-r.
- [ ] **FR-4:** Each palette row renders: leading glyph (22px column,
      `var(--ink-3)`), label (ink color). **No trailing shortcut-hint
      column** (Q4a-i — deviation from mockup §.cmd-r which has a `<span
      class="m">⌘N</span>` tail; we drop it since shortcuts are not wired
      globally in v1).
- [ ] **FR-5:** `QUICK ACTIONS` rows + their click/Enter targets
      (patch 2026-04-20: was 3 rows, now 2):
      - `New task…` (glyph `+`) → `router.push("/tasks?new=1")`.
      - `Remind me…` (glyph `◷`) → `router.push("/reminders?new=1")`.
      On click/Enter the palette closes and the input clears.
- [ ] **FR-6:** `JUMP TO` contains exactly the 10 routes from
      `frontend/src/components/layout/sidebar.tsx` (`Today`, `Tasks`,
      `Reminders`, `Meetings`, `Job Hunt`, `Outreach`, `Notes`, `Pulse`,
      `Settings`, `Profile`), in sidebar order. `Outreach` is **hidden for
      the demo role** (consistent with sidebar's `hideForDemo: true`).
      Click/Enter → `router.push(href)`, palette closes, input clears.
- [ ] **FR-7:** `RECENT` surfaces the last 5 **unique** visited routes,
      most-recent first. Data source: `useRouteHistory()` hook reading
      `localStorage["hub-recent-routes"]` (array of pathnames, capped at 5,
      de-duplicated on push). Current page is **excluded** from the list (so
      a reload doesn't immediately show the current page as the top recent).
      Section is hidden entirely when the array is empty.
- [ ] **FR-8:** Client-side fuzzy filter on the input (Q2a). Query matches
      label case-insensitively. Rows without a match hide. Section headers
      hide when their section has zero visible rows. Filter is incremental
      (every keystroke, no debounce — ≤15 rows is instant). No backend calls.
- [ ] **FR-9:** When every section has zero matches, the palette shows a
      single center-aligned row `"No results"` in `var(--ink-3)` (Q6a). No
      section headers are shown. Row is non-clickable.
- [ ] **FR-10:** Keyboard navigation:
      - `↑` / `↓` moves the highlighted row through the **visible** rows
        (filter-aware), **wrapping around** at boundaries (Q12c-i).
      - `Enter` activates the highlighted row (same target as click).
      - `Esc` closes the palette AND clears the query (Q12b-i).
      - `Tab` / `Shift+Tab` behave like in a regular input (no special
        handling — `cmdk` default is fine).
- [ ] **FR-11:** Header trigger button. A button lives in the header row
      (`frontend/src/components/header.tsx`), left of `◐ THEME`. Layout:
      `[▸ search ⌘K]` using brutalist tokens matching the existing theme
      button style (h-7, `border-[color:var(--line)]`, hover swaps to
      `var(--ink)`). Click opens the palette (same entry as ⌘K). On mobile
      (<760px) the `⌘K` keyboard-hint span hides (via `hidden sm:inline`).
- [ ] **FR-12:** `ThemeProvider` in `app/layout.tsx` uses:
      `storageKey="hub-theme"`, `defaultTheme="system"`, `enableSystem`,
      `attribute="class"`. `next-themes` writes `class="dark"` or `class="light"`
      on `<html>` (existing behavior — `html.light` overrides in `globals.css`
      keep working).
- [ ] **FR-13:** `sonner` Toaster is extracted from `app/layout.tsx` into a
      client component (`components/theme-aware-toaster.tsx`) that reads
      `resolvedTheme` via `useTheme()` and passes it through as
      `<Toaster theme={resolvedTheme === "light" ? "light" : "dark"} />`.
      Toast chrome follows the page theme without a frame-late flash.

### P1 (Should Have)

- [ ] **FR-14:** `?new=1` query-param wire-up on the two quick-action
      targets (patch 2026-04-20 — `/notes` removed, `/reminders` semantics
      clarified after audit of the actual components):
      - `/tasks`: `useEffect` listens on `searchParams.get("new") === "1"`,
        calls `setCreateDialogStatus("new")` (existing state in
        `tasks/page.tsx:70`) to open `<TaskDialog>`, then **removes** the
        param via `router.replace("/tasks")` to prevent re-trigger on reload.
      - `/reminders`: **scrolls to and focuses the existing `<QuickAddForm>`**
        — the reminders page has NO create dialog, only an inline quick-add
        form at `reminders/page.tsx:131` with a `quickAddRef`. `useEffect`
        listens on `searchParams.get("new") === "1"`, calls the same
        `scrollToQuickAdd()` helper already defined at line 45, **and**
        focuses the first input inside the form, then scrubs the param.
        This requires the reminders page to add a `useSearchParams` import
        (currently not present) and expose a way for the quick-add form's
        first input to be focused (e.g. via a second ref or a
        `data-autofocus` attribute picked up in the effect).
- [ ] **FR-15:** Focus management. When the palette opens, the input
      auto-focuses. When it closes, focus returns to the element that had
      focus before opening (`cmdk` handles this; verify with PC-6 smoke).

---

## Non-Functional Requirements

- **Accessibility:** Palette rows have `role="option"`, parent list has
  `role="listbox"`. `aria-selected="true"` on the highlighted row. `Esc` is
  wired (no focus trap needed — `cmdk` handles the semantics). Passes
  Lighthouse a11y ≥ 90 on the page where it's mounted (inherited from shell,
  not degraded by the palette).
- **Performance:** Palette mounts on first open (`cmdk` Dialog is lazy under
  our ⌘K handler). No backend calls. Filter runs synchronously over ≤18 rows
  — no perf concern. Bundle impact: `cmdk` is ~15kb gz, acceptable.
- **Reduced motion:** CSS backdrop `blur(4px)` is the only effect; no
  animations. `@media (prefers-reduced-motion)` not needed in v1 because the
  only motion is the modal appearance, and `cmdk` doesn't animate by default.
- **Testability:** Hooks are pure state + effects, directly testable with
  `@testing-library/react-hooks`-style setup. Integration test renders
  palette and asserts filter/navigation/routing behavior.

---

## Technical Design

### Stack

- **UI:** `cmdk` library (~15kb gz, MIT, author of shadcn/ui). Unstyled, a11y
  + keyboard nav + filter out of the box. Pin to latest `1.x` at install time.
- **Theme:** continue `next-themes` (already in project — see
  `frontend/src/components/theme-provider.tsx` if it exists, else
  `<ThemeProvider>` used inline in `layout.tsx`).
- **State:** React Query unchanged. Palette state is ephemeral (open/closed,
  query) via `useState` in `useCommandPalette()` hook. RECENT list in
  `localStorage` via `useRouteHistory()` hook.
- **Styling:** Tailwind utility classes + brutalist CSS variables from
  `globals.css`. Match mockup §.cmd-b / §.cmd-i / §.cmd-s / §.cmd-r color +
  spacing. No new CSS variables.

### Chosen Approach

**Palette as a shell-level component.**

A single `<CommandPalette />` component mounts inside the authenticated
shell (likely `(dashboard)/layout.tsx` or `AppShell`). It's controlled
open/closed state lives in `useCommandPalette()`, a hook that also
registers the global `keydown` listener for ⌘K / Ctrl+K. The trigger
button in the header uses the same hook's `open()` method. RECENT data
comes from `useRouteHistory()`, which listens to `usePathname()` changes
inside the shell and updates `localStorage`.

This means:
- One source of truth for palette state.
- Trigger button is a thin wrapper — no duplicated key handling.
- RECENT updates on every route change without the palette having to be
  mounted (the history hook runs in the shell regardless).

### Data Model

No DB changes. One `localStorage` key:

| Key | Shape | Cap | TTL |
|-----|-------|-----|-----|
| `hub-recent-routes` | `string[]` (pathnames) | 5 | none |
| `hub-theme` | managed by `next-themes` (`"dark"` / `"light"` / `"system"`) | 1 | none |

### File Layout

```
frontend/src/
  components/
    command-palette.tsx              # new (~100 lines)
    command-palette-trigger.tsx      # new (~30 lines)
    theme-aware-toaster.tsx          # new (~15 lines)
    header.tsx                       # modify (insert trigger)
    layout/
      sidebar.tsx                    # UNCHANGED
  hooks/
    use-command-palette.tsx          # new (~40 lines)
    use-route-history.ts             # new (~25 lines)
  app/
    layout.tsx                       # modify (ThemeProvider props, extract Toaster)
    (dashboard)/
      layout.tsx                     # modify — mount <CommandPalette /> once
      tasks/page.tsx                 # modify — ?new=1 opens <TaskDialog>
      reminders/page.tsx             # modify — add useSearchParams, ?new=1 scrolls+focuses <QuickAddForm>
      # notes/page.tsx — UNCHANGED (patch 2026-04-20: no New note quick action)
  __tests__/
    use-route-history.test.ts        # new (~6 tests)
    use-command-palette.test.tsx     # new (~4 tests)
    command-palette.test.tsx         # new (~5 tests — integration)
```

---

## Pre-Implementation Checklist

**Run every gate before opening the feature branch.** Fail → patch the PRD
and plan before starting.

- [ ] **PC-1:** `main` HEAD is the Stage 3 push (≥ `deb5735`). `git status`
      clean (untracked files allowed).
- [ ] **PC-2:** `cmdk` is not yet in `frontend/package.json`. If it is, note
      the installed version and skip the install step in Task 1. Command:
      `grep '"cmdk"' frontend/package.json`.
- [ ] **PC-3:** Current `<ThemeProvider>` usage in `frontend/src/app/layout.tsx`:
      record the exact import, props, and children structure. Record which
      file mounts `<Toaster />` today. Command: `grep -rn "ThemeProvider\|Toaster" frontend/src/app`.
- [x] **PC-4:** ✅ Resolved during PRD audit 2026-04-20 (before Task 1):
      - Tasks: `<TaskDialog>` imported from `@/components/tasks/task-dialog`,
        opened via `setCreateDialogStatus("new")` state (see
        `tasks/page.tsx:70` + `:346`). Programmatic open confirmed.
      - Reminders: **NO dialog**. Uses `<QuickAddForm>` inline with
        `quickAddRef` + `scrollToQuickAdd()` helper (see `reminders/page.tsx:6,45,131`).
        `?new=1` handler scrolls + focuses first input.
      - Notes: **no create flow** in UI (Google Drive viewer). Row dropped
        from QUICK ACTIONS. Notes page NOT modified in this stage.
- [ ] **PC-5:** `frontend/src/components/layout/sidebar.tsx` nav-items
      match the 10 routes listed in FR-6. If routes have been added/removed
      since this PRD was written, update FR-6 before Build.
- [ ] **PC-6:** Dev-server smoke deferred to post-ship (per Stage 2a / 3
      precedent). Record as ⏳ — not a blocker.
- [ ] **PC-7:** `npm run lint` = 0 errors, `npm run build` green,
      `npm test -- --run` at the recorded baseline (Stage 3 close: 334/349).

If **any** PC row is ❌ — patch PRD + plan, then re-run.

---

## Interface Contracts

These are the **external APIs** this feature depends on. Verify each in
the Audit Procedure below; mismatches cause drift.

| # | Contract | Source of truth | Risk if drifts |
|---|----------|-----------------|----------------|
| IC-1 | `next-themes` `<ThemeProvider>` accepts `storageKey`, `defaultTheme`, `enableSystem`, `attribute` props. | `next-themes` ≥ v0.3. Check `node_modules/next-themes/package.json`. | FR-12 fails silently (prop ignored). |
| IC-2 | `useTheme()` returns `{ theme, setTheme, resolvedTheme, systemTheme }`. | `next-themes`. | FR-13 breaks. |
| IC-3 | `sonner` `<Toaster>` accepts `theme: "light" \| "dark" \| "system"`. | `sonner` ≥ v1.4. | FR-13 breaks. |
| IC-4 | `cmdk` `<Command.Root>` + `<Command.Input>` + `<Command.List>` + `<Command.Group>` + `<Command.Item>` + `<Command.Empty>` API. | `cmdk` latest `1.x`. | Full palette fails — swap to custom. |
| IC-5 | `next/navigation` exports `useRouter`, `useSearchParams`, `usePathname`. | Next.js 16. Already used in Stage 2/3. | None — confirmed. |
| IC-6 | Brutalist CSS vars: `--bg`, `--bg-2`, `--accent`, `--ink`, `--ink-2`, `--ink-3`, `--line` all defined in `globals.css`. | Stage 1 shipped. | Colors fall back to shadcn aliases. |
| IC-7 | Sidebar `navSections` shape = `{ title, items: { label, href, glyph, hideForDemo? }[] }`. Palette **reads** this as the source for JUMP TO. | `frontend/src/components/layout/sidebar.tsx`. | JUMP TO drifts from sidebar; de-sync. |
| IC-8 | `useAuth()` exposes `isDemo: boolean`. | `frontend/src/lib/auth.ts` (already used by sidebar). | `Outreach` row shows for demo users. |

---

## Audit Procedure

Before Task 1, spend 10 minutes:

1. Run PC-1…PC-7.
2. For each of IC-1…IC-8: open the referenced file, confirm the export
   matches. Record in a short table (OK / drifted / needs patch).
3. If any IC drifts (e.g. `cmdk` renamed a subcomponent, or `next-themes`
   changed a prop) — **patch the PRD** before continuing, not after.
4. Record PC + IC results as a single doc-only commit on `main` (`docs:
   record Stage 4 entry audit + pre-build mode in Current Status`),
   following Stage 3's `c5f4218` precedent.
5. Only after the audit commit: open `feat/redesign-stage-4-command-palette-theme-polish`.

---

## Acceptance Criteria

- [ ] **AC-1:** From `/` press ⌘K → palette renders centered, input focused,
      backdrop dimmed, `QUICK ACTIONS` + `JUMP TO` + `RECENT` (if history
      exists) sections visible.
- [ ] **AC-2:** From `/` with focus in an existing text input (e.g. a task
      title field if one is on screen) press ⌘K → palette opens. Browser's
      default Find-In-Page does **not** appear.
- [ ] **AC-3:** Type `"tas"` → `JUMP TO` shows only `Tasks`, `QUICK ACTIONS`
      shows only `New task…` (only 2 quick actions exist after patch 2026-04-20),
      `RECENT` shows 0–1 rows (depending on history). Empty sections are hidden.
- [ ] **AC-4:** Type `"xxxzzz"` → single `"No results"` row shown,
      center-aligned, `var(--ink-3)`.
- [ ] **AC-5:** Clear input (backspace all) → all sections re-appear, first
      row of first visible section is highlighted.
- [ ] **AC-6:** With highlight on the last visible row press `↓` → highlight
      wraps to the first row. `↑` from first → wraps to last (FR-10).
- [ ] **AC-7:** Press Enter on `Tasks` row → URL becomes `/tasks`, palette
      closes, input clears on next open.
- [ ] **AC-8:** Press Enter on `New task…` row → URL becomes `/tasks?new=1`,
      palette closes, task-create dialog opens on `/tasks`, URL is
      scrubbed back to `/tasks` after dialog opens (FR-14).
- [ ] **AC-9:** Press Enter on `Remind me…` row → URL becomes
      `/reminders?new=1`, palette closes, reminders page scrolls to and
      focuses the `<QuickAddForm>` input (NOT a dialog — patch 2026-04-20),
      URL is scrubbed back to `/reminders` after the effect runs.
- [ ] ~~**AC-10:**~~ **Removed** (patch 2026-04-20): `/notes` is a Google
      Drive viewer, no `New note…` quick action exists.
- [ ] **AC-11:** Visit `/tasks`, then `/jobs`, then `/`. Open palette →
      `RECENT` shows `Jobs`, `Tasks` in that order. **Does not include
      `/` (current page)**.
- [ ] **AC-12:** Clear localStorage `hub-recent-routes`, open palette →
      `RECENT` section is **absent** (not rendered even as an empty
      header).
- [ ] **AC-13:** Log in as `demo@personalhub.app` → open palette → `JUMP TO`
      **does not** contain `Outreach`.
- [ ] **AC-14:** Press Esc → palette closes, query cleared, focus returns
      to the element that had it before open.
- [ ] **AC-15:** Click the header `[▸ search ⌘K]` button → palette opens
      (same as ⌘K).
- [ ] **AC-16:** First visit in a fresh browser (no `hub-theme` in localStorage)
      with macOS set to **Light** → Hub renders in **light** theme. Toggle
      to dark → reloads stick to dark. localStorage contains `hub-theme:"dark"`.
- [ ] **AC-17:** Trigger `toast.success("hello")` in dark mode → dark-chrome
      toast. Toggle to light → next `toast.success` renders with light-chrome.
      No manual refresh required (FR-13).
- [ ] **AC-18:** On a 720px-wide viewport (use browser devtools) open palette
      → width `94vw`, contents readable, does not overflow.
- [ ] **AC-19:** `npm run lint` = 0 errors; `npm run build` green;
      `npm test -- --run` ≥ baseline + new tests; no regressions.

---

## Risks & Open Questions

1. **cmdk versioning.** `cmdk` is maintained but has had minor API breakages
   in 0.x → 1.x. We pin to `^1.0.0` at install time; if the major bumps
   mid-build, lock via exact version.
2. **Dialog open contract per page.** Resolved in patch 2026-04-20: Tasks
   uses `<TaskDialog>` (programmatic open ✅), Reminders has **no dialog**,
   only inline `<QuickAddForm>` (handler scrolls + focuses), Notes dropped
   from scope entirely. If any of these components changes contract during
   build, the audit procedure should catch it before Task 1.
3. **Theme flash on first load.** With `defaultTheme="system"` and SSR,
   `next-themes` is known to require a small blocking script to avoid a
   flash-of-incorrect-theme (FOIT). Next.js App Router + `next-themes` v0.3+
   handles this, but verify during build — if a visible flash appears in
   dev, add the recommended `suppressHydrationWarning` to `<html>` and a
   tiny inline script per `next-themes` docs.
4. **RECENT pollution.** If a user hits 404 routes or typos in the URL,
   they shouldn't show up in RECENT. Hook filters incoming pathnames
   against the sidebar's known-routes set — only persists known routes.
5. **Toaster extraction.** Extracting Toaster to a client boundary
   (`"use client"` at the top of `theme-aware-toaster.tsx`) is the standard
   pattern but means the Toaster mounts one React boundary deeper. Check
   no toasts are dispatched before mount (should be fine — toasts come from
   user interactions, not SSR).
6. **FR-11 header layout.** The header already has a live clock stamp,
   theme button, avatar, logout. Adding a trigger button + its `⌘K` tag
   adds ~80px width. Test at 960px viewport that nothing wraps awkwardly.
7. **Query-param scrubbing race.** FR-14 scrubs `?new=1` via `router.replace`
   after opening the dialog. If the user manually navigates back before
   scrubbing lands, the dialog may re-open on the next visit — low risk
   but worth a test.

---

## Phasing

Single phase. All FRs ship as one squash merge on the feat branch. Stage 5
(mobile + QA sweep) is a separate initiative.

---

## Revision Log

| Date | Change | Commit |
|------|--------|--------|
| 2026-04-20 | Initial draft. | (this file) |
| 2026-04-20 | Patch: drop `New note…` quick action (notes page is a Google Drive viewer, no create UX); clarify `/reminders?new=1` semantics (scroll + focus `<QuickAddForm>`, not a dialog); resolve PC-4 inline with concrete component names. Affected: Goals, Non-Goals, FR-3, FR-5, FR-14, AC-3, AC-9, AC-10 (removed), File Layout, PC-4, Risks #2. | (next commit) |
