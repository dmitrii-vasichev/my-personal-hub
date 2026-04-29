# Finish-Out Test Plan

Last updated: 2026-04-29

## Strategy

Use focused validation after each milestone, then broad validation at the end. Historical broad-suite failures should be fixed or explicitly recorded before the finish-out pass is considered complete.

## Backend

Focused commands:

```bash
cd backend
source venv/bin/activate
pytest -q tests/test_reminders.py tests/test_task_reminder_persistence.py
pytest -q tests/test_job_hint.py tests/test_backfill_job_event_links.py tests/test_calendar.py tests/test_google_calendar_sync.py tests/test_focus_sessions.py
pytest -q tests/test_note_task_link.py tests/test_pulse_digest_items.py
```

Broad command:

```bash
cd backend
source venv/bin/activate
pytest -q
```

Expected historical broad-suite caveat:
- Final finish-out validation is green: `864 passed`.

## Frontend

Focused commands:

```bash
cd frontend
npm test -- --run src/components/reminders/__tests__/reminder-list-groups.test.tsx src/components/reminders/__tests__/reminders-mobile-polish.test.tsx
npm test -- --run src/components/today/__tests__/hero-cells.test.tsx src/components/calendar/__tests__/job-link-selector.test.tsx
npm test -- --run src/components/today/__tests__/now-block.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx
npm test -- --run src/components/today/__tests__/hero-priority.test.tsx
```

Broad commands:

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

Expected result:
- Final frontend validation is green: `422 passed`.
- `npm run lint` passes with no output.
- `npm run build` passes.

## Telegram Bot

Focused commands:

```bash
cd telegram_bot
.venv/bin/python -m pytest tests/test_main.py tests/test_projects.py tests/test_voice.py tests/test_cc_runner.py
```

Broad command:

```bash
cd telegram_bot
.venv/bin/python -m pytest
```

## Manual Smoke Checklist

D14:
- Create or pick a task with at least one linked note.
- Set that note as the primary draft.
- Confirm Today `Priority_01` shows `JUMP TO DRAFT` when that task is selected.
- Open the draft link and verify the note renders.
- Clear the primary draft and confirm the button disappears.

D15:
- Generate or seed structured Pulse items.
- Confirm unread count appears in Today hero.
- Mark item read and unread.
- Confirm actioning/skipping an item does not corrupt read state.

E18:
- Add a sibling project with root `CLAUDE.md`.
- Send `/refresh`.
- Send `/project` and verify the new project appears.

E17:
- Add `<project>/.claude/settings.json` with a harmless additional rule.
- Send a command in that project.
- Verify logs show a generated merged settings profile path.

E16:
- Run the benchmark script against a real `.ogg` voice note.
- Compare `WHISPER_DEVICE=cpu` and `WHISPER_DEVICE=auto` before changing production env.
