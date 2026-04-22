# PRD — D13: Job ↔ Calendar linking

**Date:** 2026-04-22
**Owner:** dmitrii.vasichev@gmail.com
**Source discovery:** `docs/discovery-2026-04-22-d13-job-calendar-link.md`
**Status:** Draft — pending owner approval

---

> ⚠️ **Pre-build protocol.** Do not open the feature branch until **all**
> items in the "Pre-Implementation Checklist" pass. If any Interface
> Contract row drifts from real code at audit time, patch this PRD
> first, commit the patch on `main`, then start the build. Stage 2a / 3
> / 4 / 5 / D12 all followed this rule — don't skip it.

---

## 1. Problem statement

Today's Hero cell #2 currently renders **"Tasks due today"** as a
placeholder (`frontend/src/components/today/hero-cells.tsx:78`). The
handoff specification called for **"Interviews this week"** — a count of
upcoming interview events in the current calendar week. That metric
requires attribution from a `calendar_events` row to a `jobs` row, which
doesn't exist in the schema.

D13 introduces the link, the user-facing mechanism to manage it, and
reverts the Hero cell to its intended metric.

## 2. Goals / non-goals

### Goals
- Users can **link** any calendar event to exactly one job.
- When editing an event, the form proposes an **auto-hint** candidate
  based on a substring match between `event.title` and `jobs.company`,
  scoped to non-terminal jobs.
- Existing events get **one-shot backfilled** against the same rule after
  deploy.
- Hero cell #2 reads **Interviews this week = count of events where
  `job_id IS NOT NULL` AND `start_time ∈ [this_week_start,
  this_week_end]` in user TZ.**
- Google Calendar re-sync **does not** reset a user-set `job_id`.

### Non-goals (deferred to future initiatives)
- Job-detail page "Upcoming events" panel.
- Events-list inline `→ <company>` chip.
- Task-detail cross-link to interviews.
- `event_kind` enum / interview-phase distinction.
- Bulk link/unlink UI.
- Backend search/filter endpoint (selector uses `GET /api/jobs` which
  already returns all user jobs).
- Auto-hint rule editable from UI.
- Email-scraping or heuristic inference beyond the substring rule.

---

## 3. Functional requirements

### FR-1. Schema migration
Add Alembic revision `xxxxx_add_calendar_events_job_id.py` with
`down_revision = '6a6937c87804'` (the D12 focus_sessions head at PRD
time; verify at audit that head hasn't advanced).

- `calendar_events.job_id INTEGER NULL REFERENCES jobs(id) ON DELETE SET
  NULL`.
- Partial index `CREATE INDEX ix_calendar_events_user_job ON
  calendar_events(user_id, job_id) WHERE job_id IS NOT NULL`.
- `downgrade`: drop index first, then drop column.

Both up and down must round-trip cleanly on a populated local DB.

### FR-2. Model update
`backend/app/models/calendar.py` `CalendarEvent` model gains
`job_id: Mapped[Optional[int]] = mapped_column(Integer,
ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, default=None)`.

No new relationship loader (avoids N+1 risk in list endpoints; the hint
endpoint returns the brief in its own query).

### FR-3. Pydantic schemas
`backend/app/schemas/calendar.py`:
- `CalendarEventUpdate` gets `job_id: Optional[int] = None` **with the
  Field default `default=None`** — same pattern as existing optional
  fields. Partial-update semantic: `exclude_unset=True` serialization in
  the service layer distinguishes "field absent" from "field present but
  null (= clear the link)".
- `CalendarEventResponse` gets `job_id: Optional[int] = None` so
  frontends can render link state without extra calls.
- `CalendarEventCreate` does **not** get `job_id` in MVP — creation is
  always followed by an auto-hint fetch on the frontend (hint is
  server-computed over the just-created event, which requires the event
  to exist first to resolve cross-user safety). If this feels awkward
  during build, revisit — can add `job_id` to create later without
  breaking existing callers since the field is optional.

### FR-4. Service layer — update-event path
`backend/app/services/calendar.py`'s `update_event` (or whatever the
current name is; verify in audit) accepts `job_id` from
`CalendarEventUpdate` and:

1. If the incoming payload's `exclude_unset=True` dict does **not**
   contain the `job_id` key: leave existing value untouched.
2. If the payload's dict contains `job_id: None`: clear the link (set
   column to NULL).
3. If the payload's dict contains `job_id: <int>`:
   - Validate the job belongs to `current_user` via
     `SELECT jobs.id WHERE jobs.id = :job_id AND jobs.user_id =
     :user_id` — raise `HTTPException(404, "Job not found")` if missing.
   - Assign `event.job_id = <int>`.

The update endpoint continues to be gated by `restrict_demo` at the
router level.

### FR-5. Hint endpoint
`GET /api/calendar/events/{event_id}/job-hint` — new endpoint in
`backend/app/api/calendar.py`, read-only (`get_current_user`, not
`restrict_demo`).

Response schema:
```json
{
  "suggested_job_id": null | <int>,
  "match_reason": null | "substring",
  "job": null | { "id": <int>, "title": "<str>", "company": "<str>",
                  "status": "<status|null>" }
}
```

Behavior:
1. Load event; 404 if not found or `user_id != current_user.id`.
2. Compute `title_lc = event.title.lower().strip()`.
3. SELECT all user's jobs where `status IS NULL OR status NOT IN
   ('accepted','rejected','ghosted','withdrawn')`. Do not rely on
   frontend `TERMINAL_STATUSES` — hardcode the 4 terminals in the
   service layer and reference the ApplicationStatus enum at import
   time.
4. Filter to those where `company.lower().strip()` is a non-empty
   substring of `title_lc`.
5. If exactly 1 candidate → return it with `match_reason: "substring"`.
   Else → return `suggested_job_id: null`, `job: null`.

Pure read; no mutation, no commit.

### FR-6. Cross-user protection
The job validation in FR-4 **must join on `jobs.user_id = user.id`** —
not just `jobs.id`. Otherwise one user could link their event to
another user's job (data disclosure via the hint endpoint's `job.company`
field, plus audit-log confusion). Mirrors the pattern in
`focus_session.start`'s plan-item check (`backend/app/services/focus_session.py:183`).

### FR-7. Backfill script
`backend/scripts/backfill_job_event_links.py`:

- Standalone entry point, runnable as `python -m scripts.backfill_job_event_links`.
- Iterates all users; for each user, runs the same auto-hint rule
  (FR-5 steps 2-5) over events where `job_id IS NULL`, applying matches
  inline.
- Prints JSON summary to stdout at end:
  ```json
  {"users": N, "scanned": N, "matched": M, "ambiguous": A, "no_match": K}
  ```
- Idempotent: re-running doesn't double-match (scoped to `WHERE job_id IS NULL`).
- No arguments, no flags; failure surfaces as exit code 1 + stderr
  traceback. Explicitly not integrated into Alembic — it's a data
  operation, not a schema operation.

### FR-8. Hero cell revert
`frontend/src/components/today/hero-cells.tsx`:

- Cell #2 changes from `"Tasks due today"` stub to
  `"Interviews this week"`.
- `val` = count of events where `job_id !== null` AND `start_time` in
  `[this_week_start, this_week_end]` (Monday 00:00 → Sunday 23:59:59 in
  user TZ).
- Data source: existing `useCalendarEvents({ start, end })` hook called
  with week bounds (derived from new helpers in
  `frontend/src/components/today/today-date.ts` — `thisWeekBounds()`).
- Delta: none for now (could show "↑ 2 vs last week" in a follow-up
  when we wire historical compare).

### FR-9. `thisWeekBounds()` helper
New export in `frontend/src/components/today/today-date.ts`:
```typescript
export function thisWeekBounds(tz?: string): { startIso: string; endIso: string } {
  // Monday 00:00 → Sunday 23:59:59.999 in local TZ.
  // JavaScript week starts Sunday (day 0), so compute offset to Monday.
}
```

Tests (unit): ISO 8601 output, Monday-start semantics, TZ-neutral
behavior, end-boundary inclusive via sub-millisecond.

### FR-10. Calendar event type update
`frontend/src/types/calendar-event.ts` (or wherever the type lives —
audit will confirm) gains `job_id?: number | null`.

### FR-11. Selector component
`frontend/src/components/calendar/job-link-selector.tsx`:

Props:
```typescript
{
  eventId: number;           // needed for hint fetch
  currentJobId: number | null;
  onChange: (jobId: number | null) => void;
  disabled?: boolean;
}
```

Behavior:
- On mount, fetches `GET /api/calendar/events/{eventId}/job-hint`.
- Renders a single-line control: currently-linked job name + "clear"
  button if set; otherwise a dropdown/combobox listing all user jobs
  (fetched via existing `useJobs()` hook).
- If hint returned `suggested_job_id` and `currentJobId === null`,
  render a sub-line: `"→ Suggested: <company>"` with an inline "link"
  button that calls `onChange(suggested_job_id)`.
- Disabled state propagates from parent form.
- Styled to match existing brutalist form controls (mono, square
  borders, 1.5px lines — follow the `EditReminderForm` pattern shipped
  in session 2026-04-21's B7 polish).

### FR-12. Event dialog integration
The existing event edit dialog (`frontend/src/components/calendar/event-dialog.tsx`
or similar — audit) mounts `<JobLinkSelector>` below the description
field. On form submit, `job_id` is included in the `PATCH` body.

For the **create** dialog, selector is hidden (FR-3 carveout).

### FR-13. React Query invalidation
Mutation path (PATCH with `job_id`) invalidates:
- `["calendar-events", ...]` (existing event list queries).
- `["event-detail", eventId]` (existing detail query).
- The job-hint query key for that event (`["event-job-hint", eventId]`),
  but since the selector already knows the new state, cache update is
  preferred over refetch.

### FR-14. Backend tests
- `backend/tests/test_calendar_api.py` (or create if missing):
  - PATCH with `job_id: <int>` → 200, column set.
  - PATCH with `job_id: null` → 200, column cleared.
  - PATCH omitting `job_id` key → 200, column unchanged.
  - PATCH with `job_id` pointing to another user's job → 404.
  - PATCH as demo user → 403 (restrict_demo gate).
- `backend/tests/test_job_hint_api.py` (new):
  - Event with exact single company match → suggests.
  - Event with no match → suggests null.
  - Event with 2 matching companies → suggests null (ambiguous).
  - Event where only terminal-status jobs match → suggests null.
  - 404 on non-existent event, 404 on other user's event.
- `backend/tests/test_backfill_job_event_links.py` (new):
  - Single match on unlinked event → matches.
  - Already-linked event → untouched.
  - Ambiguous → unchanged.
  - Re-run is no-op.
- `backend/tests/test_calendar_sync.py` (extend if exists, create if
  not): explicit regression test that `_pull_events`, when upserting an
  existing event that has a user-set `job_id`, **does not reset it to
  NULL**. This is the FR-9 implicit-guarantee lock.

### FR-15. Frontend tests
- `today-date.test.ts`: add 3+ tests for `thisWeekBounds`.
- `hero-cells.test.tsx`: revert "Tasks due today" test to
  "Interviews this week", add 2 tests (positive count with linked
  events in week, zero count when none in week).
- `job-link-selector.test.tsx`: new, 5 tests:
  - Renders current job name when `currentJobId` set.
  - Renders hint line when hint present and `currentJobId === null`.
  - Clicking hint "link" button calls `onChange(suggested_job_id)`.
  - Clicking "clear" on linked state calls `onChange(null)`.
  - Dropdown selection calls `onChange(<new id>)`.

### FR-16. Documentation
Update `CLAUDE.md` Current Status with D13 ship summary (pattern
matches D12 entry). Remove "D13 queued" from the next-session-kickoff
list.

---

## 4. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | Alembic `upgrade head` adds `job_id` column + partial index; `downgrade -1` removes both cleanly. |
| AC-2 | `PATCH /api/calendar/events/{id}` with `{"job_id": <valid>}` → 200, DB row has `job_id` set. |
| AC-3 | Same PATCH with `{"job_id": null}` → 200, DB row has `job_id = NULL`. |
| AC-4 | Same PATCH **omitting** `job_id` key → 200, existing `job_id` unchanged (not reset to NULL). |
| AC-5 | PATCH with `job_id` = another user's job → 404. |
| AC-6 | `GET /api/calendar/events/{id}/job-hint` on event whose title contains exactly one active-job company → returns `{suggested_job_id: <id>, match_reason: "substring", job: {...}}`. |
| AC-7 | Same endpoint on event with 2 matching active jobs → `suggested_job_id: null`. |
| AC-8 | Same endpoint on event matching only terminal-status jobs → `suggested_job_id: null`. |
| AC-9 | Backfill script on fresh DB with 3 matchable events, 1 ambiguous, 1 no-match → JSON report shows `matched: 3, ambiguous: 1, no_match: 1`. DB has 3 newly-linked events. |
| AC-10 | Re-running backfill on same DB → `matched: 0` (idempotent). |
| AC-11 | GCal sync on an event with user-set `job_id` → `job_id` unchanged after sync completes. Regression test asserts this. |
| AC-12 | Hero cell #2 renders "Interviews this week" with count matching weekly filter (manual verification: seed 2 linked events in this week → cell shows `2`; zero linked → cell shows `0`). |
| AC-13 | Event edit dialog shows `<JobLinkSelector>`; user can link, clear, and switch jobs; form submit persists. |
| AC-14 | Create dialog does NOT show selector (MVP carveout). |
| AC-15 | Hint renders in the selector when present; clicking "link" accepts the hint. |
| AC-16 | Demo user gets 403 on any PATCH attempt (restrict_demo still effective). |
| AC-17 | Lint 0 errors; build green; all new tests pass; no regressions in existing test count ± baseline flakes. |

---

## 5. Interface Contracts (audit at PRD-entry)

These rows will be verified against actual code in the Pre-Implementation
Checklist. Drift triggers a PRD-patch commit on `main` before branch open.

| # | Claim | File / symbol | Verify |
|---|---|---|---|
| IC-1 | D12 focus_sessions is the current alembic head | `backend/alembic/versions/` | `alembic heads` shows `6a6937c87804` |
| IC-2 | `CalendarEvent` model lives in this file | `backend/app/models/calendar.py` | exists + class name |
| IC-3 | `CalendarEventUpdate` is the PATCH schema | `backend/app/schemas/calendar.py:23` | schema file + class line |
| IC-4 | `update_event` service function accepts `data: CalendarEventUpdate` | `backend/app/services/calendar.py` | function signature |
| IC-5 | `ApplicationStatus` enum has these 12 values: `found, saved, resume_generated, applied, screening, technical_interview, final_interview, offer, accepted, rejected, ghosted, withdrawn` | `backend/app/models/job.py:22` | exact value list |
| IC-6 | `_pull_events` in GCal sync uses field-by-field assignment, NOT wholesale row replace | `backend/app/services/google_calendar.py:67` | inspect assignment block |
| IC-7 | `useCalendarEvents` hook accepts `{ start, end }` ISO strings | `frontend/src/hooks/use-calendar.ts` (or similar) | signature |
| IC-8 | Existing `today-date.ts` exports `todayBounds`, `todayStart`, `daysAgo`, `isSameLocalDay`, `formatTime` | `frontend/src/components/today/today-date.ts` | export list |
| IC-9 | `hero-cells.tsx` cell #2 is currently "Tasks due today" placeholder | `frontend/src/components/today/hero-cells.tsx:78` | exact label string |
| IC-10 | No `linkedin` or unrelated Calendar API paths conflict with `/job-hint` suffix | `backend/app/api/calendar.py` | grep for existing sub-paths |
| IC-11 | Event edit dialog exists and we know its file path | audit with `grep` | locate file name |
| IC-12 | `useJobs` hook returns all user jobs (not paginated, not filtered) for selector use | `frontend/src/hooks/use-jobs.ts` | signature + return shape |
| IC-13 | `restrict_demo` gate wraps `PATCH /events/{id}` at the router level | `backend/app/api/calendar.py:94` | dep inspection |

---

## 6. Pre-Implementation Checklist

**Run these BEFORE opening the feature branch.** All must pass; any
failure → patch PRD first, commit the patch on `main`, then re-run.

- **PC-1.** `git status` clean on `main`, `main` synced with
  `origin/main`, HEAD at or after `82bdcbf` (D12 smoke doc commit).
- **PC-2.** `alembic current` shows `6a6937c87804` (D12 head). If a new
  migration has landed since, update IC-1 + FR-1's `down_revision`.
- **PC-3.** Full backend test suite runs: `pytest` ≥ 830 passed, ≤ 9
  pre-existing failures unchanged from D12 ship (flakes in
  `test_job_matching`, `test_notes`, `test_pulse_settings`, `test_tags`,
  `test_vitals_briefing`).
- **PC-4.** Full frontend test suite runs: `npm test -- --run` ≥ 391
  passed, ≤ 15 pre-existing flakes unchanged.
- **PC-5.** `npm run lint` → 0 errors; `npm run build` → green (21
  static + 3 dynamic pages).
- **PC-6.** Each IC row verified against actual code. Drift logged
  below:
  > _To be filled during audit. Empty = no drift._

- **PC-7.** Confirm seed data in local DB supports AC-9 rehearsal:
  at least 3 events with titles containing a company name from
  `jobs` table, plus 1 ambiguous-match, plus 1 no-match. If missing,
  note the gap and either seed or defer AC-9 to post-ship smoke.

- **PC-8.** Confirm `restrict_demo` gate list. If the demo-user role
  enum or `restrict_demo` behavior has shifted since D12, revisit
  AC-16.

---

## 7. Audit Procedure (10 min, before branch open)

Follow literally:

1. `git log --oneline -10` — confirm D12 commits present, no
   post-ship debt commits since.
2. `alembic heads` — confirm head, update IC-1 if moved.
3. `grep -n "Tasks due today\|job_id\|tasksDueToday" frontend/src/components/today/hero-cells.tsx`
   — confirm IC-9.
4. `grep -n "class CalendarEventUpdate\|class CalendarEventResponse" backend/app/schemas/calendar.py`
   — confirm IC-3 line numbers.
5. `grep -n "class ApplicationStatus\|accepted\|rejected\|ghosted\|withdrawn" backend/app/models/job.py`
   — confirm IC-5 exact enum values.
6. `grep -n "local.title\|local.job_id\|getattr\|setattr" backend/app/services/google_calendar.py`
   — confirm IC-6 is field-by-field, no `local.__dict__.update(...)`
   or similar wholesale pattern.
7. Locate the event edit dialog (`grep -rn "CalendarEventUpdate\|event-dialog" frontend/src`)
   — fill in IC-11.
8. Run PC-3 + PC-4 + PC-5 with timings; record pass counts.
9. Decision: **GO** (no drift, all ICs confirmed, tests pass) or
   **PATCH** (drift → commit PRD patch on main, re-run).

---

## 8. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | Auto-hint rule false-positive (e.g. "Apple" matches "Apple Meeting" for an unrelated event). | "Only 1 match → hint" rule filters most; user can override. Accept baseline error rate; revisit if signal-to-noise reports problem. |
| R-2 | `job_id` reset during GCal sync due to a future refactor. | FR-14 regression test locks the current behavior; any refactor that breaks it fails CI. |
| R-3 | Backfill matches incorrect jobs at scale. | Script prints summary; owner reviews `matched`/`ambiguous`/`no_match` counts before taking action in prod. Idempotent, so any wrong matches can be corrected in UI without rolling back the script. |
| R-4 | Partial index performance mystery on small tables. | Explicit `EXPLAIN ANALYZE` check in local DB post-migration; keep regular `user_id` index as fallback if planner doesn't pick it. |
| R-5 | `exclude_unset=True` pattern not used elsewhere in calendar service — might require plumbing change. | Audit in PC-6; if plumbing is missing, add it in Task 2 of the build plan. Small surface, <30 lines. |
| R-6 | Selector UI feels heavy for events with 100+ jobs. | Selector uses existing `useJobs()` hook; if job list exceeds ~50, add a search filter on top of the dropdown in a follow-up. Not blocker for MVP. |
| R-7 | `this week` label confusing across TZ boundaries on Sunday night / Monday morning. | Computed in user TZ (fallback UTC); matches user intuition. Not edge-cased in MVP. |

---

## 9. Timeline estimate

- Pre-Implementation Checklist + PRD patch (if any): 30 min inline.
- Build: 3 sessions (~6-8h total).
  - Session 1: migration + model + schemas + service update-path + API
    tests for PATCH. ~2h.
  - Session 2: hint endpoint + backfill script + their tests. ~2h.
  - Session 3: frontend selector + hook + Hero cell revert +
    frontend tests + full verification. ~3h.
  - Buffer: ~1h for smoke + CLAUDE.md docs + squash.

## 10. Approval

- [ ] Owner approved (name + date): _________________

---

**End of PRD.**
