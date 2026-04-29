# Actions Unification Plan

Last updated: 2026-04-29

## Goal

Replace the daily Tasks/Reminders split with one primary Actions section backed by the existing reminders table. Actions support open/done state, optional date, optional time, details, checklist, urgency, recurrence, notifications for scheduled items, and focus sessions.

## Non-Goals

- Do not hard-delete existing task data during the Phase 1 rollout.
- Do not add structured note/job/calendar links to Actions in v1.
- Do not keep an old Tasks archive UI.
- Do not execute destructive task cleanup without explicit action-time confirmation.

## Architecture

- Evolve `Reminder` into the durable Action record by adding nullable `action_date` and nullable `remind_at`.
- Add `/api/actions` as the new primary API while leaving `/api/reminders` as a compatibility layer over the same service.
- Keep notification semantics narrow: only scheduled actions (`remind_at IS NOT NULL`) can schedule exact notifications or snooze.
- Add `focus_sessions.action_id` and move new frontend focus starts to Actions.
- Remove Tasks from visible daily navigation and linking surfaces while keeping task tables and APIs intact until the destructive cleanup phase.

## Milestones

### M0 — Baseline And Execution Pack

Definition of done:
- Working tree is isolated on `codex/actions-unification`.
- Focused Reminders/Tasks/Focus tests are run before behavior changes.
- `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, and `docs/BACKLOG.md` reflect the Actions rollout.

Validation:
- `git status --short --branch`
- `cd backend && source venv/bin/activate && pytest -q tests/test_reminders.py tests/test_task_reminder_persistence.py tests/test_focus_sessions.py`
- `cd frontend && npm test -- --run src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx`

### M1 — Backend Action Model And API

Scope:
- Add Alembic migration for `reminders.action_date`, nullable `reminders.remind_at`, and `focus_sessions.action_id`.
- Extend reminder/action schemas with `action_date` and derived `mode` (`inbox`, `anytime`, `scheduled`).
- Create `/api/actions` endpoints for list/create/update/delete/done/restore/snooze.
- Keep `/api/reminders` compatibility over the same schemas and service.

Definition of done:
- Title-only creates an inbox action.
- Date-only creates an anytime action.
- Date plus time creates a scheduled action.
- Existing reminder rows can still be listed through `/api/reminders`.
- Focus sessions can start with `action_id`.

Validation:
- `cd backend && source venv/bin/activate && pytest -q tests/test_actions.py tests/test_reminders.py tests/test_focus_sessions.py`
- `cd backend && source venv/bin/activate && PYTHONPATH=. alembic heads`

### M2 — Notification And Recurrence Semantics

Scope:
- Scheduling and polling must ignore inbox/anytime actions.
- Snooze must reject non-scheduled actions.
- Recurring scheduled actions advance `remind_at` and `action_date`.
- Recurring anytime actions advance `action_date` and keep `remind_at = NULL`.

Definition of done:
- Exact notifications are only produced for scheduled actions.
- Date-only/undated actions are UI and digest items only.
- Compatibility reminder callbacks still work for scheduled actions.

Validation:
- `cd backend && source venv/bin/activate && pytest -q tests/test_actions.py tests/test_reminders.py tests/test_telegram_notifications.py`

### M3 — Frontend Actions UI

Scope:
- Add `/actions` and `/actions/birthdays`.
- Rename the current Reminders page UI to `ACTIONS_`.
- Add title-only quick add to Inbox/Someday.
- Group list as Overdue, Today, future dates, Inbox/Someday.
- Sort each dated group as Scheduled first by time, then Anytime; urgent sorts only inside Anytime and Inbox.
- Replace noisy inline badge pile with a compact right-side metadata cluster in collapsed rows.
- Keep details, URLs, checklist, and controls in expanded state.

Definition of done:
- `/actions` is the primary section.
- `/reminders` and `/reminders/birthdays` redirect to the new routes.
- Quick add supports inbox, anytime, and scheduled modes.
- Existing details/checklist editing still works.

Validation:
- `cd frontend && npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx src/components/actions/__tests__/actions-page.test.tsx`

### M4 — Remove Visible Tasks Surfaces

Scope:
- Remove Tasks from sidebar, command palette quick actions, Today widgets, dashboard activity, calendar linked-task UI, job linked-task UI, note linked-task UI, and old task routes.
- Replace task-linked reminder badge/link with a non-navigating legacy marker until cleanup.
- Keep backend task APIs and task tables for the cleanup review phase.

Definition of done:
- The daily UI no longer routes users into Tasks.
- Task route files are removed or redirect away from the old Tasks experience.
- Jobs, notes, calendar, and Today no longer expose task-link creation controls.

Validation:
- `cd frontend && npm test -- --run src/components/__tests__/command-palette.test.tsx src/hooks/__tests__/use-command-palette.test.tsx src/components/layout/__tests__/sidebar-safe-area.test.tsx src/components/today/__tests__/hero-priority.test.tsx src/components/calendar/__tests__/job-link-selector.test.tsx __tests__/notes/linked-notes-section.test.tsx __tests__/job-linked-items.test.tsx`

### M5 — Cleanup Dry Run

Scope:
- Add a backend dry-run report for task-linked reminders before destructive cleanup.
- Report task title, reminder title, action date/time, urgency, recurrence, details presence, checklist count, and reminder id.
- Add a preservation helper that detaches selected task-linked reminders as standalone Actions.
- Do not execute hard deletion.

Definition of done:
- The owner can review task-linked reminders before deletion.
- Selected reminders can be preserved as standalone Actions.
- Hard delete remains a separately confirmed operation outside this implementation pass.

Validation:
- `cd backend && source venv/bin/activate && pytest -q tests/test_task_cleanup.py`

### M6 — Final Validation

Definition of done:
- Focused tests pass for touched backend/frontend areas.
- Lint and build pass where practical.
- Status and test plan record exact commands and outcomes.
- Destructive cleanup is left unexecuted with a clear next action.

Validation:
- `cd backend && source venv/bin/activate && pytest -q tests/test_actions.py tests/test_reminders.py tests/test_focus_sessions.py tests/test_task_cleanup.py`
- `cd frontend && npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx src/components/actions/__tests__/actions-page.test.tsx src/components/__tests__/command-palette.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
