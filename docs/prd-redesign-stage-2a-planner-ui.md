# PRD: Redesign Stage 2a — Planner UI overlay on Today

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-19 |
| Status | Draft |
| Priority | P0 |
| Discovery | [discovery-2026-04-19-redesign-and-planner-ui.md](./discovery-2026-04-19-redesign-and-planner-ui.md) |
| Depends on | `handoff/HANDOFF.md` Stage 2 — must be **fully merged into `main`** before any 2a code is written |
| Unblocks | Stage 3 (Tasks/Reminders/Jobs) |

> ⚠️ **How to use this PRD.** Do NOT start implementation from FR-1 until the **Pre-Implementation Checklist** (PC-1…PC-5) is fully ticked and the **Audit Procedure** has produced a ✅ go. Those sections are the first things to execute after Stage 2 ships. Skipping them is the single largest source of rework for this feature.
>
> **Reading order on first open:**
> 1. Problem Statement (this page, 2 paragraphs)
> 2. Pre-Implementation Checklist — MANDATORY gate
> 3. Interface Contract — what 2a assumes about Stage 2
> 4. Audit Procedure — 10-min drift check
> 5. Then: User Scenarios → Functional Requirements → Technical Design → AC → Phasing.

> ✅ **Post-Audit Status (2026-04-19).** Pre-Implementation Checklist PC-1…PC-5 all ticked. Audit Procedure produced **GO after one doc-patch commit**. Drift found: all Stage 2 components shipped under `frontend/src/components/today/` (not `components/dashboard/` as handoff implied); `StatsGrid` is zero-prop with hardcoded cells (not composable); cell labels differ (`Tasks done · today` instead of `Focus · today`, etc.); top-bar lives under `components/layout/header.tsx`. Classified as rename + signature drift per PRD's "Rules for adaptation" — no structural divergence. This PRD + the implementation plan were patched on `main` in one commit before `feature/redesign-stage-2a-planner` was opened.

## Problem Statement

Phase 2 of the planner-hub integration (`prd-planner-hub-phase2.md`, shipped at `main@af9a094`) wired the write path: the `/planner` skill POSTs today's plan to the hub API. The read path is missing — plans live in Postgres but the user has no way to see them on the portal. Today the only way to see today's plan is to ask the skill in chat (`/planner status`).

The upcoming portal redesign (`handoff/HANDOFF.md`, 5 stages) does not cover this gap — its Today-page spec pulls from tasks / meetings / reminders / jobs / pulse only. If we ship the 5 handoff stages as-is, the read path stays broken.

Stage 2a closes the loop by bolting a planner-aware overlay onto the redesigned Today page, immediately after Stage 2 ships. When a plan exists, Today renders it as the primary day view with a compact progress bar and an ordered queue of plan items; when no plan exists, Today falls back to handoff's task-driven view with a thin CTA strip nudging the user to plan.

No backend changes, no schema changes, no skill changes — the overlay is a pure frontend feature consuming already-shipped APIs.

## User Scenarios

### Scenario 1: Morning — no plan yet

**As the** user, **I want to** open the portal at 08:45 before I've run `/planner plan`, **so that** I still see my P1 task, today's calendar, and a clear CTA reminding me to plan my day.

### Scenario 2: After planning

**As the** user, **I want to** run `/planner plan 5h` in Claude Code, tab back to the portal, and see the plan immediately — progress bar, next unfinished item, queue of items with duration chips, and calendar events as read-only anchors.

### Scenario 3: Midday completion

**As the** user, **I want to** finish an English SRS block, click its checkbox on Today, and see the completed-minutes / adherence numbers update without any extra prompts.

### Scenario 4: Cross-surface completion

**As the** user, **I want to** close an item via Telegram bot (`я закончил английский, 45 минут`) and have the portal reflect it the next time I focus the tab, without manual refresh.

### Scenario 5: Adherence visibility

**As the** user, **I want to** see my 7-day plan adherence as a persistent number in Today's Stats Grid, **so that** a weekly trend is visible at a glance without navigating to a separate analytics page.

### Scenario 6: Skill-only plan items

**As the** user, **I want** plan items that aren't linked to hub tasks (e.g. `English SRS — 30 карт`) to render cleanly with just their title + category + duration, without pretending there's a deeper context to show.

## Functional Requirements

### P0 (Must Have)

#### Plan-bar (compact progress header)

- [ ] **FR-1:** New component `<PlanBar />`. Renders at the top of Today page when `GET /api/planner/plans/today` returns 200. Replaces handoff's `<HeroPriority />` for plan-mode only.
- [ ] **FR-2:** Layout — two lines:
  - Line 1: `PLAN · <YYYY-MM-DD>` + progress bar + counts `<completed_items>/<total_items>` + minutes `<completed_minutes>/<planned_minutes>m`
  - Line 2: `▶ NEXT · <title> · <minutes_planned>m` — pulls the first plan item where `status != 'done' AND status != 'skipped'`, sorted by `order`. If every item is done/skipped, Line 2 reads `✓ All items complete for today.`
- [ ] **FR-3:** Uses brutalist tokens (mono body, 11px meta labels, acid-lime progress fill on dark / black on light). No radii, no shadows.
- [ ] **FR-4:** On click of the NEXT line — no-op for MVP. No navigation, no modal. Future: could scroll to the matching row in FOCUS QUEUE.

#### Focus queue (plan items list)

- [ ] **FR-5:** New component `<FocusQueue />`. Renders the plan's `items[]` in `order`, below the Plan-bar.
- [ ] **FR-6:** Each row shows:
  - Checkbox reflecting `status` (`pending` / `in_progress` / `rescheduled` → unchecked; `done` → checked; `skipped` → dashed/muted glyph)
  - `title` — if `linked_task_id` is set and task exists, hover-tooltip shows the linked task's `priority` / `deadline`. The title text itself remains `plan_item.title` (skill's wording), not `task.title`. Implementation note: `PlanItemResponse.task_title` is already derived server-side, so no extra query is needed for the task title. For `priority` / `deadline`, reuse the already-fetched `useTasks()` data via React Query — no additional network call (TanStack Query deduplicates against the task list queried by Stage 2 components).
  - Duration chip `<minutes_planned>m`
  - Category tag `LANG` / `CAREER` / `HOME` / `LIFE` — mapped from `plan_item.category` via hardcoded label dict; unknown categories fall back to the raw key uppercased
  - Linked-task chip `#<id>` when `linked_task_id` is set. Clicking navigates to `/tasks/<id>` via Next.js `<Link>`.
- [ ] **FR-7:** Completed rows render with `.done` modifier (opacity 0.6, line-through on title, chip dimmed). Completed rows stay in their `order` position — they do not sort to bottom.
- [ ] **FR-8:** Clicking an unchecked checkbox sends `PATCH /api/planner/plans/today/items/{id}` with body `{status: "done", minutes_actual: <minutes_planned>}` — i.e. we assume the user stuck to the plan. No inline prompt for actual minutes. On success, the component updates local state from the PATCH response (including the plan-level aggregates returned indirectly via a fresh GET or by lifting state; see Technical Design).
- [ ] **FR-9:** Unchecking a completed row is not supported in MVP. If the user clicks a completed checkbox, the UI does nothing (no PATCH). Undo goes through the skill (`/planner` undo path, if any) — keeping the portal's write surface minimal.
- [ ] **FR-10:** Optimistic UI — on click, immediately render the row as `done` (strike-through, dimmed) while the PATCH is in flight. On PATCH failure, revert + show a toast `Не удалось отметить — попробуй ещё раз`. No blocking spinner.

#### Fixed schedule (read-only anchors)

- [ ] **FR-11:** New component `<FixedSchedule />`. Renders **only** when a plan exists AND `/api/planner/context.calendar_events` returns at least one event for today. When plan exists but no calendar events today, the component renders nothing (no empty placeholder).
- [ ] **FR-12:** Shows today's calendar events sorted by `start` (the backend's `ContextEvent` schema uses `start` / `end`, not `start_time` / `end_time`). Each row: `HH:MM · <title> · <duration>` where duration is computed client-side as `(end - start)` in minutes. The backend payload carries no meeting-type discriminator, so all rows render the `MEET` tag (matches Stage 2 `DayTimeline`). An `INTERVIEW` variant is deferred until a backend field supports it.
- [ ] **FR-13:** When plan exists, `<FixedSchedule />` does **not** show reminders — the skill already injected today's due reminders into plan items (`urgent=true`, earliest slot), so they live in `<FocusQueue />`.
- [ ] **FR-14:** When plan does NOT exist, the handoff-Today fallback owns the timeline (the existing `<DayTimeline />` spec includes meetings + reminders). `<FixedSchedule />` is not rendered in fallback mode.

#### Empty state (no plan)

- [ ] **FR-15:** When `GET /api/planner/plans/today` returns 404, Today renders:
  - Thin CTA strip above the Hero: `📋 No plan for today. Run /planner plan Xh in Claude Code.` (brutalist tokens, dashed bottom border, no CTA button — the skill is invoked outside the portal)
  - Full handoff-Today below: `<HeroPriority />`, `<HeroCells />`, `<DayTimeline />`, `<StatsGrid />`, `<RemindersToday />`, `<SignalsFeed />` — all as specified by handoff Stage 2.
- [ ] **FR-16:** Any non-404 error from `GET /plans/today` surfaces as a small error strip (`⚠ Could not load today's plan — showing task view. Retry.`) with a retry link; the rest of the page renders the handoff fallback so the portal remains usable.

#### Stats Grid integration

- [ ] **FR-17:** In the Stage 2 Stats Grid (2×2, 4 cells), replace the `Tasks done · today` cell with `Plan adherence · 7d`. The other three cells (`Overdue tasks`, `Notes · 30d`, `Response rate · 30d`) are untouched. (Handoff's original cell set included `Focus · today`; Stage 2 shipped `Tasks done · today` in its place due to the absent `focus_sessions` backend. 2a targets the actually-shipped cell.) Implementation: extend `today/stats-grid.tsx` with an optional `replaceTasksDoneWith?: ReactNode` prop (default `undefined` → current behavior) so Stage 2 callers remain unchanged.
- [ ] **FR-18:** The new cell fetches `GET /api/planner/analytics?from=<today-6d>&to=<today>` and renders `avg_adherence` (the server-computed mean of `adherence_pct` across the window) rounded to integer % plus a delta arrow vs. the prior 7-day window (`from=<today-13d>&to=<today-7d>`). When the prior window has no plans (`avg_adherence == null`), show no delta (no arrow, no number). When the current window has no plans, show `—` as the value.
- [ ] **FR-19:** This cell renders regardless of whether today's plan exists — past-week adherence is meaningful even on a no-plan morning.

#### Live refresh

- [ ] **FR-20:** Today refetches `GET /plans/today` on window `visibilitychange` → `visible` (tab regained focus). This covers the "completed via Telegram bot while tab was backgrounded" scenario. No polling, no WebSocket.
- [ ] **FR-21:** The same visibility hook refetches `/api/planner/analytics` for the Stats Grid cell and `/api/planner/context` for `<FixedSchedule />`.

### P1 (Should Have)

- [ ] **FR-22:** Visual distinction for plan items with `status=skipped` (dashed strike-through vs. solid strike-through for `done`). Low priority — MVP can treat `skipped` the same as `done`.
- [ ] **FR-23:** Keyboard shortcut: pressing `Space` while focused on a FOCUS QUEUE row toggles its completion (subject to FR-8/9 restrictions).

### P2 (Nice to Have — deferred)

- Replan button on Plan-bar — explicitly out of scope per discovery Q2=B.
- Drag-to-reorder items — out of scope.
- Inline edit of plan item title / minutes — out of scope.
- Per-category filter toggle on FOCUS QUEUE — out of scope.
- `<FixedSchedule />` showing a "NOW" indicator at the current wall-clock position — defer until there's real usage pain.

## Non-Functional Requirements

- **Performance:** Plan-mode Today should render its first paint within the same budget as handoff-Today (no new blocking calls on the critical path). The three planner GETs (`/plans/today`, `/context`, `/analytics`) run in parallel via `Promise.all` alongside the existing dashboard widget queries; no serial waterfall.
- **Resilience:** A 404 on `/plans/today` is an expected state (empty day), not an error — must not surface as a toast or console error. Any 5xx from planner endpoints must fall back gracefully without breaking the rest of Today.
- **Accessibility:** Checkboxes must have proper ARIA roles and be keyboard-activatable. Progress bar has `role="progressbar"` with `aria-valuenow`/`aria-valuemax`. Category tags and duration chips have `aria-label` expanding the abbreviations (e.g. `LANG` → `Language category`).
- **Observability:** PATCH failures in FR-10 must log once (not per-retry) to browser console with enough detail to debug (`item_id`, HTTP status, response snippet).
- **Theme:** All new components must support both dark (default) and light (warm paper) themes via the token system introduced in Stage 1. No hardcoded colors.

## Technical Design

### Stack

Unchanged from the redesigned Hub:
- Next.js 16 App Router (the `(dashboard)` route group)
- React 19 with server components where possible; client components for interactive pieces (`<FocusQueue />`, Stats Grid cell with live refresh)
- TanStack Query (existing `query-provider.tsx`) for all three planner fetches + optimistic updates on PATCH
- shadcn-ui primitives (Checkbox) with brutalist-token overrides
- Tailwind 4 + the token CSS from Stage 1

### Chosen Approach

**One page component, conditional render by plan existence.** Imports follow Stage 2's actual paths (`@/components/today/...`). `StatsGrid` is extended with an optional `replaceTasksDoneWith?: ReactNode` prop to swap the `Tasks done · today` cell in plan-mode without refactoring its cells array.

`frontend/src/app/(dashboard)/page.tsx` becomes:

```tsx
"use client";

import { usePlanToday } from "@/hooks/use-plan-today";
import { useVisibilityRefetch } from "@/hooks/use-visibility-refetch";
import { PlanBar } from "@/components/today/plan-bar";
import { FocusQueue } from "@/components/today/focus-queue";
import { FixedSchedule } from "@/components/today/fixed-schedule";
import { NoPlanStrip } from "@/components/today/no-plan-strip";
import { PlanAdherenceCell } from "@/components/today/plan-adherence-cell";
import { TodaySkeleton } from "@/components/today/today-skeleton";

// Stage 2 handoff components — paths validated by audit IC-1…IC-7.
import { HeroPriority } from "@/components/today/hero-priority";
import { HeroCells } from "@/components/today/hero-cells";
import { DayTimeline } from "@/components/today/day-timeline";
import { StatsGrid } from "@/components/today/stats-grid";
import { RemindersToday } from "@/components/today/reminders-today";
import { SignalsFeed } from "@/components/today/signals-feed";

export default function DashboardPage() {
  const { plan, hasPlan, isLoading } = usePlanToday();

  useVisibilityRefetch([
    ["planner", "plans", "today"],
    ["planner", "context"],
    ["planner", "analytics", "7d"],
    ["planner", "analytics", "7d-prior"],
  ]);

  if (isLoading) return <TodaySkeleton />;

  return (
    <div>
      {hasPlan && plan ? <PlanBar plan={plan} /> : <NoPlanStrip />}

      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] border-[1.5px] border-[color:var(--line)]">
        {!hasPlan && <HeroPriority />}
        <HeroCells />
      </div>

      {hasPlan && plan ? <FocusQueue plan={plan} /> : <DayTimeline />}
      {hasPlan && <FixedSchedule />}

      <StatsGrid replaceTasksDoneWith={<PlanAdherenceCell />} />

      <RemindersToday />
      <SignalsFeed />
    </div>
  );
}
```

No feature flag, no A/B toggle — an error (404 or any other non-200) on `/plans/today` is the natural switch into fallback mode. The `usePlanToday` hook treats all errors as "no plan" (`hasPlan=false`) and surfaces the error object only for the optional error-strip (FR-16).

**StatsGrid extension (IC-4 signature drift fix):** The shipped `today/stats-grid.tsx` builds its 4 cells inside the component and has no props. 2a adds one optional prop without touching defaults:

```tsx
// today/stats-grid.tsx — diff
export function StatsGrid({
  replaceTasksDoneWith,
}: { replaceTasksDoneWith?: React.ReactNode } = {}) {
  // ...existing hooks + cells[] array...
  const renderCell = (c: Cell) =>
    c.lab === "Tasks done · today" && replaceTasksDoneWith
      ? replaceTasksDoneWith
      : <DefaultCellTile cell={c} />;
  // ...render the 2×2 grid using renderCell(c)
}
```

Stage 2 callers (`<StatsGrid />` with no props) keep identical output. Plan-mode callers pass `<PlanAdherenceCell />` as the replacement. The `PlanAdherenceCell` fetches `/api/planner/analytics` via `usePlanAnalytics` and renders inside the same border/padding skeleton so the grid stays visually consistent.

### API Design

All endpoints exist already. This feature adds **no new backend routes**.

| Method | Path | Use | Notes |
|--------|------|-----|-------|
| GET | `/api/planner/plans/today` | Plan-mode switch + Plan-bar + FocusQueue data | 404 = no plan today (expected) |
| PATCH | `/api/planner/plans/today/items/{item_id}` | Complete an item | Body: `{status, minutes_actual}`. Returns updated `PlanItemResponse`. |
| GET | `/api/planner/context?date=today` | FixedSchedule calendar events | Use only `.calendar_events` — ignore other fields |
| GET | `/api/planner/analytics?from=<today-6d>&to=<today>` | Plan adherence Stats cell | Current window |
| GET | `/api/planner/analytics?from=<today-13d>&to=<today-7d>` | Plan adherence delta | Prior window for arrow |

All reuse the existing JWT session cookie (`ApiClient.getToken()`). No API-token bearer flow on the portal side — that lives in the skill's `.auth` file.

### Data Model

No changes. The skill's Phase 2 schema is sufficient:
- `daily_plans` — one row per (user, date). Aggregates computed server-side on PATCH.
- `plan_items` — N rows per plan, ordered by `order`. `status ∈ {pending, in_progress, done, skipped, rescheduled}`.
- `api_tokens` — untouched.

### File Layout

All new 2a components live under `frontend/src/components/today/` — the same directory Stage 2 uses — to keep the Today page's co-located structure intact.

```
frontend/src/
├── app/(dashboard)/
│   ├── page.tsx                          # MODIFIED — conditional render by hasPlan
│   └── __tests__/
│       └── page-plan-mode.test.tsx       # NEW — integration test for plan/no-plan switch
├── components/today/
│   ├── stats-grid.tsx                    # MODIFIED — add replaceTasksDoneWith?: ReactNode prop
│   ├── plan-bar.tsx                      # NEW
│   ├── focus-queue.tsx                   # NEW
│   ├── fixed-schedule.tsx                # NEW
│   ├── no-plan-strip.tsx                 # NEW
│   ├── plan-adherence-cell.tsx           # NEW (plan-mode replacement cell)
│   ├── today-skeleton.tsx                # NEW (loading state)
│   └── __tests__/
│       ├── plan-bar.test.tsx             # NEW
│       ├── focus-queue.test.tsx          # NEW
│       ├── fixed-schedule.test.tsx       # NEW
│       ├── plan-adherence-cell.test.tsx  # NEW
│       └── stats-grid.test.tsx           # NEW — covers the replaceTasksDoneWith branch
├── lib/
│   └── api.ts                            # MODIFIED — add plannerApi methods
├── hooks/
│   ├── use-plan-today.ts                 # NEW — wraps React Query for /plans/today + PATCH mutation
│   ├── use-plan-analytics.ts             # NEW — 7d + prior-7d adherence for Stats Grid cell
│   ├── use-planner-context.ts            # NEW — /context for FixedSchedule
│   └── use-visibility-refetch.ts         # NEW — visibilitychange → invalidate queries
├── types/
│   └── plan.ts                           # NEW — DailyPlan, PlanItem, PlannerContext, Analytics types
```

No backend files touched. No skill files touched.

### Category Label Map (FR-6)

Hardcoded in `frontend/src/components/today/focus-queue.tsx` (or lifted into `frontend/src/types/plan.ts` and re-exported — either is fine):

```ts
const CATEGORY_LABEL: Record<string, string> = {
  language: "LANG",
  career: "CAREER",
  home: "HOME",
  life: "LIFE",
};
const labelFor = (key: string | null) =>
  key ? (CATEGORY_LABEL[key] ?? key.toUpperCase()) : "—";
```

New categories introduced in `registry.yaml` without a label here will render as their uppercased key (e.g. `FINANCE`) — acceptable until the new category gets meaningful portal use.

### Optimistic Update + Cache Reconciliation (FR-8, FR-10)

Using TanStack Query:

```ts
const patchMutation = useMutation({
  mutationFn: ({ id, body }) => plannerApi.patchItem(id, body),
  onMutate: async ({ id }) => {
    await queryClient.cancelQueries({ queryKey: ["planner", "plans", "today"] });
    const prev = queryClient.getQueryData(["planner", "plans", "today"]);
    queryClient.setQueryData(["planner", "plans", "today"], (p) => {
      if (!p) return p;
      return {
        ...p,
        items: p.items.map(i => i.id === id ? { ...i, status: "done" } : i),
      };
    });
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    queryClient.setQueryData(["planner", "plans", "today"], ctx?.prev);
    toast.error("Не удалось отметить — попробуй ещё раз");
  },
  onSuccess: () => {
    // Refetch to pick up server-computed aggregates (adherence_pct, completed_minutes)
    queryClient.invalidateQueries({ queryKey: ["planner", "plans", "today"] });
  },
});
```

The PATCH response returns only the updated `PlanItemResponse` (no plan-level aggregates). To keep `<PlanBar />` counts accurate, `onSuccess` invalidates the whole plan query, causing a single re-GET. A faster path would be to recompute aggregates client-side — deferred, not worth the duplication for MVP.

## Out of Scope

- Backend changes (schemas, endpoints, migrations).
- Skill changes (`plan-day.md`, `registry.yaml`, etc.).
- New sidebar route `/planner`.
- Historical / weekly / monthly plan views (remain in skill).
- Drag-to-reorder, inline edit, add / delete plan items from UI.
- Replan button on Today.
- `minutes_actual` inline input on checkbox click.
- Undo completion from UI.
- Signals-feed column for planner events.
- Top-bar global stat for plan progress.
- `<FixedSchedule />` NOW-indicator.
- Mobile-specific layout tuning (belongs to handoff Stage 5 QA pass).

## Acceptance Criteria

- [ ] **AC-1:** Navigate to `/` while `GET /plans/today` returns 200. `<PlanBar />` renders with `PLAN · <today>`, progress bar visually correct for `completed_items / total_items`, minute counts match API response, and `▶ NEXT` shows the first non-done, non-skipped item's title + `minutes_planned`.
- [ ] **AC-2:** Navigate to `/` while `GET /plans/today` returns 404. `<NoPlanStrip />` shows the CTA text; full handoff Hero + DayTimeline + StatsGrid (with Plan-adherence cell replacing Focus) render below.
- [ ] **AC-3:** With a plan loaded, clicking an unchecked row in `<FocusQueue />` immediately renders it as `done` (optimistic), fires `PATCH /plans/today/items/{id}` with `{status:"done", minutes_actual:<minutes_planned>}`, and — within 500ms of the PATCH response — re-renders `<PlanBar />` counts with the server's updated aggregates.
- [ ] **AC-4:** Simulate PATCH failure (network throttle / 500). The optimistic `done` state reverts to unchecked, a toast shows the error message, and the item remains clickable to retry.
- [ ] **AC-5:** Clicking a row that's already `done` does nothing — no PATCH, no UI change.
- [ ] **AC-6:** With plan loaded AND today's calendar has ≥1 event, `<FixedSchedule />` renders each event as `HH:MM · title · duration` sorted chronologically. With plan loaded AND no calendar events, `<FixedSchedule />` does not render (no empty placeholder).
- [ ] **AC-7:** With plan loaded, today's due reminders (from `/context.due_reminders`) are NOT shown in `<FixedSchedule />`. They already appear in `<FocusQueue />` as plan items with `linked_task_id=null`.
- [ ] **AC-8:** Stats Grid cell `Plan adherence · 7d` shows `avg(adherence_pct)` for the last 7 days from `/api/planner/analytics`, with an up/down arrow + delta number vs. the prior 7-day window. When no plans exist in the current window, the cell shows `—`.
- [ ] **AC-9:** Open Today in one browser tab with plan loaded. Complete an item via Telegram bot. Focus back to the browser tab — within the same user interaction (tab-focus event), `<FocusQueue />` reflects the completion and `<PlanBar />` counts update.
- [ ] **AC-10:** Toggle theme (Stage 4 dependency — deferred test). Verify all new components render correctly in both dark and light themes with no hardcoded colors, using tokens only. If Stage 4 is not yet merged when building 2a, smoke-test with manual class toggling on `<html>`.
- [ ] **AC-11:** Keyboard: tab through FOCUS QUEUE rows; pressing Space toggles completion of the focused row (P1 requirement FR-23; skip if P1 deferred).
- [ ] **AC-12:** Build + lint pass. All new component tests pass. No regression in existing dashboard tests.
- [ ] **AC-13:** Lighthouse a11y score on Today remains ≥ 90.

## Pre-Implementation Checklist (MANDATORY before Stage 2a work starts)

Stage 2a depends on handoff Stage 2 having shipped first. The following must be true before opening `feature/redesign-stage-2a-planner`:

- [ ] **PC-1:** Stage 2 (handoff Today redesign) is merged into `main`. The squash commit is recorded in `CLAUDE.md` under `Current Status`.
- [ ] **PC-2:** Handoff Stages 3, 4, 5 have NOT yet started. (Stage 2a must land before Stage 3 to keep the two redesign tracks sequenced. If Stage 3 started first, re-assess.)
- [ ] **PC-3:** The Interface Contract below has been verified against the real Stage 2 code (run the Audit Procedure, fill in the table). Any drift from handoff-spec must be reconciled in this PRD before any 2a code is written.
- [ ] **PC-4:** All existing frontend tests pass on `main` after Stage 2 merged. 2a must not inherit a broken baseline.
- [ ] **PC-5:** Backend API is reachable and `GET /api/planner/plans/today` / `PATCH /api/planner/plans/today/items/{id}` / `GET /api/planner/context` / `GET /api/planner/analytics` return the shapes described in `backend/app/schemas/planner.py` (no schema drift since Phase 2 ship).

**Do not start implementation** until every box above is ticked. Skipping this checklist is the single largest source of rework for this PRD.

## Interface Contract (what Stage 2a expects from Stage 2)

Stage 2a imports and composes components produced by Stage 2. The table below is the **expected** shape as implied by `handoff/HANDOFF.md` and `handoff/mockups/hub-brutalist-v2.html`. After Stage 2 ships, run the Audit Procedure to verify or correct.

| # | Stage 2 artifact | Expected path | Expected signature / behavior | Used by 2a for |
|---|---|---|---|---|
**Post-audit (2026-04-19): rows updated to reflect actual Stage 2 ship. Original handoff-spec expectations kept in parentheses for history.**

| IC-1 | `HeroPriority` component | `frontend/src/components/today/hero-priority.tsx` *(handoff expected `components/dashboard/`)* | Self-fetching (no required props) — picks the Priority_01 target per a client-side `selectPriority` (urgent-today → any-today → next meeting → empty). Renders an empty-state block when no candidate exists. | FR-15 fallback when no plan |
| IC-2 | `HeroCells` component | `frontend/src/components/today/hero-cells.tsx` *(handoff expected `components/dashboard/`)* | Self-fetching 2×2 cells. Shipped cells: `Open tasks` / `Tasks due today` / `Apps live` / `Meetings today` (handoff's `Interviews wk` / `Pulse unread` replaced per the scope adjustments logged in `CLAUDE.md` — backend gaps). Renders in both modes. | Unchanged by 2a |
| IC-3 | `DayTimeline` component | `frontend/src/components/today/day-timeline.tsx` *(handoff expected `components/dashboard/`)* | Self-fetching union view (tasks + meetings + reminders). Focus rows omitted — no `focus_sessions` backend. | FR-15 fallback only |
| IC-4 | `StatsGrid` component | `frontend/src/components/today/stats-grid.tsx` *(handoff expected `components/dashboard/`; shipped as zero-prop with 4 cells hardcoded in an internal `Cell[]` array)* | **Not composable as handoff implied.** No `cells=` prop, no children slot. Cells rendered: `Overdue tasks` / `Notes · 30d` / `Response rate · 30d` / `Tasks done · today`. **2a strategy:** modify `today/stats-grid.tsx` directly — add an optional `replaceTasksDoneWith?: ReactNode` prop (default `undefined` → current behavior). When set, the `Tasks done · today` cell body is replaced with that node; Stage 2 callers remain unchanged. | 2a swaps one cell (`Tasks done · today` → `PlanAdherenceCell`) |
| IC-5 | Focus-cell (formerly `FocusTodayCell`) | Inlined in `today/stats-grid.tsx` as the `Tasks done · today` cell; **no standalone file** | Shipped as inlined JSX (the handoff's "Focus · today" cell was replaced with `Tasks done · today` due to backend gap — see `CLAUDE.md` scope adjustments). | 2a swaps via IC-4's `replaceTasksDoneWith` prop |
| IC-6 | `RemindersToday` component | `frontend/src/components/today/reminders-today.tsx` *(handoff expected `components/dashboard/`)* | Self-fetching reminders-for-today slice. | Unchanged by 2a |
| IC-7 | `SignalsFeed` component | `frontend/src/components/today/signals-feed.tsx` *(handoff expected `components/dashboard/`)* | 4-column AI digest per handoff §4.6. | Unchanged by 2a |
| IC-8 | Design tokens | CSS variables on `:root` per handoff `TOKENS.md`, with `html.light` overrides | All handoff tokens present in `frontend/src/app/globals.css`: `--bg`, `--bg-2`, `--line`, `--line-2`, `--ink`, `--ink-2`, `--ink-3`, `--ink-4`, `--accent`, `--accent-2`, `--accent-3`, `--mono`, `--display`. Shadcn aliases (`--shadcn-accent` etc.) also present; do NOT use directly in 2a — use brutalist tokens only. | All new 2a components use only these tokens — zero hardcoded colors |
| IC-9 | Top-bar / header | `frontend/src/components/layout/header.tsx` *(handoff expected `components/dashboard/top-bar.tsx`)* | Already in Stage 1 shell. 2a does NOT modify it. | Not used directly; only verify it exists |
| IC-10 | Page composition | `frontend/src/app/(dashboard)/page.tsx` renders `HeroPriority`, `HeroCells`, `DayTimeline`, `StatsGrid`, `RemindersToday`, `SignalsFeed` as direct children, with a local `Hdline` helper drawing section separators (`Timeline · Today`, `Reminders · Today`, `Signals · Background`). Layout: Hero row (Priority+Cells) → 2-col (Timeline left, Stats+Reminders right) → Signals feed. | 2a wraps the existing render in a `hasPlan` conditional. Section headings may change in plan-mode (e.g. `Focus queue · Today` instead of `Timeline · Today`). Structure is composable. |

**Rules for adaptation when audit finds drift:**
- **Rename only** (e.g. `HeroPriority` → `PriorityHero`): update this PRD's FR references in a single commit (`docs: align stage-2a PRD with stage-2 component names`) before starting build.
- **Signature change** (e.g. `<HeroPriority />` → `<HeroPriority task={...} />` requiring us to fetch): extend `use-plan-today.ts` or add a sibling hook; note in the audit but keep this PRD as source of truth for the PATCH/GET flow — which does not change.
- **Layout change** (e.g. Stage 2 splits page into named slots via a sub-component like `<TodayLayout hero={...} timeline={...} />`): this PRD's "Chosen Approach" code sketch becomes stale; rewrite that section only, not the FRs.
- **Structural divergence** (e.g. Stage 2 decides to server-render all components with no client-side state — incompatible with our PATCH mutation flow): this is a scope blocker. Stop, escalate, renegotiate Stage 2a scope with user before any 2a code is written.

## Audit Procedure (run AFTER Stage 2 merges, BEFORE starting 2a)

Ten-minute procedure. Produces either ✅ go or 🔴 block.

1. **Pull latest main.** `git checkout main && git pull`
2. **List what Stage 2 actually changed.**
   ```bash
   git log --oneline <stage-1-squash>..<stage-2-squash> -- frontend/src
   git diff <stage-1-squash>..<stage-2-squash> --stat -- frontend/src
   ```
3. **Verify each Interface Contract row (IC-1 … IC-10) against the code.** For each row: does the file exist at the expected path? Does its signature match? Tick or mark drift.
4. **Run frontend tests on main.** `cd frontend && npm test`. Must be green before 2a starts (PC-4).
5. **Quick smoke — open the portal.** Verify the handoff-Today visually matches `handoff/mockups/hub-brutalist-v2.html`. Catches silent regressions where tests pass but the page looks wrong.
6. **Compile the audit findings into a short note** (paste into `CLAUDE.md` under `Current Status`, or save as `docs/audit-2026-MM-DD-stage-2-to-2a.md` if non-trivial):
   ```
   Stage 2 → 2a audit, <date>
   IC-1 ✅ as expected
   IC-2 ✅ as expected
   IC-3 ⚠️  component named `TodayTimeline`, not `DayTimeline` — update PRD FR-15
   IC-4 ✅ StatsGrid uses children pattern
   IC-5 🔴 FocusTodayCell inlined inside StatsGrid, extract needed OR different replacement strategy
   ...
   Decision: GO after one 10-min PRD update (IC-3 rename) + one 20-min refactor to extract FocusTodayCell (IC-5).
   ```
7. **If any row is 🔴 structural divergence** — stop. Do not open the 2a branch. Bring the audit note to the user for a scope decision.
8. **If all rows are ✅ or drift-fixable** — apply PRD updates as a single commit on main (`docs: align stage-2a PRD with actual stage-2 (post-audit)`), then open `feature/redesign-stage-2a-planner`.

## Implementation Phasing

Stage 2a is a single deliverable but should land as **two commits** for review ergonomics:

1. **Commit 1 — Scaffolding + data layer.** `plan.ts` types, `plannerApi` methods on `ApiClient`, `use-plan-today.ts` hook, `use-visibility-refetch.ts` hook, `<TodaySkeleton />`. No changes to the page render path yet; tests assert the hook contract.
2. **Commit 2 — Components + page wiring.** `<PlanBar />`, `<FocusQueue />`, `<FixedSchedule />`, `<NoPlanStrip />`, `<PlanAdherenceCell />`. Modify `app/(dashboard)/page.tsx` to conditional-render. Component + integration tests.

Each commit ends with build + lint + `npm test` clean.

**Pre-condition to commit 1:** Pre-Implementation Checklist fully ticked (PC-1…PC-5). No exceptions — this is what keeps the two stages from colliding.

## Risks & Open Questions

1. **Stage 2 is not yet built** at the time of writing this PRD. Stage 2a's fallback (FR-15) references handoff components (`<HeroPriority />`, `<DayTimeline />`, `<StatsGrid />`, `<HeroCells />`, `<RemindersToday />`, `<SignalsFeed />`) that don't exist yet. Mitigated by:
   - **Hard pre-condition** — Pre-Implementation Checklist (PC-1…PC-5) must all be ✅ before any 2a code is written. Skipping this checklist is explicitly forbidden.
   - **Explicit Interface Contract** — table IC-1…IC-10 enumerates the exact expected path + signature for every Stage 2 artifact 2a depends on. If Stage 2 diverges, the contract table is the diff target.
   - **10-minute Audit Procedure** — run after Stage 2 merges, produces a ✅ / 🔴 decision. Drift is caught in minutes, not after a day of broken imports.
   - **Decision tree for drift** (Interface Contract §"Rules for adaptation"): rename / signature / layout drift → update PRD and go; structural divergence → stop and renegotiate scope. Ambiguity is eliminated.
   - **Residual risk:** if Stage 2 makes a fundamental structural choice incompatible with this PRD's data flow (e.g. all-server-rendered Today with no client state), the audit catches it but resolving it requires a new discovery round. Probability: low — handoff spec is explicit and `handoff/PROMPT.md` forbids improvisation by the Stage 2 agent.

2. **Skill-only plan items have sparse metadata.** `plan_item.title` is the skill's raw line (`English SRS — 30 карт`). No description, no deeper context. The UI honors this honestly (FR-6) — no invented deck, no fake context. If this feels too sparse in real use, the follow-up is a skill-side change (populate `plan_item.notes` at POST time) — explicitly out of scope here.

3. **Category set drift.** Frontend's hardcoded `CATEGORY_LABEL` map may go stale if the skill's `registry.yaml` gains new categories. Mitigation: unknown category keys render as uppercased fallback (acceptable; new categories get a meaningful label in a one-line PR when they show up).

4. **Optimistic UI vs. server truth on aggregates.** `PATCH /plans/today/items/{id}` returns only the updated item — `completed_minutes` / `adherence_pct` / `categories_actual` arrive on the next GET. The 500ms re-GET (FR-8, `onSuccess: invalidate`) is the simple solution; the risk is a brief (< 1s) window where `<PlanBar />` progress is one PATCH behind the actual server state. Accept — it self-heals in sub-second.

5. **Stats Grid cell needs two sequential GETs (current + prior window).** Handled by `Promise.all` so there's no user-visible latency, but if `/analytics` is slow (Railway cold start), the cell shows its skeleton for longer than neighboring cells. Mitigation: cell has an independent React Query key with `staleTime: 5min` so re-navigations within 5 minutes skip the round-trip.

6. **No test harness for the Telegram-cross-tab scenario (AC-9).** Manual smoke only — trigger completion via bot, verify portal reflects on tab focus. Not hard; just flagging that it can't be fully automated in the test suite.

## Next Step

On approval, this PRD becomes the source of truth for the Stage 2a implementation plan. The plan will split Commit 1 and Commit 2 into 2–5 minute tasks each (types → API client method → hook → tests → components → page wiring → verification), following the `/dev plan` step-6 template.
