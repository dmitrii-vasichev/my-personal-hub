# Phase 38: Telegram API Credentials in UI

## Overview
Move Telegram API credentials (API ID, API Hash) from `.env` to Settings UI with write-only security pattern.

## Tasks

### Task 1: Add credential columns to PulseSettings model
**Files:** `backend/app/models/telegram.py`
**Description:** Add `telegram_api_id` (Integer, nullable) and `telegram_api_hash_encrypted` (Text, nullable) columns to `PulseSettings` model.
**AC:** Model has two new nullable columns. Existing rows unaffected (nullable).
**Verify:** `python -c "from app.models.telegram import PulseSettings; print('ok')"`

### Task 2: Alembic migration for new columns
**Files:** `backend/alembic/versions/<new_migration>.py`
**Description:** Generate and verify Alembic migration adding the two columns to `pulse_settings` table.
**AC:** Migration runs up/down cleanly.
**Verify:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

### Task 3: Add Pydantic schemas for credentials
**Files:** `backend/app/schemas/telegram.py`
**Description:** Add `TelegramCredentialsSaveRequest` (api_id: int, api_hash: str with validation), `TelegramCredentialsStatusResponse` (configured: bool, api_id: int | None — no hash returned). Update `TelegramConfigStatus` to include `api_id`.
**AC:** Validation: api_id > 0, api_hash is 32-char hex string.
**Verify:** Unit tests pass.

### Task 4: Backend service — save & read credentials
**Files:** `backend/app/services/telegram_auth.py`
**Description:**
- Add `save_credentials(db, user, api_id, api_hash)` — encrypts api_hash, upserts into PulseSettings.
- Add `get_credentials(db, user)` — returns `(api_id, api_hash)` from DB, falling back to `.env` values.
- Modify `is_configured()` → `is_configured(db, user)` (async) — checks DB first, then `.env`.
- Modify `_create_client()` to accept api_id/api_hash params.
**AC:** DB credentials take priority over `.env`. Write-only: api_hash never returned unencrypted via any public function.
**Depends on:** Task 1
**Verify:** Backend tests pass.

### Task 5: Backend API endpoints for credentials
**Files:** `backend/app/api/telegram.py`
**Description:**
- `PUT /api/pulse/telegram/credentials` — save credentials (admin only).
- Update `GET /config-status` — call async `is_configured()`, return api_id if set (no hash).
**AC:** PUT saves encrypted hash, GET returns configured + api_id. Hash never in response.
**Depends on:** Task 3, Task 4
**Verify:** Backend tests pass.

### Task 6: Update all callers of is_configured / _create_client
**Files:** `backend/app/services/telegram_auth.py`, `backend/app/api/telegram.py`
**Description:** Update `start_auth`, `disconnect`, `get_client_for_user`, `config_status` endpoint to pass db/user to the new async `is_configured()` and pass credentials to `_create_client()`.
**AC:** All existing Telegram flows work with DB-stored credentials and `.env` fallback.
**Depends on:** Task 4, Task 5
**Verify:** Full backend test suite passes.

### Task 7: Backend tests for credentials
**Files:** `backend/tests/test_telegram_credentials.py`
**Description:** Tests for:
- Save credentials (happy path, validation errors)
- Read credentials (DB priority, .env fallback)
- is_configured with DB credentials
- PUT endpoint (success, validation, non-admin rejection)
- GET config-status returns api_id but no hash
**AC:** All new tests pass, existing telegram_auth tests still pass.
**Depends on:** Task 5, Task 6
**Verify:** `pytest backend/tests/test_telegram_credentials.py -v`

### Task 8: Frontend types and hooks for credentials
**Files:** `frontend/src/types/telegram.ts`, `frontend/src/hooks/use-telegram.ts`
**Description:**
- Add `TelegramCredentialsSaveRequest` type (api_id: number, api_hash: string).
- Extend `TelegramConfigStatus` with `api_id?: number`.
- Add `useTelegramSaveCredentials()` mutation hook (PUT, invalidates config query, shows toast).
**AC:** Types match backend schemas, hook works.
**Depends on:** Task 5
**Verify:** Frontend build passes.

### Task 9: Telegram Tab UI — credentials section
**Files:** `frontend/src/components/settings/telegram-tab.tsx`
**Description:** Replace the "not configured" warning with an inline credentials form:
- Two fields: API ID (number input), API Hash (password-style input)
- If credentials already saved: show api_id, show masked hash placeholder "••••••••"
- Save button — calls `useTelegramSaveCredentials`
- After save: warning disappears, phone number input appears
- Link to my.telegram.org/apps preserved
**AC:** Full flow works: enter credentials → save → phone number input appears → connect.
**Depends on:** Task 8
**Verify:** Frontend build + manual UI test.

### Task 10: Frontend tests for credentials UI
**Files:** `frontend/__tests__/telegram-tab.test.tsx`
**Description:** Add tests for:
- Credentials form renders when not configured
- Save credentials flow (fill + submit)
- After save, phone input appears
- Already configured shows api_id and masked hash
**AC:** All frontend tests pass.
**Depends on:** Task 9
**Verify:** `npm test`

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

## Total: 10 tasks
