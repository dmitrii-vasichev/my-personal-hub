# Telegram Claude Bridge Decommission Plan

Last updated: 2026-05-15

## Goal

Remove the Telegram-to-Claude-Code bridge completely now that Codex provides the
remote control workflow directly.

## Non-Goals

- Do not remove Telegram Pulse channel collection, digests, reminder callbacks,
  or the Telegram Mini App.
- Do not remove generic API token support; only remove bridge-specific token
  consumers and setup surfaces.
- Do not preserve bridge pairing data. `users.telegram_user_id` and
  `users.telegram_pin_hash` may be dropped.

## Architecture

- Stop and remove the local macOS LaunchAgent before deleting its repo script.
- Delete the standalone `telegram_bot/` package, launchd files, security
  profiles, local bridge tests, and setup docs.
- Remove Hub bridge auth endpoints under `/api/telegram/auth/*`.
- Remove bridge self-service endpoints under `/api/users/me/telegram-*`.
- Remove bridge-only user columns and API response fields.
- Add a normal Alembic revision after the current head to drop the bridge
  columns and constraints from `users`.
- Remove the Settings → Telegram "Telegram Bridge" section while preserving the
  existing "Telegram Pulse" section.

## Milestones

### M1 — Runtime Shutdown

Scope:
- Unload and remove `com.my-personal-hub.telegram-bot` from LaunchAgents.
- Remove local bridge logs after the service is stopped.
- Delete ignored local runtime files together with `telegram_bot/`.

Definition of done:
- `launchctl print gui/$(id -u)/com.my-personal-hub.telegram-bot` reports the
  service is not registered.
- No `telegram_bot/main.py` process is running.

### M2 — Backend Decommission

Scope:
- Delete bridge router, schemas, rate limiter, and bridge tests.
- Remove router registration from `app/main.py`.
- Remove `telegram_user_id` and `telegram_pin_hash` from the ORM and auth
  response schema.
- Add a drop-column Alembic migration with downgrade restoration.

Definition of done:
- `/api/telegram/auth/check-sender` and `/api/telegram/auth/verify-pin` are no
  longer registered.
- `/api/auth/me` no longer serializes bridge fields.
- `alembic heads` reports a single new head.

### M3 — Frontend Decommission

Scope:
- Remove bridge mutations and request types.
- Remove bridge state and UI from `TelegramTab`.
- Remove bridge fields from the frontend `User` type.
- Keep Telegram Pulse settings/auth UI intact.

Definition of done:
- Settings → Telegram still renders the Pulse section.
- Settings → Telegram no longer renders "Telegram Bridge".

### M4 — Documentation And Validation

Scope:
- Update active repo instructions and status docs so the bridge is no longer a
  live constraint.
- Keep historical shipped logs as historical context unless they create active
  instructions.
- Run focused backend/frontend validation first, then broader checks where
  practical.

Definition of done:
- Active docs describe the decommissioned state.
- Focused backend and frontend tests pass.
- Compile, lint, and build checks are run or explicitly recorded as skipped.
