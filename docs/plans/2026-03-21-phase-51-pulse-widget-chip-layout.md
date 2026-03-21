# Phase 51: Pulse Widget — Chip Layout

**PRD:** `docs/prd-pulse-widget-chip-layout.md`
**Scope:** Frontend only — `pulse-digest-widget.tsx` + tests

## Tasks

### Task 1: Refactor CategoryRow to chip layout
**Files:** `frontend/src/components/dashboard/pulse-digest-widget.tsx`
**Description:**
Replace the vertical `<ul>` bullet list in `CategoryRow` with a horizontal flex-wrap layout of chip/pill components.

Changes:
- Slice `preview_items` to first 3 items (instead of displaying all)
- Replace `<ul className="space-y-0.5">` + `<li>` with `<div className="flex flex-wrap gap-2">`
- Each item becomes a chip `<span>` with:
  - Category-colored muted background (`config.bg`)
  - Rounded corners (`rounded-md`)
  - Padding `px-3 py-1.5`
  - `text-sm` text
  - `truncate` + `max-w-[280px]` for long titles
- Classification badge stays inside chip (as a small inline tag)
- Recalculate `moreCount` as `totalCount - visibleCount` (where `visibleCount = min(3, displayedCount)`)
- Show "+ N more" as an inline element in the same flex row (not a separate `<p>`)

**Acceptance criteria:**
- [ ] Preview items render as horizontal chips with category-colored backgrounds
- [ ] Max 3 chips shown per category
- [ ] Long titles truncated with ellipsis
- [ ] Classification badges visible inside chips
- [ ] "+ N more" appears inline after last chip
- [ ] Fallback to `content_preview` still works when `preview_items` is empty

### Task 2: Update tests
**Files:** `frontend/src/components/dashboard/__tests__/pulse-digest-widget.test.tsx`
**Description:**
Update existing tests to verify the new chip layout. Add test for truncation limit (3 items shown even when more provided).

Changes:
- Add test: when 5 preview_items provided, only first 3 are rendered
- Update "+ N more" test: with 3 displayed of 12 total → "+ 9 more"
- Verify chip elements have expected styling (check for chip-related classes)

**Acceptance criteria:**
- [ ] Test verifying only 3 items shown when more are available
- [ ] "+ N more" count is correct (total - 3)
- [ ] All existing tests pass (item titles, classification badges, fallback, empty state)

### Task 3: Build & lint verification
**Description:**
Run lint, build, and tests to ensure no regressions.

**Acceptance criteria:**
- [ ] `npm run lint` passes (frontend)
- [ ] `npm run build` passes (frontend)
- [ ] All frontend tests pass

## Dependencies
Task 1 → Task 2 → Task 3 (sequential)

## Verification
```bash
cd frontend && npm run lint && npm run build && npx vitest run src/components/dashboard/__tests__/pulse-digest-widget.test.tsx
```
