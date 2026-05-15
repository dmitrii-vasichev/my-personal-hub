# Today Redesign Design

Date: 2026-05-15
Status: Approved for implementation planning
Source: User brainstorming session and visual mockups in `.superpowers/brainstorm/`

## Goal

Redesign the Today tab into a low-noise daily operating view focused on two jobs:

1. Show the user's current health state from Garmin at a glance.
2. Show and manage the Actions that need attention today.

Today should stop acting as a mixed dashboard for planner, job-hunt, notes, and background signals. Those areas can remain elsewhere in the product, but they should not compete for attention on the Today first screen.

## Product Decisions

- The Today page is health-first.
- The three top factoids are Training Readiness, HRV, and Sleep.
- Today works with the `actions` domain only. In user language, "reminder" means an Action with a date or time.
- A quick-add form on Today creates a new Action for today by default.
- The Actions list on Today is interactive, using expandable rows rather than a full inline editor.
- Planner-specific UI, job-hunt factoids, notes metrics, response-rate metrics, and background signal previews are removed from the primary Today page.

## Health Factoids

The first screen starts with three equal factoid tiles:

### Training Readiness

- Large value: `metrics.training_readiness`
- Subtext: readiness level and recovery hours when available, for example `READY - 6h recovery`
- Tooltip or title may include `training_readiness_feedback` when present.
- Empty state: show `--` with a short muted subtext such as `No readiness data`.

### HRV

- Large value: `metrics.hrv_weekly_avg`
- Subtext: `Last night {metrics.hrv_last_night_avg} ms - {metrics.hrv_status}`
- If weekly average is missing, show `--` as the large value.
- If last-night HRV exists while weekly average is missing, still show it in the subtext.
- Do not silently replace the weekly average with last-night HRV; the large number should mean the same thing every day.

### Sleep

- Large value: formatted duration from `sleep.duration_seconds`
- Format: `7h 23m`
- Subtext: `Score {sleep.sleep_score}` when a score is available.
- Empty state: show `--` with a muted subtext such as `No sleep data`.

## Quick Add

The quick-add form appears directly below the health factoids.

Default behavior:

- Creating from Today sets `action_date` to today's local date.
- If no time is selected, `remind_at` remains `null`.
- If a time is selected, set `remind_at` to today's local date at that time.
- The form creates an Action, not a Reminder.
- The form should invalidate the Actions query so the new item appears immediately in the Today list.

Fields for the first implementation:

- Title input.
- Today date chip or implicit Today default.
- Optional time control.
- Add button.
- Optional urgent toggle can be included if it reuses existing Actions quick-add behavior without adding visual noise.

## Actions Today List

The list shows pending Actions that belong to today.

Inclusion rule:

- Include an Action when `status !== "done"` and either `action_date` or `remind_at` falls on today's local date.
- Actions created from Today without time should appear as `Anytime`.
- Timed Actions should sort before untimed Actions by `remind_at`.
- Untimed Actions should sort by urgency first, then creation time.

Row collapsed state:

- Time label: `HH:mm` for timed Actions, `Anytime` for date-only Actions.
- Relative label: `NOW`, `IN 4H`, or `TODAY`, following the existing Actions row conventions.
- Title.
- Compact badges for useful state such as urgent, recurrence, checklist progress, note, link, and snooze count.

Row expanded state:

- Show details with linkified URLs when present.
- Show checklist with toggles when present.
- Provide quick actions:
  - `Done`
  - `Edit`
  - `Move` or `Snooze`
  - `Delete` if consistent with the existing Actions row pattern
- Editing can use the existing Action edit dialog. Full inline editing is out of scope for this phase.

## Layout

Chosen visual direction: health-first layout with expandable Actions.

Desktop order:

1. Page header.
2. Three health factoids.
3. Quick-add Action form.
4. Actions Today list.

Mobile order is the same, with factoids stacked or fitting the existing responsive grid pattern.

The page should avoid nested cards and keep the existing brutalist dashboard language: strong borders, compact mono labels, restrained spacing, and no marketing-style hero.

## Removed Or De-Emphasized Today Content

Remove from the primary Today screen:

- Planner plan bar, focus queue, fixed schedule, no-plan strip, and planner adherence cells.
- Job hunt response-rate and applications metrics.
- Notes metrics.
- Background signals feed.
- "Planner with code" or similar planner instruction copy.

This design does not delete planner, jobs, notes, or pulse functionality from the product. It only removes them from the Today first screen.

## Architecture

Frontend-only work should be sufficient for the first implementation.

Expected changes:

- Replace `frontend/src/app/(dashboard)/page.tsx` with the simplified Today composition.
- Add or refactor a Today health component that reads `useVitalsToday()` or the existing dashboard vitals summary hook.
- Add a Today quick-add Action component, preferably by extracting reusable behavior from `QuickAddActionForm`.
- Replace or rename `RemindersToday` with an Actions-focused component to avoid the current naming mismatch.
- Reuse Action row behavior from `ActionList` where practical. If extraction is too large for the first pass, build a focused Today Action row that preserves the same mutation hooks and edit dialog behavior.

Backend changes are not expected unless an existing endpoint cannot support the needed Action update behavior.

## Error Handling And Empty States

- If Garmin data is loading, render stable skeleton factoids.
- If Garmin data is unavailable, show empty factoids rather than hiding the health section.
- If Actions fail to load, show a compact error state for the list while keeping health and quick-add available.
- If there are no Actions today, show a compact empty state below quick-add.
- Mutations should use existing toast patterns for create, done, update, snooze/move, and delete failures.

## Testing

Focused frontend tests should cover:

- Today renders the three health factoids.
- HRV large value uses weekly average, and subtext uses last-night HRV.
- Sleep duration formats as `7h 23m`.
- Quick-add from Today creates an Action with today's `action_date` when no time is selected.
- Quick-add from Today sets `remind_at` when a time is selected.
- Today list includes only pending Actions for today.
- A row can expand and expose quick actions.
- Done action calls the existing mark-done mutation.

Validation commands:

```bash
cd frontend && npm test -- --run src/app/(dashboard)/__tests__/page-plan-mode.test.tsx src/components/today/__tests__/*.test.tsx src/components/actions/__tests__/*.test.tsx
cd frontend && npm run lint
cd frontend && npx next build --webpack
```

Known broad-suite failures should be compared against `docs/STATUS.md` and `docs/TEST_PLAN.md`.

## Non-Goals

- No backend data model merge between Actions and Reminders.
- No full inline Action editor on Today.
- No new planner functionality.
- No new job-hunt, notes, or pulse widgets on Today.
- No deletion of existing planner, jobs, notes, pulse, or reminders code outside the Today surface.

## Open Implementation Notes

- Prefer renaming or replacing `RemindersToday` because it currently reads `actions` and can confuse future work.
- Consider extracting shared Action row helpers from `ActionList` only if it keeps the implementation smaller and testable.
- Keep Today scoped to pending Actions. Completed Actions remain available through the Actions history.
