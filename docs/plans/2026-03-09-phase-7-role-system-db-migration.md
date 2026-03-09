# Phase 7 Plan: Role System & Database Migration

**Date:** 2026-03-09
**PRD:** docs/prd-user-management.md
**FR covered:** FR-6, FR-7, FR-10, FR-11, FR-19, FR-20, FR-21
**Tasks:** 9

## Overview

Foundation phase for User Management feature. All database schema changes, role rename, visibility system, and auth hardening. No UI work — backend and data layer only (except minimal frontend type updates).

---

## Task 1: Alembic Migration — Users Table Enhancements

**Description:**
Create migration `008_add_user_fields.py` adding 3 new columns to `users` table.

**Changes:**
- `is_blocked: Boolean DEFAULT FALSE NOT NULL` — for blocking user accounts
- `last_login_at: DateTime(timezone=True) NULL` — last successful login timestamp
- `theme: String(10) DEFAULT 'dark' NOT NULL` — UI theme preference (light/dark)

**Files:**
- CREATE: `backend/alembic/versions/008_add_user_fields.py`

**Acceptance Criteria:**
- [ ] Migration applies without errors on existing DB with data
- [ ] All existing users get `is_blocked=false`, `theme='dark'`, `last_login_at=null`
- [ ] Downgrade drops the columns cleanly
- [ ] Format matches existing migrations (001–007)

**Verification:** `alembic upgrade head` succeeds, `alembic downgrade -1` succeeds

---

## Task 2: Alembic Migration — Role Enum Rename (user → member)

**Description:**
Create migration `009_rename_user_role_to_member.py` that safely renames the PostgreSQL enum value.

**Changes:**
- `ALTER TYPE userrole RENAME VALUE 'user' TO 'member'`

**Dependencies:** Task 1

**Files:**
- CREATE: `backend/alembic/versions/009_rename_user_role_to_member.py`

**Acceptance Criteria:**
- [ ] Enum value renamed in PostgreSQL
- [ ] Existing users with role='user' now have role='member'
- [ ] New users can be created with role='member'
- [ ] Downgrade renames back to 'user'

**Verification:** `SELECT DISTINCT role FROM users` returns only 'admin' and 'member'

---

## Task 3: Alembic Migration — Visibility Fields

**Description:**
Create migration `010_add_visibility_fields.py` adding visibility enum and columns to tasks and calendar_events.

**Changes:**
- Create enum type `visibility` with values: 'family', 'private'
- Add `visibility` column to `tasks` (DEFAULT 'family', NOT NULL)
- Add `visibility` column to `calendar_events` (DEFAULT 'family', NOT NULL)
- Create composite indexes: `(user_id, visibility)` on both tables

**Dependencies:** Task 2

**Files:**
- CREATE: `backend/alembic/versions/010_add_visibility_fields.py`

**Acceptance Criteria:**
- [ ] Enum type created in PostgreSQL
- [ ] Both columns added with correct defaults
- [ ] All existing tasks/events get visibility='family'
- [ ] Indexes created for query performance
- [ ] Downgrade drops columns, indexes, and enum type

**Verification:** `SELECT visibility, count(*) FROM tasks GROUP BY 1` shows all 'family'

---

## Task 4: Update SQLAlchemy User Model

**Description:**
Update `User` model and `UserRole` enum to reflect DB changes from Tasks 1–2.

**Changes:**
- Rename `UserRole.user` → `UserRole.member`
- Add fields: `is_blocked`, `last_login_at`, `theme`

**Dependencies:** Task 3 (all migrations applied)

**Files:**
- EDIT: `backend/app/models/user.py`

**Acceptance Criteria:**
- [ ] `UserRole` enum has values: `admin`, `member` (no `user`)
- [ ] `User` class has `is_blocked: bool`, `last_login_at: Optional[datetime]`, `theme: str`
- [ ] Field types and defaults match migration exactly
- [ ] No import errors when loading model

**Verification:** `python -c "from app.models.user import User, UserRole; print(UserRole.member)"`

---

## Task 5: Update SQLAlchemy Task & CalendarEvent Models

**Description:**
Add `Visibility` enum and `visibility` field to Task and CalendarEvent models.

**Changes:**
- Define `Visibility` enum (family/private) — shared across models
- Add `visibility` field to `Task` model
- Add `visibility` field to `CalendarEvent` model

**Dependencies:** Task 4

**Files:**
- CREATE or EDIT: `backend/app/models/visibility.py` (shared enum, or define in task.py)
- EDIT: `backend/app/models/task.py`
- EDIT: `backend/app/models/calendar.py`
- EDIT: `backend/app/models/__init__.py` (export Visibility)

**Acceptance Criteria:**
- [ ] `Visibility` enum defined with `family` and `private` values
- [ ] `Task.visibility` defaults to `Visibility.family`
- [ ] `CalendarEvent.visibility` defaults to `Visibility.family`
- [ ] Models load without import errors

**Verification:** `python -c "from app.models.task import Task, Visibility; print(Visibility.family)"`

---

## Task 6: Update Auth Dependencies & Security

**Description:**
Update authentication guards to handle blocked users and new role name.

**Changes:**
- Add `require_not_blocked()` dependency in `deps.py`
- Update `get_current_user()` to check `is_blocked` flag
- Verify `create_access_token()` works with 'member' role value
- Update any hardcoded 'user' role references

**Dependencies:** Task 5

**Files:**
- EDIT: `backend/app/core/deps.py`
- EDIT: `backend/app/core/security.py` (verify, minimal changes)

**Acceptance Criteria:**
- [ ] `get_current_user()` raises 403 if user.is_blocked is True
- [ ] JWT token contains role='member' for non-admin users
- [ ] `require_admin()` still works correctly
- [ ] No hardcoded references to 'user' role

**Verification:** Unit tests for blocked user scenario

---

## Task 7: Update Auth Endpoints (Login & Register)

**Description:**
Update login to track last_login_at and check block status. Update register default role.

**Changes:**
- Login endpoint: add `is_blocked` check before auth, update `last_login_at` on success
- Register endpoint: change default role from 'user' to 'member'
- Auth schemas: update `RegisterRequest.role` default, add new fields to `UserResponse`

**Dependencies:** Task 6

**Files:**
- EDIT: `backend/app/api/auth.py`
- EDIT: `backend/app/schemas/auth.py`

**Acceptance Criteria:**
- [ ] Blocked user gets 403 with clear message on login attempt
- [ ] `last_login_at` updated on each successful login
- [ ] New users created with role='member' by default
- [ ] `/api/auth/me` returns new fields (is_blocked, theme, last_login_at)

**Verification:** Manual test: login → check DB for last_login_at; block user → login fails

---

## Task 8: Update Frontend Types & Auth Provider

**Description:**
Update TypeScript types and auth error handling for blocked users.

**Changes:**
- Update `User` interface with new fields (is_blocked, last_login_at, theme)
- Update auth-provider to show specific error message on 403 (blocked account)
- Replace any 'user' role references with 'member'

**Dependencies:** Task 7

**Files:**
- EDIT: `frontend/src/lib/auth.ts` (User interface)
- EDIT: `frontend/src/components/auth-provider.tsx` (403 handling)
- EDIT: any files referencing role === 'user'

**Acceptance Criteria:**
- [ ] `User` type includes `is_blocked`, `last_login_at`, `theme` fields
- [ ] Login page shows "Account blocked" message on 403
- [ ] No TypeScript errors (`npm run build` clean)
- [ ] No references to role 'user' in frontend code

**Verification:** `npm run build` passes, `npm run lint` passes

---

## Task 9: Write Comprehensive Tests

**Description:**
Create test suite covering all Phase 7 changes.

**Dependencies:** Task 8

**Files:**
- CREATE: `backend/tests/test_user_management_phase7.py`

**Test Cases:**
1. `test_user_role_enum_has_member` — UserRole.member exists, no UserRole.user
2. `test_user_model_new_fields` — is_blocked, last_login_at, theme exist on User
3. `test_visibility_enum` — Visibility.family and Visibility.private exist
4. `test_task_has_visibility` — Task model has visibility field with correct default
5. `test_calendar_event_has_visibility` — CalendarEvent has visibility field
6. `test_login_updates_last_login_at` — last_login_at set after successful login
7. `test_blocked_user_cannot_login` — blocked user gets 403 on login attempt
8. `test_register_creates_member_role` — new user gets role='member'
9. `test_jwt_token_contains_member_role` — token payload has role='member'
10. `test_admin_role_unchanged` — admin role still works as before

**Acceptance Criteria:**
- [ ] All 10 tests pass
- [ ] Tests follow existing patterns (pytest + AsyncMock)
- [ ] No flaky tests
- [ ] `pytest` full suite passes (including existing tests)

**Verification:** `cd backend && python -m pytest tests/ -v`

---

## Execution Order

```
Task 1 → Task 2 → Task 3 (sequential: migrations)
                         ↓
Task 4 → Task 5 → Task 6 → Task 7 (sequential: backend models & logic)
                                  ↓
                            Task 8 (frontend)
                                  ↓
                            Task 9 (tests)
```

## Files Summary

| Action | File |
|--------|------|
| CREATE | `backend/alembic/versions/008_add_user_fields.py` |
| CREATE | `backend/alembic/versions/009_rename_user_role_to_member.py` |
| CREATE | `backend/alembic/versions/010_add_visibility_fields.py` |
| CREATE | `backend/tests/test_user_management_phase7.py` |
| EDIT | `backend/app/models/user.py` |
| EDIT | `backend/app/models/task.py` |
| EDIT | `backend/app/models/calendar.py` |
| EDIT | `backend/app/models/__init__.py` |
| EDIT | `backend/app/core/deps.py` |
| EDIT | `backend/app/core/security.py` |
| EDIT | `backend/app/api/auth.py` |
| EDIT | `backend/app/schemas/auth.py` |
| EDIT | `frontend/src/lib/auth.ts` |
| EDIT | `frontend/src/components/auth-provider.tsx` |

## Definition of Done

- [ ] All 3 migrations apply and roll back cleanly
- [ ] Role renamed everywhere (backend + frontend)
- [ ] Blocked user cannot log in
- [ ] last_login_at tracked on login
- [ ] Visibility fields on tasks and events with default 'family'
- [ ] All tests pass (new + existing)
- [ ] Frontend builds without errors
- [ ] Backend lint clean
