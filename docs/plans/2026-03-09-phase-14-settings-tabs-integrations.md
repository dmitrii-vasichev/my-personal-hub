# Phase 14: Settings Tabs & Google Calendar Integration Config

**Date:** 2026-03-09
**PRD:** docs/prd-settings-tabs-integrations.md
**Tasks:** 10

## Overview

Refactor the Settings page from a monolithic layout into a tabbed interface, and add Google Calendar OAuth credential management (admin-only) in a new "Integrations" tab. Backend reads credentials from DB first, falling back to env vars.

---

## Task 1: DB Migration — Add Google OAuth columns

**Description:** Add 3 new encrypted columns to `user_settings` table for Google Calendar OAuth credentials.

**Files:**
- `backend/alembic/versions/011_add_google_oauth_settings.py` (new)

**Changes:**
- Add columns: `google_client_id` (Text, nullable), `google_client_secret` (Text, nullable), `google_redirect_uri` (String(500), nullable)
- These store Fernet-encrypted values, same pattern as existing `api_key_*` columns

**Acceptance Criteria:**
- [ ] Migration runs without errors: `alembic upgrade head`
- [ ] Columns exist in `user_settings` table
- [ ] Downgrade works: `alembic downgrade -1`

---

## Task 2: Backend Model — Add fields to UserSettings ORM

**Description:** Add the 3 new columns to the SQLAlchemy ORM model.

**Files:**
- `backend/app/models/settings.py`

**Changes:**
- Add `google_client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)`
- Add `google_client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)`
- Add `google_redirect_uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)`

**Acceptance Criteria:**
- [ ] Model matches migration columns
- [ ] No import errors

---

## Task 3: Backend Schema — Extend Pydantic models

**Description:** Add Google Calendar fields to settings schemas.

**Files:**
- `backend/app/schemas/settings.py`

**Changes:**
- `SettingsUpdate`: add `google_client_id`, `google_client_secret`, `google_redirect_uri` (all Optional[str])
- `SettingsResponse`: add `has_google_client_id: bool`, `has_google_client_secret: bool`, `google_redirect_uri: Optional[str]` (URI is not secret, can return as-is)
- `MemberSettingsResponse`: no changes (members don't see integrations)

**Acceptance Criteria:**
- [ ] Schema validation works for new fields
- [ ] API key fields are masked (bool), URI is returned as-is

---

## Task 4: Backend Service — Handle new fields in settings service

**Description:** Extend `update_settings()` and `to_response()` to encrypt/decrypt Google OAuth fields.

**Files:**
- `backend/app/services/settings.py`

**Changes:**
- In `update_settings()`: add `google_client_id` and `google_client_secret` to `_ENCRYPTED_FIELDS` list (admin-only)
- Handle `google_redirect_uri` as plain text (no encryption needed, it's not a secret)
- In `to_response()`: add `has_google_client_id=bool(...)`, `has_google_client_secret=bool(...)`, `google_redirect_uri=settings.google_redirect_uri`
- Add helper `get_google_oauth_credentials(db) -> tuple[str, str, str] | None` — finds admin user's settings, decrypts and returns (client_id, client_secret, redirect_uri) or None

**Acceptance Criteria:**
- [ ] Admin can save Google credentials, they're encrypted in DB
- [ ] Members cannot save Google credentials
- [ ] `to_response()` returns masked booleans
- [ ] `get_google_oauth_credentials()` returns decrypted values for internal use

---

## Task 5: Backend — Update Google OAuth service for DB-first credential resolution

**Description:** Modify `google_oauth.py` to read credentials from DB before falling back to env vars.

**Files:**
- `backend/app/services/google_oauth.py`
- `backend/app/api/calendar.py`

**Changes in `google_oauth.py`:**
- Add `async def get_oauth_config(db: AsyncSession) -> tuple[str, str, str]` that:
  1. Calls `settings_service.get_google_oauth_credentials(db)`
  2. If None → falls back to `settings.GOOGLE_CLIENT_ID`, `settings.GOOGLE_CLIENT_SECRET`, `settings.GOOGLE_REDIRECT_URI`
  3. Raises ValueError if all empty
- Update `_build_flow()` to accept `client_id`, `client_secret`, `redirect_uri` params instead of reading from env directly
- Update `get_authorization_url()` to accept and pass these params
- Update `get_credentials()` to use DB-resolved credentials
- Update `exchange_code_for_tokens()` to use DB-resolved credentials

**Changes in `calendar.py`:**
- `google_oauth_connect`: use `get_oauth_config(db)` instead of checking `cfg.GOOGLE_CLIENT_ID` directly
- Update error detail: `"Google Calendar integration is not configured. Ask your admin to set it up in Settings → Integrations."`
- Add `db: AsyncSession = Depends(get_db)` to `google_oauth_connect` endpoint (currently missing)

**Acceptance Criteria:**
- [ ] OAuth flow works when credentials are in DB only (no env vars)
- [ ] OAuth flow works when credentials are in env only (no DB)
- [ ] DB credentials take priority over env vars
- [ ] Error message mentions Settings → Integrations

---

## Task 6: Frontend Types — Extend TypeScript interfaces

**Description:** Add Google Calendar fields to frontend settings types.

**Files:**
- `frontend/src/types/settings.ts`

**Changes:**
- `UserSettings`: add `has_google_client_id: boolean`, `has_google_client_secret: boolean`, `google_redirect_uri: string | null`
- `UpdateSettingsInput`: add `google_client_id?: string`, `google_client_secret?: string`, `google_redirect_uri?: string`

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] Types match backend schema

---

## Task 7: Frontend — Refactor Settings page into tabbed layout

**Description:** Split the monolithic settings page into tabs. Extract each section into its own component.

**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` (refactor)
- `frontend/src/components/settings/general-tab.tsx` (new)
- `frontend/src/components/settings/ai-api-keys-tab.tsx` (new)
- `frontend/src/components/settings/integrations-tab.tsx` (new — placeholder, filled in Task 8)

**Changes:**
- Settings page becomes a shell with tab navigation + shared Save button
- Tab list: "General" (all users) | "AI & API Keys" (admin) | "Integrations" (admin) | "Users" (admin)
- Tab styling: underline/pill style consistent with design brief (dark theme, accent color)
- Extract `TagInput` and `ApiKeyInput` to shared utils or keep in page (they're reused across tabs)
- State management stays in parent, passed down via props
- Non-admin users see only "General" tab (no tab bar shown if only 1 tab)

**Acceptance Criteria:**
- [ ] Tab switching works without page reload or API call
- [ ] All existing settings functionality preserved
- [ ] Non-admin sees only General content (no tab bar)
- [ ] Admin sees all 4 tabs
- [ ] Save button works across all tabs

---

## Task 8: Frontend — Integrations tab with Google Calendar config

**Description:** Build the Integrations tab content with Google Calendar OAuth credential inputs.

**Files:**
- `frontend/src/components/settings/integrations-tab.tsx`

**Changes:**
- Section card "Google Calendar" with:
  - Status badge: "✓ Configured" (green) or "Not configured" (muted)
  - `ApiKeyInput` for Client ID (masked, shows "••••• (set)" when configured)
  - `ApiKeyInput` for Client Secret (masked)
  - Text input for Redirect URI (pre-filled with `http://localhost:8000/api/calendar/oauth/callback`, editable)
  - Helper text explaining where to get credentials (Google Cloud Console link)
- Values flow through same state management as other settings
- Save triggers same `PUT /api/settings/` endpoint

**Acceptance Criteria:**
- [ ] Admin can enter and save Google credentials
- [ ] Status indicator shows "Configured" after save
- [ ] Redirect URI has sensible default
- [ ] Credentials never displayed in plaintext after save

---

## Task 9: Frontend — Improve Calendar "Connect Google" error UX

**Description:** When Google Calendar is not configured, show a helpful message directing admin to Settings instead of a generic error toast.

**Files:**
- `frontend/src/components/calendar/google-connect.tsx`

**Changes:**
- Catch the 503 error specifically
- If user is admin: show toast with "Google Calendar not configured. Go to Settings → Integrations to set it up." with action link
- If user is member: show toast "Google Calendar is not configured. Contact your administrator."

**Acceptance Criteria:**
- [ ] Admin sees actionable error with link to Settings
- [ ] Member sees informative error message
- [ ] No change to happy path (when configured, OAuth flow works as before)

---

## Task 10: Backend Tests

**Description:** Add tests for new settings fields and credential resolution logic.

**Files:**
- `backend/tests/test_settings_google.py` (new)

**Tests:**
1. `test_admin_save_google_credentials` — admin can save google_client_id and google_client_secret, they appear encrypted in DB
2. `test_member_cannot_save_google_credentials` — member's update ignores google_* fields
3. `test_settings_response_masks_google_keys` — response contains `has_google_client_id: true` but not the actual key
4. `test_get_google_oauth_credentials_from_db` — helper returns decrypted values when set in DB
5. `test_get_google_oauth_credentials_fallback_env` — helper returns env values when DB is empty
6. `test_oauth_connect_uses_db_credentials` — /oauth/connect works when credentials only in DB

**Acceptance Criteria:**
- [ ] All 6 tests pass
- [ ] No existing tests broken

---

## Execution Order

```
Task 1 (migration) → Task 2 (model) → Task 3 (schema) → Task 4 (service)
    → Task 5 (oauth resolution) → Task 10 (tests)
Task 6 (frontend types) → Task 7 (tabs refactor) → Task 8 (integrations tab) → Task 9 (calendar UX)
```

Backend tasks 1-5 are sequential. Frontend tasks 6-9 are sequential.
Backend and frontend tracks can run in parallel after Task 6.
Task 10 runs after Task 5.

---

## Dependencies

- Existing Fernet encryption (`app.core.encryption`) — already working
- Existing `UserSettings` model and `user_settings` table — extending
- Existing `ApiKeyInput` component — reusing
- Design brief (`docs/design-brief.md`) — follow for tab styling
