# Finish-Out Plan

Last updated: 2026-04-27

## Goal

Finish the currently queued, not-yet-built project work after D13:

1. Close deferred D13/D12 smoke verification where it can be checked locally.
2. Ship D14: primary task draft document link.
3. Ship D15: Pulse item read state and Today hero unread count.
4. Ship E18: Telegram bot project discovery refresh without restart.
5. Ship E17: per-project Claude settings overlay for Telegram bot runs.
6. Ship E16: voice transcription benchmark knobs and optional non-CPU Whisper device path.

## Non-Goals

- No broad redesign beyond the affected surfaces.
- No new GitHub issue/PR gates.
- No production backfill execution without a separate explicit approval.
- No deletion of old local or remote branches in this finish-out pass.

## Milestones

### M0 — Baseline And Documentation

Definition of done:
- Execution pack exists: `AGENTS.md`, `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, `docs/BACKLOG.md`.
- Working tree status is recorded.
- Current known unfinished scope is recorded.

Validation:
- `git status --short --branch`

### M1 — Deferred Smoke Verification

Scope:
- Run low-risk automated verification for D13/D12 affected areas.
- Record any manual-only smoke that still needs a browser or production snapshot.

Definition of done:
- Targeted backend/frontend/telegram tests are run before feature changes where practical.
- Known blockers and manual-only items are recorded in `docs/STATUS.md`.

Validation candidates:
- `cd backend && source venv/bin/activate && pytest -q tests/test_job_hint.py tests/test_backfill_job_event_links.py tests/test_calendar.py tests/test_google_calendar_sync.py tests/test_focus_sessions.py`
- `cd frontend && npm test -- --run src/components/today/__tests__/hero-cells.test.tsx src/components/calendar/__tests__/job-link-selector.test.tsx src/components/today/__tests__/now-block.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx`
- `cd telegram_bot && .venv/bin/python -m pytest tests/test_main.py tests/test_projects.py tests/test_voice.py`

### M2 — D14 Task Primary Draft Link

Problem:
- The handoff UI wanted a `JUMP TO DRAFT` action in `HeroPriority`, but `Task` has no primary draft/document field.
- Existing many-to-many task-note links are useful, but they do not identify which note is the task's primary draft.

Implementation:
- Add nullable `tasks.linked_document_id` FK to `notes.id` with `ON DELETE SET NULL`.
- Add SQLAlchemy model field and optional relationship loading.
- Extend `TaskCreate`, `TaskUpdate`, and `TaskResponse`.
- Validate that a linked document belongs to the same user as the task.
- When setting a primary document, ensure the task-note link also exists.
- When unlinking a note from a task, clear `linked_document_id` if it pointed at that note.
- Add UI on task detail to set/clear the primary draft from linked notes.
- Add `JUMP TO DRAFT` in `HeroPriority` when the selected task has a primary document.

Definition of done:
- User can set, clear, and view a task primary draft.
- Hero priority task shows `JUMP TO DRAFT` only when a valid primary draft exists.
- Cross-user document assignment returns 404/permission-safe failure.
- Existing linked notes behavior remains intact.

Validation:
- Backend focused tests for task update + note-task unlink.
- Frontend tests for HeroPriority and task detail draft selector.

### M3 — D15 Pulse Read State

Problem:
- Today hero still uses `Meetings today` because Pulse has no item-level read state.
- Existing `status=new/actioned/skipped` means processing state; it must not be reused as read/unread.

Implementation:
- Add nullable `pulse_digest_items.read_at` or equivalent read state.
- Extend schema and frontend types with `is_read`/`read_at`.
- Add endpoint to mark a single item read/unread.
- Add read mutation hook.
- Mark an item read when it is opened/expanded or via explicit control.
- Add an unread count endpoint or reuse list data safely for `HeroCells`.
- Replace `Meetings today` with `Pulse unread` once count exists.

Definition of done:
- Read/unread state is independent from actioned/skipped.
- Today hero counts unread Pulse digest items.
- Digest item UI can mark read/unread without losing action status.

Validation:
- Backend digest item tests for read set/clear and cross-user 404.
- Frontend hook/card/HeroCells tests.

### M4 — E18 Telegram Project Discovery Refresh

Problem:
- `projects.discover()` runs only at bot startup; new projects require LaunchAgent restart.

Implementation:
- Add `/refresh` command that re-runs discovery, updates `app.bot_data["projects"]` and `_projects_ref["known"]`, and reports added/removed/current count.
- Update `/project` and callback unknown-project copy to reference `/refresh`.
- Keep refresh whitelisted.

Definition of done:
- Owner can add/remove a project and run `/refresh` without restarting the bot.
- Active stale projects still fall back safely.

Validation:
- Telegram bot tests for `/refresh`, command registration, and project list update.

### M5 — E17 Per-Project Settings Overlay

Problem:
- Locked/unlocked CC settings profiles are global. Project-specific `.claude/settings.json` files are not considered.

Implementation:
- Resolve profile per run using active project and lock state.
- If `<project>/.claude/settings.json` exists, merge it over the global locked/unlocked profile into a generated runtime profile.
- Keep global deny rules load-bearing; project overlay may add rules but must not weaken the protected personal-data deny list.
- Cache generated profiles by `(project, locked/unlocked, source mtimes/content hash)` to avoid rewriting on every message.

Definition of done:
- Runs in a project with `.claude/settings.json` pass a generated merged settings path to `claude -p`.
- Runs without project settings keep existing global profile behavior.
- Protected deny rules remain present after merge.

Validation:
- Unit tests for merge semantics and `run_cc` settings path routing.

### M6 — E16 Whisper Benchmark And Optional Device Path

Problem:
- Voice transcription is CPU int8 only. Metal/auto acceleration should be attempted only if latency proves painful.

Implementation:
- Add `WHISPER_DEVICE` setting, default `cpu`, allowed practical values `cpu`, `auto`, or platform-supported explicit device strings.
- Add transcription duration logging and real-time factor when Telegram voice duration is available.
- Add a small local benchmark script that runs transcription on an audio file and prints JSON metrics.
- Keep CPU int8 default unchanged.

Definition of done:
- Existing behavior is unchanged by default.
- Owner can benchmark real voice files and opt into `WHISPER_DEVICE=auto`.
- Logs show transcription duration for live voice messages.

Validation:
- Voice unit tests for device forwarding and benchmark helper where practical.

## Final Validation

Run targeted tests after each milestone and then broad validation when the finish-out pass is complete:

- `cd backend && source venv/bin/activate && pytest -q`
- `cd frontend && npm test -- --run` (`422 passed` after cleanup)
- `cd frontend && npm run lint` (passes with no output after cleanup)
- `cd frontend && npm run build` (passes)
- `cd telegram_bot && .venv/bin/python -m pytest`

Historical baseline from `CLAUDE.md`:
- Backend broad suite had 9 pre-existing failures after D13; the current finish-out pass is green.
- Frontend broad suite had pre-existing flakes/setup failures after D13; the current finish-out pass is green after test debt cleanup.

## Rollout Order

1. M0 documentation.
2. M1 targeted smoke baseline.
3. M2 D14.
4. M3 D15.
5. M4 E18.
6. M5 E17.
7. M6 E16.
8. Final validation and status update.
