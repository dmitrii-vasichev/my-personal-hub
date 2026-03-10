# PRD: Popup & Overlay UI Redesign

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-10 |
| Status | Approved |
| Priority | P0 |

## Problem Statement
The application uses native browser `confirm()` dialogs in 5 places (task deletion, job deletion, event deletion, note deletion, Google Calendar disconnect). These break the visual consistency of the dark-themed UI. Additionally, 2 dialog components (EventDialog, CreateUserDialog) bypass the reusable Dialog primitive and use manual HTML overlays. Finally, ~11 tooltip instances use native `title` attributes which render as unstyled browser tooltips, inconsistent with the design system.

## User Scenarios

### Scenario 1: Destructive Action Confirmation
**As a** user, **I want to** see a styled confirmation dialog when deleting items, **so that** the experience feels polished and consistent with the rest of the app.

### Scenario 2: Consistent Dialog Experience
**As a** user, **I want to** have all modals look and behave identically (animation, backdrop, radius, close behavior), **so that** the app feels cohesive.

### Scenario 3: Styled Tooltips
**As a** user, **I want to** see styled tooltips that match the dark/light theme, **so that** hover hints look intentional rather than browser-default.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: Create reusable `ConfirmDialog` component using @base-ui/react Dialog primitive
  - Props: `open`, `onConfirm`, `onCancel`, `title`, `description`, `confirmLabel`, `cancelLabel`, `variant` (danger | default)
  - Danger variant: red confirm button for destructive actions
  - Default variant: accent-colored confirm button
  - Follows design brief: 14px radius, `--surface` bg, `--border` border, 60% black overlay
  - Keyboard: Escape to cancel, Enter to confirm
  - Focus trap inside dialog

- [ ] FR-2: Replace native `confirm()` in job-detail.tsx with ConfirmDialog
- [ ] FR-3: Replace native `confirm()` in tasks/[id]/page.tsx with ConfirmDialog
- [ ] FR-4: Replace native `confirm()` in calendar/[id]/page.tsx with ConfirmDialog
- [ ] FR-5: Replace native `confirm()` in google-connect.tsx with ConfirmDialog
- [ ] FR-6: Replace native `confirm()` in event-notes.tsx with ConfirmDialog

- [ ] FR-7: Migrate EventDialog (calendar/event-dialog.tsx) to use Dialog base component
  - Fix border radius from 8px to 14px
  - Keep all existing functionality

- [ ] FR-8: Migrate CreateUserDialog (settings/create-user-dialog.tsx) to use Dialog base component
  - Keep all existing functionality

- [ ] FR-9: Migrate local ConfirmDialog from user-actions-menu.tsx to use the new shared ConfirmDialog component

- [ ] FR-10: Create reusable `Tooltip` component using @base-ui/react Tooltip primitive
  - Props: `content`, `side` (top | bottom | left | right), `children`
  - Styling: `--surface-2` bg, `--border` border, 6px radius, 12px font, `--text-primary` text
  - Appears on hover with ~300ms delay
  - Follows theme (dark/light)

- [ ] FR-11: Replace all native `title` attributes with Tooltip component (~11 instances)

### P1 (Nice to Have)

- [ ] FR-12: Add subtle enter/exit animation to ConfirmDialog (fade + scale, matching existing dialog animations)
- [ ] FR-13: Add arrow pointer to Tooltip component

## Non-Functional Requirements
- Performance: Tooltip and ConfirmDialog must not cause layout shift or jank
- Accessibility: Focus trap in ConfirmDialog, aria-labels on Tooltip, Escape to dismiss both
- Theme: Must work in both dark and light modes using CSS custom properties

## Technical Design

### Stack
- @base-ui/react Dialog primitive (already in project)
- @base-ui/react Tooltip primitive (already available in @base-ui/react)
- Tailwind CSS for styling
- CSS custom properties for theming

### Component Architecture
```
src/components/ui/confirm-dialog.tsx   — new shared component
src/components/ui/tooltip.tsx          — new shared component
```

### Migration Strategy
- ConfirmDialog: each consumer manages its own `open` state, passes callbacks
- Tooltip: wrap existing elements, move `title` text to `content` prop
- EventDialog & CreateUserDialog: swap manual HTML overlay for Dialog/DialogPortal/DialogBackdrop/DialogPopup

## Out of Scope
- Toast redesign (already compliant with Sonner)
- Popover redesign (already compliant)
- New dropdown/menu component
- Inline editing components (not floating elements)

## Acceptance Criteria
- [ ] AC-1: Zero native `confirm()`, `alert()`, or `prompt()` calls in the codebase
- [ ] AC-2: All dialogs use the shared Dialog primitive from ui/dialog.tsx
- [ ] AC-3: All tooltips use the shared Tooltip component (no `title` attributes for UI hints)
- [ ] AC-4: ConfirmDialog works with keyboard (Escape, Enter)
- [ ] AC-5: Both themes (dark/light) render correctly for all new components
- [ ] AC-6: No visual regressions in existing dialogs

## Implementation Phases

### Phase 22: Popup & Overlay UI Redesign (single phase)

| # | Task | Description |
|---|------|-------------|
| 1 | ConfirmDialog component | Create `ui/confirm-dialog.tsx` using @base-ui/react Dialog primitive |
| 2 | Replace confirm() in job-detail | Replace native confirm in job-detail.tsx |
| 3 | Replace confirm() in task detail | Replace native confirm in tasks/[id]/page.tsx |
| 4 | Replace confirm() in calendar event | Replace native confirm in calendar/[id]/page.tsx |
| 5 | Replace confirm() in google-connect | Replace native confirm in google-connect.tsx |
| 6 | Replace confirm() in event-notes | Replace native confirm in event-notes.tsx |
| 7 | Migrate user-actions-menu ConfirmDialog | Replace local ConfirmDialog with shared component |
| 8 | Migrate EventDialog to Dialog primitive | Convert to base Dialog component, fix radius to 14px |
| 9 | Migrate CreateUserDialog to Dialog primitive | Convert to base Dialog component |
| 10 | Tooltip component | Create `ui/tooltip.tsx` using @base-ui/react Tooltip primitive |
| 11 | Replace all title attributes | Replace ~11 native title attrs with Tooltip component |

## Open Questions
- None
