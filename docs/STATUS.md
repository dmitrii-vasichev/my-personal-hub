# Finish-Out Status

Last updated: 2026-04-29

## Current State

- Branch: `main`
- Remote sync: `main...origin/main`
- Working tree at start of rich reminder pass: clean
- Latest local feature: Rich reminder cards
- Current execution source of truth: `docs/PLAN.md`

## Live Journal

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

- [x] M0 documentation pack created.
- [x] M1 deferred smoke baseline.
- [x] M2 D14 task primary draft link.
- [x] M3 D15 Pulse read state.
- [x] M4 E18 Telegram project refresh.
- [x] M5 E17 per-project settings overlay.
- [x] M6 E16 Whisper benchmark/device path.
- [x] Final validation.
- [x] Frontend test debt cleanup.

## Blockers

None currently.

## Manual-Only Items

- D13 production backfill rehearsal against a production snapshot requires explicit owner approval before running.
- Live browser round-trips may require local backend/frontend servers and seeded data.
- iOS/PWA smoke requires a real device or browser profile.
