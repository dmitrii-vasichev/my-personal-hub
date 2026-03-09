# PRD: Dashboard — Quick Actions Removal & Task Creation Modal

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P0 |

## Problem Statement
The Quick Actions sidebar on the dashboard provides minimal value — it's just 3 navigation links that duplicate existing sidebar navigation. It takes up 260px of horizontal space, compressing the Recent Activity feed. Meanwhile, the "+ New Task" button in the dashboard header navigates away to /tasks instead of allowing inline task creation.

## User Scenarios
### Scenario 1: Quick Task Creation from Dashboard
**As a** user viewing the dashboard, **I want to** create a task without leaving the dashboard, **so that** I can quickly capture a to-do and continue reviewing my dashboard.

### Scenario 2: Full-Width Activity Feed
**As a** user reviewing recent activity, **I want to** see the activity feed at full content width, **so that** I have more space to scan recent items.

## Functional Requirements

### P0 (Must Have)
- [ ] FR-1: Remove the Quick Actions component from the dashboard layout
- [ ] FR-2: Change the dashboard content area from 2-column grid (`lg:grid-cols-[1fr_260px]`) to single-column layout — Recent Activity stretches to full content width
- [ ] FR-3: Convert the "+ New Task" button in the dashboard header from a `<Link>` to a `<button>` that opens the existing TaskDialog modal
- [ ] FR-4: After successful task creation in the modal, redirect the user to the /tasks page

## Non-Functional Requirements
- Reuse the existing TaskDialog component from `src/components/tasks/task-dialog.tsx` — no new form UI
- Reuse the existing Dialog UI primitives from `src/components/ui/dialog.tsx`
- No changes to the backend API — task creation endpoint remains the same
- Maintain current responsive behavior for summary cards and activity feed

## Technical Design
### Stack
- Next.js (existing), React, TypeScript, Tailwind CSS
- Existing components: TaskDialog, Dialog UI, RecentActivity, SummaryCards

### Approach
1. Dashboard page (`src/app/(dashboard)/page.tsx`) becomes a client component (needs state for modal open/close and router for redirect)
2. Remove `<QuickActions />` import and rendering
3. Remove the 2-column grid wrapper — RecentActivity renders directly in single-column flow
4. Replace `<Link href="/tasks">` button with `<button onClick>` that sets modal open state
5. Render `<TaskDialog open={...} onOpenChange={...} mode="create" onSuccess={() => router.push('/tasks')} />`
6. TaskDialog already supports `onSuccess` callback — use it for redirect

### Files Changed
| File | Change |
|------|--------|
| `src/app/(dashboard)/page.tsx` | Convert to client component, add modal state, replace Link with button, remove QuickActions, flatten grid |
| `src/components/dashboard/quick-actions.tsx` | Delete file |

## Out of Scope
- Changing the task creation form fields
- Modifying the Recent Activity component internals
- Changing summary cards layout
- Backend API changes

## Acceptance Criteria
- [ ] AC-1: Quick Actions block is not rendered on the dashboard
- [ ] AC-2: Recent Activity section spans the full content width (no right sidebar gap)
- [ ] AC-3: Clicking "+ New Task" in the dashboard header opens the TaskDialog modal
- [ ] AC-4: Successfully creating a task in the modal redirects to /tasks
- [ ] AC-5: The task is persisted (visible on the /tasks page after redirect)
- [ ] AC-6: Frontend builds without errors
