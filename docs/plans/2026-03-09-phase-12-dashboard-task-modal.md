# Phase 12: Dashboard — Quick Actions Removal & Task Creation Modal

## Overview
Remove Quick Actions sidebar from dashboard, stretch Recent Activity to full width, and convert the "+ New Task" header button to open a TaskDialog modal with redirect to /tasks on success.

## Tasks

### Task 1: Add `onSuccess` callback to TaskDialog
**File:** `frontend/src/components/tasks/task-dialog.tsx`
**Changes:**
- Add optional `onSuccess?: () => void` prop to `TaskDialogProps`
- In `handleSubmit`, call `onSuccess?.()` after successful mutation, before `onClose()`
- This allows the dashboard to redirect on task creation without affecting existing edit/cancel flows

**Acceptance Criteria:**
- [ ] TaskDialog accepts optional `onSuccess` callback
- [ ] `onSuccess` is called only after successful create/update, not on cancel
- [ ] Existing TaskDialog usage on /tasks page is unaffected (no `onSuccess` passed)

### Task 2: Convert dashboard page to client component with modal
**File:** `frontend/src/app/(dashboard)/page.tsx`
**Changes:**
- Add `"use client"` directive
- Import `useState` from React, `useRouter` from `next/navigation`
- Import `TaskDialog` from `@/components/tasks/task-dialog`
- Remove `QuickActions` import
- Add `showCreateDialog` state (boolean, default false)
- Replace `<Link href="/tasks">` with `<button onClick={() => setShowCreateDialog(true)}>` (keep same styling)
- Remove the 2-column grid wrapper (`lg:grid-cols-[1fr_260px]`), render `<RecentActivity />` directly
- Remove `<QuickActions />`
- Render `<TaskDialog>` conditionally when `showCreateDialog` is true, with `onSuccess={() => router.push("/tasks")}` and `onClose={() => setShowCreateDialog(false)}`

**Acceptance Criteria:**
- [ ] Quick Actions block is gone from dashboard
- [ ] Recent Activity spans full content width
- [ ] "+ New Task" button opens TaskDialog modal
- [ ] After successful task creation, user is redirected to /tasks
- [ ] Closing/canceling the modal does NOT redirect

### Task 3: Delete quick-actions.tsx
**File:** `frontend/src/components/dashboard/quick-actions.tsx`
**Changes:**
- Delete the file entirely (no longer imported anywhere)

**Acceptance Criteria:**
- [ ] File is deleted
- [ ] No remaining imports of QuickActions in the codebase
- [ ] Frontend builds without errors

## Verification
```bash
npm run build   # no build errors
npm run lint    # no new lint errors
```
Manual: open dashboard → "+ New Task" → fill form → create → redirected to /tasks → task visible.
