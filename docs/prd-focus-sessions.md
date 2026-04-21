# PRD: Focus Sessions (D12)

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-21 |
| Status | Draft |
| Priority | P1 |

## Problem Statement

The redesign Stage 2 shipped a Today page whose mockup included two focus-related
surfaces: a **NOW-block** in `day-timeline.tsx` (the active focus session rendered
inline inside the timeline) and a **`Focus · today`** cell in `stats-grid.tsx`
(total focused minutes today). Neither could be wired up because the backend had
no concept of a focus session. As a result:

- The NOW-block was omitted entirely — nothing renders in the current time slot
  even when the user is actively working.
- The `Focus · today` StatsGrid cell was replaced with a placeholder `Tasks done
  · today` counter.

This PRD introduces the `focus_sessions` table + API + UI needed to restore both
surfaces and integrate focus sessions with the existing planner flow
(`plan_items.completed_minutes` auto-increment).

## User Scenarios

### Scenario 1: Start a focus session from the FocusQueue
**As a** user working through my daily plan, **I want to** press a single
button on a FocusQueue row to start a 25-min focus on that task, **so that**
I don't have to navigate away from the plan to start working.

### Scenario 2: Start a focus session from an arbitrary task
**As a** user who opened a task dialog ad-hoc (no plan item), **I want to**
start a focus session directly from the task dialog, **so that** I can focus
on tasks outside of today's plan.

### Scenario 3: See progress while focused
**As a** focused user, **I want to** see an inline countdown card inside the
Day Timeline with "12:34 / 25:00" and a STOP button, **so that** I always
know how much time I have left without leaving Today.

### Scenario 4: See daily focus time
**As a** user reviewing my day, **I want to** see total focused minutes in
the StatsGrid `Focus · today` cell, **so that** I can gauge whether the day
was productive.

### Scenario 5: Plan progress auto-updates
**As a** user who completed a 50-minute focus on a plan item, **I want to**
see the plan item's progress bar fill automatically, **so that** I don't
have to manually log time.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: New SQLAlchemy model `FocusSession` with fields `id`, `user_id`
      (NOT NULL, FK → users), `task_id` (NULL, FK → tasks), `plan_item_id`
      (NULL, FK → plan_items), `started_at` (timestamptz, NOT NULL), `ended_at`
      (timestamptz, NULL), `planned_minutes` (INT, NOT NULL), `auto_closed`
      (BOOL, NOT NULL, DEFAULT false), `created_at` (timestamptz, DEFAULT now()).
- [ ] FR-2: Alembic migration adds the table and a partial index
      `idx_focus_sessions_user_active ON focus_sessions(user_id) WHERE ended_at IS NULL`
      to make "find my active session" O(1).
- [ ] FR-3: `POST /api/focus-sessions/start` — body:
      `{ task_id?: int, plan_item_id?: int, planned_minutes: 25 | 50 | 90 }`.
      Rejects with **409** if the user has an active session (`ended_at IS NULL`
      after the lazy-reaper sweep runs — see FR-7). Returns `201 { id, started_at,
      planned_minutes, task?, plan_item? }`.
- [ ] FR-4: `PATCH /api/focus-sessions/{id}/stop` — sets `ended_at = now()`.
      Atomic with an auto-increment of `plan_items.completed_minutes` when
      `plan_item_id` is set (value added: `extract(epoch from (ended_at -
      started_at)) / 60`, rounded down, capped at `planned_minutes`). Returns
      `200 { id, started_at, ended_at, actual_minutes, task?, plan_item? }`.
      Idempotent: if already stopped → returns the existing record (200).
- [ ] FR-5: `GET /api/focus-sessions/active` — returns the user's currently
      active session (at most one), or `null`. Runs the lazy reaper first.
- [ ] FR-6: `GET /api/focus-sessions/today` — returns `{ sessions: [...],
      total_minutes: int, count: int }` scoped to the user's local-day window
      (derived from `X-User-Timezone` header, same pattern as DailyPlan today).
      Runs the lazy reaper first.
- [ ] FR-7: **Lazy reaper.** Before any read endpoint returns, server issues
      `UPDATE focus_sessions SET ended_at = started_at + make_interval(mins =>
      planned_minutes), auto_closed = true WHERE user_id = :uid AND ended_at
      IS NULL AND started_at + make_interval(mins => planned_minutes) < now()`.
      Same sweep must run before `POST /start` to prevent 409 on a stale zombie.
      Reaped sessions still increment `plan_items.completed_minutes` by
      `planned_minutes` (the reaped value).
- [ ] FR-8: New React Query hook `useFocusSessionActive()` returns the active
      session (polls via React Query `staleTime: 30s`, invalidates on
      start/stop mutations). New hook `useFocusSessionToday()` returns daily
      totals (`staleTime: 60s`).
- [ ] FR-9: `<NowBlock />` component, mounted inside `day-timeline.tsx`
      **only when there's an active session**. Renders a brutalist card with
      task name (or "FOCUS" if no task), `MM:SS / MM:SS` countdown, and a STOP
      button. Countdown ticks client-side via `useState + setInterval(1000)`.
      When countdown reaches 0 → hook auto-fires the stop mutation (FR-4) and
      optimistically clears the active session.
- [ ] FR-10: `<StartFocusButton />` component — renders a small icon button
      that opens a `<StartFocusDialog />` with three preset duration buttons
      (25 / 50 / 90 minutes). Selecting a preset fires `POST /start` with the
      button's current `task_id`/`plan_item_id` props. Mounted in:
      (a) FocusQueue row (`focus-queue.tsx`), between the status checkbox and
      the task title — props `{ task_id, plan_item_id }`;
      (b) TaskDialog header (`task-dialog.tsx`), next to the close button —
      props `{ task_id, plan_item_id: undefined }`.
- [ ] FR-11: `<FocusTodayCell />` replaces `<TasksDoneTodayCell />` in
      `stats-grid.tsx`. Renders label `Focus · today` + value `Hh MMm` (e.g.
      `2h 15m`) using `useFocusSessionToday()`. Falls back to `0m` when the
      user has no sessions today. `<TasksDoneTodayCell />` is deleted (no
      callers remain after the swap).
- [ ] FR-12: Starting a new session while one is active → dialog surfaces
      the backend's 409 as a toast: `"У тебя уже идёт сессия — останови её
      сначала"`. No auto-stop of the existing session.
- [ ] FR-13: Backend tests — fixture + tests for: create happy path, create
      409 on existing active, stop happy path with plan_item increment, stop
      idempotency, lazy-reap on read, lazy-reap increments plan_item, daily
      aggregate. Minimum 8 new tests in
      `backend/tests/test_focus_sessions.py`.
- [ ] FR-14: Frontend tests — vitest for `useFocusSessionActive` (returns
      null / returns session / auto-stops on countdown=0), `<NowBlock />`
      (renders when active, hides when null, STOP fires mutation),
      `<StartFocusDialog />` (3 preset buttons fire correct payload),
      `<FocusTodayCell />` (formats minutes correctly). Minimum 8 new tests.

### P1 (Should Have)

- [ ] FR-15: Timer persistence — if the user refreshes the browser mid-session,
      `useFocusSessionActive` refetches on mount and the countdown resumes
      from `started_at + planned_minutes - now()`. No localStorage shadow.

## Non-Functional Requirements

- **Performance:** All endpoints < 100ms p95. Lazy reaper's `UPDATE ... WHERE
  started_at + ... < now()` uses the partial index `idx_focus_sessions_user_active`
  — expected to touch at most 1 row per user (hard-capped to 1 active by FR-3).
- **Concurrency:** `POST /start` wraps the "find active + insert" pair in a
  single transaction. Race-safe by virtue of the partial unique-ish check
  (even without a formal UNIQUE constraint — two concurrent POSTs from the
  same user would be rare and the second would fail the pre-insert SELECT).
  If race becomes real → add `CREATE UNIQUE INDEX ... WHERE ended_at IS NULL`
  as a follow-up.
- **Security:** All endpoints require auth (existing `get_current_user`
  dependency). `task_id`/`plan_item_id` in start body are validated to belong
  to the authed user (404 otherwise). Demo role (from Outreach v2) is blocked
  from mutations by the existing `restrict_demo` dependency.
- **Timezone:** Day-window for `GET /today` derived from `X-User-Timezone`
  header with UTC fallback — same pattern as the planner Phase 2 endpoints.

## Technical Design

### Stack

- Backend: FastAPI + SQLAlchemy (async) + Alembic, same as the rest of the app.
- Frontend: Next.js 16 + React 19 + React Query + Tailwind 4 brutalist tokens,
  same as Stage 5 close.
- No new dependencies on either side.

### Chosen Approach

**Server-authoritative state, client-side tick.** The source of truth for
whether a session is active lives entirely in the database (`ended_at IS NULL`);
the client never tracks "is a timer running" independently. The countdown the
user sees in `<NowBlock />` is purely a cosmetic `setInterval(1000)` that ticks
down based on the `started_at` + `planned_minutes` fetched from the server. When
the countdown hits 0, the client fires PATCH `/stop` optimistically; if it
doesn't (browser closed, network lost), the **lazy reaper** on the next read
closes the session on the server side with `auto_closed=true`. This means we
never have to worry about drift between server and client clocks beyond the
first render.

**No cron, no background worker** — the lazy reaper runs in the request cycle
of the next read endpoint. Worst case: a user who stops pressing buttons for
days still has their last stale session lying around with `ended_at IS NULL`,
but it causes no user-visible harm — it's closed on the next Today page load.

**Auto-increment on stop (not during tick).** `plan_items.completed_minutes` is
only mutated in two places: on `PATCH /stop` and in the lazy reaper. The
per-second tick does NOT phone home. This keeps the DB write load bounded to
~1 request per session (start) + 1 request per session (stop), regardless of
how long the session runs.

**UI mount strategy.** `<NowBlock />` is mounted unconditionally inside
`day-timeline.tsx`, and returns `null` when `useFocusSessionActive()` returns
null. This keeps the DOM tree stable and avoids a mount/unmount cycle on
start/stop. Same pattern as Stage 2a's `<PlanBar />` conditional render.

**Component location.**
- `frontend/src/components/today/now-block.tsx`
- `frontend/src/components/focus/start-focus-button.tsx`
- `frontend/src/components/focus/start-focus-dialog.tsx`
- `frontend/src/components/today/focus-today-cell.tsx`
- `frontend/src/hooks/use-focus-session.ts` (both hooks + mutations colocated)
- `frontend/src/types/focus-session.ts`
- `frontend/src/lib/api.ts` — extend with `focusSessionsApi`
- `backend/app/models/focus_session.py`
- `backend/app/schemas/focus_session.py`
- `backend/app/routers/focus_sessions.py`
- `backend/app/services/focus_session.py` (lazy reaper + stop logic)
- `backend/alembic/versions/<rev>_add_focus_sessions.py`
- `backend/tests/test_focus_sessions.py`

## Out of Scope

- Notifications (Telegram / desktop / sound) on session end.
- Session notes / free-text comments on what was accomplished.
- Parallel sessions (always max 1 active per user).
- Custom duration (only 25/50/90 presets — no number input).
- Pause/resume mid-session (Pomodoro is discrete: stop and start a new one).
- Historical analytics page (weekly/monthly focus trends, focus-by-tag, etc.).
- Cross-device handoff (session started on phone, stopped on laptop). Works
  accidentally because state is server-side, but not a design goal — no tests.
- Integration with the Telegram bot (/focus command or similar).
- Focus "streak" counters or any gamification.
- Import/export of focus history.

## Open Questions

None — all resolved during discovery (1B · 2A · 3да · 4блок · reaper=B).
