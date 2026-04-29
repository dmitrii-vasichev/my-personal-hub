# Legacy Tasks Domain Removal Plan

Last updated: 2026-04-29

## Goal

Remove the legacy Tasks domain completely now that Actions are backed by reminders and are the primary daily execution model.

## Non-Goals

- Do not add an export/archive UI for deleted task data.
- Do not introduce Action tags in this pass.
- Do not support rolling mixed-version deployment between legacy task code and the removal migration.

## Architecture

- Keep `reminders` as the durable Action table.
- Move `Visibility` into a shared backend model module so Calendar keeps its enum without depending on Tasks.
- Remove task-only backend models, schemas, services, routers, analytics, cleanup APIs, link services, seed data, and tests.
- Remove task-only frontend pages, hooks, components, types, and tests.
- Keep `/tasks*` frontend routes as redirect shims to `/actions`.
- Replace Pulse `to_task` actions with `to_action`, creating Actions through the reminders-backed service.

## Milestones

### M1 — Destructive Migration

Scope:
- Add a normal Alembic revision after current head.
- Detach preserved non-task rows before dropping task references.
- Drop legacy task link tables, tag tables, update table, task table, and unused task enum types.
- Rename vitals briefing task snapshot storage to action snapshot storage.

Definition of done:
- `alembic upgrade head` runs without manual cleanup.
- `reminders.task_id`, `focus_sessions.task_id`, `plan_items.linked_task_id`, and `vitals_briefings.tasks_data_json` are gone.
- Legacy task tables are gone.
- `visibility` remains available for Calendar.

### M2 — Backend Removal

Scope:
- Remove `/api/tasks*`, `/api/task-analytics*`, `/api/actions/task-cleanup/*`, task-link endpoints, and task-only bulk tag APIs.
- Remove task fields from Actions, Reminders, Focus, and Planner schemas.
- Remove task services, task analytics, cleanup service, task link services, models, schemas, seed data, and task-specific tests.
- Update Calendar, Jobs, Notes, Dashboard, Planner, Focus, Vitals, and Pulse dependencies.

Definition of done:
- Backend imports no longer depend on removed task/tag modules.
- Mixed modules compile and focused tests pass without task fields.

### M3 — Frontend Removal

Scope:
- Remove task pages/components/hooks/types/tests.
- Move reusable checklist UI into a shared component location for Actions and Reminders.
- Remove linked-task UI from Calendar, Jobs, and Notes.
- Remove the Legacy Review button and task cleanup page.
- Keep `/tasks`, `/tasks/[id]`, and `/tasks/analytics` as redirects to `/actions`.

Definition of done:
- Frontend has no imports from task/tag hooks, types, or components.
- Visible task-link controls are removed.
- Actions, Focus, Pulse, Settings, command palette, Jobs, Calendar, and Notes remain functional.

### M4 — Validation And Status

Definition of done:
- Local migration has been applied and inspected.
- Focused backend and frontend suites for touched areas pass.
- Broad lint/build/test validation is run where practical.
- `docs/STATUS.md` records exact commands and outcomes.
