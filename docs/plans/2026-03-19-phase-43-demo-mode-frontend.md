# Phase 43: Demo Mode — Frontend (UI Badges, Reset Button)

## Overview
Add visual indicators for restricted features in demo mode, hide sensitive settings tabs, add admin reset button, and support local notes rendering for demo user.

## Tasks

### Task 1: Add `isDemo` to auth context
- **Description:** Add computed `isDemo: boolean` to `AuthContextType` interface and the auth context provider. This provides a single boolean for all components to check demo state.
- **Files:** `frontend/src/lib/auth.ts`, `frontend/src/components/auth-provider.tsx`
- **Acceptance Criteria:**
  - `AuthContextType` has `isDemo: boolean`
  - `isDemo` is `true` when `user?.role === "demo"`, `false` otherwise
  - Exposed from `useAuth()` hook
- **Verification:** `useAuth()` returns `isDemo: true` for demo user

### Task 2: Create `DemoModeBadge` component
- **Description:** Create a reusable badge component that replaces disabled feature buttons. Shows lock icon, "Demo Mode" title, and a brief description of what the feature does. Props: `feature` (string describing the integration type) and `description` (what the feature does).
- **Files:** `frontend/src/components/ui/demo-mode-badge.tsx`
- **Acceptance Criteria:**
  - Renders lock icon, "Demo Mode" heading
  - Shows feature name and description
  - Styled consistently with app design (border, muted background)
  - Compact variant available (for inline buttons)
- **Verification:** Component renders correctly in isolation

### Task 3: Apply DemoModeBadge to AI generation features
- **Description:** Add demo checks to Resume generation, ATS audit, Gap analysis, Cover Letter generation, and Job Match buttons. For demo users, replace or disable buttons and show DemoModeBadge.
- **Files:**
  - `frontend/src/components/jobs/resume-section.tsx` (generate, ATS audit, gap analysis)
  - `frontend/src/components/jobs/cover-letter-section.tsx` (generate)
  - Job detail page — match button (find where match is triggered)
- **Acceptance Criteria:**
  - "Generate Resume" button shows DemoModeBadge for demo user
  - "ATS Audit" and "Gap Analysis" buttons disabled for demo user
  - "Generate Cover Letter" button shows DemoModeBadge for demo
  - Job match button disabled for demo
  - Normal functionality preserved for admin/member
- **Verification:** Visual check + test
- **Depends on:** Tasks 1, 2

### Task 4: Apply DemoModeBadge to external job search
- **Description:** Replace the external search form in JobSearch component with DemoModeBadge for demo users. The "Auto" search button should also be disabled.
- **Files:** `frontend/src/components/jobs/job-search.tsx`
- **Acceptance Criteria:**
  - Search form hidden for demo user, replaced by DemoModeBadge
  - Auto search button disabled for demo
  - Existing job list/kanban still visible
- **Verification:** Visual check + test
- **Depends on:** Tasks 1, 2

### Task 5: Apply DemoModeBadge to Google Calendar sync
- **Description:** For demo users, hide or replace the GoogleConnect button and calendar sync functionality with DemoModeBadge. Local event CRUD remains available.
- **Files:**
  - `frontend/src/app/(dashboard)/calendar/page.tsx`
  - Google connect component (find and modify)
- **Acceptance Criteria:**
  - GoogleConnect button hidden/replaced for demo
  - Calendar sync not available for demo
  - Local event create/edit/delete still works
- **Verification:** Visual check
- **Depends on:** Tasks 1, 2

### Task 6: Apply DemoModeBadge to Pulse generation and sources
- **Description:** Disable "Generate Now" button on Pulse digests page for demo. On sources page, disable "Add Source" and poll buttons. Read-only viewing of existing digests/sources remains available.
- **Files:**
  - `frontend/src/app/(dashboard)/pulse/page.tsx` (generate button)
  - `frontend/src/app/(dashboard)/pulse/sources/page.tsx` (add source)
  - Pulse poll button component (if separate)
- **Acceptance Criteria:**
  - "Generate Now" shows DemoModeBadge for demo
  - "Add Source" disabled for demo
  - Poll button disabled for demo
  - Existing digests and inbox items viewable
  - Inbox actions (to_task, to_note, skip) still work for demo
- **Verification:** Visual check + test
- **Depends on:** Tasks 1, 2

### Task 7: Apply DemoModeBadge to Notes and Profile import
- **Description:** For demo users on Notes page: skip Google Drive check, show seeded notes directly, hide create/sync buttons. For Profile: hide "Import from text" button.
- **Files:**
  - `frontend/src/app/(dashboard)/notes/page.tsx`
  - `frontend/src/components/profile/profile-import-dialog.tsx`
- **Acceptance Criteria:**
  - Notes page shows seeded notes for demo (no Google Drive connection required)
  - Create note and sync buttons hidden for demo
  - Profile import button hidden or replaced with DemoModeBadge
- **Verification:** Demo user sees 4 pre-seeded notes
- **Depends on:** Tasks 1, 2

### Task 8: Filter Settings tabs for demo user
- **Description:** Hide sensitive tabs (AI & API Keys, Integrations, Telegram, Users) for demo user. Show only General and Tags tabs (same as member view).
- **Files:** `frontend/src/app/(dashboard)/settings/page.tsx`
- **Acceptance Criteria:**
  - Demo user sees only "General" and "Tags" tabs
  - No access to API keys, integrations, telegram credentials, user management
  - General tab allows editing job search preferences
- **Verification:** Visual check + test
- **Depends on:** Task 1

### Task 9: Update RoleBadge to support demo role
- **Description:** Update the RoleBadge component in profile page to display "Demo" with appropriate styling for demo users.
- **Files:** `frontend/src/app/(dashboard)/profile/page.tsx` (RoleBadge function)
- **Acceptance Criteria:**
  - RoleBadge shows "Demo" with distinct color for demo role
  - Admin and Member badges unchanged
- **Verification:** Visual check
- **Depends on:** Task 1

### Task 10: Add "Reset Demo Data" button for admin
- **Description:** Add a button in Settings → Users tab (admin only) that calls `POST /api/users/demo/reset`. Shows confirmation dialog before executing. Only visible when a demo user exists.
- **Files:**
  - `frontend/src/app/(dashboard)/settings/page.tsx` (or Users settings component)
  - `frontend/src/hooks/use-users.ts` (or new hook for reset mutation)
- **Acceptance Criteria:**
  - Button visible only to admin
  - Confirmation dialog before reset
  - Shows success/error toast
  - Button disabled during request
- **Verification:** Admin can reset demo data via UI
- **Depends on:** Task 1

### Task 11: Tests for demo mode UI
- **Description:** Write tests for DemoModeBadge component rendering, auth context isDemo flag, settings tab filtering, and demo checks on key components.
- **Files:** `frontend/src/__tests__/demo-mode.test.tsx`
- **Acceptance Criteria:**
  - Test DemoModeBadge renders with correct content
  - Test auth context returns isDemo: true for demo role
  - Test settings tabs filtered for demo user
  - Test restricted buttons show badge/disabled state
  - Minimum 12 test cases
- **Verification:** `npm test` all pass
- **Depends on:** Tasks 1-10

## Execution Order

```
Task 1 (auth context)
  ├→ Task 2 (DemoModeBadge component)
  │    ├→ Task 3 (AI generation badges)
  │    ├→ Task 4 (search badge)
  │    ├→ Task 5 (calendar badge)
  │    ├→ Task 6 (pulse badges)
  │    └→ Task 7 (notes + profile import)
  ├→ Task 8 (settings tabs)
  ├→ Task 9 (role badge)
  └→ Task 10 (reset button)
       └→ Task 11 (tests)
```

## Summary
- **11 tasks**
- New files: `demo-mode-badge.tsx`, `demo-mode.test.tsx`
- Modified files: ~12 existing files
- All changes are frontend-only (TypeScript/React)
- No new API endpoints needed (backend done in Phase 42)
