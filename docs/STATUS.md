# Legacy Tasks Domain Removal Status

Last updated: 2026-05-13

## Current State

- Branch: `claude/serene-galileo-957673` (worktree), awaiting squash-merge to `main`.
- Base branch: `main`
- Current feature: Garmin Training Readiness end-to-end (sync + factoid + chart + backfill).
- Current execution source of truth: `docs/STATUS.md`

## Live Journal

### 2026-05-13 — Garmin Training Readiness Added

Changed:
- Added 4 nullable columns to `vitals_daily_metrics`: `training_readiness` (int 0-100), `training_readiness_level` (str), `training_readiness_recovery_hours` (int), `training_readiness_feedback` (str). Alembic migration `e1f2a3b4c5d6_add_training_readiness_to_vitals_daily_metrics`.
- `_sync_daily_metrics` now calls `client.get_morning_training_readiness(date_str)` after the HRV block. 429 propagates as `GarminRateLimitError`; other errors log a warning and leave the columns null. Helper `_extract_training_readiness(payload)` parses score/level/recoveryTime/feedbackLong-or-feedbackShort. `raw_json["training_readiness"]` carries the full payload alongside `summary`/`body_battery`/`max_metrics`/`hrv`.
- `_needs_vitals_backfill` extended with `_count_recent_readiness_rows` and `READINESS_SPARSE_THRESHOLD = 30` (softer than HRV's 90 because Garmin only returns readiness for ~30 days).
- `VitalsDailyMetricResponse` Pydantic schema exposes the 4 new fields (Optional).
- `vitals_briefing.py`: `get_health_snapshot` emits a `training_readiness` dict (`score`, `level`, `recovery_hours`, `feedback`); `_build_briefing_prompt` renders a `Training readiness: N (LEVEL) — feedback` line when score is non-null.
- New one-shot CLI `backend/scripts/backfill_training_readiness.py` — walks back N days (default 90, idempotent, supports `--dry-run`) and fills training-readiness fields on existing `vitals_daily_metrics` rows only. Local engine + `engine.dispose()` in `finally` (mirrors `backfill_job_event_links.py`).
- Frontend type `VitalsDailyMetric` gets 4 snake_case nullable fields (matches existing field convention; no API adapter — backend JSON passes through).
- `today-summary.tsx` renders a new factoid first when `training_readiness != null`. Score is the big number, level is the caption, feedback is the tooltip. Tone scale: `<50` amber, `≥75` green (project design system collapses neutral/yellow into amber).
- New chart `frontend/src/components/vitals/charts/training-readiness-chart.tsx` (Recharts AreaChart, Y-domain `[0, 100]`, mirrors `hrv-chart.tsx` style; custom tooltip shows level + recovery hours). Wired first in `charts-section.tsx`, above HRV.
- Demo seed (`backend/app/scripts/seed_demo.py` + frontend `vitals-demo.test.tsx` inline fixture): generates plausible readiness 60-92 with derived level (POOR/LOW/MODERATE/GOOD/READY/MAXIMIZED), recovery 0-48h, feedback from a fixed pool.
- Dashboard widget (`vitals-widget.tsx`) intentionally unchanged (out of scope).

Validation:
- Backend `py_compile`: `app/models/garmin.py app/schemas/garmin.py app/services/garmin_sync.py app/services/vitals_briefing.py alembic/versions/e1f2a3b4c5d6_*.py scripts/backfill_training_readiness.py app/scripts/seed_demo.py` -> passed.
- Backend `alembic heads` -> `e1f2a3b4c5d6 (head)`. Local `alembic upgrade head` skipped (local Postgres unavailable, will be applied on Railway during deploy).
- Backend focused: `pytest -q tests/test_garmin_sync.py tests/test_garmin_auth.py tests/test_vitals_briefing.py tests/test_vitals_demo.py` -> `152 passed`.
- TDD on every implementer cycle: RED test demonstrated failure before implementation, GREEN confirmed after. Existing sparse-history tests (`hrv_history_is_sparse`, `hrv_history_is_only_30_days`) had their mocked `db.execute` count iterables extended from 3 elements to 4 to accommodate the new readiness count.
- Frontend focused: `npm test -- --run __tests__/vitals.test.tsx __tests__/vitals-widget.test.tsx src/components/vitals/__tests__/vitals-demo.test.tsx src/components/vitals/charts/__tests__/training-readiness-chart.test.tsx` -> `45 passed`.
- Frontend lint: `npm run lint` -> clean.
- Frontend build: `npx next build --webpack` -> clean, `/vitals` prerendered. (`npm run build` via Turbopack fails on `node_modules` symlink — known worktree quirk, not a code issue.)

Commits on `claude/serene-galileo-957673` (oldest → newest):
- `a890c9d` feat(vitals): migration for training readiness columns
- `c8c8ac5` feat(vitals): add training readiness fields to VitalsDailyMetric
- `517a088` feat(vitals): add training readiness extractor
- `1def4e4` feat(vitals): sync training readiness in daily metrics
- `a8fd865` test(vitals): cover training readiness rate limit
- `b615fc0` feat(vitals): trigger backfill when training readiness sparse
- `cf74b0e` feat(vitals): expose training readiness via API schema
- `d076ce6` feat(vitals): include training readiness in briefing snapshot
- `0d8383a` feat(vitals): one-shot script to backfill training readiness
- `bf7d75a` feat(vitals): training readiness types
- `aa571ae` feat(vitals): readiness factoid in today summary
- `ea9bf8a` feat(vitals): training readiness chart component
- `4c520e0` feat(vitals): show readiness chart first on vitals page
- `c30b32e` feat(vitals): demo seed populates training readiness

Manual-only items:
- Squash-merge to `main` and push (manual gate per CLAUDE.md — awaiting user confirmation).
- Railway deploy + `alembic upgrade head` on prod.
- One-shot backfill: `railway run --service backend-api --environment production --no-local -- python backend/scripts/backfill_training_readiness.py --user-id 1 --days 90`.
- Visual smoke `/vitals` in prod — factoid + chart populated.

Notes:
- Local Postgres still unavailable on `127.0.0.1:5432`; migration applies on Railway during deploy.
- Garmin API typically returns morning training readiness only for the last ~30 days. The backfill script asks for 90; the actual fill window will be best-effort (~30 days). This is expected, not an error.
- Existing dependency/deprecation and `AsyncMock` warnings remain in backend focused suite (pre-existing).

### 2026-05-07 — Pulse Background Freeze

Changed:
- Added `polling_enabled` and `digest_enabled` flags to `pulse_settings`, defaulting both to `false` so Pulse background work is opt-in.
- Added Alembic migration `d4e5f6a7b8c9_add_pulse_freeze_flags`.
- Updated Pulse settings schemas and API responses to expose the freeze flags.
- Updated Pulse settings service so enabling polling/digests schedules jobs, while disabling them removes existing jobs.
- Added scheduler guards so stale polling or digest jobs exit before collecting Telegram messages, applying AI filters, or generating LLM digests when Pulse is frozen.
- Updated startup scheduler restoration to restore only enabled Pulse polling/digest jobs while keeping birthday checks intact.
- Updated timezone-change side effects so disabled Pulse digests are removed rather than recreated.
- Added Settings > Pulse controls for background Telegram polling and scheduled AI digests, with a visible paused/active state. `Poll Now` is disabled while polling is paused.

Validation:
- RED backend freeze tests: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_pulse_settings.py::TestPulseSettingsSchemas::test_settings_schema_freeze_flags tests/test_pulse_settings.py::TestPulseSettingsSchemas::test_update_schema_freeze_flags tests/test_pulse_settings.py::TestPulseSettingsService::test_disabling_polling_removes_poll_job tests/test_pulse_settings.py::TestPulseSettingsService::test_disabling_digest_removes_digest_job tests/test_pulse_settings.py::TestPulseSettingsAPI::test_api_get_settings` -> failed because freeze flags were absent from schemas/API and ignored by the settings service.
- GREEN backend freeze tests: same command -> `5 passed`.
- Backend focused Pulse/Timezone: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_pulse_settings.py tests/test_pulse_digest.py tests/test_pulse_collection.py tests/test_user_timezone.py tests/test_pulse_sources.py tests/test_pulse_digest_prompts.py` -> `109 passed`.
- Backend compile: `cd backend && PYTHONPATH=. ./venv/bin/python -m py_compile app/models/telegram.py app/schemas/pulse_settings.py app/services/pulse_settings.py app/services/pulse_scheduler.py app/services/timezone.py app/main.py alembic/versions/d4e5f6a7b8c9_add_pulse_freeze_flags.py` -> passed.
- Alembic heads: `cd backend && PYTHONPATH=. ./venv/bin/alembic heads` -> `d4e5f6a7b8c9 (head)`.
- Frontend Pulse prompt test: `cd frontend && npm test -- --run src/__tests__/pulse/prompt-editor.test.tsx` -> `8 passed`.
- Frontend lint: `cd frontend && npm run lint` -> passed.
- Frontend build: `cd frontend && npm run build` -> passed.
- Git: committed `c9b16c9 Freeze Pulse background work` and pushed `main` to `origin/main`.
- Railway deploy: `railway up --service backend-api --environment production --message "Freeze Pulse background work"` -> deployment `3bfcfbc0-42b7-4815-8105-841725dbbe4a` reached `SUCCESS`.
- Railway production migration check: `railway run --service backend-api --environment production --no-local -- bash -lc 'cd backend && PYTHONPATH=. ./venv/bin/alembic current'` -> `d4e5f6a7b8c9 (head)`.
- Production health check: `curl -fsS https://backend-api-production-1967.up.railway.app/api/health` -> `{"status":"ok"}`.

Notes:
- Local migration application was not completed because PostgreSQL is unavailable on `127.0.0.1:5432` / `::1:5432`; `alembic upgrade head` failed at database connection time.
- Focused backend tests still emit existing dependency/deprecation and `AsyncMock` warnings.

### 2026-05-06 — Garmin HRV Added To Vitals

Findings:
- HRV was absent because the app had no storage, schema, sync mapping, or frontend display fields for it.
- The installed `garminconnect` library does expose HRV via `Garmin.get_hrv_data(date)`, backed by Garmin's `/hrv-service/hrv/{date}` endpoint.
- Follow-up root cause for only two HRV days: existing daily metrics and sleep rows made the backfill gate choose the 2-day incremental sync window because HRV coverage was not part of the sparse-history check.
- Railway production follow-up for the 90-day HRV gap: production had `metrics_90d=38`, `sleep_90d=38`, `hrv_90d=24`, and HRV only from `2026-04-07` through `2026-05-06`; 24 HRV rows still exceeded the generic 7-row sparse-history threshold, so another 90-day backfill was not triggered.

Changed:
- Added nullable HRV fields to `vitals_daily_metrics`: `hrv_last_night_avg`, `hrv_weekly_avg`, and `hrv_status`.
- Added Alembic migration `c3d4e5f6a7b8_add_hrv_to_vitals_daily_metrics`.
- Garmin daily metrics sync now fetches HRV, stores it in `raw_json`, persists nightly and weekly HRV values, and treats HRV-only payloads as valid daily metric rows.
- Vitals API schemas and frontend Vitals types now expose HRV.
- Vitals page summary now shows five factoids ordered HRV, Sleep, Body Battery, Avg Stress, and Steps; Resting HR was removed from the top factoids.
- Vitals charts now show HRV first, Sleep second, followed by the previous trend charts.
- Dashboard Vitals widget now includes HRV.
- Vitals briefing health snapshots and prompts now include HRV.
- Demo seed data now includes realistic HRV values.
- Vitals backfill detection now counts recent HRV rows and triggers a 90-day sync while HRV history is sparse, matching the maximum Vitals chart filter.
- HRV backfill detection now keeps the 90-day sync path active until HRV itself has 90 recent rows.

Validation:
- RED backend HRV regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_sync_daily_metrics_create tests/test_garmin_sync.py::TestGarminSyncService::test_sync_daily_metrics_creates_from_hrv_only` failed on missing HRV fields and HRV-only payload handling.
- RED frontend HRV regression: `cd frontend && npm test -- --run __tests__/vitals.test.tsx __tests__/vitals-widget.test.tsx` failed because HRV was not rendered.
- GREEN backend HRV regression: same command -> `2 passed`.
- GREEN frontend HRV regression: same command -> `25 passed`.
- RED frontend ordering regression: `cd frontend && npm test -- --run __tests__/vitals.test.tsx` failed because the Vitals page still rendered six factoids and the first chart was Steps.
- GREEN frontend ordering regression: `cd frontend && npm test -- --run __tests__/vitals.test.tsx src/components/vitals/__tests__/vitals-demo.test.tsx` -> `25 passed`.
- RED backend HRV sparse-history regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_needs_vitals_backfill_when_hrv_history_is_sparse` failed because `_needs_vitals_backfill` returned `False` for full metrics/sleep history and only 2 HRV rows.
- GREEN backend HRV sparse-history regression: same command -> `1 passed`.
- RED backend 90-day backfill regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_sync_user_data_backfills_90_days_when_history_is_sparse` failed with `30 == 90`.
- GREEN backend 90-day backfill regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_sync_user_data_backfills_90_days_when_history_is_sparse tests/test_garmin_sync.py::TestGarminSyncService::test_needs_vitals_backfill_when_hrv_history_is_sparse` -> `2 passed`.
- Backend focused: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py tests/test_garmin_auth.py tests/test_vitals_briefing.py` -> `129 passed`.
- Backend focused after sparse-history fix: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py tests/test_garmin_auth.py tests/test_vitals_briefing.py` -> `130 passed`.
- Backend sparse-history compile: `cd backend && PYTHONPATH=. ./venv/bin/python -m py_compile app/services/garmin_sync.py` -> passed.
- RED backend 30-day HRV threshold regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_needs_vitals_backfill_when_hrv_history_is_only_30_days` failed because `_needs_vitals_backfill` returned `False` for 30 HRV rows.
- GREEN backend 90-day HRV threshold regression: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py::TestGarminSyncService::test_needs_vitals_backfill_when_hrv_history_is_sparse tests/test_garmin_sync.py::TestGarminSyncService::test_needs_vitals_backfill_when_hrv_history_is_only_30_days tests/test_garmin_sync.py::TestGarminSyncService::test_sync_user_data_backfills_90_days_when_history_is_sparse` -> `3 passed`.
- Backend focused after 90-day HRV threshold fix: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_garmin_sync.py tests/test_garmin_auth.py tests/test_vitals_briefing.py` -> `131 passed`.
- Railway deploy: `railway up --service backend-api --environment production --message "Fix HRV 90-day backfill threshold"` -> deployment `90298a93-4c35-4105-9812-22ca4ffa48f1` reached `SUCCESS`.
- Railway manual sync from the deployed container: `railway ssh --service backend-api --environment production ... sync_user_data(...)` -> `sync_success`.
- Railway post-sync inspection: `metrics_90d=90`, `sleep_90d=89`, `hrv_90d=63`, HRV range `2026-02-18` through `2026-05-06`, Garmin connection `success`, last sync log `success`.
- Backend demo vitals: `cd backend && PYTHONPATH=. ./venv/bin/python -m pytest -q tests/test_vitals_demo.py` -> `12 passed`.
- Backend compile: `cd backend && PYTHONPATH=. ./venv/bin/python -m py_compile app/models/garmin.py app/schemas/garmin.py app/services/garmin_sync.py app/services/vitals_briefing.py app/scripts/seed_demo.py alembic/versions/c3d4e5f6a7b8_add_hrv_to_vitals_daily_metrics.py` -> passed.
- Alembic heads: `cd backend && PYTHONPATH=. ./venv/bin/alembic heads` -> `c3d4e5f6a7b8 (head)`.
- Frontend focused: `cd frontend && npm test -- --run __tests__/vitals-widget.test.tsx __tests__/vitals.test.tsx src/components/vitals/__tests__/vitals-demo.test.tsx` -> `32 passed`.
- Frontend lint: `cd frontend && npm run lint` -> passed.
- Frontend build: `cd frontend && npm run build` -> passed.

Notes:
- Local Alembic `current` / `upgrade head` validation was not run because local PostgreSQL was unavailable on `127.0.0.1:5432`.
- Local manual HRV backfill was not run because `cd backend && PYTHONPATH=. ./venv/bin/alembic current` still cannot connect to PostgreSQL on `127.0.0.1:5432`.
- Manual production sync via local `railway run` was not used because the production Garmin tokenstore failed to decode with the local virtualenv Garmin client; run sync from the deployed Railway container after deploying this fix.
- Garmin returned empty HRV payloads, not parser-readable HRV values, for the remaining missing dates: `2026-02-06` through `2026-02-17`, `2026-03-07` through `2026-03-15`, and `2026-04-09` through `2026-04-14`.
- Backend tests still emit existing dependency/deprecation and `AsyncMock` warnings.

### 2026-04-29 — Legacy Tasks Domain Removed

Changed:
- Added destructive Alembic migration `b2c3d4e5f6a7_remove_legacy_tasks_domain`.
- Detached and removed legacy task references from reminders, focus sessions, planner items, and vitals briefing storage.
- Dropped legacy task/tag/link/update tables and removed task-only backend APIs, models, schemas, services, seed data, and tests.
- Moved `Visibility` into `app.models.visibility` for Calendar and shared access-control usage.
- Removed task fields from Actions, Reminders, Focus, Planner, Pulse, Dashboard, Vitals, Jobs, Calendar, and Notes flows.
- Replaced Pulse `to_task` with `to_action`, including a visible frontend "Save as Action" control.
- Removed frontend task/tag pages, hooks, components, types, cleanup UI, linked-task surfaces, and the Actions page `Legacy Review` button.
- Kept `/tasks`, `/tasks/[id]`, and `/tasks/analytics` as redirect shims to `/actions`.
- Updated `docs/PLAN.md` and `docs/TEST_PLAN.md` for the destructive removal phase.

Validation:
- Migration: `cd backend && PYTHONPATH=. ./venv/bin/alembic upgrade head` -> passed.
- Migration current: `cd backend && PYTHONPATH=. ./venv/bin/alembic current` -> `b2c3d4e5f6a7 (head)`.
- Database inspection confirmed no legacy tables remain among `tasks`, `task_updates`, `task_tags`, `tags`, `task_event_links`, `job_task_links`, `note_task_links`.
- Database inspection confirmed no legacy columns remain among `reminders.task_id`, `focus_sessions.task_id`, `plan_items.linked_task_id`, `vitals_briefings.tasks_data_json`; `vitals_briefings.actions_data_json` exists.
- Backend focused: `cd backend && PYTHONPATH=. ./venv/bin/pytest -q tests/test_actions.py tests/test_reminders.py tests/test_focus_sessions.py tests/test_planner_api.py tests/test_planner_service.py tests/test_pulse_digest_items.py tests/test_pulse_inbox.py tests/test_calendar.py tests/test_job_links.py tests/test_dashboard.py tests/test_vitals_briefing.py` -> `185 passed`.
- Backend compile smoke: `cd backend && PYTHONPATH=. ./venv/bin/python -m py_compile app/main.py app/api/actions.py app/api/reminders.py app/api/calendar.py app/api/jobs.py app/api/notes.py app/services/actions.py app/services/reminders.py app/services/planner.py app/services/pulse_digest_items.py app/services/pulse_inbox.py app/services/vitals_briefing.py` -> passed.
- Backend broad: `cd backend && PYTHONPATH=. ./venv/bin/pytest -q` -> `770 passed`.
- Frontend focused: `cd frontend && npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx src/components/actions/__tests__/actions-page.test.tsx src/components/focus/__tests__/start-focus-dialog.test.tsx src/components/today/__tests__/fixed-schedule.test.tsx src/components/today/__tests__/focus-queue.test.tsx src/components/today/__tests__/now-block.test.tsx src/components/today/__tests__/plan-bar.test.tsx src/hooks/__tests__/use-focus-session.test.tsx src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx __tests__/digest-items.test.tsx __tests__/job-detail-tracking.test.tsx __tests__/collapsible-description.test.tsx __tests__/inline-edit.test.tsx __tests__/api-error-handling.test.ts` -> `73 passed`.
- Frontend broad: `cd frontend && npm test -- --run` -> `372 passed`.
- Frontend lint: `cd frontend && npm run lint` -> passed.
- Frontend build: `cd frontend && npm run build` -> passed.

Notes:
- Backend broad validation still emits existing dependency/deprecation and `AsyncMock` warnings, but no failures.

### 2026-04-29 — Actions Unification Started

Changed:
- Created isolated worktree at `/Users/dmitry.vasichev/.config/superpowers/worktrees/my-personal-hub/actions-unification`.
- Created branch `codex/actions-unification`.
- Replaced the old finish-out execution plan/test plan/backlog with the Actions rollout plan.

Baseline validation:
- Backend: `source venv/bin/activate && pytest -q tests/test_reminders.py tests/test_task_reminder_persistence.py tests/test_focus_sessions.py` → `15 passed`.
- Frontend: `npm test -- --run src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx` → `12 passed`.

Notes:
- Backend baseline emitted the existing task-reminder `AsyncMock` warnings.

Next action:
- Write RED backend tests for nullable action scheduling modes and `/api/actions`.

### 2026-04-29 — Actions Unification Implemented

Changed:
- Added `/api/actions` backed by the existing `Reminder` model, with `action_date`, nullable `remind_at`, and derived `inbox` / `anytime` / `scheduled` modes.
- Added nullable `focus_sessions.action_id` and frontend focus start support from Actions.
- Updated reminder scheduling, restore, snooze, recurrence, birthday, planner, and startup job restoration paths for nullable `remind_at`.
- Added `/actions`, `/actions/birthdays`, and `/actions/task-cleanup`; legacy `/reminders*` and `/tasks*` routes redirect to Actions.
- Replaced visible daily Tasks/Reminders surfaces in sidebar, command palette, Today widgets, dashboard cards/activity, miniapp login, settings labels, and Pulse item actions.
- Added grouped Actions list behavior: Overdue, Today, future dates, Inbox/Someday; scheduled items sort by time before anytime items; urgent only ranks within anytime/inbox.
- Added cleanup dry-run APIs and UI for task-linked reminders, plus preserve-selected behavior that only detaches reminders from `task_id`.
- Moved settings shared inputs out of the Next page file so production build type checks under Next 16.

Validation:
- Backend focused baseline before changes: `pytest -q tests/test_reminders.py tests/test_task_reminder_persistence.py tests/test_focus_sessions.py` → `15 passed`.
- Frontend focused baseline before changes: `npm test -- --run src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx` → `12 passed`.
- Backend focused Actions/Reminders/Focus/Cleanup: `pytest -q tests/test_actions.py tests/test_reminders.py tests/test_focus_sessions.py tests/test_task_cleanup.py` → `25 passed`.
- Backend compile: `python -m py_compile app/api/actions.py app/services/actions.py app/services/task_cleanup.py app/schemas/action.py app/schemas/task_cleanup.py app/models/reminder.py app/models/focus_session.py` → passed.
- Alembic: `alembic heads` → `a1b2c3d4e5f6 (head)`.
- Frontend full tests: `npm test -- --run` → `81 passed / 439 tests passed`.
- Frontend lint: `npm run lint` → passed.
- Frontend build: `npm run build -- --webpack` → passed.
- Frontend default build note: `npm run build` with Turbopack fails in this isolated worktree because `node_modules` is a symlink outside the filesystem root; webpack build is clean.
- Backend broad suite: `pytest -q` → `887 passed / 2 failures` in `tests/test_vitals_demo.py` on vitals dashboard mock ordering outside the touched Actions/Reminders/Focus/Cleanup areas.

Notes:
- No hard-delete endpoint or task data deletion was added. The cleanup path stops at dry-run review plus explicit preserve-selected detach.
- Existing backend dependency/deprecation and `AsyncMock` warnings remain present in broad suite output.

### 2026-04-29 — Garmin Vitals Metrics Sync Fix

Findings:
- Local database currently has only the seeded demo Garmin connection (`demo_token`), not real admin Garmin tokens, so live Garmin payloads could not be queried from this workspace.
- Demo vitals data includes non-null daily metrics, sleep, and activities through 2026-04-27.
- Root cause found in code: token-only Garmin clients were loaded without hydrating `display_name`, while Garmin summary/sleep endpoints build URLs with that profile value.
- Secondary sync issue: empty daily metric payloads were counted as successful all-null rows, and Body Battery parsing did not handle Garmin's intraday values array shape.
- Follow-up root cause for two-day history: `sync_user_data` used the first-sync history window only for activities; daily metrics and sleep were always limited to today/yesterday.

Changed:
- `get_garmin_client` now hydrates cached tokens with `login(tokenstore=...)` and maps hydration 429s into the existing Garmin cooldown path.
- Daily metrics sync now skips all-null metric payloads and parses Body Battery from `bodyBatteryValuesArray` in addition to older scalar fields.
- Vitals sync now backfills 30 days for first sync or sparse existing metrics/sleep history, then returns to a lightweight 2-day incremental window.

Validation:
- RED focused tests reproduced the missing token hydration, Body Battery parsing, and empty-payload behavior.
- GREEN focused tests: `python -m pytest -q backend/tests/test_garmin_auth.py::TestGarminAuthService::test_get_garmin_client_hydrates_cached_tokens_with_login backend/tests/test_garmin_auth.py::TestGarminAuthService::test_get_garmin_client_converts_login_429_to_rate_limit backend/tests/test_garmin_sync.py::TestGarminSyncService::test_sync_daily_metrics_parses_body_battery_values_array backend/tests/test_garmin_sync.py::TestGarminSyncService::test_sync_daily_metrics_skips_empty_payload` → `4 passed`.
- RED backfill regression: `python -m pytest -q backend/tests/test_garmin_sync.py::TestGarminSyncService::test_sync_user_data_backfills_30_days_when_history_is_sparse` failed with `2 == 30`.
- Touched backend slice: `python -m pytest -q backend/tests/test_garmin_auth.py backend/tests/test_garmin_sync.py` → `98 passed`.
- Compile check: `python -m py_compile backend/app/services/garmin_sync.py backend/app/services/garmin_auth.py` → passed.
- Wider Vitals slice: `python -m pytest -q backend/tests/test_garmin_auth.py backend/tests/test_garmin_sync.py backend/tests/test_vitals_demo.py backend/tests/test_vitals_briefing.py` → `137 passed / 2 mock-order failures in test_vitals_demo.py` outside the touched auth/sync path.

### 2026-04-29 — Rich Reminder Cards Implemented

Changed:
- Added `reminders.details` and non-null `reminders.checklist` with an Alembic migration.
- Extended Reminder schemas, API create/update, and service create/update support.
- Recurring reminders now reset checklist completion when advanced to the next occurrence while preserving details.
- Reminder cards now show notes/link/checklist badges, render auto-linked URLs in expanded cards, and support inline checklist toggles.
- Reminder edit dialog now saves details and checklist items while Quick Add remains title/date focused.

Validation:
- Backend RED: `pytest -q tests/test_reminders.py` failed on missing rich reminder fields and recurring checklist reset.
- Backend GREEN: `pytest -q tests/test_reminders.py tests/test_task_reminder_persistence.py` → `7 passed`.
- Frontend RED: `npm test -- --run src/components/reminders/__tests__/reminders-mobile-polish.test.tsx` failed on missing rich card UI.
- Frontend GREEN: `npm test -- --run src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx` → `9 passed`.
- Alembic: `PYTHONPATH=. alembic heads` → `9c1d2e3f4a5b (head)`.
- Frontend: `npm run lint` → passed with no output.
- Frontend: `npm run build` → passed.

Notes:
- Backend focused validation still emits existing `AsyncMock` warnings from `tests/test_task_reminder_persistence.py`.

### 2026-04-27 — Visual QA Pass

Scope:
- Started local backend at `http://127.0.0.1:8000`.
- Reused local frontend dev server at `http://localhost:3000`.
- Logged in through demo mode in the in-app browser.
- Checked the narrow/mobile layout for Today, Tasks, Pulse, Notes, Settings, task detail, note viewer, and mobile sidebar navigation.

Findings:
- No browser console errors or app error screens were observed on the checked pages.
- Mobile/narrow layout renders the hamburger header and sidebar navigation correctly.
- Today hero renders `Pulse unread`.
- D14 primary draft flow was visually checked by linking demo task `735` to demo note `245`: task detail shows the linked note with a `Draft` badge, Today hero shows `Jump to draft`, and the link opens `/notes?file=245`. The temporary demo link was removed after the check.
- D15 read state was visually checked on Pulse: `Mark read` changes the item to `Mark unread` and decrements the digest unread count; the item was restored to unread afterward.

Follow-up:
- The frontend full-suite noise found during this pass was cleaned up later on 2026-04-27. See `Frontend Test Debt Cleanup`.

### 2026-04-27 — Frontend Test Debt Cleanup

Changed:
- Added a deterministic Vitest `localStorage` shim that avoids Node 25's incomplete built-in `localStorage` getter and resets storage between tests.
- Fixed frontend tests that were overriding read-only globals by switching them to Vitest global stubs.
- Added Telegram settings test mocks for auth and bridge hooks.
- Updated stale UI expectations for Telegram settings and job search provider selection.
- Fixed `PromptEditor` so an existing saved prompt is loaded into the initial draft.
- Fixed job detail tracking UI so untracked jobs show `Start Tracking` and hide resume/cover-letter tools until the job is tracked.
- Removed the remaining frontend lint warnings, including unused imports/variables and React hook dependency noise.

Validation:
- Frontend: `npm test -- --run` → `422 passed`.
- Frontend: `npm run lint` → passed with no output.
- Frontend: `npm run build` → passed.

### 2026-04-27 — M1 Targeted Baseline

Validation:
- Backend focused baseline: `92 passed`.
- Frontend focused baseline: `14 passed`.
- Telegram bot focused baseline: `70 passed`.

Notes:
- Backend emitted existing dependency/deprecation warnings and one pre-existing `AsyncMock` warning in `test_note_task_link.py`.
- No baseline blockers found.

Next action:
- Implement D14 task primary draft link.

### 2026-04-27 — M2 D14 Implemented

Changed:
- Added `tasks.linked_document_id` migration with `ON DELETE SET NULL`.
- Added backend model/schema/service/API support for a task primary draft note.
- Setting a primary draft validates note ownership and ensures the existing task-note link exists.
- Unlinking a note from a task clears `linked_document_id` when that note was primary.
- Task detail linked notes can mark/clear a primary draft.
- Today `HeroPriority` renders `JUMP TO DRAFT` when the selected task has a primary draft.

Validation:
- Backend: `pytest -q tests/test_task_linked_document.py tests/test_note_task_link.py` → `14 passed`.
- Frontend: `npm test -- --run src/components/today/__tests__/hero-priority.test.tsx __tests__/notes/linked-notes-section.test.tsx` → `11 passed`.
- Alembic: `alembic heads` → `7a8c9d0e1f2b (head)`.

Next action:
- Implement D15 Pulse read state and Today hero unread count.

### 2026-04-27 — M3 D15 Implemented

Changed:
- Added `pulse_digest_items.read_at` migration and unread index.
- Added backend read/unread mutation and unread-count endpoint.
- Digest item actions now mark items read while keeping processing `status` separate.
- Added frontend unread-count hook and read/unread mutation hook.
- Today `HeroCells` now renders `Pulse unread` instead of `Meetings today`.
- Structured Pulse item cards can explicitly mark read/unread.

Validation:
- Backend: `pytest -q tests/test_pulse_digest_items.py` → `39 passed`.
- Frontend: `npm test -- --run src/components/today/__tests__/hero-cells.test.tsx __tests__/digest-items.test.tsx` → `15 passed`.
- Alembic: `alembic heads` → `8b9c0d1e2f3a (head)`.

Next action:
- Implement E18 Telegram `/refresh` project discovery.

### 2026-04-27 — M4 E18 Implemented

Changed:
- Added Telegram `/refresh` command.
- `/refresh` re-runs sibling project discovery, updates `bot_data["projects"]`, and updates the module-level `_projects_ref` used by CC routing.
- `/project` empty/unknown-project messages now point to `/refresh` instead of restart.
- Registered `/refresh` in Telegram command menu and help text.

Validation:
- Telegram bot: `python -m py_compile main.py` → passed.
- Telegram bot: `.venv/bin/python -m pytest tests/test_main.py tests/test_projects.py` → `51 passed`.

Next action:
- Implement E17 per-project settings overlay.

### 2026-04-27 — M5 E17 Implemented

Changed:
- Added runtime project settings merge helper in `telegram_bot/settings_profiles.py`.
- `_profile_for()` now starts from locked/unlocked base profile, then merges active project `.claude/settings.json` when present.
- Base list values, including deny rules and hooks, are appended/de-duplicated so project overlays can add rules without removing global safety rails.
- Generated merged profiles are written under `telegram_bot/profiles/generated/` and ignored by git.
- Updated Telegram README project-switching/security notes.

Validation:
- Telegram bot: `python -m py_compile main.py settings_profiles.py` → passed.
- Telegram bot: `.venv/bin/python -m pytest tests/test_settings_profiles.py tests/test_cc_runner.py tests/test_main.py` → `63 passed`.

Next action:
- Implement E16 Whisper benchmark and optional device selection.

### 2026-04-27 — M6 E16 Implemented

Changed:
- Added `WHISPER_DEVICE` setting, defaulting to `cpu`.
- Voice transcription now forwards device to faster-whisper and logs elapsed time plus real-time factor when Telegram voice duration is present.
- Added `telegram_bot/benchmark_voice.py` for local CPU vs `auto` benchmarking against real audio files.
- Updated Telegram `.env.example` and README voice notes.

Validation:
- Telegram bot: `python -m py_compile voice.py main.py config.py benchmark_voice.py` → passed.
- Telegram bot: `.venv/bin/python -m pytest tests/test_voice.py tests/test_main.py` → `49 passed`.

Next action:
- Run cross-cutting validation and update final status.

### 2026-04-27 — Final Validation

Changed during validation:
- Applied the new Alembic migrations to the local database with `PYTHONPATH=. alembic upgrade head`.
- Made task service post-commit reload test-safe while preserving real DB reload behavior.
- Added response-schema defaults for newly optional task/pulse settings fields.
- Kept job matching backward-compatible with legacy LLM responses that return `score` without weighted `ratings`.
- Updated two stale backend tests to match current Google OAuth scopes and timezone-aware vitals behavior.

Validation:
- Backend: `pytest -q` → `864 passed`.
- Telegram bot: `.venv/bin/python -m pytest -q` → `170 passed`.
- Frontend touched tests: `npm test -- --run src/components/today/__tests__/hero-priority.test.tsx src/components/today/__tests__/hero-cells.test.tsx __tests__/notes/linked-notes-section.test.tsx __tests__/digest-items.test.tsx` → `26 passed`.
- Frontend broad suite after cleanup: `npm test -- --run` → `422 passed`.
- Frontend lint after cleanup: `npm run lint` → passed with no output.
- Frontend build: `npm run build` → passed.
- Alembic: `PYTHONPATH=. alembic heads` → `8b9c0d1e2f3a (head)`.

Notes:
- The broad frontend suite was restored after the initial final-validation pass exposed historical setup failures.

Next action:
- Manual smoke only, if desired, for browser/iOS/PWA and production snapshot backfill rehearsal.

### 2026-04-27 — Baseline Review

Findings:
- D13 is shipped and pushed.
- D14 is not implemented: `Task` has no `linked_document_id`; `HeroPriority` has `Open task` and `Snooze 1h`, but no `JUMP TO DRAFT`.
- D15 is not implemented: `PulseDigestItem` has `status`, `actioned_at`, `action_type`, and `action_result_id`, but no read state. `HeroCells` still renders `Meetings today`.
- E18 is not implemented: Telegram project discovery runs at startup only.
- E17 is not implemented: Telegram bot passes one global locked/unlocked settings profile to every project.
- E16 is not implemented: `voice.py` hardcodes `device="cpu"` and has no benchmark helper.

Decisions:
- Use `linked_document_id` as a primary draft pointer while keeping existing many-to-many linked notes.
- Keep Pulse read state separate from processing status.
- Prefer `/refresh` over a background file watcher for project discovery. It is simpler, explicit, and safer for a single-user bot.
- Keep CPU Whisper as the default; add measurement and opt-in device selection before attempting acceleration.

Next action:
- Run targeted baseline tests for D13/D12/Telegram adjacent surfaces.

## Progress

- [x] M0 baseline and execution pack.
- [x] M1 backend Action model and API.
- [x] M2 notification and recurrence semantics.
- [x] M3 frontend Actions UI.
- [x] M4 remove visible Tasks surfaces.
- [x] M5 cleanup dry run.
- [x] M6 final validation.

## Blockers

None for the Actions rollout. Broad backend validation still has two unrelated vitals dashboard test failures recorded above.

## Manual-Only Items

- D13 production backfill rehearsal against a production snapshot requires explicit owner approval before running.
- Live browser round-trips may require local backend/frontend servers and seeded data.
- iOS/PWA smoke requires a real device or browser profile.
