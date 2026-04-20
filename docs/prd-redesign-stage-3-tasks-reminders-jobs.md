# PRD: Redesign Stage 3 — Tasks / Reminders / Jobs

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-20 |
| Status | Draft |
| Priority | P0 |
| Depends on | `main` at or after `3c657b2` (Stage 2a post-ship smoke fixes). Stages 1 + 2 + 2a must all be live on `main`. |
| Unblocks | Stage 4 (Command Palette + theme toggle), Stage 5 (Mobile / QA). |
| Branch | `feat/redesign-stage-3-tasks-reminders-jobs` (single mega-squash PR covering all three pages) |
| Visual reference | `handoff/mockups/hub-brutalist-v2.html` — Tasks ~L564-658, Jobs ~L660-736, Reminders ~L738-836 |

> ⚠️ **How to use this PRD.** Do NOT start implementation from FR-1 until the **Pre-Implementation Checklist** (PC-1…PC-6) is fully ticked and the **Audit Procedure** has produced a ✅ go. Those sections are the first things to execute after Stage 2a has settled on `main`. Skipping them is the single largest source of rework for this feature.
>
> **Reading order on first open:**
> 1. Problem Statement (this page, 2 paragraphs)
> 2. Pre-Implementation Checklist — MANDATORY gate
> 3. Interface Contract — what 3 assumes about Stage 1/2/2a + current Tasks/Reminders/Jobs code
> 4. Audit Procedure — 10-min drift check
> 5. Then: User Scenarios → Functional Requirements → AC → Phasing.

## Problem Statement

Stage 1 (squash `9be267f`) installed the brutalist token system (acid-lime accent on `#0e0e0c` dark, warm-paper light) and the new shell (sidebar + header). Stages 2 + 2a (squashes `a74c16f`, `e481587`, post-ship fixes `0274652` / `49d6a7f` / `3c657b2`) re-skinned the Today page and overlaid the planner UI. Today now visually matches `handoff/mockups/hub-brutalist-v2.html`.

The three remaining high-traffic routes — `/tasks`, `/reminders`, `/jobs` — still render the pre-redesign shadcn-default look. Even though they inherit the global brutalist tokens through the shadcn aliases, they keep rounded corners, shadcn-style column headers, old-style page headers (`<h1>Tasks</h1>`), and shadcn tab bars. The visual seam is obvious the moment the user clicks out of Today.

Stage 3 closes that seam. It is a **pure re-skin** of the three pages — no backend work, no schema changes, no CRUD changes, no new endpoints. Existing hooks (`useKanbanTasks`, `useTasks`, `useJobs`, `useJobKanban`, `useReminders`, `useBirthdays`) stay untouched. Drag-and-drop, dialogs, filters, search, analytics tabs — all keep working exactly as they do today. Only markup, classes, and a small number of presentational components change.

Three explicit non-alignments with the mockup are locked by discovery (see "Scope locked" below): Tasks Kanban stays on the existing 6 status columns (not TODAY/THIS WEEK/LATER/DONE); Jobs Kanban stays on the existing `ApplicationStatus` enum columns (not the 5-stage mockup pipeline); Reminders does NOT grow a Settings panel (no settings are persisted today to back one honestly).

## Scope locked (from the brief, reproduced here for the implementer)

1. **Tasks Kanban columns** — keep the existing 6 statuses (`backlog` / `new` / `in_progress` / `review` / `done` / `cancelled`). Do NOT remap to date-based columns. Kanban stays the default view.
2. **Tasks** — re-skin only; no structural change to data flow, hooks, or logic.
3. **Jobs Kanban columns** — keep the existing `PIPELINE_COLUMNS` + `TERMINAL_STATUSES` split (`found` / `saved` / `resume_generated` / `applied` / `screening` / `technical_interview` / `final_interview` / `offer` on the pipeline row; `accepted` / `rejected` / `ghosted` / `withdrawn` on the Completed row). Do NOT remap to the mockup's 5-stage APPLIED/SCREEN/INTERVIEW/OFFER/CLOSED pipeline.
4. **Jobs Hero** — pure variant A. Only the 4 stat-cells (Applied / Screen / Interview / Offer, with counts + mini-bars) spanning full width. NO narrative text, NO stalled-applications list, NO AI summary. These 4 labels are mockup-facing aggregates that map to underlying backend statuses — the mapping is defined in FR-J3 below.
5. **Reminders Settings panel** (Channel / Quiet hours / Timezone / Birthday pulse from the mockup) — explicitly OUT. No settings are persisted in backend today to render honestly.
6. **Jobs card footer** — `{applied_date formatted} · {days_since}D`. Computed client-side from `applied_date` (present on `backend/app/models/job.py:74`, `Mapped[Optional[date]]`). Null-safe fallback per FR-J5.
7. **No shared primitives extracted** — write inline per-page, mirroring Stage 2/2a's co-located pattern under `frontend/src/components/today/`. Rationale: YAGNI, 3 pages isn't critical mass for abstraction.

## User Scenarios

### Scenario 1: Visual continuity across the shell

**As the** user, **I want to** click from Today to Tasks and have the page look like it belongs to the same app — same fonts, same borders, same acid-lime accent, same header style — **so that** the portal feels finished rather than half-migrated.

### Scenario 2: Kanban muscle memory preserved

**As the** user, **I want to** drag a task from "In Progress" to "Done" (or a job card from "Screening" to "Technical Interview") and have it work exactly like it did before the re-skin, **so that** no workflow breaks the day the Stage 3 PR merges.

### Scenario 3: Jobs pipeline at a glance

**As the** user, **I want to** open `/jobs`, see a 4-cell hero that tells me at a glance how many applications are in Applied / Screen / Interview / Offer, and then scroll to the Kanban to inspect individual cards — **so that** the page leads with a summary before diving into detail.

### Scenario 4: "How long has this been sitting?"

**As the** user, **I want** each Job card in Kanban to show both the applied date AND days-since-applied, **so that** I can spot stalled applications (Applied · 21D should feel different to my eye than Applied · 2D).

### Scenario 5: Reminders two-up layout

**As the** user, **I want** reminders on the left (bigger column, grouped by Today / This week / …) and birthdays on the right (smaller aside), **so that** today's reminders dominate the page without birthdays being buried below the fold.

## Pre-Implementation Checklist (MANDATORY before Stage 3 work starts)

Stage 3 depends on Stages 1 + 2 + 2a being live, and on the current Tasks/Reminders/Jobs pages being in the state assumed by the Interface Contract. The following must be true before opening `feat/redesign-stage-3-tasks-reminders-jobs`:

- [ ] **PC-1:** `main` is at or after commit `3c657b2` (Stage 2a post-ship smoke fixes). Verify: `git log --oneline -5 | head`. The top commit SHAs should include `3c657b2`, `49d6a7f`, `0274652`, `75677d3`, `e481587`.
- [ ] **PC-2:** Stage 2 + 2a components still live under `frontend/src/components/today/` (`hero-priority.tsx`, `hero-cells.tsx`, `day-timeline.tsx`, `stats-grid.tsx`, `reminders-today.tsx`, `signals-feed.tsx`, `plan-bar.tsx`, `focus-queue.tsx`, `fixed-schedule.tsx`, `no-plan-strip.tsx`, `plan-adherence-cell.tsx`, `today-skeleton.tsx`). Stage 3 imitates their inline brutalist style. If any have moved/renamed, update IC-S2 below before writing code.
- [ ] **PC-3:** Run `npm test -- --run` on current `main`. Baseline **315/330** (289 Stage 2 baseline + 24 Stage 2a + 2 Stage 2a post-ship; 15 pre-existing flakes in `__tests__/telegram-tab.test.tsx`, `__tests__/job-detail-tracking.test.tsx`, `src/__tests__/pulse/prompt-editor.test.tsx`). Lock this number in the audit note. Stage 3 must ship with ≥315 passing and no NEW failures.
- [ ] **PC-4:** Verify field names on `Job` model match PRD assumptions. Open `backend/app/models/job.py` — confirm: `applied_date: Mapped[Optional[date]]` (L74), `next_action_date: Mapped[Optional[date]]` (L76), `status: Mapped[Optional[ApplicationStatus]]` (L68). If any drifted, update FR-J4/J5 before writing code.
- [ ] **PC-5:** Open `handoff/mockups/hub-brutalist-v2.html` in a browser. Bookmark the 3 target sections (Tasks ~L564, Jobs ~L660, Reminders ~L738). Optional: screenshot each and paste the paths into the Stage 3 plan doc (`docs/plans/<date>-redesign-stage-3-tasks-reminders-jobs.md`) for side-by-side reference during build.
- [ ] **PC-6:** Spin up the dev server (`cd frontend && npm run dev`) and manually verify:
  - `/jobs` loads with no console errors.
  - Switch view toggle to Kanban → `ApplicationKanban` renders without error. Drag a card from one column to another → `StatusChangeDialog` appears. Cancel it. The card stays in its original column. (We need to know this path works BEFORE we switch the default view; see FR-J6.)
  - `/tasks` loads. Drag a task between columns. It moves.
  - `/reminders` loads. Quick-add form creates a reminder.
- [ ] **PC-7:** Capture `npm run lint` and `npm run build` baseline output. Both must be green on current `main`. Stage 3 ships with both still green.

**Do not start implementation** until every box above is ticked. Skipping this checklist is the single largest source of rework for this PRD.

## Interface Contract (what Stage 3 expects from shipped code)

Stage 3 imports and composes components from Stages 1/2/2a AND modifies the existing Tasks / Reminders / Jobs components. The table below is the **expected** shape at PRD-write time (2026-04-20, `main` at `3c657b2`). After PC-1…PC-7 are ticked, run the Audit Procedure to verify or correct each row.

### From Stages 1/2/2a (style + layout patterns to match)

| # | Artifact | Expected path | Signature / behavior | Used by 3 for |
|---|---|---|---|---|
| IC-S1 | Brutalist tokens | `frontend/src/app/globals.css` (`:root` + `html.light`) | All tokens present: `--bg`, `--bg-2`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--accent` (acid lime), `--accent-2` (orange), `--accent-3` (teal), `--mono`, `--display`. Shadcn aliases exist but Stage 3 uses brutalist vars directly. | All re-skinned components |
| IC-S2 | Stage 2/2a component directory | `frontend/src/components/today/*` | 12 components (see PC-2 list). Pattern: brutalist inline styling, `border-[1.5px] border-[color:var(--line)]`, no radii, `font-[family-name:var(--mono)]` on body text, uppercase-11px meta labels. | Style reference for all new Stage 3 markup |
| IC-S3 | Header kicker + H1 pattern | Inline in Today page components (no extracted `PageHeader`) | Kicker (`text-[11px] uppercase tracking-wider text-[color:var(--ink-3)]`) + H1 in `font-heading`/`var(--display)` + subline. Action buttons on right. | Tasks / Jobs / Reminders page header markup (mockup's `.ph` class) |
| IC-S4 | Section heading `.hdline` | Rendered inline in Today page as a local `Hdline` helper | `<h3>` uppercase small-caps + optional count pill `<span class="n">` on right. | Reminders "Today" / "This week" group headers; reuse the same visual. |

### From current Tasks code (what Stage 3 will modify)

| # | Artifact | Path | Current signature | Stage 3 action |
|---|---|---|---|---|
| IC-T1 | `TasksPage` | `frontend/src/app/(dashboard)/tasks/page.tsx` | 325 lines. Renders `<h1>Tasks</h1>` header + `TaskFiltersBar` + `TasksViewToggle` (kanban/table) + `KanbanBoard` or `TasksTable` + `BulkActionToolbar` + `TaskDialog`. `viewMode` defaults to `"kanban"` (already correct). | Swap `<h1>` block for brutalist `.ph`-style header inline. Keep all state/logic. |
| IC-T2 | `KanbanBoard` | `frontend/src/components/tasks/kanban-board.tsx` | Props: `{board, onStatusChange, onReorder, isPending, hiddenColumns, onAddTask, selectedTaskIds, onToggleSelect, onClearSelection}`. DnD wiring via `@dnd-kit/core` + `@dnd-kit/sortable`. Renders `KanbanColumn` per visible status. | No prop change. Inner column styling delegated to `KanbanColumn` re-skin. |
| IC-T3 | `KanbanColumn` | `frontend/src/components/tasks/kanban-column.tsx` | Props: `{status, tasks, activeTaskId, onAddTask, selectedTaskIds, onToggleSelect}`. Uses `TASK_STATUS_LABELS[status]` + a `STATUS_ACCENT` color map (backlog=violet / in_progress=acid / done=success / cancelled=danger / review=yellow / new=tertiary). | Re-skin: uppercase label, colored marker SQUARE (not rounded dot — brutalist), count pill on right. Keep `onAddTask` hover button, keep Done-column collapse. |
| IC-T4 | `TaskCard` | `frontend/src/components/tasks/task-card.tsx` | Props: `{task, isDragging, selected, onToggleSelect}`. Uses `PRIORITY_BORDER_CSS_VARS[task.priority]` as `borderLeftColor`. Current styling: `rounded-lg border border-l-[3px] bg-[var(--surface)]`. Shows title, `formatDeadline`, tags via `<TagPills />`. | Swap: `rounded-lg` → none (brutalist), `border` → `border-[1.5px] border-[color:var(--line)]`, keep `border-l-[3px]` + `PRIORITY_BORDER_CSS_VARS` (Stage 3 spec honors the priority-color left border). Uppercase meta labels. `TagPills` kept as-is (non-Stage-3 scope). |
| IC-T5 | `TasksTable` | `frontend/src/components/tasks/tasks-table.tsx` | Shadcn-styled `<Table>` with sortable headers. | Minimal re-skin: swap card/border tokens to brutalist vars. Keep columns, keep interactions. |
| IC-T6 | `TaskFiltersBar` | `frontend/src/components/tasks/task-filters.tsx` | Dropdown-style tag filters + `extraButtons` slot. | Token-swap only (border + text colors). Do NOT replace dropdowns with tab-pills — breaks bulk actions + multi-select tag UX. |
| IC-T7 | Task enums | `frontend/src/types/task.ts` | `TASK_STATUS_ORDER` = `["backlog", "new", "in_progress", "review", "done", "cancelled"]`; `TASK_STATUS_LABELS`, `PRIORITY_BORDER_CSS_VARS`, `DEFAULT_HIDDEN_COLUMNS=["review","cancelled"]`. | UNCHANGED. Stage 3 reads these. |
| IC-T8 | Tasks tabs | Not present — Tasks has NO tab bar currently. It has a `TasksViewToggle` (kanban / table). | Add a brutalist `.tabs` row inline: `KANBAN · TABLE · ANALYTICS`. `ANALYTICS` replaces the current `<Link href="/tasks/analytics">` button. `BACKLOG` (from mockup) is NOT added — `backlog` is a status column in the Kanban, not a separate view. |

### From current Reminders code

| # | Artifact | Path | Current signature | Stage 3 action |
|---|---|---|---|---|
| IC-R1 | `RemindersPage` | `frontend/src/app/(dashboard)/reminders/page.tsx` | Renders `<h1>Reminders</h1>` + `RemindersTabs` + `QuickAddForm` + `ReminderList` + `CompletedRemindersSheet`. | Restructure to 2-column grid (1.7fr / 1fr). Quick-add moves INTO left column at top. Birthdays move INTO right column. `RemindersTabs` kept above the grid (tab bar for Reminders ↔ Birthdays subroute). Header swapped to brutalist `.ph` inline. |
| IC-R2 | `RemindersTabs` | `frontend/src/components/reminders/reminders-tabs.tsx` | Pathname-driven pill tabs: `Reminders` / `Birthdays`. Navigates via Next.js `<Link>`. | Re-skin to brutalist `.tabs` style (row of buttons, `.on` gets acid-lime border-bottom or background). |
| IC-R3 | `QuickAddForm` | `frontend/src/components/reminders/quick-add-form.tsx` | Full form with title / date / time / recurrence / urgent toggle. NOT a single-line natural-language input (mockup implies one, but current impl is multi-field). | Style the form with dashed border (`1.5px dashed var(--line-2)`) + mono font to match mockup's `.rem-qa` visual while preserving all existing fields. Do NOT replace with NL input — that's a backend/parsing feature, out of scope. |
| IC-R4 | `ReminderList` | `frontend/src/components/reminders/reminder-list.tsx` | 669 lines. Self-fetches inside but also takes `{reminders, isLoading, error}` props. Groups by date via `groupByDate()` helper (L96-143): keys are `Today` / `Tomorrow` / `<formatted date>`. Renders `ReminderRow` per item. Has expand-to-action-panel behavior + edit/delete dialogs. | Re-skin group headers to `.hdline` pattern. Re-skin `ReminderRow` to match mockup's `.remrow` shape (chk | when | body | acts). Keep all action logic. Do NOT re-write `groupByDate` — its labels (Today / Tomorrow / calendar dates) are already the right semantic. |
| IC-R5 | `BirthdayList` | `frontend/src/components/reminders/birthday-list.tsx` | Renders list of birthday cards with avatar initial, name, age, days-until badge. Currently lives on `/reminders/birthdays` subroute. | Stage 3 **does not move it**. Keep the Birthdays tab route (`/reminders/birthdays`) intact. On `/reminders` main page, render a **compact** birthday section (top 3 by days-until) inline in the right column. Either reuse `BirthdayList` with a `limit` prop (preferred, tiny change) OR add a new inline `BirthdaysCompact` component reading `useBirthdays()` directly. |
| IC-R6 | `useReminders` | `frontend/src/hooks/use-reminders.ts` | Returns `{data, isLoading, error}` + mutations. | UNCHANGED. |
| IC-R7 | `useBirthdays` | `frontend/src/hooks/use-birthdays.ts` | Returns `{data, isLoading, error}` + mutations. | UNCHANGED. |

### From current Jobs code

| # | Artifact | Path | Current signature | Stage 3 action |
|---|---|---|---|---|
| IC-J1 | `JobsPage` | `frontend/src/app/(dashboard)/jobs/page.tsx` | 213 lines. Tabs via `useState<Tab>` (`jobs` / `search` / `analytics`) with custom `<button>` bar + `border-b-2` accent. `viewMode` starts `"table"`. `JobsTable` or `ApplicationKanban` rendered based on `viewMode`. Header is `<h1>Jobs</h1>` + action buttons. | Re-skin header to brutalist `.ph` inline. Insert `<JobsHero />` directly above tabs. Switch `viewMode` default to `"kanban"` (FR-J6). Re-skin the tab bar's container + pill states. Keep the 3-tab list (`Jobs`/`Search`/`Analytics`) — `Table` view is an orthogonal toggle (ViewToggle), NOT a tab. |
| IC-J2 | `JobsViewToggle` | `frontend/src/components/jobs/view-toggle.tsx` | Binary pill toggle `table | kanban`. Controlled. | Re-skin to brutalist button group. No logic change. |
| IC-J3 | `ApplicationKanban` | `frontend/src/components/jobs/application-kanban.tsx` | Self-fetching via `useJobKanban()`. Renders two rows: `PIPELINE_COLUMNS` (found/saved/resume_generated/applied/screening/technical_interview/final_interview/offer) as the top row + `TERMINAL_STATUSES` (accepted/rejected/ghosted/withdrawn) as the bottom "Completed" row. Uses `@dnd-kit/core`. Drag-end → `StatusChangeDialog`. | No prop change. Inner column styling delegated to `ApplicationColumn` re-skin. Keep the two-row layout (pipeline + completed). |
| IC-J4 | `ApplicationColumn` | `frontend/src/components/jobs/application-column.tsx` | Props: `{status, cards, activeCardId}`. Uses `APPLICATION_STATUS_LABELS[status]` + `APPLICATION_STATUS_COLORS[status]` for the dot marker. | Re-skin: marker square not dot, uppercase label (already uppercase), count pill, brutalist border/bg tokens. |
| IC-J5 | `ApplicationCard` | `frontend/src/components/jobs/application-card.tsx` | Props: `{card, isDragging}`. Layers: left-border accent strip (colored by `APPLICATION_STATUS_COLORS[status]`) + grip handle + title + company + match score + metadata footer (deadline / source / applied date / action date). Click → `router.push(/jobs/${id})`. | Re-skin per FR-J4: company bold, role secondary, footer `{applied_date formatted} · {days_since}D`. Special accent rule: if `next_action_date` is within 3 days AND status is `screening` or later → full 1.5px orange border (the mockup's `.hot` variant); if status is `offer` → full 1.5px teal border (`.off` variant). All others: `border-[1.5px] border-[color:var(--line)]` + keep left-border accent strip for status color. |
| IC-J6 | `JobsTable` | `frontend/src/components/jobs/jobs-table.tsx` | Table view with job rows. | Minimal re-skin: token swap to brutalist (`bg-card` → `bg-[color:var(--bg-2)]`, `border-border` → `border-[color:var(--line)]`). Keep columns, keep actions. |
| IC-J7 | Job enums | `frontend/src/types/job.ts` | `ApplicationStatus` = 12-value enum matching `backend/app/models/job.py:22-34`. `PIPELINE_COLUMNS` (8 values from `found` through `offer`), `TERMINAL_STATUSES` (4 values). `APPLICATION_STATUS_LABELS`, `APPLICATION_STATUS_COLORS`, `APPLICATION_STATUS_BG_COLORS`. | UNCHANGED for column layout. Stage 3 adds a **new** mapping dict `HERO_BUCKET_STATUSES` for the Jobs Hero aggregation (see FR-J3). |
| IC-J8 | `useJobs`, `useJobKanban` | `frontend/src/hooks/use-jobs.ts` | `useJobs(filters)` → `Job[]` (flat list). `useJobKanban()` → `KanbanData` (grouped dict keyed by `ApplicationStatus`). | UNCHANGED. JobsHero reuses `useJobs({})` (already fetched by page) and aggregates client-side. |

### Audit Procedure (10-min drift check before writing code)

1. **Verify `main` SHA.** `git log --oneline -5`. Top commit should be `3c657b2` or later.
2. **Verify IC-S1…IC-S4.** Open `frontend/src/app/globals.css` — confirm the brutalist tokens are at `:root`. Open `frontend/src/components/today/` — confirm all 12 Stage 2/2a components exist. Read the first 30 lines of `today/hero-cells.tsx` to relearn the "inline brutalist + `var(--line)` borders" style.
3. **Verify IC-T1…IC-T8.** Open each path, grep for the signature bullet in that row. If any drift, patch the PRD in ONE doc-only commit (`docs: align stage-3 PRD with actual tasks/reminders/jobs (post-audit)`) before opening the branch.
4. **Verify IC-R1…IC-R7.** Same process.
5. **Verify IC-J1…IC-J8.** Same process. Especially: read `types/job.ts` lines 170-190 for `PIPELINE_COLUMNS` exact ordering — FR-J3 depends on it.
6. **Run baseline tests + lint + build.** `cd frontend && npm test -- --run` (expect 315/330) and `npm run lint` and `npm run build`. Lock the exact test number in the audit note.
7. **If all rows ✅** — proceed to branch open (`feat/redesign-stage-3-tasks-reminders-jobs`), start from FR-T1.
8. **If any row 🔴 structural divergence** (e.g. `ApplicationKanban` got split into 3 files, or `useKanbanTasks` now returns a flat array) — stop, update the PRD's FRs, renegotiate with owner before any code.

## Functional Requirements

### P0 (Must Have)

#### Tasks page — `/tasks`

- [ ] **FR-T1:** Replace the existing Tasks page header (`<h1>Tasks</h1>` + icon buttons in a flex row at `page.tsx:239-257`) with a brutalist `.ph`-style header inline:
  - Kicker: `Module · Tasks` (text-[11px], uppercase, tracking-wider, color `var(--ink-3)`)
  - H1: `TASKS_` (font `var(--display)`, size ~28px, `color var(--ink)`)
  - Subline: dynamic — `<open_count> open · <due_today_count> due today` (derived client-side from `useTasks()` via the same filter logic as `HeroCells.openTasks` + `HeroCells.tasksDueToday`)
  - Right-aligned action buttons: `⌕ FILTER` (stubs to no-op or opens existing filter UI if needed), `↓ SORT · DUE` (same), `+ NEW TASK` (acid-lime accent, wires to the existing `setCreateDialogStatus("new")` handler). The filter/sort buttons are visual fill from the mockup; current filtering is handled by `TaskFiltersBar` below and need not move.
- [ ] **FR-T2:** Add a brutalist `.tabs` row directly below the header, above `TaskFiltersBar`:
  - Buttons: `KANBAN` (active by default) · `TABLE` · `ANALYTICS` (navigates to `/tasks/analytics`, replacing the current top-right Analytics button).
  - Active state: bold + `border-bottom: 3px solid var(--accent)`.
  - `KANBAN`/`TABLE` tabs control `viewMode` state (today's `TasksViewToggle` becomes the tab bar; remove the separate `TasksViewToggle` component from the page render to avoid duplicating the control).
  - Counts next to tab labels (e.g. `KANBAN 7`) are OUT of scope — optional nice-to-have if trivial, but not required.
- [ ] **FR-T3:** Re-skin `KanbanColumn` (`frontend/src/components/tasks/kanban-column.tsx`):
  - Column header row: replace the `h-2 w-2 rounded-full` status dot with a **square** marker (`h-2 w-2` no radius), color from the existing `STATUS_ACCENT` map (keep that dict — remap colors to brutalist tokens: `backlog` → `var(--accent-2)` orange, `new` → `var(--ink-3)`, `in_progress` → `var(--accent)` acid, `review` → `var(--accent-2)` orange, `done` → `var(--accent-3)` teal, `cancelled` → `var(--ink-4)` dim).
  - Label: uppercase + `font-[family-name:var(--mono)]` + `tracking-wider`. Keep existing `TASK_STATUS_LABELS[status]`.
  - Count pill: monospace, bg `var(--bg-2)`, border `1px solid var(--line)`, no radius.
  - Drop zone: replace `rounded-lg` + `ring-1 ring-[var(--accent-muted)]` hover with no-radius + solid `2px var(--accent)` border on `isOver`.
  - Empty-state "No tasks" text: uppercase 11px, `var(--ink-3)`.
  - Keep Done-column collapse (`DONE_COLLAPSE_LIMIT = 10`) behavior unchanged.
  - Keep `onAddTask` hover-plus button unchanged (acid-lime on hover).
- [ ] **FR-T4:** Re-skin `TaskCard` (`frontend/src/components/tasks/task-card.tsx`):
  - Container: `border-[1.5px] border-[color:var(--line)] border-l-[3px]` (keep the `borderLeftColor` inline style from `PRIORITY_BORDER_CSS_VARS[task.priority]` — priority color-coded left border).
  - Background: `bg-[color:var(--bg-2)]`.
  - No radius (remove `rounded-lg`).
  - Hover: `border-[color:var(--line-2)]`.
  - Selected: `border-[color:var(--accent)]` (keep `ring-2` visual but brutalist — solid 2px outline accent).
  - Deadline text (`formatDeadline`): uppercase, 11px, `var(--ink-3)`. Overdue indicator stays the ⚠ glyph but in `var(--accent-2)` orange.
  - Tags row: unchanged component-wise (`TagPills`), just verify visual integrity against brutalist bg.
  - No other data-shape changes.
- [ ] **FR-T5:** Re-skin `TasksTable` (`frontend/src/components/tasks/tasks-table.tsx`):
  - Token swap only: `bg-card` → `bg-[color:var(--bg-2)]`; header row text → uppercase 11px `var(--ink-3)`; row border → `border-[color:var(--line)]`; row hover → `bg-[color:var(--bg-2)]` alpha variant.
  - Column layout, sort behavior, row actions — UNCHANGED.
- [ ] **FR-T6:** `TaskFiltersBar` — token-swap only. Keep dropdown-based tag selection (bulk actions depend on it; replacing with pill tabs breaks multi-select).
- [ ] **FR-T7:** Remove the old top-right `Analytics` button from `page.tsx:242-247` (replaced by the `ANALYTICS` tab in FR-T2). Keep the `+ NEW TASK` button in FR-T1's right action group.

#### Reminders page — `/reminders`

- [ ] **FR-R1:** Replace the existing Reminders page header (`<Bell />` + `<h1>Reminders</h1>` at `page.tsx:20-34`) with brutalist `.ph`:
  - Kicker: `Module · Reminders`
  - H1: `REMINDERS_`
  - Subline: dynamic — `<today_count> for today · <this_week_floating_count> floating this week · <birthdays_within_14d_count> birthdays coming up` (derived from `useReminders()` + `useBirthdays()` counts, same filter semantics as `groupByDate()` in `reminder-list.tsx`).
  - Right action buttons: `HISTORY` (wires to existing `setCompletedOpen(true)`), `+ QUICK ADD` (acid-lime; scrolls to / focuses the quick-add form below).
- [ ] **FR-R2:** Keep `RemindersTabs` directly below the header (tabs for Reminders ↔ Birthdays sub-route). Re-skin to brutalist `.tabs` style — active tab: bold + `border-bottom: 3px solid var(--accent)`, no radius, uppercase mono.
- [ ] **FR-R3:** Introduce 2-column CSS grid below the tabs on `/reminders` (the list view, not the birthdays subroute):
  - `grid-template-columns: 1.7fr 1fr` at `md:` and above; single column on mobile (though mobile styling is Stage 5 scope — just don't break it).
  - Left column contains: `QuickAddForm` (at top, re-skinned per FR-R4) → `ReminderList` (re-skinned per FR-R5/R6).
  - Right column (aside) contains: `Hdline("Birthdays", count)` → compact `BirthdayList` (top 3, see FR-R7).
  - The `/reminders/birthdays` subroute keeps its own full `BirthdayList` untouched.
- [ ] **FR-R4:** Re-skin `QuickAddForm` with dashed border + mono font to visually match the mockup's `.rem-qa` strip, while preserving all existing fields:
  - Container: `border-[1.5px] border-dashed border-[color:var(--line-2)] bg-[color:var(--bg-2)] p-3` no radius.
  - Title input: placeholder hint italicized + mono (e.g. `Remind me to…`).
  - The date/time/recurrence/urgent controls below — kept as-is, just re-skinned to brutalist tokens (no radii, `var(--line)` borders).
  - Do NOT replace with a natural-language parser. That's a separate backend feature.
- [ ] **FR-R5:** Re-skin `ReminderList` group headers to the `.hdline` pattern:
  - `<h3>` uppercase, `var(--ink-3)`, tracking-wider, 11px → 13px hybrid.
  - Count pill on right side: `bg-[color:var(--bg-2)] border-[1px] border-[color:var(--line)] px-1.5 py-0.5 text-[11px]`.
  - Keep the existing `groupByDate()` logic (L96-143 of `reminder-list.tsx`) — Today / Tomorrow / calendar-date labels stay unchanged.
- [ ] **FR-R6:** Re-skin `ReminderRow` to match the mockup's `.remrow` structure:
  - 4 grid columns: `chk | when | body | acts` (mobile can wrap the `acts` column).
  - Container: `border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] hover:border-[color:var(--line-2)]` no radius.
  - `when` block: time uppercase mono; if urgent → orange (`var(--accent-2)`); relative label below (`IN 48M` / `IN 2H`) in 10px `var(--ink-3)`. The "IN X" countdown is **client-side**, computed from `remind_at - now` (mockup has it; we wire it up).
  - Title (`.body h4`): `var(--ink)`, 14px, mono (`.body p` if present: 12px `var(--ink-3)`).
  - Done-state modifier: opacity 0.6, line-through on title.
  - All existing action affordances (expand-to-actions, mark-done, snooze, edit, delete) preserved — just re-skinned.
  - Badges (Urgent / snooze count / Task link / Recurrence) re-skinned: no rounded-md, no shadcn-tinted bg; use brutalist accents (`Urgent` → `bg-transparent border-[1px] border-[color:var(--accent-2)] text-[color:var(--accent-2)]`, `Task` → border + `var(--accent-3)` teal, `Recurrence` → `var(--ink-3)`).
- [ ] **FR-R7:** On the right column (aside) of `/reminders`, render a compact Birthdays section:
  - `<Hdline label="Birthdays" count={birthdays.length} />` header.
  - List of up to 3 birthdays sorted by `days_until` ascending.
  - Each row: avatar letter square (brutalist: `h-9 w-9 border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--ink)] font-[family-name:var(--display)] flex items-center justify-center` — first letter of name), name, `TURNING {age}` secondary line, right-aligned `{weekday} · {N}D` pill.
  - Implementation: extend `BirthdayList` with an optional `limit?: number` prop (default: no limit). If trivial, do it in the same PR; otherwise inline a new `BirthdaysCompact` using `useBirthdays()` directly.
  - A small `See all →` link at the bottom routing to `/reminders/birthdays`.
- [ ] **FR-R8:** Reminders Settings panel is **OUT OF SCOPE** (see Non-Goals). No Settings tile, no Settings `<aside>` block in the right column.

#### Jobs page — `/jobs`

- [ ] **FR-J1:** Replace the existing Jobs page header (`<h1>Jobs</h1>` + Import/Add buttons at `page.tsx:52-74`) with brutalist `.ph`:
  - Kicker: `Module · Job Hunt`
  - H1: `JOB_HUNT_`
  - Subline: dynamic — `<live_count> live · <interview_count> in interview · <offer_count> offer · <pipeline_qualitative>` where `pipeline_qualitative` is either `healthy pipeline.` (live ≥ 5) or `keep pushing.` (live < 5). Counts derived from `useJobs()` using the same bucket mapping as FR-J3.
  - Right actions: `⌕ SEARCH` (navigate to `search` tab — reuses the existing `setActiveTab("search")`), `↥ IMPORT` (opens `BulkImportDialog`), `+ NEW APP` (acid-lime, opens `JobDialog` in create mode).
- [ ] **FR-J2:** **NEW component: `<JobsHero />`** — inline in the Jobs page (no extraction to `components/jobs/jobs-hero.tsx`; use the inline pattern per "no shared primitives" rule, but if the inline JSX exceeds ~80 lines extracting to a single `jobs-hero.tsx` is acceptable). Renders directly below the header, above the tab bar, full width:
  - Outer container: `border-[1.5px] border-[color:var(--line)]` grid with 4 columns: `Applied · Screen · Interview · Offer`.
  - Each cell: label (uppercase 11px `var(--ink-3)`), value (display font, ~32px, `var(--ink)`), mini-bar (`h-1 bg-[color:var(--bg-2)]` with inner fill). If the value is 0, render `0` as the real count — these are already-filtered aggregates where 0 is a meaningful number (NOT the `—` case; DATA-MAP's "don't show 0" applies to indicators of nonexistent backend data sources, not to honest aggregate counts).
  - Mini-bar fill width: `cell.val / max(cells.val)` × 100%, clamped to `[0, 100]`. When `max` is 0 (no apps live at all), all fills render at 0% width (empty track).
  - Colors: `Applied` + `Screen` fills use `var(--ink)` (default). `Interview` fill uses `var(--accent-2)` (orange). `Offer` fill uses `var(--accent-3)` (teal).
  - No narrative text, no AI summary, no stalled-applications list (locked by discovery).
- [ ] **FR-J3:** **JobsHero bucket mapping** — client-side aggregation from `useJobs({})`. Define in the same file as `<JobsHero />`:
  ```ts
  const HERO_BUCKET_STATUSES = {
    Applied: ["applied"] as ApplicationStatus[],
    Screen: ["screening"] as ApplicationStatus[],
    Interview: ["technical_interview", "final_interview"] as ApplicationStatus[],
    Offer: ["offer"] as ApplicationStatus[],
  };
  ```
  For each label, count jobs where `job.status` is in the mapped status list. Jobs with null/other statuses (`found`, `saved`, `resume_generated`, `accepted`, `rejected`, `ghosted`, `withdrawn`) do NOT contribute to any hero bucket.
- [ ] **FR-J4:** Re-skin `ApplicationColumn`:
  - Column header: marker SQUARE (not dot), uppercase label (already uppercase), count pill brutalist (`bg-[color:var(--bg-2)] border-[1px] border-[color:var(--line)]`), all keyed by `APPLICATION_STATUS_COLORS[status]`. For `technical_interview` / `final_interview` → marker uses `var(--accent-2)`; for `offer` → `var(--accent-3)`.
  - Drop zone: replace `rounded-lg` + `ring-1 ring-primary` on `isOver` with no-radius + `border-2 border-[color:var(--accent)]`.
- [ ] **FR-J5:** Re-skin `ApplicationCard`:
  - Container: default `border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]`, no radius. Keep the colored left-border accent strip (already ~0.5px — widen to 3px for parity with Tasks).
  - Title (`card.title`): mono, `var(--ink)`, 13px.
  - Company (`card.company`): secondary, `var(--ink-3)`, 12px, uppercase.
  - Footer: `{applied_date formatted} · {days_since}D` — replaces the current mixed footer content. Computation:
    ```ts
    function daysSince(appliedDate: string | null, today: Date = new Date()): number | null {
      if (!appliedDate) return null;
      const d = new Date(appliedDate);
      if (isNaN(d.getTime())) return null;
      const diffMs = today.getTime() - d.getTime();
      return Math.max(0, Math.floor(diffMs / 86_400_000));
    }
    function formatAppliedDate(appliedDate: string | null): string {
      if (!appliedDate) return "—";
      return new Date(appliedDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }).toUpperCase();
    }
    // Footer text:
    const dsince = daysSince(card.applied_date);
    const label = dsince === null ? "—" : `${formatAppliedDate(card.applied_date)} · ${dsince}D`;
    ```
    If `applied_date` is null → label renders `—`. (Per DATA-MAP — don't fabricate an applied date we don't have.)
    The salary / score / location text currently in the footer is preserved as a second line below the date, tokens-only-swapped.
  - "Hot" variant (full orange border): when `card.next_action_date` is non-null AND within 3 calendar days AND `card.status` is in `["screening", "technical_interview", "final_interview"]` → override outer border to `border-[1.5px] border-[color:var(--accent-2)]`.
  - "Offer" variant (full teal border): when `card.status === "offer"` → override outer border to `border-[1.5px] border-[color:var(--accent-3)]`.
  - Archived/closed variant (terminal statuses): `opacity-60` + `var(--ink-3)` company color (matches mockup's closed column).
  - Click → existing `router.push(/jobs/${card.id})` preserved.
- [ ] **FR-J6:** Switch `viewMode` default in `JobsPage` (`page.tsx:28`) from `"table"` to `"kanban"` so the PIPELINE tab (default) lands on the Kanban view. Verified to work in PC-6.
- [ ] **FR-J7:** Re-skin the existing tab bar (3 tabs: Jobs / Search / Analytics) at `page.tsx:77-113`:
  - Container: `border-b-[1.5px] border-[color:var(--line)]`.
  - Each tab: `border-b-[3px]` (active: `var(--accent)`, inactive: transparent), uppercase mono, `var(--ink-3)` inactive / `var(--ink)` active.
  - Rename tab label `Jobs` → `PIPELINE` (matches mockup). `Search` → `SEARCH`, `Analytics` → `ANALYTICS`. (The `TABLE` pill in the mockup's Jobs section is NOT a tab — it's the ViewToggle; that toggle stays where it is in the toolbar row.)
- [ ] **FR-J8:** Re-skin `JobsViewToggle`: brutalist button group (`border-[1.5px] border-[color:var(--line)]`, active = `bg-[color:var(--accent)] text-[color:var(--bg)]`, inactive = transparent). No logic change.
- [ ] **FR-J9:** Re-skin `JobsTable` — token swap only (same pattern as FR-T5 for TasksTable).

#### Verification

- [ ] **FR-V1:** `npm run lint` — green (0 errors, existing 38 warnings tolerated).
- [ ] **FR-V2:** `npm run build` — green (all 21 static pages compile).
- [ ] **FR-V3:** `npm test -- --run` — 315+ passing, no NEW failures. New unit tests added in Stage 3 (see FR-V4) count toward the positive number.
- [ ] **FR-V4:** New unit tests:
  - `daysSince()` and `formatAppliedDate()` pure functions — 4 cases each (valid date / invalid / null / today).
  - `<JobsHero />` — renders correct counts for a mocked `useJobs` return, handles zero case (all 4 cells show `0`), picks correct max for bar scaling.
  - Regression: `ApplicationKanban` drag-drop still calls `StatusChangeDialog` (existing test; re-run, not re-write).
  - `<ReminderList />` group-header re-skin — snapshot or DOM assertion on the `.hdline` class markup.

### P1 (Should Have)

- [ ] **FR-P1:** Jobs Hero subline "pipeline_qualitative" phrasing in FR-J1 could branch further (e.g. `needs apps.` if live = 0). Keep to the 2-branch version unless trivial.
- [ ] **FR-P2:** Task Kanban column counts in the tab bar (e.g. `KANBAN 7 · TABLE · ANALYTICS`). Trivially computable from `board`, but visual-only, skip if time-tight.

### P2 (Nice to Have — deferred)

- Natural-language Reminder parser.
- Shared extracted primitives (`PageHeader`, `SectionHeading`) — only revisit in Stage 4 after command palette adds a third surface that needs them.
- Column counts on every tab (Kanban `7`, Backlog `14` per mockup) — deferred; backlog isn't its own tab in Stage 3.
- Task card deadline countdown (`T-2H 14M`) — mockup hints at it; we stick with `formatDeadline` today.

## Non-Goals (Out of Scope)

- **No backend changes.** No schema migrations, no new endpoints, no model changes. `applied_date` / `next_action_date` / `status` fields on `Job` are consumed as-is.
- **No CRUD behavior changes.** Create/edit/delete of tasks, reminders, birthdays, and jobs still works exactly as today. All existing dialogs (`TaskDialog`, `JobDialog`, `EditReminderDialog`, `BulkImportDialog`, `StatusChangeDialog`) are preserved with token swaps only.
- **No drag-drop rewrites.** Existing DnD behavior in `KanbanBoard` (`@dnd-kit/core`) and `ApplicationKanban` stays identical.
- **No column re-mapping.** Tasks keeps the existing 6-status Kanban (`backlog / new / in_progress / review / done / cancelled`). Jobs keeps `PIPELINE_COLUMNS` + `TERMINAL_STATUSES`. Neither remaps to the mockup's simplified 4- or 5-column layouts.
- **No Reminders Settings panel.** The mockup's Channel / Quiet hours / Timezone / Birthday pulse tiles are explicitly out — none of these settings are persisted in the backend today. Adding a visual-only panel would violate DATA-MAP.
- **No shared primitive extraction.** No `PageHeader`, `SectionHeading`, `Tabs`, or `Card` components created in this PR. Write inline per-page — 3 pages is below critical mass for abstraction.
- **No mobile/responsive work.** Deferred to Stage 5. Stage 3 keeps the existing mobile behavior; if the current page works on mobile, re-skin must not break it, but new mobile-specific tuning is not in scope.
- **No theme toggle work.** Stage 1's basic dark/light flip still works; Stage 3 verifies new components render correctly in both themes but makes no toggle changes. Full theme-toggle polish = Stage 4.
- **No ⌘K / command palette.** Stage 4.
- **No badge counters in the sidebar** (still deferred per Stage 1 CLAUDE.md note).
- **No new test coverage targets.** Add smoke tests for new components (FR-V4). Do not rewrite existing tests unless they break from a required token change.
- **No regression test changes** — the 15 pre-existing flakes (`telegram-tab`, `job-detail-tracking`, `prompt-editor`) stay flaky at exactly the same counts.
- **No Reminders quick-add NL parser.** Visual-only dashed-border re-skin of the existing multi-field form.
- **No Job card salary/match-score rewrites.** If present today, they stay — just token-swapped.
- **No removal of the `/tasks/analytics` or `/reminders/birthdays` subroutes.** Both continue to work; Stage 3 only changes the entry points (tab label / compact preview).

## Acceptance Criteria

- [ ] **AC-1:** Navigate to `/tasks` on the dark theme. Page header reads `Module · Tasks` / `TASKS_` / `<N> open · <M> due today`. Right-side buttons include `+ NEW TASK` (acid-lime). No `<h1>Tasks</h1>` shadcn header remains. All brutalist tokens (`var(--ink)`, `var(--line)`, `var(--accent)`) visible.
- [ ] **AC-2:** `/tasks` header + tab bar + Kanban render correctly on light theme too. `html.light` class on `<html>` flips `--bg` to warm paper and `--accent` to black; no hardcoded colors bleed through.
- [ ] **AC-3:** Tasks Kanban column headers show: square marker (not rounded dot), uppercase label, count pill. Status-to-color mapping honored (`in_progress` → acid marker; `done` → teal marker).
- [ ] **AC-4:** TaskCard left border color is correct per `PRIORITY_BORDER_CSS_VARS[task.priority]` for all four priorities (`urgent` / `high` / `medium` / `low`). Test one task of each level.
- [ ] **AC-5:** Drag a task from `new` → `in_progress` → `done`. Movement persists after refresh. No console errors. `StatusChangeDialog` is NOT involved (Tasks has no confirmation dialog — direct update).
- [ ] **AC-6:** Navigate to `/reminders`. Header reads `Module · Reminders` / `REMINDERS_` / dynamic subline. Below the header: tabs (Reminders active) + 2-column grid. Quick-add form is at the top of the left column, visibly dashed-border. Birthdays aside (max 3) in the right column.
- [ ] **AC-7:** Type a title in quick-add, pick a date, submit. New reminder appears in the left column under "Today" (or the matching group). `toast.success("Reminder created")` fires. (Existing behavior; AC-6 is regression-only.)
- [ ] **AC-8:** ReminderRow renders `chk | when | body | acts` layout. Time urgent variant shows orange text. `IN Xh Ym` relative label visible on non-floating reminders.
- [ ] **AC-9:** `/reminders` right column shows top 3 upcoming birthdays. Clicking `See all →` navigates to `/reminders/birthdays` (full list).
- [ ] **AC-10:** Navigate to `/jobs`. Header `Module · Job Hunt` / `JOB_HUNT_` / dynamic subline. JobsHero renders below with 4 cells labeled `Applied · Screen · Interview · Offer`. Counts match a manual query of `useJobs()` filtered by `HERO_BUCKET_STATUSES`.
- [ ] **AC-11:** JobsHero mini-bars: max-value cell's bar is at 100% width. Other cells' bars scale to `value / max`. Interview bar = orange (`var(--accent-2)`), Offer bar = teal (`var(--accent-3)`), Applied + Screen = default ink.
- [ ] **AC-12:** JobsHero with zero jobs at all buckets: all cells show `0` as a numeric value; all bar fills render at 0% (empty track visible). No crash, no `—`.
- [ ] **AC-13:** On `/jobs`, the default `viewMode` is Kanban. Land on the page — `ApplicationKanban` renders immediately, NOT `JobsTable`. Drag a card from `screening` to `technical_interview`: `StatusChangeDialog` opens with the new status preselected. Confirm → card moves. Cancel → card stays.
- [ ] **AC-14:** ApplicationCard footer renders `{applied_date formatted} · {days_since}D`. Seed a job with `applied_date = '2026-04-10'` and verify footer reads `10 APR · 10D` on 2026-04-20. For a job with `applied_date = null` → footer shows `—` (no NaN, no `Invalid Date`).
- [ ] **AC-15:** ApplicationCard "hot" variant: seed a job with `status='screening'` and `next_action_date` = 2 days from today → card outer border renders orange (`var(--accent-2)`). Seed a job with `status='offer'` → card outer border renders teal (`var(--accent-3)`).
- [ ] **AC-16:** Stage 3 adds at least 6 new unit tests covering `daysSince()` (4 cases), `formatAppliedDate()` (null + valid), and `<JobsHero />` count aggregation (zero case + non-zero case).
- [ ] **AC-17:** No regression. `npm run lint` 0 errors. `npm run build` green. `npm test -- --run` ≥ 315 passing (baseline 315/330 + 6 new = 321/336 target; pre-existing 15 flakes unchanged).
- [ ] **AC-18:** Navigate through all 3 pages after merge. No `<h1>` with shadcn default styling. No `rounded-lg` / `rounded-md` on newly re-skinned containers (CSS compiled output grep-clean for `.tc`, `.jcc`, `.remrow` analogs — i.e. cards / rows are sharp-cornered).

## Implementation Phasing

Stage 3 ships as a single squash PR on `feat/redesign-stage-3-tasks-reminders-jobs`. The plan doc (`docs/plans/<date>-redesign-stage-3-tasks-reminders-jobs.md`, local-only per convention) breaks the work into the following task sequence. **Do not attempt to commit per-task** unless the plan doc says so — squash rolls everything into one commit at merge time.

1. **Scaffolding.** Pull `main`, run PC-1…PC-7, produce audit note (append to `CLAUDE.md` Current Status or save as `docs/audit-<date>-stage-3-entry.md`). Open branch.
2. **Tasks page re-skin** (FR-T1 → FR-T7). Commit once locally to mark progress. Expected surface: `page.tsx` + `kanban-column.tsx` + `task-card.tsx` + `tasks-table.tsx` + `task-filters.tsx`. Verify `npm test -- --run tasks` green.
3. **Reminders page re-skin** (FR-R1 → FR-R8). Surface: `page.tsx` + `reminders-tabs.tsx` + `quick-add-form.tsx` + `reminder-list.tsx` + new compact birthday markup (inline or `BirthdayList.limit?` prop). Verify reminders tests green.
4. **Jobs page re-skin + JobsHero** (FR-J1 → FR-J9). Surface: `page.tsx` (+ inline JobsHero or a new `jobs-hero.tsx` if JSX > 80 lines) + `application-column.tsx` + `application-card.tsx` + `jobs-table.tsx` + `view-toggle.tsx`. Write the 6 new unit tests (FR-V4) in this step. Verify jobs tests green.
5. **Verification sweep** (FR-V1…V4). `npm run lint`, `npm run build`, `npm test -- --run`. Document outcome in plan doc.
6. **Manual smoke** across all 3 pages, dark + light theme, on a seeded demo user:
   - Create / edit / delete task + drag between columns.
   - Create / complete / snooze / delete reminder.
   - Create / edit / drag job + verify JobsHero counts update.
7. **Squash merge** to `main` with message `feat: redesign stage 3 — tasks / reminders / jobs`. Delete branch. Update `CLAUDE.md` Current Status.

**Pre-condition to step 2:** Pre-Implementation Checklist fully ticked (PC-1…PC-7). No exceptions — this is what keeps Stage 3 from colliding with Stage 2/2a drift.

## Risks & Open Questions

1. **Reminders `groupByDate()` returns calendar dates for days beyond Tomorrow** — the mockup shows only `Today` and `This week` groupings. Current `reminder-list.tsx:96-143` returns `Today` / `Tomorrow` / formatted-date ("April 22, 2026") groups. Mitigation: Stage 3 accepts the current grouping as-is (renaming/regrouping would be a behavior change, out of scope for a re-skin). If the owner wants a strict 2-group `Today / This week` model later, that's a separate PR.
2. **`BirthdayList.limit` prop doesn't exist yet** (FR-R7). Adding it is a 1-line change; risk is that the existing `/reminders/birthdays` route needs the unlimited default — easy to preserve (`limit?: number` with no default = no limit). Fallback: inline a bespoke `BirthdaysCompact` using `useBirthdays()` directly — also 20 lines.
3. **JobsHero "Applied" bucket ambiguity** — does "Applied" mean only status `applied`, or also include any job further down the pipeline (since they were applied-to at some point)? Locked in FR-J3: only status `applied`. Rationale: each hero bucket must be disjoint for the mini-bars to aggregate sensibly; double-counting inflates the totals. If the owner prefers "ever-applied" semantics, swap `HERO_BUCKET_STATUSES.Applied` to include `["applied", "screening", "technical_interview", "final_interview", "offer"]` and the bar math still works — but the narrative breaks (Applied = 12 with Interview = 3 is confusing).
4. **`JobsViewToggle` on mobile currently has a separate collapse panel** (`showMobileFilters` in `page.tsx`). Re-skinning this without touching the behavior is fine; just token-swap. No other mobile risk since Stage 5 owns responsive.
5. **Test baseline (315/330) may drift** between PRD write and branch open if Stage 2a follow-up fixes continue landing. Always re-lock the baseline in the Audit Procedure step 6 before start.
6. **`TaskFiltersBar` dropdown vs mockup pill tabs** (IC-T6, FR-T6): the mockup shows `ALL / #WORK / #JOB / #ADMIN` pill tabs in the Tasks tab row. Keeping the dropdown preserves multi-select + bulk-action wiring, at a small visual cost. Accepted per "Scope locked #7 (no shared primitives, inline per-page) + DATA-MAP integrity". If the owner later prioritizes the pill visual, it's a separate stage.
7. **Jobs card "salary" and "match_score" footer fields** — currently `ApplicationCard` shows these after the applied-date line. Stage 3 keeps them as a second footer line but re-skinned; if they're absent (null), render a dash or omit silently (existing behavior). Do not add new fields.

## Next Step

On approval, this PRD becomes the source of truth for the Stage 3 implementation plan. The plan doc splits FR-T1…T7, FR-R1…R8, FR-J1…J9 into 2-5 minute tasks each following the `/dev plan` step-6 template. Expected duration: 3-5 focused days (similar to Stage 2a scope).
