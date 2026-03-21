# PRD: Pulse Widget — Structured Preview Items

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-21 |
| Status | Approved |
| Priority | P1 |

## Overview
The Pulse dashboard widget currently shows a truncated plain-text preview (`content_preview`, 200 chars, `line-clamp-2`) for each digest category. Markdown formatting symbols (e.g. `**bold**`) leak into the preview, and only ~2 lines of content are visible, making the widget uninformative.

This feature replaces the text blob with a structured list of 3–5 headline items per category, dramatically improving scannability and information density.

## Requirements

### P0 (Must Have)
- [ ] FR-1: Backend returns an array of preview items (`preview_items: [{title, classification?}]`) per digest instead of `content_preview`
- [ ] FR-2: For **structured digests** (learning, jobs) — query `PulseDigestItem` table, return first 5 items with `title` and `classification`
- [ ] FR-3: For **markdown digests** (news) — parse bullet points / bold headings from `content` field, extract up to 5 titles
- [ ] FR-4: Frontend renders each category as a compact list of item titles (single-line each, `line-clamp-1`)
- [ ] FR-5: Show remaining count indicator (e.g. `+ 14 more`) when total items exceed displayed count
- [ ] FR-6: Keep `content_preview` field for backward compatibility (existing `/pulse` page references)

### P1 (Should Have)
- [ ] FR-7: Each item row is clickable — navigates to `/pulse?digest={id}` (same as current behavior)
- [ ] FR-8: Show classification badge for structured items (e.g. `article`, `tool`, `vacancy`)

## Out of Scope
- Expandable/collapsible widget on dashboard
- Full markdown rendering inside the widget
- Inline actions (skip/action) from dashboard widget

## Technical Notes

### Backend Changes
- **Schema:** Add `preview_items: list[PreviewItem]` to `DigestSummaryItem` where `PreviewItem = {title: str, classification: str | None}`
- **Service:** In `get_pulse_summary()`:
  - For `digest_type == "structured"`: query `PulseDigestItem` WHERE `digest_id = digest.id` ORDER BY `id` LIMIT 5, return titles
  - For `digest_type == "markdown"`: parse `content` with regex to extract bullet point text (strip `- **Title**: Description` → `Title`), return up to 5

### Frontend Changes
- **Type:** Add `preview_items` to `DigestSummaryItem` interface
- **Widget:** Replace `<p className="line-clamp-2">` with a `<ul>` of item titles, each `line-clamp-1`, max 5 visible
- **Styling:** Item titles in `text-sm text-foreground`, classification badges in small muted text

## Implementation Phases

### Phase 50: Pulse Widget — Structured Preview Items
- Backend: `PreviewItem` schema, markdown title parsing, `PulseDigestItem` query for structured digests
- Frontend: replace text blob with structured item list, classification badges, "+N more" indicator
- Covers: FR-1 through FR-8
- Tests for backend parsing and frontend rendering

### Markdown Parsing Strategy
News digests use a consistent markdown format with bullet points:
```
- **Title**: Description text...
```
Extract the bold title portion. Fallback: use first N non-heading, non-empty lines trimmed to first sentence.
