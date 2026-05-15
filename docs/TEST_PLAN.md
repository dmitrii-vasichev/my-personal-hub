# Telegram Claude Bridge Decommission Test Plan

Last updated: 2026-05-15

## Strategy

Validate absence of the bridge surface while preserving Telegram Pulse and
generic auth/user behavior. Run focused checks first, then broader suites where
practical.

## Runtime

```bash
launchctl print gui/$(id -u)/com.my-personal-hub.telegram-bot
pgrep -fl 'telegram_bot/main.py|com.my-personal-hub.telegram-bot'
```

Expected:
- LaunchAgent is not registered.
- No bridge bot Python process is running.

## Backend

Focused checks:

```bash
cd backend
PYTHONPATH=. ./venv/bin/python -m pytest -q \
  tests/test_telegram_bridge_decommission.py \
  tests/test_auth.py
```

Compile/import smoke:

```bash
cd backend
PYTHONPATH=. ./venv/bin/python -m py_compile \
  app/main.py \
  app/api/users.py \
  app/models/user.py \
  app/schemas/auth.py \
  alembic/versions/f2a3b4c5d6e7_decommission_telegram_claude_bridge.py
```

Migration metadata:

```bash
cd backend
PYTHONPATH=. ./venv/bin/alembic heads
```

Broad command:

```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest -q
```

## Frontend

Focused checks:

```bash
cd frontend
npm test -- --run __tests__/telegram-tab.test.tsx
```

Broad commands:

```bash
cd frontend
npm test -- --run
npm run lint
npm run build
```

## Manual Smoke Checklist

- Settings → Telegram renders "Telegram Pulse".
- Settings → Telegram does not render "Telegram Bridge".
- Pulse source management and digest pages still render.
- No `/api/telegram/auth/*` endpoint appears in the FastAPI route table.
