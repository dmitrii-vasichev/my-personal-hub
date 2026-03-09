# PRD: UX Interactions Polish

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P0 |

## Problem Statement
Several UX interaction issues degrade the user experience across the application:
1. **Kanban card click zone is too narrow** — only the task title (Link) is clickable, users expect the entire card to navigate to task details.
2. **Kanban card drag zone is too narrow** — drag listeners are only on the small GripVertical icon, making it hard to grab cards for reordering.
3. **Buttons lack pointer cursor** — hovering over buttons does not show the hand cursor, making them feel non-interactive.
4. **Native date inputs** — browser-default date/datetime pickers look inconsistent with the app's design system. They should be replaced with custom, themed date pickers.

## User Scenarios

### Scenario 1: Click anywhere on Kanban card
**As a** user viewing the Kanban board, **I want to** click anywhere on a task card to open task details, **so that** I don't have to precisely aim at the title text.

### Scenario 2: Drag card from anywhere
**As a** user managing tasks on Kanban, **I want to** grab and drag a card from any point on the card, **so that** I can quickly reorganize tasks without hunting for the drag handle.

### Scenario 3: Visual button feedback
**As a** user interacting with buttons, **I want to** see the pointer cursor when hovering over any button, **so that** I know the element is clickable.

### Scenario 4: Themed date pickers
**As a** user filling in dates (deadlines, reminders, event times, job application dates), **I want to** use a styled, in-app calendar popup instead of the browser's native date picker, **so that** the experience feels cohesive and polished.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: Entire Kanban task card is clickable — navigates to `/tasks/{id}` on click
- [ ] FR-2: Entire Kanban task card is draggable — drag can initiate from any point on the card (not just the grip icon). Click vs drag differentiation via dnd-kit `distance: 8` activation constraint (existing behavior).
- [ ] FR-3: All `<Button>` components display `cursor: pointer` on hover (also applies to icon buttons, ghost buttons, etc.)
- [ ] FR-4: All interactive elements (links, buttons, clickable cards, checkboxes, selects) have appropriate cursor styles
- [ ] FR-5: Replace native `type="date"` inputs with a custom DatePicker component (Popover + Calendar from `react-day-picker`)
- [ ] FR-6: Replace native `type="datetime-local"` inputs with custom DatePicker + time input
- [ ] FR-7: DatePicker component supports: single date selection, clear button, placeholder text, overdue highlight styling

### P1 (Should Have)

- [ ] FR-8: DatePicker supports manual keyboard date entry (DD.MM.YYYY format)
- [ ] FR-9: Calendar component follows the app's design system (colors, border-radius, typography from design-brief.md)

## Non-Functional Requirements
- Performance: No additional JS bundle size beyond `react-day-picker` + `date-fns`
- Accessibility: DatePicker must be keyboard-navigable
- Consistency: All date inputs across the app use the same component

## Technical Design

### Stack
- `react-day-picker` (v9+) — calendar UI
- `date-fns` — date formatting/parsing (already a dependency of react-day-picker)
- Existing: `@dnd-kit/core`, `@base-ui/react`, Tailwind CSS v4

### Architecture

#### 1. Kanban Card (task-card.tsx)
- Wrap entire card content in a clickable container (not `<Link>` to avoid nesting issues with drag)
- Use `onClick` with `router.push()`, guarded by `if (transform) return` to prevent navigation during drag
- Move `{...listeners}` and `{...attributes}` from the grip icon to the outer `<div>`
- Keep grip icon as visual indicator only (no separate listeners)
- Add `cursor-pointer` to the card, `cursor-grab` on hover, `cursor-grabbing` while dragging

#### 2. Button cursor (button.tsx + globals.css)
- Add `cursor-pointer` to the base styles in `buttonVariants` cva definition
- Also add global CSS rule for interactive elements as safety net

#### 3. DatePicker components
- Create `components/ui/calendar.tsx` — styled `react-day-picker` DayPicker
- Create `components/ui/date-picker.tsx` — Popover + Calendar + manual input
- Create `components/ui/date-time-picker.tsx` — DatePicker + time input field

#### 4. Files to update with new DatePicker
| File | Fields | Picker type |
|------|--------|-------------|
| `tasks/task-dialog.tsx` | deadline, reminder_at | date, datetime |
| `jobs/application-edit-dialog.tsx` | applied_date, next_action_date | date, date |
| `tasks/task-filters.tsx` | deadline_before | date |
| `calendar/event-dialog.tsx` | date, start/end times | date, datetime |

### Reference Implementation
Based on `Task_Manager_Oncoschool/frontend/src/components/shared/DatePicker.tsx` which uses the same Popover + Calendar + manual input pattern.

## Out of Scope
- Date range picker (selecting a range of dates)
- Recurring date selection
- Timezone selection
- Drag-and-drop reordering within a column (current behavior: cross-column only)

## Acceptance Criteria
- [ ] AC-1: Clicking anywhere on a Kanban task card navigates to task detail page
- [ ] AC-2: Dragging from any point on a Kanban card initiates drag-and-drop
- [ ] AC-3: All buttons show pointer cursor on hover
- [ ] AC-4: No native browser date pickers visible anywhere in the app
- [ ] AC-5: Custom DatePicker opens a styled calendar popup matching the app's theme
- [ ] AC-6: DatePicker supports clearing the selected date
- [ ] AC-7: DateTime fields show both date picker and time input
- [ ] AC-8: Build passes with no errors, existing tests pass

## Open Questions
- None — requirements are well-defined based on reference implementation analysis.
