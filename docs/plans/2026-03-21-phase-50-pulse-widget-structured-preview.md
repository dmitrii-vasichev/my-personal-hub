# Phase 50: Pulse Widget — Structured Preview Items

## Overview
Replace the truncated plain-text preview in the Pulse dashboard widget with a structured list of 3–5 headline items per category, improving scannability and eliminating raw markdown symbols.

## Tasks

### Task 1: Add PreviewItem schema and update DigestSummaryItem
**Description:** Add a `PreviewItem` Pydantic model (`title: str`, `classification: str | None`) and add `preview_items: list[PreviewItem]` field to `DigestSummaryItem` schema.
**Files:** `backend/app/schemas/pulse_digest.py`
**AC:**
- `PreviewItem` model exists with `title` and `classification` fields
- `DigestSummaryItem` has `preview_items: list[PreviewItem] = []`
**Verify:** Import and instantiate in Python REPL

### Task 2: Extract titles from markdown digest content
**Description:** Create `_extract_preview_items(content: str) -> list[dict]` in dashboard service. Parses markdown bullet points (`- **Title**: Description`) to extract up to 5 titles. Fallback: use first N non-heading lines trimmed to first sentence.
**Files:** `backend/app/services/dashboard.py`
**AC:**
- Extracts bold titles from `- **Title**: ...` patterns
- Falls back to first meaningful lines if no bold pattern found
- Returns max 5 items with `title` and `classification=None`
**Verify:** Unit tests

### Task 3: Query PulseDigestItem for structured digest previews
**Description:** For structured digests (learning, jobs), query `PulseDigestItem` table to get first 5 items ordered by `id`, returning `title` and `classification`.
**Files:** `backend/app/services/dashboard.py`
**Depends on:** Task 1
**AC:**
- For `digest_type == "structured"`: queries PulseDigestItem for digest_id
- Returns up to 5 items with title and classification
- Items ordered by id ASC
**Verify:** Unit tests

### Task 4: Integrate preview_items into get_pulse_summary
**Description:** Update `get_pulse_summary()` to populate `preview_items` for each digest using Task 2 (markdown) or Task 3 (structured) logic. Keep `content_preview` for backward compatibility.
**Files:** `backend/app/services/dashboard.py`
**Depends on:** Task 2, Task 3
**AC:**
- Each digest in response includes `preview_items` array
- Markdown digests: items from `_extract_preview_items()`
- Structured digests: items from PulseDigestItem query
- `content_preview` still present and populated
**Verify:** API call returns preview_items

### Task 5: Backend tests for preview extraction and summary
**Description:** Write tests for `_extract_preview_items()` (various markdown formats, edge cases) and for `get_pulse_summary()` returning preview_items.
**Files:** `backend/tests/test_dashboard_pulse_preview.py`
**Depends on:** Task 4
**AC:**
- Tests for bold-title extraction from markdown
- Tests for fallback parsing (no bold patterns)
- Tests for empty/null content
- Tests for structured digest item query
**Verify:** `pytest` passes

### Task 6: Update frontend DigestSummaryItem type
**Description:** Add `preview_items` to the `DigestSummaryItem` TypeScript interface.
**Files:** `frontend/src/types/pulse-digest.ts`
**AC:**
- `preview_items: { title: string; classification: string | null }[]` added
**Verify:** TypeScript compiles

### Task 7: Redesign CategoryRow to show item list
**Description:** Replace the `<p className="line-clamp-2">` text block with a `<ul>` of item titles. Each item: single line with `line-clamp-1`. Show classification badge for structured items. Show `+ N more` when total exceeds displayed count.
**Files:** `frontend/src/components/dashboard/pulse-digest-widget.tsx`
**Depends on:** Task 6
**AC:**
- Shows up to 5 item titles as a compact list
- Each title is single-line with ellipsis overflow
- Classification shown as small badge (for structured digests)
- `+ N more` indicator when items_count or message_count > displayed
- Falls back to current text preview if preview_items is empty
- Clicking row still navigates to `/pulse?digest={id}`
**Verify:** Visual check, frontend build passes

### Task 8: Frontend tests for updated widget
**Description:** Update/add tests for PulseDigestWidget to verify structured preview rendering, fallback behavior, and "+N more" indicator.
**Files:** `frontend/src/components/dashboard/__tests__/pulse-digest-widget.test.tsx`
**Depends on:** Task 7
**AC:**
- Test: renders item titles from preview_items
- Test: shows classification badge for structured items
- Test: shows "+N more" indicator
- Test: falls back to content_preview when preview_items empty
**Verify:** `npm test` passes

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
