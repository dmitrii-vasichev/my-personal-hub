# Today Redesign Plan

Last updated: 2026-05-15

## Goal

Rebuild Today as a low-noise daily operating view focused on Garmin health
factoids and pending Actions for today.

## Source Documents

- Design: `docs/superpowers/specs/2026-05-15-today-redesign-design.md`
- Implementation plan: `docs/superpowers/plans/2026-05-15-today-redesign.md`

## Milestones

### M1 - Shared Action Row

Extract the expandable Action row from `ActionList` so Today and `/actions`
share Done, Edit, Snooze/Move, Delete, details, and checklist behavior.

Definition of done:
- Existing ActionList grouping tests pass.
- `/actions` keeps its existing row behavior.

### M2 - Today Components

Add Today health factoids, Today quick-add Action capture, and Actions Today
list components.

Definition of done:
- HRV large value uses weekly average.
- Sleep duration renders as `7h 23m`.
- Quick-add creates an Action with today's `action_date`.
- Actions Today shows only pending Actions for the current local day.

### M3 - Page Replacement

Replace the current planner/dashboard Today composition with the new
health-first Today composition.

Definition of done:
- Today no longer renders planner, job-hunt, notes, response-rate, or background
  signals blocks.
- Focused Today page tests pass.

### M4 - Validation

Run focused tests first, then lint and production build.

Definition of done:
- Focused Today/Actions tests pass.
- `npm run lint` passes.
- `npx next build --webpack` passes or any failure is documented with a known
  baseline comparison.
