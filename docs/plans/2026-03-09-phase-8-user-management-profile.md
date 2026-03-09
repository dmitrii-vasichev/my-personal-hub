# Phase 8: User Management & Profile

**Date:** 2026-03-09
**PRD:** docs/prd-user-management.md
**Phase:** 8 of 9
**Estimated tasks:** 10

## Overview

Admin panel for managing users (CRUD, role changes, block/unblock, password reset) + user profile page (edit name, theme, change password, avatar initials) + role-based settings visibility.

## Prerequisites

- Phase 7 completed: `users` table has `is_blocked`, `last_login_at`, `theme` columns; role enum is `admin`/`member`; visibility fields on tasks/events.
- Existing `POST /api/auth/register` creates users (admin-only) and returns temp password.
- Existing `GET /api/users/` lists all users (admin-only).

---

## Task 1: Backend — User CRUD API endpoints

**Description:** Extend `backend/app/api/users.py` with full admin CRUD: get single user, create user, update user (role/block), delete user, reset password. Move/deduplicate user creation logic from `auth.py` register endpoint to reuse `auth_service.create_user()`.

**Files:**
- `backend/app/api/users.py` — add endpoints
- `backend/app/schemas/auth.py` — add `CreateUserRequest`, `UpdateUserRequest`, `ResetPasswordResponse` schemas

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/{id}` | Get single user (admin-only) |
| POST | `/api/users/` | Create user → returns user + temp_password |
| PATCH | `/api/users/{id}` | Update role, is_blocked (admin-only) |
| POST | `/api/users/{id}/reset-password` | Reset password → returns temp_password |
| DELETE | `/api/users/{id}` | Delete user (admin-only, cannot delete self) |

**Acceptance Criteria:**
- [ ] Admin can create a user via POST /api/users/ and receives temp password
- [ ] Admin can update role (admin↔member) and block/unblock via PATCH
- [ ] Admin can reset user password; user gets must_change_password=true
- [ ] Admin cannot delete themselves
- [ ] Non-admin gets 403 on all endpoints
- [ ] Tests cover all endpoints and edge cases

**Verification:** `pytest tests/ -k test_user_crud`

---

## Task 2: Backend — Profile API endpoints

**Description:** Add profile endpoints so any authenticated user can view/update their own profile (display_name, theme) and change their password via a dedicated profile route.

**Files:**
- `backend/app/api/auth.py` — add `GET /api/auth/profile`, `PUT /api/auth/profile`
- `backend/app/schemas/auth.py` — add `ProfileResponse`, `UpdateProfileRequest`

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/profile` | Get own profile (id, email, display_name, role, theme, is_blocked, last_login_at, created_at) |
| PUT | `/api/auth/profile` | Update own display_name and/or theme |

**Acceptance Criteria:**
- [ ] Any authenticated user can get their profile
- [ ] Any authenticated user can update display_name and theme
- [ ] Theme value validated to "light" or "dark"
- [ ] Updated user data reflected in response
- [ ] Tests pass

**Verification:** `pytest tests/ -k test_profile`

---

## Task 3: Backend — Role-based settings access control

**Description:** Restrict settings endpoints so members cannot view or update AI provider and API key fields. Members can still manage job search settings (target roles, location, etc.).

**Files:**
- `backend/app/api/settings.py` — add role-based filtering
- `backend/app/schemas/settings.py` — add `MemberSettingsResponse` (subset without API key flags)

**Acceptance Criteria:**
- [ ] GET /api/settings/ for member returns only job search fields (no has_api_key_* flags)
- [ ] PUT /api/settings/ for member ignores api_key_* and llm_provider fields
- [ ] Admin retains full access to all settings fields
- [ ] Tests verify member cannot set/see API keys

**Verification:** `pytest tests/ -k test_settings_role`

---

## Task 4: Backend — Tests for user management & profile

**Description:** Comprehensive tests for all new endpoints from Tasks 1-3.

**Files:**
- `backend/tests/test_user_management_phase8.py`

**Test cases:**
- Admin creates user → 201, temp_password returned
- Admin creates user with duplicate email → 409
- Admin updates user role → 200
- Admin blocks user → user cannot login → 403
- Admin resets password → must_change_password=true
- Admin deletes user → 204, user cannot login
- Admin cannot delete self → 400
- Member calls admin endpoints → 403
- Profile: get own → 200
- Profile: update name/theme → 200
- Settings: member sees only job search fields
- Settings: member cannot set API keys

**Acceptance Criteria:**
- [ ] All test cases pass
- [ ] No regressions in existing tests

**Verification:** `pytest tests/ -v`

---

## Task 5: Frontend — Types, API hooks, and utilities for user management

**Description:** Add TypeScript types for user management, React Query hooks for all new endpoints, and avatar utility (initials + color generation from name).

**Files:**
- `frontend/src/types/user.ts` — UserListItem, CreateUserInput, UpdateUserInput, UpdateProfileInput, ResetPasswordResponse
- `frontend/src/hooks/use-users.ts` — useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetPassword
- `frontend/src/hooks/use-profile.ts` — useProfile, useUpdateProfile
- `frontend/src/lib/avatar.ts` — getInitials(name), getAvatarColor(name) utilities

**Acceptance Criteria:**
- [ ] All types match backend schemas
- [ ] Hooks use correct endpoints and invalidate queries on mutation
- [ ] Avatar util generates 1-2 letter initials from display_name
- [ ] Avatar util generates deterministic color from name string
- [ ] No TypeScript errors

**Verification:** `npm run build` (type checking)

---

## Task 6: Frontend — User Management table in Settings (admin-only)

**Description:** Add a "User Management" section to the Settings page, visible only to admins. Shows a table of all users with columns: avatar+name, email, role badge, status (active/blocked), last login, created date. Each row has an actions menu (edit role, block/unblock, reset password, delete).

**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` — add User Management section (admin-only conditional)
- `frontend/src/components/settings/user-management-table.tsx` — table component
- `frontend/src/components/settings/user-actions-menu.tsx` — dropdown actions per user row

**Acceptance Criteria:**
- [ ] Table renders all users with correct columns
- [ ] Admin role badge styled differently from member
- [ ] Blocked users visually distinguished (dimmed/badge)
- [ ] Actions menu: Change Role, Block/Unblock, Reset Password, Delete
- [ ] Each action shows confirmation dialog before executing
- [ ] Reset password shows the temp password in a dialog after success
- [ ] Delete confirms with user's name, prevents deleting self
- [ ] Section hidden entirely for non-admin users
- [ ] Follows design-brief.md styling
- [ ] No lint errors

**Verification:** Visual check + `npm run build`

---

## Task 7: Frontend — Create User dialog (admin-only)

**Description:** "Add User" button in User Management section opens a dialog/form with fields: display name, email, password (auto-generated or manual), role select (admin/member). On success shows the temporary password for the admin to share.

**Files:**
- `frontend/src/components/settings/create-user-dialog.tsx`

**Acceptance Criteria:**
- [ ] Form validates: email format, display name required, password min 8 chars
- [ ] Role defaults to "member"
- [ ] On submit → POST /api/users/ → show success with temp password
- [ ] Temp password displayed in a copyable format
- [ ] User list refreshes after creation
- [ ] Error handling: duplicate email shows clear message
- [ ] Follows design-brief.md styling

**Verification:** Visual check + `npm run build`

---

## Task 8: Frontend — Profile page

**Description:** Create `/profile` page accessible to all authenticated users. Shows: avatar (initials in colored circle), display name (editable), email (read-only), role badge (read-only), theme toggle, change password form (current + new password).

**Files:**
- `frontend/src/app/(dashboard)/profile/page.tsx` — profile page
- `frontend/src/components/profile/avatar-display.tsx` — large avatar with initials
- `frontend/src/components/profile/profile-form.tsx` — edit name form
- `frontend/src/components/profile/change-password-form.tsx` — change password form

**Acceptance Criteria:**
- [ ] Avatar shows initials from display_name in colored circle
- [ ] Display name editable with save button
- [ ] Email shown but not editable
- [ ] Role shown as badge
- [ ] Theme toggle works and persists to backend
- [ ] Change password: validates current != new, min length
- [ ] Success/error toasts for all actions
- [ ] Follows design-brief.md styling

**Verification:** Visual check + `npm run build`

---

## Task 9: Frontend — Avatar in sidebar and header + profile navigation

**Description:** Replace the plain text username in sidebar/header with an avatar component (initials circle). Clicking the avatar navigates to `/profile`. Add "Profile" to the sidebar navigation.

**Files:**
- `frontend/src/components/layout/sidebar.tsx` — add Profile nav item, avatar at bottom
- `frontend/src/components/layout/header.tsx` — replace text name with avatar component
- `frontend/src/components/ui/avatar.tsx` — reusable small avatar component (initials + color)

**Acceptance Criteria:**
- [ ] Avatar (initials circle) shown in header instead of plain text name
- [ ] Clicking avatar in header navigates to /profile
- [ ] Sidebar has "Profile" navigation item
- [ ] Avatar color consistent between sidebar and header (same algorithm)
- [ ] Follows design-brief.md styling

**Verification:** Visual check + `npm run build`

---

## Task 10: Frontend — Hide AI/API settings sections for member role

**Description:** In the Settings page, conditionally hide "AI Provider" and "Job Search API Keys" sections when the current user is a member. Also hide "Job Search Settings" section for members (FR-9).

**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` — wrap sections with role check

**Acceptance Criteria:**
- [ ] Member sees only basic settings (if any remain visible) or a message
- [ ] Admin sees all sections: User Management, Job Search, AI Provider, API Keys
- [ ] No flash of hidden content on page load
- [ ] Settings page works correctly for both roles
- [ ] No lint errors

**Verification:** Visual check with different roles + `npm run build`

---

## Execution Order

```
Task 1  (Backend: User CRUD)
Task 2  (Backend: Profile API)        ← can parallel with Task 1
Task 3  (Backend: Settings ACL)       ← can parallel with Tasks 1-2
Task 4  (Backend: Tests)              ← depends on Tasks 1-3
Task 5  (Frontend: Types + Hooks)     ← depends on Tasks 1-3 (API contract)
Task 6  (Frontend: User Table)        ← depends on Task 5
Task 7  (Frontend: Create User)       ← depends on Task 5
Task 8  (Frontend: Profile Page)      ← depends on Task 5
Task 9  (Frontend: Avatar + Nav)      ← depends on Task 5
Task 10 (Frontend: Settings ACL)      ← can parallel with Tasks 6-9
```

**Parallelization opportunities:**
- Tasks 1, 2, 3 — all backend, independent
- Tasks 6, 7, 8, 9, 10 — all frontend, mostly independent (all depend on Task 5)

---

## Dependencies

| Task | Depends on |
|------|-----------|
| 1 | — |
| 2 | — |
| 3 | — |
| 4 | 1, 2, 3 |
| 5 | 1, 2, 3 |
| 6 | 5 |
| 7 | 5 |
| 8 | 5 |
| 9 | 5 |
| 10 | — (only uses auth context) |
