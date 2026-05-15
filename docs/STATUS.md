# Today Redesign Status

Last updated: 2026-05-15

## Current State

- Branch: `main`
- Base branch: `main`
- Current feature: Today redesign.
- Current execution source of truth: `docs/PLAN.md`

## Live Journal

### 2026-05-15 - Design And Planning

Changed:
- Approved Today redesign direction: health-first, quick Action capture, and
  expandable Actions Today list.
- Wrote design spec:
  `docs/superpowers/specs/2026-05-15-today-redesign-design.md`.
- Wrote implementation plan:
  `docs/superpowers/plans/2026-05-15-today-redesign.md`.
- Updated the active execution pack in `docs/PLAN.md`, `docs/STATUS.md`, and
  `docs/TEST_PLAN.md`.

Decisions:
- Today uses the `actions` domain only. A user-facing reminder is an Action
  with a date or time.
- Quick-add on Today creates an Action with `action_date` set to today's local
  date by default.
- HRV factoid shows weekly average as the large value and last-night HRV in the
  subtext.
- Sleep duration format is `7h 23m`.

Planned validation:
- Focused Today/Actions Vitest tests.
- Frontend lint.
- Frontend production build with `npx next build --webpack`.
