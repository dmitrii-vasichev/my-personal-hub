# PRD: Pulse Widget — Chip Layout

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-21 |
| Status | Approved |
| Priority | P1 |

## Overview
The Pulse dashboard widget currently displays preview items as a vertical bullet list (5 items per category), making it look stretched and text-heavy. This change replaces the bullet list with horizontal chip/pill components (3 items per category) to create a more compact, visually appealing layout.

## Requirements
- [ ] FR-1: Display preview items as horizontal chip/pill components instead of a vertical bullet list
- [ ] FR-2: Show max 3 items per category (reduced from 5); frontend slices the array, backend unchanged
- [ ] FR-3: Chips use `flex-wrap` layout — flow horizontally, wrap to next line when needed
- [ ] FR-4: Long titles are truncated with ellipsis at ~40-45 characters to keep chips compact
- [ ] FR-5: Each chip has category-colored muted background (`accent-violet-muted` for news, `accent-amber-muted` for jobs, `accent-teal-muted` for learning), rounded corners (`rounded-md`), padding `px-3 py-1.5`, `text-sm`
- [ ] FR-6: Classification badges (for learning/jobs) remain visible inside chips
- [ ] FR-7: "+ N more" counter displayed inline as the last element in the flex row (calculated as `items_count - 3`)
- [ ] FR-8: Update existing tests to reflect new layout (3 items, chip classes)

## Out of Scope
- Backend API changes (still returns up to 5 items)
- Item ranking/prioritization logic
- Category order changes
- Widget header/footer changes

## Technical Notes
- Frontend-only change: `pulse-digest-widget.tsx` and its test file
- Reduce `slice(0, 5)` → `slice(0, 3)` in the component
- Replace `<li>` bullet list with `<div className="flex flex-wrap gap-2">` containing chip `<span>` elements
- Truncation via Tailwind `truncate` + `max-w-[...]` on chip container
