# PRD: Settings Tabs & Google Calendar Integration Config

## Metadata
| Field | Value |
|-------|-------|
| Author | Claude |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

The Settings page is a monolithic list of sections without logical grouping. When users click "Connect Google" on the Calendar page, they get an error toast "Google Calendar integration is not configured" with no way to configure it from the UI. Admin must manually set environment variables and restart the server.

## User Scenarios

### Scenario 1: Admin configures Google Calendar
**As an** admin, **I want to** enter Google OAuth credentials (Client ID, Secret) through the Settings UI, **so that** all users can connect their Google Calendar without touching server config.

### Scenario 2: User navigates organized settings
**As a** user, **I want to** find my settings organized in logical tabs, **so that** I can quickly locate what I need.

### Scenario 3: Admin checks integration status
**As an** admin, **I want to** see whether Google Calendar integration is configured and working, **so that** I know if users can connect.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: Refactor Settings page into tabbed layout with sections:
  - **General** — Job Search preferences (visible to all users)
  - **AI & API Keys** — LLM provider, AI keys, job search API keys (admin only)
  - **Integrations** — Google Calendar OAuth config (admin only)
  - **Users** — User management table (admin only)
- [ ] FR-2: Integrations tab shows Google Calendar section with:
  - Client ID input (masked, like existing API key inputs)
  - Client Secret input (masked)
  - Redirect URI input (pre-filled with default, editable)
  - Status indicator: "Configured" / "Not configured"
  - Save button (shared with page or section-level)
- [ ] FR-3: Store Google OAuth credentials in DB (encrypted with existing Fernet key), per admin user settings row
- [ ] FR-4: Backend reads Google OAuth credentials from DB first, falls back to env vars if DB is empty
- [ ] FR-5: New DB migration adding `google_client_id`, `google_client_secret`, `google_redirect_uri` columns to `user_settings` table
- [ ] FR-6: Update settings API schema to include Google Calendar fields (admin-only, with `has_google_client_id` mask in response)

### P1 (Should Have)

- [ ] FR-7: "Test Connection" button that validates Client ID/Secret are valid Google credentials
- [ ] FR-8: Calendar page "Connect Google" button shows a helpful message directing to Settings when not configured (instead of generic error toast)

### P2 (Nice to Have)

- [ ] FR-9: Placeholder sections in Integrations tab for future integrations (Telegram, Notion) — disabled/coming soon style

## Non-Functional Requirements

- **Security**: Credentials must be encrypted at rest (Fernet). Never returned in plaintext via API — only boolean `has_*` flags.
- **Backward Compatibility**: Existing env var configuration must continue to work. DB values take priority over env vars.
- **Performance**: Tab switching must be instant (client-side only, no additional API calls per tab).

## Technical Design

### Stack
- Frontend: Next.js + Tailwind CSS + shadcn/ui tabs pattern (CSS-only tabs or simple state-based, no new dependency)
- Backend: FastAPI + SQLAlchemy + Alembic migration
- Encryption: Existing Fernet (`ENCRYPTION_KEY`)

### Architecture

**Credential resolution order (backend):**
1. Check admin's `user_settings` row in DB for `google_client_id` / `google_client_secret`
2. If empty → fall back to `settings.GOOGLE_CLIENT_ID` / `settings.GOOGLE_CLIENT_SECRET` from env
3. If both empty → return 503 "not configured"

**Tab routing:**
- Tabs are client-side state only (no URL change needed)
- Non-admin users see only "General" tab
- Admin users see all 4 tabs

### Files to modify
- `backend/app/models/settings.py` — add 3 new columns
- `backend/app/schemas/settings.py` — add fields to SettingsUpdate + SettingsResponse
- `backend/app/services/settings.py` — handle new fields in update/response
- `backend/app/services/google_oauth.py` — read credentials from DB first
- `backend/app/api/calendar.py` — update error message to point to Settings
- `backend/alembic/versions/` — new migration
- `frontend/src/types/settings.ts` — add new fields
- `frontend/src/app/(dashboard)/settings/page.tsx` — refactor to tabs
- `frontend/src/components/settings/` — extract tab content components
- `frontend/src/components/calendar/google-connect.tsx` — improve error UX

## Out of Scope
- Google Calendar OAuth flow itself (already implemented)
- Other integrations (Telegram, Notion) — future work
- Settings URL-based tab routing (not needed for now)

## Acceptance Criteria
- [ ] AC-1: Settings page shows tabs; non-admin sees "General" only; admin sees all 4 tabs
- [ ] AC-2: Admin can enter Google Client ID + Secret in Integrations tab, save, and see "Configured" status
- [ ] AC-3: After admin configures credentials via UI, users can click "Connect Google" on Calendar page and get redirected to Google OAuth
- [ ] AC-4: Credentials are encrypted in DB and never returned in plaintext via API
- [ ] AC-5: Existing env var config continues to work when DB fields are empty
- [ ] AC-6: All existing settings functionality preserved after tabs refactor

## Open Questions
- None
