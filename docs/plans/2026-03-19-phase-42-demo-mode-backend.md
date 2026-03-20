# Phase 42: Demo Mode — Backend (Role, Restrictions, Seed)

## Overview
Add `demo` user role with restricted access to AI/integration features, create seed script with realistic demo data, and provide admin reset endpoint.

## Tasks

### Task 1: Alembic migration — add `demo` to UserRole enum + `content` to Note
- **Description:** Create migration 033 that adds `demo` value to the `userrole` PostgreSQL enum and adds a nullable `content` Text column to the `notes` table (for local/demo notes without Google Drive).
- **Files:** `backend/alembic/versions/033_add_demo_role_and_note_content.py`
- **Acceptance Criteria:**
  - `ALTER TYPE userrole ADD VALUE 'demo'` in upgrade
  - `notes.content` column added as nullable Text
  - Downgrade removes `content` column (enum value removal not needed — PostgreSQL limitation)
- **Verification:** `alembic upgrade head` succeeds

### Task 2: Update User model and Note model
- **Description:** Add `demo` to `UserRole` enum class. Add `content` Mapped field to `Note` model. Update `google_file_id` to be nullable (demo notes don't have Google file IDs). Update unique constraint to handle nullable google_file_id.
- **Files:** `backend/app/models/user.py`, `backend/app/models/note.py`
- **Acceptance Criteria:**
  - `UserRole.demo = "demo"` exists in enum
  - `Note.content` is `Mapped[Optional[str]]` with `Text` type, nullable
  - `Note.google_file_id` is nullable
- **Verification:** App starts without errors, models match migration
- **Depends on:** Task 1

### Task 3: Create `restrict_demo` dependency
- **Description:** Add a new FastAPI dependency `restrict_demo` in `deps.py` that raises 403 if `current_user.role == UserRole.demo`. Message: `"This feature is not available in demo mode"`.
- **Files:** `backend/app/core/deps.py`
- **Acceptance Criteria:**
  - `restrict_demo(current_user)` raises `HTTPException(403)` for demo users
  - Returns user unchanged for admin/member
- **Verification:** Unit test
- **Depends on:** Task 2

### Task 4: Apply `restrict_demo` to AI generation endpoints
- **Description:** Add `Depends(restrict_demo)` to all AI-powered endpoints: resume generate, ATS audit, gap analysis, cover letter generate, job match, profile import.
- **Files:**
  - `backend/app/api/resumes.py` (generate, ats_audit, gap_analysis)
  - `backend/app/api/cover_letters.py` (generate)
  - `backend/app/api/jobs.py` (match endpoint)
  - `backend/app/api/profile.py` (import endpoint)
- **Acceptance Criteria:**
  - All 6 AI endpoints return 403 for demo users
  - Normal behavior preserved for admin/member
- **Verification:** Tests confirm 403 for demo, 200/201 for member
- **Depends on:** Task 3

### Task 5: Apply `restrict_demo` to integration endpoints
- **Description:** Add `Depends(restrict_demo)` to Google Calendar sync, Google Drive operations (create/edit notes, sync), Telegram setup, Pulse polling/digest generation, external job search.
- **Files:**
  - `backend/app/api/calendar.py` (oauth_connect, sync)
  - `backend/app/api/notes.py` (create, sync — keep GET endpoints open for seeded notes)
  - `backend/app/api/telegram.py` (all endpoints)
  - `backend/app/api/pulse_sources.py` (poll, resolve)
  - `backend/app/api/pulse_digests.py` (generate)
  - `backend/app/api/search.py` (search, auto_search)
- **Acceptance Criteria:**
  - All integration endpoints return 403 for demo users
  - Read endpoints (GET) remain accessible for seeded data
  - Pulse inbox actions (to_task, to_note, skip) remain accessible
- **Verification:** Tests confirm 403 for demo on restricted endpoints
- **Depends on:** Task 3

### Task 6: Block password/email change for demo user
- **Description:** Prevent demo user from changing password or email. Add check in `change-password` endpoint and in profile update (email field).
- **Files:**
  - `backend/app/api/auth.py` (change_password endpoint)
  - `backend/app/api/profile.py` or `backend/app/api/auth.py` (profile update — email field)
- **Acceptance Criteria:**
  - `POST /api/auth/change-password` returns 403 for demo user
  - Profile update ignores email change for demo user
- **Verification:** Tests confirm 403 on password change, email unchanged after update
- **Depends on:** Task 3

### Task 7: Demo-specific settings response
- **Description:** Add `to_demo_response()` to settings service that returns minimal settings (no API key indicators, no Google/Telegram fields). Update settings API to use it for demo users.
- **Files:**
  - `backend/app/services/settings.py`
  - `backend/app/schemas/settings.py` (if new schema needed)
  - `backend/app/api/settings.py`
- **Acceptance Criteria:**
  - Demo user sees only job search preferences (like member) without any API key/integration indicators
  - Settings update for demo user only allows job search fields (default_location, target_roles, etc.)
- **Verification:** Test confirms demo settings response has no API key fields
- **Depends on:** Task 3

### Task 8: Create `seed_demo.py` script — user, profile, tags, tasks
- **Description:** Create seed script that generates demo user "Alex Demo" with profile, 8 tags, and 12 tasks across all statuses with realistic data. Script is idempotent (checks if demo user exists, deletes old data first).
- **Files:** `backend/app/scripts/seed_demo.py`
- **Acceptance Criteria:**
  - Creates demo user with email `demo@personalhub.app`, role `demo`
  - Password from `DEMO_PASSWORD` env var (default: `demo2026`)
  - Creates UserProfile with skills, experience, education, contacts
  - Creates 8 tags with colors
  - Creates 12 tasks with descriptions, priorities, deadlines, tags, checklists, updates
  - Idempotent: safe to run multiple times
- **Verification:** `python -m app.scripts.seed_demo` creates all data; re-run doesn't duplicate
- **Depends on:** Task 2

### Task 9: Extend `seed_demo.py` — jobs, events, KB, notes, pulse data
- **Description:** Add remaining seed data: 8 jobs across statuses with status history, 6 calendar events with notes, 3 KB documents, 4 local notes (using `content` field), 3 pulse sources + 2 digests with items + 5 inbox items.
- **Files:** `backend/app/scripts/seed_demo.py` (extend)
- **Acceptance Criteria:**
  - 8 jobs with realistic companies, salaries, descriptions, status history
  - 6 calendar events (upcoming, past, recurring)
  - 3 AI KB documents (elevator-pitch, star-stories, target-companies)
  - 4 notes stored locally (google_file_id=None, content filled)
  - 3 pulse sources (simulated, no real Telegram IDs)
  - 2 digests with structured items
  - 5 inbox items in "new" status
  - Jobs and events linked where appropriate
- **Verification:** Full seed creates all data; count matches expectations
- **Depends on:** Task 8

### Task 10: Reset demo data endpoint
- **Description:** Create `POST /api/users/demo/reset` (admin-only) that deletes all demo user data and re-runs seed logic. Add to users router.
- **Files:**
  - `backend/app/api/users.py` (add reset endpoint)
  - `backend/app/scripts/seed_demo.py` (extract reusable seed function)
- **Acceptance Criteria:**
  - Only admin can call the endpoint
  - Deletes ALL data owned by demo user (cascade from user_id FK)
  - Re-runs seed to recreate default data
  - Returns `{"status": "ok", "message": "Demo data reset successfully"}`
  - Demo user password reset to default
- **Verification:** After CRUD operations by demo user, reset restores original data
- **Depends on:** Task 9

### Task 11: Notes API — support local notes for demo user
- **Description:** Update notes API to serve local notes (from `content` field) for demo user. GET endpoints should return note content directly instead of fetching from Google Drive.
- **Files:**
  - `backend/app/api/notes.py` (GET content endpoint)
  - `backend/app/services/notes.py` (if exists, or inline in API)
- **Acceptance Criteria:**
  - `GET /api/notes/{file_id}/content` returns `content` field for notes with `google_file_id IS NULL`
  - `GET /api/notes/tree` returns flat list for demo user (no Google Drive tree)
  - `GET /api/notes/` works normally for demo user (returns seeded notes)
- **Verification:** Demo user can view all 4 seeded notes with content
- **Depends on:** Task 9

### Task 12: Tests for demo mode
- **Description:** Comprehensive tests covering: restrict_demo dependency, all restricted endpoints return 403, demo user CRUD works for allowed features, seed script logic, reset endpoint, notes local content, settings response.
- **Files:** `backend/tests/test_demo_mode.py`
- **Acceptance Criteria:**
  - Test restrict_demo allows admin/member, blocks demo
  - Test each category of restricted endpoints (AI, integrations, password)
  - Test demo user can create/read/update/delete tasks and jobs
  - Test settings response for demo user
  - Test notes content endpoint for local notes
  - Test reset endpoint (admin-only, data restored)
  - Minimum 20 test cases
- **Verification:** `pytest backend/tests/test_demo_mode.py -v` all pass
- **Depends on:** Tasks 3-11

## Execution Order

```
Task 1 (migration)
  └→ Task 2 (models)
       └→ Task 3 (restrict_demo dep)
            ├→ Task 4 (AI endpoints)
            ├→ Task 5 (integration endpoints)
            ├→ Task 6 (password/email block)
            └→ Task 7 (settings response)
       └→ Task 8 (seed: user, profile, tags, tasks)
            └→ Task 9 (seed: jobs, events, KB, notes, pulse)
                 ├→ Task 10 (reset endpoint)
                 └→ Task 11 (notes API for demo)
                      └→ Task 12 (tests)
```

## Summary
- **12 tasks**
- New migration: 033
- New files: `seed_demo.py`, `test_demo_mode.py`
- Modified files: ~15 existing files
- New endpoint: `POST /api/users/demo/reset`
- New dependency: `restrict_demo`
