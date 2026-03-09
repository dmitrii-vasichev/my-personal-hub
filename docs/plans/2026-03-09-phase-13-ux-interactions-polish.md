# Phase 13: UX Interactions Polish

**PRD:** docs/prd-ux-interactions.md
**Date:** 2026-03-09

## Overview
Fix UX interaction issues: Kanban card click/drag zones, button cursor styles, and replace native date inputs with custom themed pickers.

## Dependencies
- `react-day-picker` (v9+) — calendar UI component
- `date-fns` — date formatting/parsing (peer dep of react-day-picker)

## Tasks

### Task 1: Add cursor-pointer to Button component and global interactive styles
**Files:**
- `frontend/src/components/ui/button.tsx`
- `frontend/src/app/globals.css`

**Changes:**
1. Add `cursor-pointer` to the base classes in `buttonVariants` cva definition in button.tsx
2. Add global CSS rule in globals.css for interactive elements as safety net:
   ```css
   button, [role="button"], a, select, [type="checkbox"], [type="radio"], label[for] {
     cursor: pointer;
   }
   ```

**Acceptance Criteria:**
- [ ] All Button variants show pointer cursor on hover
- [ ] Native `<select>`, `<a>`, checkbox, radio elements show pointer cursor
- [ ] Disabled buttons still show not-allowed/default cursor (via `disabled:pointer-events-none`)

**Verification:** Hover over buttons in UI, check cursor changes

---

### Task 2: Make entire Kanban task card clickable and draggable
**Files:**
- `frontend/src/components/tasks/task-card.tsx`

**Changes:**
1. Move `{...listeners}` and `{...attributes}` from the GripVertical div to the outer card `<div>`
2. Replace the `<Link>` around the title with a plain `<span>` (keep same styles)
3. Add `onClick` handler to the outer card div that calls `router.push(\`/tasks/${task.id}\`)`, guarded by `if (transform) return` to skip navigation during drag
4. Add `useRouter` import from `next/navigation`
5. Update cursor classes: `cursor-pointer` on card, `active:cursor-grabbing` during drag
6. Keep GripVertical icon as visual-only indicator (no separate listeners)

**Acceptance Criteria:**
- [ ] Clicking anywhere on a task card navigates to task detail page
- [ ] Dragging from anywhere on the card initiates drag-and-drop (after 8px movement)
- [ ] Quick click (< 8px movement) navigates, not drags
- [ ] Card shows pointer cursor, changes to grabbing during drag

**Verification:** Click card body/footer/header → navigates. Drag card → moves between columns.

---

### Task 3: Install dependencies and create Calendar UI component
**Files:**
- `frontend/package.json` (install react-day-picker, date-fns)
- `frontend/src/components/ui/calendar.tsx` (new)

**Changes:**
1. `npm install react-day-picker date-fns`
2. Create `calendar.tsx` — styled DayPicker component following design-brief.md:
   - Uses app's CSS variables for colors (--primary, --accent, --surface, --border, etc.)
   - 8px border-radius on days, navigation buttons match Button component
   - Selected day: primary background, white text
   - Today: accent muted background
   - Hover: surface-hover background
   - Navigation chevrons using lucide-react icons
   - Compact sizing matching the app's 32px input height aesthetic

**Acceptance Criteria:**
- [ ] Calendar renders with app's design system colors
- [ ] Month navigation works (prev/next)
- [ ] Single date selection mode works
- [ ] Light and dark themes both look correct

**Verification:** Import and render Calendar in a test page, check visual consistency.

---

### Task 4: Create Popover component (Base UI)
**Files:**
- `frontend/src/components/ui/popover.tsx` (new)

**Changes:**
1. Create Popover component using `@base-ui/react` Popover primitives
2. Export: Popover, PopoverTrigger, PopoverContent (styled with --surface background, --border border, shadow, 8px radius)
3. Supports alignment (start/center/end), side (top/bottom)
4. Smooth open/close animation (fadeSlideUp)

**Acceptance Criteria:**
- [ ] Popover opens/closes on trigger click
- [ ] Styled consistently with app's design system
- [ ] Closes on click outside
- [ ] Closes on Escape key

**Verification:** Render a test popover, check positioning and styling.

---

### Task 5: Create DatePicker component
**Files:**
- `frontend/src/components/ui/date-picker.tsx` (new)

**Changes:**
1. Create DatePicker component combining Popover + Calendar:
   - Trigger: Button (outline variant) showing formatted date or placeholder
   - Content: manual input field (DD.MM.YYYY) + Calendar
   - Props: `value` (YYYY-MM-DD string), `onChange`, `placeholder`, `clearable`, `className`
   - Date formatting: `date-fns` format with `en-US` locale (e.g., "Mar 15, 2026")
   - Manual input: auto-inserts dots, validates on Enter/blur
   - Clear button (X icon) when clearable=true and value exists
   - Calendar icon in trigger button

**Acceptance Criteria:**
- [ ] Clicking trigger opens calendar popover
- [ ] Selecting a date calls onChange with YYYY-MM-DD string
- [ ] Manual DD.MM.YYYY input works
- [ ] Clear button resets to empty
- [ ] Popover closes after date selection

**Verification:** Use DatePicker in task-dialog, select dates, verify values.

---

### Task 6: Create DateTimePicker component
**Files:**
- `frontend/src/components/ui/date-time-picker.tsx` (new)

**Changes:**
1. Create DateTimePicker = DatePicker + time input side by side:
   - Props: `value` (ISO datetime string like "2026-03-15T14:30"), `onChange`, `placeholder`, `clearable`
   - Layout: DatePicker (flex-1) + styled time input (HH:MM, w-24)
   - Time input: `<input type="time">` with app styling (this is acceptable — browser time pickers are small and consistent, unlike date pickers)
   - On date change: keeps existing time, on time change: keeps existing date
   - Clear clears both date and time

**Acceptance Criteria:**
- [ ] Date and time can be selected independently
- [ ] Value is emitted as ISO datetime string
- [ ] Clear resets both fields

**Verification:** Use in task-dialog reminder field, verify datetime values.

---

### Task 7: Replace native date inputs in all forms
**Files:**
- `frontend/src/components/tasks/task-dialog.tsx`
- `frontend/src/components/jobs/application-edit-dialog.tsx`
- `frontend/src/components/tasks/task-filters.tsx`
- `frontend/src/components/calendar/event-dialog.tsx`

**Changes:**

**task-dialog.tsx:**
- Deadline field: `<Input type="date">` → `<DatePicker value={deadline} onChange={setDeadline} clearable placeholder="No deadline" />`
- Reminder field: `<Input type="datetime-local">` → `<DateTimePicker value={reminderAt} onChange={setReminderAt} clearable placeholder="No reminder" />`

**application-edit-dialog.tsx:**
- Applied Date: `<Input type="date">` → `<DatePicker value={appliedDate} onChange={setAppliedDate} placeholder="Select date" />`
- Next Action Date: `<Input type="date">` → `<DatePicker value={nextActionDate} onChange={setNextActionDate} clearable placeholder="No date" />`

**task-filters.tsx:**
- Deadline before: `<Input type="date">` → `<DatePicker value={filters.deadline_before ?? ""} onChange={(v) => onFiltersChange({...filters, deadline_before: v || undefined})} clearable placeholder="Any date" className="w-36" />`

**event-dialog.tsx:**
- All-day mode: start/end → `<DatePicker>` for each
- Timed mode: start/end → `<DateTimePicker>` for each
- Refactor state management to split date and time parts as needed

**Acceptance Criteria:**
- [ ] No native `type="date"` or `type="datetime-local"` inputs remain
- [ ] All date fields use DatePicker component
- [ ] All datetime fields use DateTimePicker component
- [ ] Form submission sends correct date/datetime values to API
- [ ] Existing functionality preserved (create, edit, filter)

**Verification:** Open each dialog, select dates, submit forms, verify API payloads.

---

### Task 8: Build verification and cleanup
**Files:** None (verification only)

**Changes:**
1. Run `npm run build` — verify no TypeScript/build errors
2. Run `npm run lint` — verify no new lint errors
3. Run `npm test` (if tests exist) — verify no regressions
4. Manual check: navigate through all forms with date pickers
5. Verify both light and dark themes render correctly

**Acceptance Criteria:**
- [ ] Build passes
- [ ] Lint passes (or only pre-existing errors)
- [ ] All tests pass
- [ ] No native date pickers visible anywhere

**Verification:** CI-equivalent local checks.

## Task Order (Dependencies)
```
Task 1 (cursor) ─────────────────────────────── can start immediately
Task 2 (kanban card) ────────────────────────── can start immediately
Task 3 (calendar component) ──┐
Task 4 (popover component) ───┤
                               ├── Task 5 (DatePicker) ──┐
                               │                          ├── Task 7 (replace inputs)
                               └── Task 6 (DateTimePicker)┘
                                                           └── Task 8 (verification)
```

Tasks 1, 2, 3, 4 are independent and can be parallelized.
Tasks 5, 6 depend on 3+4.
Task 7 depends on 5+6.
Task 8 depends on all.
