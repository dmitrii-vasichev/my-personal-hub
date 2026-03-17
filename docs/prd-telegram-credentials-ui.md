# PRD: Telegram API Credentials in UI

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-16 |
| Status | Approved |
| Priority | P1 |

## Overview
Move Telegram API credentials (API ID and API Hash) from `.env` file to the Settings UI (Telegram Tab). This eliminates the need to manually edit `.env` and restart the server when configuring Telegram integration. A write-only security pattern ensures credentials are never exposed in plain text after saving.

## Requirements
- [ ] FR-1: Add "API Credentials" section in Telegram Tab — two fields (API ID, API Hash) displayed above the Phone Number block
- [ ] FR-2: Backend endpoint to save credentials — encrypt API Hash with Fernet before storing in DB
- [ ] FR-3: Backend endpoint to check credentials status — return `{configured: bool, api_id_set: bool, api_hash_set: bool}` without exposing actual values
- [ ] FR-4: Write-only pattern — API Hash is never returned in plain text via API; UI shows masked value (`abc...xyz`) after save
- [ ] FR-5: API ID displayed as-is after save (it's a public integer, not a secret)
- [ ] FR-6: Credential priority: DB first, `.env` fallback — existing `.env` setups continue to work
- [ ] FR-7: Validation — API ID must be a positive integer, API Hash must be a 32-char hex string
- [ ] FR-8: After saving credentials, the "not configured" warning disappears and Phone Number input becomes available
- [ ] FR-9: Admin-only access — only admin users can view/edit credentials (already enforced by Telegram Tab visibility)
- [ ] FR-10: Allow updating credentials — user can overwrite existing values by entering new ones

## Out of Scope
- ENCRYPTION_KEY management — stays in `.env` (infrastructure secret)
- Telegram Bot Token configuration (already in Pulse Settings)
- Migration of existing `.env` values into DB

## Technical Notes
- Store credentials in `PulseSettings` table (add `telegram_api_id` and `telegram_api_hash_encrypted` columns) or a dedicated table
- Reuse existing `app.core.encryption` (Fernet) for API Hash encryption
- Modify `telegram_auth.is_configured()` to check DB first, then `.env`
- Modify `_create_client()` to read credentials from DB with `.env` fallback
- Frontend: extend `useTelegramConfig` hook to return richer status
- Tests: backend endpoint tests + frontend component tests for new fields

## Security Considerations
- API Hash encrypted at rest (Fernet AES-128-CBC + HMAC-SHA256)
- API Hash never returned in GET responses — write-only
- All endpoints require authentication + admin role
- API ID is not a secret (it's a public app identifier) but still only accessible to admins
