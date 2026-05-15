# Today Redesign Test Plan

Last updated: 2026-05-15

## Strategy

Validate the touched frontend surface first: shared Action row behavior, Today
health factoids, Today quick-add Action creation, Actions Today filtering, and
the Today page composition.

## Frontend Focused Checks

```bash
cd frontend
npm test -- --run \
  src/components/actions/__tests__/action-list-groups.test.tsx \
  src/components/today/today-action-utils.test.ts \
  src/components/today/__tests__/health-factoids.test.tsx \
  src/components/today/__tests__/quick-add-today-action-form.test.tsx \
  src/components/today/__tests__/actions-today.test.tsx \
  'src/app/(dashboard)/__tests__/today-redesign.test.tsx'
```

Expected:
- All focused tests pass.

## Frontend Broad Checks

```bash
cd frontend
npm run lint
npx next build --webpack
```

Expected:
- Lint passes.
- Build passes.

## Manual Smoke Checklist

- Today opens without planner/no-plan/focus-queue blocks.
- Top factoids are Training Readiness, HRV, and Sleep.
- HRV large value is the weekly average; last-night HRV appears below.
- Sleep duration uses `7h 23m`.
- Quick-add creates a new Action visible in Actions Today.
- Untimed quick-add items appear as `Anytime`.
- Timed quick-add items appear in time order.
- Expanding an Action row exposes details/checklist and Done/Edit/Move or
  Snooze controls.
