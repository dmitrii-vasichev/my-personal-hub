# Actions Unification Test Plan

Last updated: 2026-04-29

## Strategy

Use TDD for each behavior change. Prefer focused tests around Actions, Reminders compatibility, Focus, navigation, and the removed Tasks surfaces, then run broader frontend validation when the rollout is stable.

## Backend

Focused commands:

```bash
cd backend
source venv/bin/activate
pytest -q tests/test_actions.py tests/test_reminders.py tests/test_focus_sessions.py
pytest -q tests/test_actions.py tests/test_telegram_notifications.py
pytest -q tests/test_task_cleanup.py
```

Broad command:

```bash
cd backend
source venv/bin/activate
pytest -q
```

Expected caveats:
- Existing task-reminder persistence tests may emit `AsyncMock` warnings.

## Frontend

Focused commands:

```bash
cd frontend
npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx src/components/actions/__tests__/actions-page.test.tsx
npm test -- --run src/components/__tests__/command-palette.test.tsx src/hooks/__tests__/use-command-palette.test.tsx src/components/layout/__tests__/sidebar-safe-area.test.tsx
npm test -- --run src/components/today/__tests__/hero-priority.test.tsx src/components/today/__tests__/focus-today-cell.test.tsx
```

Broad commands:

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

## Cleanup Dry Run

Focused command:

```bash
cd backend
source venv/bin/activate
pytest -q tests/test_task_cleanup.py
```

Manual review:
- Run the dry-run endpoint or helper.
- Confirm every task-linked reminder row includes task title, reminder title, action date/time, urgency, recurrence, details presence, checklist count, and reminder id.
- Preserve selected reminders by detaching them from their task.
- Stop before hard deletion unless explicit destructive confirmation is given.

## Manual Smoke Checklist

Actions:
- Open `/actions`.
- Add title-only action and confirm it lands in Inbox/Someday.
- Add date-only action and confirm it lands in Today or future date under Anytime.
- Add date+time action and confirm it lands under Scheduled before Anytime.
- Mark urgent date-only action and confirm it sorts within Anytime, not above Scheduled.
- Expand an action with details, URL, and checklist.
- Mark done and restore from history.

Birthdays:
- Open `/actions/birthdays`.
- Confirm `/reminders/birthdays` redirects.

Focus:
- Start focus from an Action.
- Confirm active/today focus cells display without task dependencies.

Notifications:
- Confirm scheduled actions can snooze and notify.
- Confirm inbox/anytime actions do not schedule exact notifications.

Visible Tasks removal:
- Sidebar and command palette do not show Tasks.
- Calendar, jobs, notes, and Today do not expose task-link creation.
- Old task URLs redirect away from the old Tasks experience.
