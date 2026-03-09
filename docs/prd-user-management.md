# PRD: User Management & Access Control

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P0 |
| Type | Feature |

## Problem Statement

The personal hub currently has a hardcoded single-user setup. There is no UI to manage users — no way to add new members, change passwords from the interface, assign roles, or control data visibility. The system needs to become a **family portal** where an admin can create user accounts, each person owns their data, and shared/private visibility is enforced. No email infrastructure — admin creates accounts manually and shares credentials directly.

## Current State

### What exists
- JWT-based email+password authentication (login, change-password)
- `users` table with `email`, `password_hash`, `role` (admin/user), `display_name`, `must_change_password`
- `POST /api/auth/register` endpoint (admin-only, returns temp password)
- `require_admin()` dependency guard
- Per-user settings (`user_settings` table) with encrypted API keys
- Tasks already have `created_by_id` and `assignee_id` fields
- All data tables have `user_id` FK

### What's missing
- No user management UI (admin panel)
- No user profile page (name, avatar, theme)
- No visibility system (`family`/`private`) on data records
- No backend filtering by owner + visibility
- No restrictions on Settings sections by role
- Role label `user` should be renamed to `member` for clarity

## User Scenarios

### Scenario 1: Admin creates a new family member account
**As an** admin, **I want to** create a new user account with a temporary password, **so that** a new family member can access the portal.

**Flow:**
1. Admin opens Settings → User Management section
2. Clicks "Add User"
3. Fills in form: display name, email (login), temporary password, role (admin/member)
4. System creates the account with `must_change_password=true`
5. Admin shares credentials with the new member directly (verbally, messenger, etc.)
6. New member logs in with temp password, is forced to change it on first login

### Scenario 2: Member changes their password
**As a** member, **I want to** change my password from my profile page, **so that** I can maintain account security.

**Flow:**
1. Member clicks on their avatar in the sidebar → Profile
2. Enters current password and new password
3. Password is updated

### Scenario 3: Admin manages users
**As an** admin, **I want to** view all users, change their roles, and block/unblock accounts, **so that** I can control portal access.

**Flow:**
1. Admin opens Settings → User Management
2. Sees a table of all users with: name, email, role, status, last login
3. Can change role (admin ↔ member)
4. Can block/unblock a user (blocked user cannot log in)
5. Can reset a user's password (generates new temp password)

### Scenario 4: Visibility-based data access
**As a** member, **I want to** see family-shared tasks and calendar events alongside my own, **so that** I can coordinate with my family.

**Flow:**
1. Member opens Tasks page
2. Sees: own tasks (any visibility) + other users' tasks with `visibility=family`
3. Can edit only own tasks
4. Cannot see other users' `visibility=private` tasks
5. Jobs/applications are always private per user

### Scenario 5: Admin sees everything
**As an** admin, **I want to** see all data from all users including private records, **so that** I have full control over the portal.

**Flow:**
1. Admin opens any data page (Tasks, Calendar, Jobs)
2. Sees all records from all users, including private ones
3. Can edit and delete any record

### Scenario 6: Member views their profile
**As a** member, **I want to** see and edit my profile (name, theme preference), **so that** I can personalize my experience.

**Flow:**
1. Member clicks avatar in sidebar
2. Opens profile page with: display name, email (read-only), avatar (auto-generated initials), role (read-only), theme toggle
3. Can update display name and theme preference

## Functional Requirements

### P0 (Must Have)

#### User Management (Admin)
- [ ] FR-1: Admin can view a list of all users (name, email, role, status, created date)
- [ ] FR-2: Admin can create a new user via form (display_name, email, temporary password, role) → account created with `must_change_password=true`
- [ ] FR-3: Admin can change a user's role (admin ↔ member)
- [ ] FR-4: Admin can block/unblock a user (blocked users cannot log in)
- [ ] FR-5: Admin can reset a user's password (generates new temp password, sets `must_change_password=true`)

#### Role System
- [ ] FR-6: Rename role `user` to `member` across backend and frontend
- [ ] FR-7: Two roles: `admin` (full access) and `member` (restricted access)
- [ ] FR-8: Settings page: AI Provider and Job Search API Keys sections visible only to admin
- [ ] FR-9: Settings page: Job Search settings (target roles, location, etc.) visible only to admin

#### Visibility System
- [ ] FR-10: Add `visibility` field to `tasks` table (enum: `family`/`private`, default: `family`)
- [ ] FR-11: Add `visibility` field to `calendar_events` table (enum: `family`/`private`, default: `family`)
- [ ] FR-12: Jobs and applications remain strictly private per user (no visibility field needed, filter by `user_id` only)
- [ ] FR-13: Backend query filters: member sees own records + others' `family` records; admin sees all
- [ ] FR-14: Member can only edit/delete own records; admin can edit/delete any

#### User Profile
- [ ] FR-15: Profile page accessible from sidebar avatar click
- [ ] FR-16: Profile shows: display name (editable), email (read-only), role (read-only), avatar (auto-generated initials in colored circle)
- [ ] FR-17: Change password from profile page (current + new password)
- [ ] FR-18: Theme preference (light/dark) stored in user profile and applied globally

#### Auth Enhancements
- [ ] FR-19: Add `is_blocked` field to users table; blocked users get 403 on login
- [ ] FR-20: Add `last_login_at` field to users table; updated on each successful login
- [ ] FR-21: Store `theme` preference in users table (enum: `light`/`dark`, default: `dark`)

### P1 (Should Have)
- [ ] FR-22: User Management table has search/filter by role and status
- [ ] FR-23: Visual indicator in sidebar showing current user name and avatar
- [ ] FR-24: Visibility toggle (family/private) on task and event creation/edit forms
- [ ] FR-25: Show owner name on family-visible records created by other users

### P2 (Nice to Have)
- [ ] FR-26: Activity log for admin actions (user created, role changed, password reset)

## Non-Functional Requirements

- **Security:** Passwords hashed with bcrypt (existing). Blocked users rejected at login, not just at API level.
- **Performance:** User list is small (family portal, <20 users) — no pagination needed.
- **Migration Safety:** Role rename (`user` → `member`) must be backward-compatible. Existing users with role `user` must be migrated to `member`.
- **Data Integrity:** Adding `visibility` to existing records must default to `family` for tasks/events. No data loss during migration.

## Technical Design

### Stack (existing)
- Backend: FastAPI (Python), PostgreSQL, SQLAlchemy async
- Frontend: Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui
- Auth: JWT (HS256), bcrypt passwords, Fernet-encrypted API keys

### Database Changes

#### `users` table — alter
```sql
-- Rename role enum value: 'user' → 'member'
ALTER TYPE userrole RENAME VALUE 'user' TO 'member';

-- Add new columns
ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'dark';
```

#### `tasks` table — alter
```sql
-- Add visibility enum type and column
CREATE TYPE visibility AS ENUM ('family', 'private');
ALTER TABLE tasks ADD COLUMN visibility visibility DEFAULT 'family';
```

#### `calendar_events` table — alter
```sql
ALTER TABLE calendar_events ADD COLUMN visibility visibility DEFAULT 'family';
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/` | Admin | List all users |
| POST | `/api/users/` | Admin | Create new user (manual) |
| GET | `/api/users/{id}` | Admin | Get user details |
| PUT | `/api/users/{id}` | Admin | Update user (role, block) |
| POST | `/api/users/{id}/reset-password` | Admin | Reset password → temp |
| GET | `/api/profile/` | Any | Get own profile |
| PUT | `/api/profile/` | Any | Update own profile (name, theme) |
| PUT | `/api/profile/password` | Any | Change own password |

### Frontend Pages

| Page | Route | Access |
|------|-------|--------|
| User Management | `/settings` (new tab/section) | Admin only |
| User Profile | `/profile` | All authenticated |

### Data Access Pattern

```
# Pseudocode for visibility filtering
def get_tasks(current_user):
    if current_user.role == 'admin':
        return all_tasks  # See everything
    else:
        return tasks.where(
            (task.user_id == current_user.id) |  # Own tasks
            (task.visibility == 'family')          # Others' family tasks
        )

def can_edit(record, current_user):
    if current_user.role == 'admin':
        return True
    return record.user_id == current_user.id  # Only own records
```

## Out of Scope
- Billing / subscriptions
- Two-factor authentication (2FA)
- Multi-tenancy (isolated workspaces)
- OAuth / SSO / external auth providers
- Email sending (SMTP integration)
- Self-registration (sign-up page)
- Granular permissions beyond admin/member
- File/photo upload for avatars

## Acceptance Criteria
- [ ] AC-1: Admin can create a new user via form (name, email, temp password, role) and the new user can log in and is forced to change password
- [ ] AC-2: Admin can view, edit roles, block/unblock, and reset passwords for all users
- [ ] AC-3: Blocked user cannot log in (receives clear error message)
- [ ] AC-4: Member sees own tasks + family tasks from others; cannot see others' private tasks
- [ ] AC-5: Member sees only own jobs and applications (always private)
- [ ] AC-6: Admin sees all data from all users including private records
- [ ] AC-7: Member can only edit/delete own records
- [ ] AC-8: Admin can edit/delete any record
- [ ] AC-9: Profile page allows changing name, theme, and password
- [ ] AC-10: Settings: AI Provider and API Keys sections hidden for members
- [ ] AC-11: Role `user` migrated to `member` without breaking existing auth
- [ ] AC-12: Existing tasks and events get `visibility=family` by default after migration

## Implementation Phases

### Phase 7: Role System & Database Migration
Foundation — DB migration, role rename, visibility fields, auth hardening.
- Rename role `user` → `member` (enum migration)
- Add `is_blocked`, `last_login_at`, `theme` to `users`
- Add `visibility` enum + column to `tasks` and `calendar_events`
- Update backend models, security (block check, last_login_at tracking)
- Migration script with safe defaults
- FR covered: FR-6, FR-7, FR-10, FR-11, FR-19, FR-20, FR-21

### Phase 8: User Management & Profile
Admin panel + user profile page.
- Backend: CRUD API for users, profile API, reset password
- Frontend: User Management section in Settings (table, create form, actions)
- Frontend: Profile page (name, avatar initials, theme, change password)
- Frontend: Avatar component in sidebar
- Settings: hide AI/API sections for member
- FR covered: FR-1, FR-2, FR-3, FR-4, FR-5, FR-8, FR-9, FR-15, FR-16, FR-17, FR-18, FR-22, FR-23

### Phase 9: Visibility & Access Control
Data visibility enforcement + owner-based access control.
- Backend: visibility-aware query filters for tasks and calendar_events
- Backend: owner-based edit/delete restrictions for members
- Backend: admin bypass (sees and edits everything)
- Backend: jobs/applications strict user_id filter
- Frontend: visibility toggle on task/event forms
- Frontend: owner name on other users' records, edit/delete restrictions
- FR covered: FR-12, FR-13, FR-14, FR-24, FR-25

## Open Questions
- None at this time — all requirements clarified during discovery.
