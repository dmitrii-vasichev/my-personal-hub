# Actions Unification Status

Last updated: 2026-04-29

## Current State

- Branch: `codex/actions-unification`
- Base branch: `main`
- Working tree at start of Actions pass: clean
- Current feature: Actions unification
- Current execution source of truth: `docs/PLAN.md`

## Live Journal

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
