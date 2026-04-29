# Legacy Tasks Domain Removal Test Plan

Last updated: 2026-04-29

## Strategy

Validate the destructive migration first, then focused backend/frontend areas that previously touched Tasks. Run broader suites after focused regressions are clean.

## Migration

```bash
cd backend
PYTHONPATH=. ./venv/bin/alembic upgrade head
PYTHONPATH=. ./venv/bin/alembic current
```

Manual database inspection:
- Confirm legacy tables are absent: `tasks`, `task_updates`, `task_tags`, `tags`, `task_event_links`, `job_task_links`, `note_task_links`.
- Confirm legacy columns are absent: `reminders.task_id`, `focus_sessions.task_id`, `plan_items.linked_task_id`, `vitals_briefings.tasks_data_json`.
- Confirm `vitals_briefings.actions_data_json` exists.

## Backend

Focused commands:

```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest -q \
  tests/test_actions.py \
  tests/test_reminders.py \
  tests/test_focus_sessions.py \
  tests/test_planner_api.py \
  tests/test_planner_service.py \
  tests/test_pulse_digest_items.py \
  tests/test_pulse_inbox.py \
  tests/test_calendar.py \
  tests/test_job_links.py \
  tests/test_dashboard.py \
  tests/test_vitals_briefing.py
```

Compile/import smoke:

```bash
cd backend
PYTHONPATH=. ./venv/bin/python -m py_compile \
  app/main.py \
  app/api/actions.py \
  app/api/reminders.py \
  app/api/calendar.py \
  app/api/jobs.py \
  app/api/notes.py \
  app/services/actions.py \
  app/services/reminders.py \
  app/services/planner.py \
  app/services/pulse_digest_items.py \
  app/services/pulse_inbox.py \
  app/services/vitals_briefing.py
```

Broad command:

```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest -q
```

## Frontend

Focused commands:

```bash
cd frontend
npm test -- --run \
  src/components/actions/__tests__/action-list-groups.test.tsx \
  src/components/actions/__tests__/actions-page.test.tsx \
  src/components/focus/__tests__/start-focus-dialog.test.tsx \
  src/components/today/__tests__/fixed-schedule.test.tsx \
  src/components/today/__tests__/focus-queue.test.tsx \
  src/components/today/__tests__/now-block.test.tsx \
  src/components/today/__tests__/plan-bar.test.tsx \
  src/hooks/__tests__/use-focus-session.test.tsx \
  src/components/reminders/__tests__/reminder-list-groups.test.tsx \
  src/components/reminders/__tests__/reminders-mobile-polish.test.tsx \
  __tests__/digest-items.test.tsx \
  __tests__/job-detail-tracking.test.tsx \
  __tests__/collapsible-description.test.tsx \
  __tests__/inline-edit.test.tsx \
  __tests__/api-error-handling.test.ts
```

Broad commands:

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

## Manual Smoke Checklist

- `/actions` has no `Legacy Review` button.
- `/tasks`, `/tasks/[id]`, and `/tasks/analytics` redirect to `/actions`.
- Pulse item action saves as an Action, not a Task.
- Calendar, Jobs, and Notes no longer show task-link UI.
- Settings no longer exposes task tag management.
