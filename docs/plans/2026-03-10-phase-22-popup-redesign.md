# Phase 22: Popup & Overlay UI Redesign

## Overview
Replace all native browser dialogs and unstyled tooltips with custom themed components.

## Dependencies
- @base-ui/react (Dialog, Tooltip primitives — already installed)
- Existing `ui/dialog.tsx` component

---

## Task 1: Create shared ConfirmDialog component

**File:** `src/components/ui/confirm-dialog.tsx` (new)

**Description:**
Create a reusable confirmation dialog built on the existing Dialog primitives from `ui/dialog.tsx`.

**Props interface:**
```ts
interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;   // default: "Confirm"
  cancelLabel?: string;    // default: "Cancel"
  variant?: "default" | "danger";  // default: "default"
  loading?: boolean;       // disable buttons while action runs
}
```

**Behavior:**
- Uses Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogDescription from `ui/dialog.tsx`
- Escape key → cancel
- Backdrop click → cancel
- Enter key → confirm
- Focus trapped inside
- `danger` variant: red confirm button (`--danger` bg, white text)
- `default` variant: accent confirm button (`--accent` bg, white text)
- Max-width: `max-w-sm` (384px)
- Cancel button: ghost style

**Acceptance Criteria:**
- [ ] Component renders with correct styling (14px radius, surface bg, border)
- [ ] Keyboard: Escape closes, Enter confirms
- [ ] Both variants (default, danger) render correctly
- [ ] Works in dark and light themes
- [ ] `loading` prop disables both buttons

**Verification:** Storybook-style render test + visual check

---

## Task 2: Replace confirm() in job-detail.tsx

**File:** `src/components/jobs/job-detail.tsx` (line ~74)

**Description:**
Replace `if (!confirm(...)) return;` with ConfirmDialog state pattern.

**Changes:**
1. Add `const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);`
2. Change `handleDelete` to just set `setShowDeleteConfirm(true)`
3. Move actual delete logic to `confirmDelete` callback
4. Render `<ConfirmDialog>` with variant="danger", title="Delete Job", description with job title/company

**Acceptance Criteria:**
- [ ] No native `confirm()` call
- [ ] Styled dialog appears on delete click
- [ ] Confirm triggers deletion, cancel dismisses
- [ ] Job title shown in dialog description

**Verification:** Click delete button on job detail page → styled dialog appears

---

## Task 3: Replace confirm() in tasks/[id]/page.tsx

**File:** `src/app/(dashboard)/tasks/[id]/page.tsx` (line ~95)

**Description:**
Same pattern as Task 2. Replace native confirm with ConfirmDialog.

**Changes:**
1. Add `showDeleteConfirm` state
2. Render ConfirmDialog with variant="danger"
3. Title: "Delete Task", description: "This action cannot be undone."

**Acceptance Criteria:**
- [ ] No native `confirm()` call
- [ ] Styled confirmation dialog
- [ ] Delete proceeds only on confirm

**Verification:** Click delete button on task detail → styled dialog

---

## Task 4: Replace confirm() in calendar/[id]/page.tsx

**File:** `src/app/(dashboard)/calendar/[id]/page.tsx` (line ~25)

**Description:**
Same pattern. Replace native confirm for event deletion.

**Changes:**
1. Add `showDeleteConfirm` state
2. ConfirmDialog variant="danger", title="Delete Event"

**Acceptance Criteria:**
- [ ] No native `confirm()` call
- [ ] Styled dialog for event deletion

**Verification:** Click delete on event detail → styled dialog

---

## Task 5: Replace confirm() in google-connect.tsx

**File:** `src/components/calendar/google-connect.tsx` (line ~63)

**Description:**
Replace native confirm for Google Calendar disconnect.

**Changes:**
1. Add `showDisconnectConfirm` state
2. ConfirmDialog variant="default" (not destructive, just disconnect), title="Disconnect Google Calendar", description="Local events will remain."

**Acceptance Criteria:**
- [ ] No native `confirm()` call
- [ ] Styled dialog for disconnect action

**Verification:** Click disconnect → styled dialog

---

## Task 6: Replace confirm() in event-notes.tsx

**File:** `src/components/calendar/event-notes.tsx` (line ~39)

**Description:**
Replace native confirm for note deletion.

**Changes:**
1. Add `showDeleteConfirm` state
2. ConfirmDialog variant="danger", title="Delete Note"

**Acceptance Criteria:**
- [ ] No native `confirm()` call
- [ ] Styled dialog for note deletion

**Verification:** Click delete note → styled dialog

---

## Task 7: Migrate local ConfirmDialog in user-actions-menu.tsx

**File:** `src/components/settings/user-actions-menu.tsx` (lines 14-49)

**Description:**
Remove local `ConfirmDialog` and `TempPasswordDialog` implementations. Use the shared ConfirmDialog from `ui/confirm-dialog.tsx`. Keep `TempPasswordDialog` but migrate it to use Dialog primitives from `ui/dialog.tsx`.

**Changes:**
1. Remove local `ConfirmDialog` component (lines 14-49)
2. Import shared `ConfirmDialog` from `@/components/ui/confirm-dialog`
3. Update usages — props are nearly identical, just add `open` prop
4. Migrate `TempPasswordDialog` to use Dialog/DialogPortal/DialogBackdrop/DialogPopup

**Acceptance Criteria:**
- [ ] No local ConfirmDialog definition
- [ ] All 4 confirm dialogs (role, block, unblock, delete) use shared component
- [ ] TempPasswordDialog uses Dialog primitives
- [ ] Identical visual behavior

**Verification:** Test all actions in user menu (role change, block, delete, reset password)

---

## Task 8: Migrate EventDialog to Dialog primitive

**File:** `src/components/calendar/event-dialog.tsx` (lines 106-234)

**Description:**
Replace manual `<div className="fixed inset-0 z-50 ...">` overlay with Dialog/DialogPortal/DialogBackdrop/DialogPopup components. Fix border radius from `rounded-lg` (8px) to `rounded-[14px]`.

**Changes:**
1. Import Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogClose from `ui/dialog.tsx`
2. Replace manual overlay with `<Dialog open={open} onOpenChange={...}>` + DialogPortal + DialogBackdrop + DialogPopup
3. Remove manual close button, use DialogClose
4. Keep form content unchanged
5. Border radius becomes 14px via DialogPopup default styling

**Acceptance Criteria:**
- [ ] Uses Dialog component, not manual HTML
- [ ] Border radius = 14px
- [ ] Backdrop = 60% black
- [ ] All form functionality preserved (create + edit modes)
- [ ] Escape and backdrop click close dialog

**Verification:** Open new event dialog → same functionality, 14px radius, proper animations

---

## Task 9: Migrate CreateUserDialog to Dialog primitive

**File:** `src/components/settings/create-user-dialog.tsx` (lines 67-144)

**Description:**
Replace manual overlay with Dialog primitives. Note: this file already imports `Dialog` but doesn't use it for the overlay.

**Changes:**
1. Use Dialog with `open` prop, DialogPortal, DialogBackdrop, DialogPopup
2. Remove manual `<div className="fixed inset-0 z-50 ...">` wrapper
3. Remove `if (!open) return null;` — Dialog handles this
4. Keep both states (form + temp password display) inside DialogPopup

**Acceptance Criteria:**
- [ ] Uses Dialog component
- [ ] Both states (create form, password display) work
- [ ] Escape and backdrop click close dialog
- [ ] Reset form on close

**Verification:** Open Add User dialog → create user → see temp password → close → reopen → form is reset

---

## Task 10: Create Tooltip component

**File:** `src/components/ui/tooltip.tsx` (new)

**Description:**
Create a reusable Tooltip component using @base-ui/react Tooltip primitive.

**Props interface:**
```ts
interface TooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";  // default: "top"
  children: React.ReactElement;
}
```

**Styling:**
- Background: `--surface-2`
- Border: 1px solid `--border`
- Border radius: 6px
- Font: 12px, `--text-primary`
- Padding: 4px 8px
- Shadow: `shadow-md`
- Z-index: 100
- Appear delay: ~300ms
- Animation: fade in (opacity 0→1)

**Implementation:**
```tsx
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
// Use TooltipPrimitive.Root, .Trigger, .Portal, .Positioner, .Popup
```

**Acceptance Criteria:**
- [ ] Tooltip appears on hover after ~300ms delay
- [ ] Tooltip positioned correctly (top/bottom/left/right)
- [ ] Styled per design brief (surface-2 bg, border, 6px radius)
- [ ] Works in dark and light themes
- [ ] Disappears on mouse leave

**Verification:** Wrap an icon with Tooltip, hover → styled tooltip appears

---

## Task 11: Replace all native title attributes with Tooltip

**Files (11 instances):**
1. `src/components/ui/avatar.tsx` — avatar title
2. `src/components/ui/collapsible-description.tsx` — edit button title
3. `src/components/ui/inline-edit-salary.tsx` — save/cancel titles
4. `src/components/ui/inline-edit-tags.tsx` — save/cancel titles
5. `src/components/ui/inline-edit-date.tsx` — clear title
6. `src/components/settings/user-actions-menu.tsx` — dialog action titles (if any remain)
7. `src/components/tasks/task-card.tsx` — visibility and owner titles
8. `src/components/calendar/event-pill.tsx` — event and private icon titles
9. `src/components/layout/header.tsx` — profile link title
10. `src/components/layout/sidebar.tsx` — collapsed nav items titles
11. `src/components/jobs/job-search.tsx` — auto-search and limit titles
12. `src/components/settings/create-user-dialog.tsx` — copy password title

**Changes for each:**
1. Import `Tooltip` from `@/components/ui/tooltip`
2. Remove `title="..."` attribute
3. Wrap element with `<Tooltip content="...">...</Tooltip>`

**Acceptance Criteria:**
- [ ] Zero `title="..."` attributes used for UI hints in the codebase
- [ ] All replaced with styled Tooltip component
- [ ] Tooltips appear correctly positioned
- [ ] No layout shift from wrapping

**Verification:** `grep -r 'title=' src/components/ | grep -v 'DialogTitle\|htmlFor\|className'` returns no UI hint titles

---

## Execution Order

Tasks 1 and 10 are independent (new components) → can be done first/in parallel.
Tasks 2-6 depend on Task 1.
Task 7 depends on Task 1.
Tasks 8-9 are independent of each other.
Task 11 depends on Task 10.

Recommended order: 1 → 2-7 → 8-9 → 10 → 11

## Estimated Total: 11 tasks
