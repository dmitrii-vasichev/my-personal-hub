# Phase 32: Telegram Connection & Pulse Models

## Overview

Foundation phase for Telegram Pulse. Creates all 5 database models (telegram_sessions, pulse_sources, pulse_messages, pulse_digests, pulse_settings), Telethon authorization flow with Fernet-encrypted session storage, connection management API, and Settings UI tab for Telegram connection.

**Result:** User can connect their Telegram account, see connection status, and disconnect — with encrypted, isolated session storage.

## Tasks

### Task 1: Create Pulse DB models
- **Description:** Create all 5 Pulse models in a single file: `TelegramSession`, `PulseSource`, `PulseMessage`, `PulseDigest`, `PulseSettings`
- **Files:** `backend/app/models/telegram.py` (new)
- **Details:**
  - TelegramSession: user_id (unique, CASCADE), session_string (Text, encrypted), phone_number (Text, encrypted), is_active, connected_at, last_used_at
  - PulseSource: user_id (CASCADE), telegram_id (BigInt), username, title, category, subcategory, keywords (JSON), criteria (JSON), is_active, last_polled_at. Unique: (user_id, telegram_id). Index: (user_id, is_active)
  - PulseMessage: user_id (CASCADE), source_id (CASCADE), telegram_message_id (BigInt), text, sender_name, message_date, category, ai_relevance (Float), ai_classification, status (default "new"), collected_at, expires_at. Unique: (user_id, source_id, telegram_message_id). Indexes: (user_id, status), (user_id, expires_at)
  - PulseDigest: user_id (CASCADE), category, content (Text), message_count, generated_at, period_start, period_end. Index: (user_id, category, generated_at DESC)
  - PulseSettings: user_id (unique, CASCADE), polling_interval_minutes (default 60), digest_schedule (default "daily"), digest_time (default 09:00), digest_day, digest_interval_days, message_ttl_days (default 30), bot_token (encrypted), bot_chat_id (BigInt), notify_digest_ready (default true), notify_urgent_jobs (default true)
- **AC:** All 5 models importable, follow existing patterns (DateTime(tz), func.now(), CASCADE)
- **Verify:** `python -c "from app.models.telegram import TelegramSession, PulseSource, PulseMessage, PulseDigest, PulseSettings"`

### Task 2: Register models in __init__ and Alembic env
- **Description:** Import telegram models so Alembic detects them
- **Files:** `backend/app/models/__init__.py` (modify), `backend/alembic/env.py` (modify)
- **AC:** `alembic revision --autogenerate` picks up all 5 new tables
- **Verify:** Run autogenerate and inspect the migration

### Task 3: Create Alembic migration
- **Description:** Generate and verify migration for 5 Pulse tables with all constraints and indexes
- **Files:** `backend/alembic/versions/NNN_add_telegram_pulse_models.py` (new)
- **AC:** `alembic upgrade head` succeeds, all tables created with correct columns, indexes, and constraints
- **Verify:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

### Task 4: Create Pydantic schemas for Telegram auth
- **Description:** Request/response schemas for auth flow and connection status
- **Files:** `backend/app/schemas/telegram.py` (new)
- **Details:**
  - `TelegramStartAuthRequest(phone_number: str)`
  - `TelegramVerifyCodeRequest(code: str, password: Optional[str])`
  - `TelegramStatusResponse(connected: bool, phone_number: Optional[str], connected_at: Optional[datetime])`
- **AC:** Schemas validate input, serialize output correctly
- **Verify:** Unit test with sample data

### Task 5: Create Telegram auth service
- **Description:** Service layer for Telethon auth flow with encrypted session storage
- **Files:** `backend/app/services/telegram_auth.py` (new)
- **Details:**
  - `start_auth(db, user, phone_number)` — create Telethon client, send code request, store temp state
  - `verify_code(db, user, code, password?)` — complete auth, encrypt session with Fernet, store in DB
  - `get_status(db, user)` — return connection status (connected, phone, timestamp)
  - `disconnect(db, user)` — delete session from DB
  - `get_client_for_user(db, user)` — reconstruct TelegramClient from encrypted session (for later phases)
  - Uses `encrypt_value()` / `decrypt_value()` from `core/encryption.py`
  - Handles Telethon exceptions: SessionPasswordNeededError, PhoneCodeInvalidError, etc.
- **AC:** Auth flow works end-to-end with mocked Telethon; session encrypted in DB
- **Verify:** Service tests (Task 8)

### Task 6: Create Telegram API router
- **Description:** REST endpoints for Telegram connection management
- **Files:** `backend/app/api/telegram.py` (new)
- **Details:**
  - `POST /api/pulse/telegram/start-auth` — accepts phone_number, returns success/step info
  - `POST /api/pulse/telegram/verify-code` — accepts code + optional password, returns status
  - `GET /api/pulse/telegram/status` — returns connection status
  - `DELETE /api/pulse/telegram/disconnect` — revokes session, returns 204
  - All endpoints require `get_current_user` dependency
- **AC:** Endpoints return correct status codes and response bodies
- **Verify:** API tests (Task 8)

### Task 7: Register router in main app
- **Description:** Import and include telegram router in FastAPI app
- **Files:** `backend/app/main.py` (modify)
- **AC:** Endpoints appear in `/docs` (OpenAPI schema)
- **Verify:** `curl http://localhost:8000/docs` shows pulse/telegram endpoints

### Task 8: Backend tests for Telegram auth
- **Description:** Test auth service and API endpoints with mocked Telethon
- **Files:** `backend/tests/test_telegram_auth.py` (new)
- **Tests:**
  - `test_start_auth_sends_code` — service calls Telethon send_code_request
  - `test_verify_code_stores_encrypted_session` — session_string and phone encrypted in DB
  - `test_verify_code_with_2fa` — handles password parameter
  - `test_status_connected` — returns correct info after auth
  - `test_status_disconnected` — returns connected=false when no session
  - `test_disconnect_deletes_session` — DB row removed
  - `test_session_unique_per_user` — second auth replaces first session
  - `test_session_cascade_on_user_delete` — deleting user removes session
  - `test_api_start_auth_endpoint` — HTTP POST returns 200
  - `test_api_verify_code_endpoint` — HTTP POST returns status
  - `test_api_status_endpoint` — HTTP GET returns status
  - `test_api_disconnect_endpoint` — HTTP DELETE returns 204
- **AC:** All 12 tests pass
- **Verify:** `pytest tests/test_telegram_auth.py -v`

### Task 9: Create frontend TypeScript types
- **Description:** Types for Telegram auth API responses
- **Files:** `frontend/src/types/telegram.ts` (new)
- **Details:**
  - `TelegramAuthStatus { connected, phone_number?, connected_at? }`
  - `TelegramStartAuthRequest { phone_number }`
  - `TelegramVerifyCodeRequest { code, password? }`
- **AC:** Types match backend schemas exactly
- **Verify:** TypeScript compilation passes

### Task 10: Create Telegram API hooks
- **Description:** TanStack Query hooks for Telegram auth endpoints
- **Files:** `frontend/src/hooks/use-telegram.ts` (new)
- **Details:**
  - `useTelegramStatus()` — GET /api/pulse/telegram/status
  - `useTelegramStartAuth()` — POST mutation
  - `useTelegramVerifyCode()` — POST mutation
  - `useTelegramDisconnect()` — DELETE mutation
  - All mutations invalidate status query on success
- **AC:** Hooks follow existing patterns (use-settings.ts), error handling via sonner toast
- **Verify:** TypeScript compilation passes

### Task 11: Create Telegram settings tab component
- **Description:** UI component for Telegram connection management in Settings
- **Files:** `frontend/src/components/settings/telegram-tab.tsx` (new)
- **Details:**
  - **Disconnected state:** Phone number input + "Connect" button
  - **Awaiting code state:** Verification code input + optional 2FA password toggle + "Verify" button
  - **Connected state:** Status badge (green), masked phone number, connected_at date, "Disconnect" button with confirmation dialog
  - Follow design-brief.md patterns (shadcn components, consistent spacing)
- **AC:** All 3 states render correctly, transitions work
- **Verify:** Frontend tests (Task 13)

### Task 12: Add Telegram tab to Settings page
- **Description:** Register Telegram tab in settings page tabs array
- **Files:** `frontend/src/app/(dashboard)/settings/page.tsx` (modify)
- **AC:** "Telegram" tab visible in settings, renders TelegramTab component
- **Verify:** Visual check + frontend tests

### Task 13: Frontend tests for Telegram tab
- **Description:** Component tests for all UI states
- **Files:** `frontend/tests/components/telegram-tab.test.tsx` (new)
- **Tests:**
  - `renders disconnected state with phone input`
  - `renders code verification form after start-auth`
  - `renders connected state with status and disconnect button`
  - `submits phone number on connect`
  - `submits verification code`
  - `shows 2FA password field when toggled`
  - `shows confirmation dialog on disconnect`
- **AC:** All 7 tests pass
- **Verify:** `npx vitest run tests/components/telegram-tab.test.tsx`

## Dependencies

```
Task 1 → Task 2 → Task 3 (models → registration → migration)
Task 4 (schemas — independent)
Task 1 + Task 4 → Task 5 → Task 6 → Task 7 (service → router → registration)
Task 5 + Task 6 → Task 8 (backend tests)
Task 9 (types — independent)
Task 9 → Task 10 → Task 11 → Task 12 (types → hooks → component → page)
Task 11 → Task 13 (component → tests)
```

## Execution Order

1. Task 1 — Models
2. Task 2 — Model registration
3. Task 3 — Migration
4. Task 4 — Schemas
5. Task 5 — Auth service
6. Task 6 — API router
7. Task 7 — Router registration
8. Task 8 — Backend tests
9. Task 9 — Frontend types
10. Task 10 — Hooks
11. Task 11 — Telegram tab component
12. Task 12 — Settings page update
13. Task 13 — Frontend tests
