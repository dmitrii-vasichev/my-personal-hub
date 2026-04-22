# Discovery — D13: Job ↔ Calendar linking

**Date:** 2026-04-22
**Owner:** dmitrii.vasichev@gmail.com
**Scope tag:** D13 (planner/Today backlog item from CLAUDE.md)

## Context

Handoff spec (`handoff/HANDOFF.md`) promised an **"Interviews this week"** Hero
cell on the Today page. Stage 2 shipped without it because there was no way
to attribute a `calendar_events` row to a `jobs` row — the metric had no
source of truth. Today's Hero currently shows "Tasks due today" as a stub
(`frontend/src/components/today/hero-cells.tsx:78`).

D13 closes that gap by introducing a direct link from `calendar_events` to
`jobs`, a user-facing mechanism to manage that link, and reverts the Hero
cell to its intended metric.

## Non-negotiable constraints

- **No schema pollution beyond what's needed.** One nullable FK column on
  `calendar_events`; no join tables, no new enums, no denormalized counts.
- **Google Calendar re-sync must not destroy user intent.** If the user
  linked an event to a job, a subsequent GCal sync is a no-op for the
  `job_id` field.
- **User-role gate preserved.** Demo users cannot mutate (existing
  `restrict_demo` dep on calendar mutations stays).

## 10 decisions (locked)

### Q1 — relationship shape
**Chosen: (b) nullable `calendar_events.job_id` (FK ON DELETE SET NULL)**

Rejected (a) `job_events` join table: many-to-many semantics aren't needed.
One event maps to at most one job. Join table would add migration + ORM
surface for no observed use case.

### Q2 — how the link is created
**Chosen: (c) manual link + auto-hint on form open**

- Manual: an event's edit/create form gets a "Link to job" selector that
  the user controls explicitly.
- Auto-hint: when the form opens, a single best-guess candidate is
  proposed inline; user accepts by leaving it or overrides by picking
  another job / clearing it.

Rejected (a) manual-only: zero-click happy path is valuable.
Rejected (b) auto-detect only: silently attaching on creation would break
user expectation that "linked" means "they clicked link."

### Q3 — backfill for existing events
**Chosen: (b) one-shot idempotent script**

`backend/scripts/backfill_job_event_links.py`:
- Scopes to `WHERE job_id IS NULL` (so rerunning is safe).
- Applies the Q6 auto-detect rule.
- Single unambiguous match → set `job_id`; 0 or ≥2 matches → leave NULL.
- Prints a summary: `scanned=N, matched=M, ambiguous=A, no_match=K`.
- Runs manually from CLI (`python -m scripts.backfill_job_event_links`),
  not from Alembic.

Rejected (a) no backfill: Hero cell would stay empty post-deploy.
Rejected (c) lazy per-view: drags out the visible effect, more complex UX.

### Q4 — MVP UI surfaces
**Chosen: (1) Hero cell revert + (2) event edit/create selector.**

Both are minimum for the feature to function:
- (1) reverts `hero-cells.tsx` cell #2 from "Tasks due today" stub to
  "Interviews this week".
- (2) is the only user-facing handle on the link.

Deferred (not shipped in D13, separate initiatives if desired):
- (3) Job-detail page "Upcoming events" block.
- (4) Calendar events list inline `→ <company>` chip.
- (5) Task-detail cross-link to interviews.

None of the deferred surfaces require schema changes; they can be added
without migration once D13 lands.

### Q5 — event kind / interview stage field
**Chosen: (b) no `event_kind` column.**

Every event with `job_id IS NOT NULL` is treated as interview-related for
metric purposes. If debrief / onboarding / other roles ever need to be
distinguished, add a nullable `event_kind` enum in a follow-up — no data
loss from deferring.

Rejected (a) enum column: premature granularity — MVP UI doesn't read it.
Rejected (c) auto-derive from title: bad for metric performance (regex
scan on every count), no migration gain.

### Q6 — auto-hint matching algorithm
**Chosen: (a) strict substring on `jobs.company`, active jobs only.**

Algorithm (pseudocode):
```
def suggest_job_for_event(event):
    title_lc = event.title.lower().strip()
    candidates = []
    for job in active_jobs_of(event.user_id):
        company_lc = job.company.lower().strip()
        if company_lc and company_lc in title_lc:
            candidates.append(job)
    if len(candidates) == 1:
        return candidates[0].id, "substring"
    return None, None
```

"Active" defined in Q7. Ties (multiple jobs with matching company names)
produce no hint — safer than picking one arbitrarily.

Rejected (b) substring-on-title-also: jobs.title ("Mobile developer")
raises false-positive rate too high.
Rejected (c) fuzzy/trigram: over-engineering for MVP; needs pg_trgm or
Python library; harder to test.

### Q7 — "active" job definition
**Chosen: `status NOT IN {accepted, rejected, ghosted, withdrawn}`**

Actual backend `ApplicationStatus` enum (`backend/app/models/job.py:22`)
has 12 values. Splits as:

- **Terminal (excluded from auto-hint):** `accepted, rejected, ghosted,
  withdrawn` — 4 values.
- **Active (eligible for auto-hint):** `found, saved, resume_generated,
  applied, screening, technical_interview, final_interview, offer` — 8
  values.

Note: `NULL` status (job saved but never moved into any status) is also
eligible — the auto-hint filter is `status IS NULL OR status NOT IN
<terminal>`.

Manual selector in (Q2) shows **all** user's jobs, not only active — if
user wants to link a debrief event to an `accepted` job, they can. Only
the auto-hint side applies this filter.

### Q8 — "This week" window for Hero cell
**Chosen: (a) calendar week Monday 00:00 – Sunday 23:59:59 in user TZ.**

- Start of week: Monday 00:00:00 in `user.timezone` (fallback UTC).
- End of week: Sunday 23:59:59.999 in the same TZ.
- Count: `calendar_events WHERE user_id = current_user AND job_id IS NOT
  NULL AND start_time IN [week_start, week_end]`.

Rejected (b) rolling 7d: "this week" implies calendar week to most users.
Rejected (c) "now..week_end": splits the intuitive boundary in the middle
of the week (cell collapses after Sunday evening).

Computed frontend-side — the `/api/calendar/events` endpoint already
accepts `start` / `end` params (see `backend/app/api/calendar.py:57`);
Hero cell calls it with week bounds, counts results with `job_id !=
null`.

### Q9 — Google Calendar re-sync semantics
**Chosen: (a) preserve `job_id` across sync.**

**Bonus finding:** the current `_pull_events` in
`backend/app/services/google_calendar.py:67` already does field-by-field
assignment (`local.title = …`, `local.description = …`, etc.), NOT a
wholesale row replace. The `job_id` column, once added, will be
preserved implicitly — no code changes to the sync service are required.

PRD will document this as a **guarantee that must be preserved if the
sync is ever refactored**: the regression test will explicitly assert
that `_pull_events` does not reset `job_id`.

### Q10 — API shape
**Chosen: (a) extend `PATCH /api/calendar/events/{id}` + new `GET
/api/calendar/events/{id}/job-hint`.**

- `CalendarEventUpdate` Pydantic schema
  (`backend/app/schemas/calendar.py:23`) adds `job_id: Optional[int] =
  None` — but because all fields there are already `Optional` for
  partial-update semantics, we need a sentinel to distinguish "not
  provided" from "clear to NULL". Pattern: use `Optional[int] = Field(None)`
  + check `"job_id" in data.model_dump(exclude_unset=True)`. Alternative:
  add a `clear_job_id: bool = False` flag — ugly. Go with the
  `exclude_unset` pattern (already used elsewhere in the codebase if
  present; verify in PRD audit).
- `CalendarEventResponse` schema exposes `job_id: Optional[int]` so the
  frontend can display current link state without an extra fetch.
- `GET /api/calendar/events/{id}/job-hint` returns `{"suggested_job_id":
  int | null, "match_reason": "substring" | null, "job": {...brief...} |
  null}`. The `job` brief saves a second request to render the suggestion
  chip.
- Selector options for the manual picker use existing `GET /api/jobs`
  (already returns all user jobs); no new endpoint required.

Rejected (b) separate link/unlink endpoints: more paths, more React Query
keys to invalidate, more backend tests — no benefit over extending the
existing PATCH.

## Implicit decisions (not asked, but recorded for PRD)

- **Delete semantics:** when a `jobs` row is deleted, `ON DELETE SET
  NULL` on the `calendar_events.job_id` FK leaves events orphaned with
  `job_id = NULL`. No cascading event deletion.
- **Authorization:** `GET /job-hint` runs under `get_current_user` (not
  `restrict_demo`) — read-only, safe for demo. `PATCH /events/{id}` with
  `job_id` already gated by `restrict_demo` on the existing endpoint.
- **Cross-user safety:** setting `job_id` requires a join-check that
  `jobs.user_id = current_user.id` — mirrors the same pattern as
  `focus_session.start`'s plan-item validation
  (`backend/app/services/focus_session.py:183`).
- **Index:** add `CREATE INDEX ix_calendar_events_user_job ON
  calendar_events(user_id, job_id) WHERE job_id IS NOT NULL` — partial
  index keeps it small; speeds up Hero cell's weekly aggregate + any
  future "events for this job" queries. Mirrors the partial-index pattern
  from D12 `focus_sessions` (`idx_focus_sessions_user_active`).

## Out of scope (explicit non-goals)

- Job detail page UI for upcoming/past events.
- Calendar list chip decorations.
- Task ↔ interview cross-links (if a task references a job through
  `job_applications.task_id`, D13 does not surface that).
- Bulk link/unlink UI (selector is per-event only).
- Editing the auto-hint match rule from UI (the rule is fixed code).
- `event_kind` enum / phase labeling.
- Automated email scraping to find interview events.
- Support for recurring interview series (each instance is a separate
  `calendar_events` row from GCal sync; linking is per-instance).

## Scope summary

**Backend:** 1 migration (+ partial index) · 1 nullable FK · 1 schema
field on Update + Response · 1 new read endpoint · 1 new script file ·
service-layer cross-user validation.

**Frontend:** 1 Hero cell swap · 1 selector component (to be dropped into
event edit and create dialogs) · 1 hook for the job-hint endpoint · type
updates for `CalendarEvent` to include `job_id`.

**Zero changes to:** GCal sync service (implicit preservation), focus
sessions, planner, tasks/jobs CRUD, auth, deployment config.

## Deliverables ahead

1. PRD — `docs/prd-d13-job-calendar-link.md` (in git, approved by owner).
2. Plan — `docs/plans/2026-04-22-d13-job-calendar-link.md` (gitignored).
3. Feature branch `feature/d13-job-calendar-link` → per-task commits →
   squash merge.
