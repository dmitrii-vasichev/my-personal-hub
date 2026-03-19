# Phase 41: Structured Digest Items — Frontend

## Overview
Replace the old Inbox view with an interactive digest items view for Learning and Jobs categories. When a digest has `digest_type="structured"`, render actionable item cards (with → Task, → Note, → Job Hunt, Skip buttons) instead of the previous markdown wall. News category and old markdown digests remain unchanged. Remove all old Inbox code (endpoints were already removed in Phase 40).

## Tasks

### Task 1: DigestItem TypeScript types
**Description:** Add TypeScript types matching the backend `DigestItemResponse`, `DigestItemListResponse`, `DigestItemAction`, `DigestItemBulkAction` schemas.

**Files:**
- `frontend/src/types/pulse-digest.ts` — add new interfaces

**New types:**
- `DigestItem` — id, digest_id, title, summary, classification, metadata (nullable dict with company/position/salary_range/location/url), source_names (string[]), status ("new"|"actioned"|"skipped"), action_type (nullable), action_result_id (nullable), created_at
- `DigestItemListResponse` — items: DigestItem[], total: number, is_markdown: boolean
- `DigestItemAction` — "to_task" | "to_note" | "to_job" | "skip"
- `DigestItemBulkActionRequest` — item_ids: number[], action: DigestItemAction
- Update `PulseDigest` — add `digest_type: string` field (backend now returns it)

**Acceptance criteria:**
- All types match backend schemas from `backend/app/schemas/pulse_digest.py`
- PulseDigest type includes `digest_type` field
- No TypeScript errors

**Verification:** `npx tsc --noEmit`

---

### Task 2: Digest items API hooks
**Description:** Create React Query hooks for the new digest items endpoints: fetch items (by digest ID and latest), single item action, bulk item action.

**Files:**
- `frontend/src/hooks/use-pulse-digest-items.ts` — new file

**Hooks:**
- `useDigestItems(digestId, options?)` — `GET /api/pulse/digests/{digestId}/items?classification=&status=&limit=&offset=`
- `useLatestDigestItems(category)` — `GET /api/pulse/digests/latest/items?category=`
- `useDigestItemAction()` — `POST /api/pulse/digests/items/{itemId}/action` body: {action}
- `useBulkDigestItemAction()` — `POST /api/pulse/digests/items/bulk-action` body: {item_ids, action}

**Query key:** `["pulse-digest-items", ...]` — invalidate on action mutations. Also invalidate `PULSE_DIGESTS_KEY` to refresh digest metadata.

**Acceptance criteria:**
- All hooks work with correct API endpoints
- Mutations show toast on success/error
- Query invalidation after actions
- TypeScript types applied

**Verification:** `npx tsc --noEmit`

---

### Task 3: DigestItemCard component (Learning)
**Description:** Reusable card component for rendering a single Learning digest item. Shows title, summary, classification badge, source names, and action buttons (→ Task, → Note, Skip). Reuses classification badge styling from old inbox-view.

**Files:**
- `frontend/src/components/pulse/digest-item-card.tsx` — new file

**UI Elements:**
- Classification badge (Article/Lifehack/Insight/Tool/Other) with colored background — same styles as old inbox
- Title in bold
- Summary text (expandable if long, > 3 lines)
- Source names as subtle chips
- Checkbox for multi-select (left side)
- Action buttons (right side, visible on hover): → Task (CheckSquare icon), → Note (FileText icon), Skip (SkipForward icon)
- Status indicator: if `status === "actioned"` — show greyed out with action_type label; if `status === "skipped"` — show dimmed

**Acceptance criteria:**
- Card renders all item fields correctly
- Action buttons call provided callback
- Selection checkbox works
- Actioned/skipped items shown differently (dimmed, no action buttons)

**Verification:** Visual inspection + `npx tsc --noEmit`

---

### Task 4: JobDigestItemCard component (Jobs)
**Description:** Card component for rendering a single Jobs digest item. Shows vacancy details (title, company, salary, location, URL) and → Job Hunt action button.

**Files:**
- `frontend/src/components/pulse/job-digest-item-card.tsx` — new file

**UI Elements:**
- Title (position name) in bold
- Company name
- Salary range (if available)
- Location (if available)
- URL as external link (if available)
- Source names as subtle chips
- Summary text (expandable)
- Checkbox for multi-select (left side)
- Action buttons: → Job Hunt (Briefcase icon), Skip (SkipForward icon)
- Status indicator: same as Task 3

**Acceptance criteria:**
- Card renders all vacancy metadata fields
- Missing optional fields (salary, location, url) gracefully hidden
- → Job Hunt button calls provided callback with "to_job" action
- Actioned items show "Added to Job Hunt" label

**Verification:** Visual inspection + `npx tsc --noEmit`

---

### Task 5: DigestItemsView component
**Description:** Main view component that renders a list of digest items with toolbar, filtering, selection, and bulk actions. Used for both Learning and Jobs categories.

**Files:**
- `frontend/src/components/pulse/digest-items-view.tsx` — new file

**Props:** `digestId: number`, `category: string`

**Features:**
- Fetches items using `useDigestItems(digestId)`
- Renders DigestItemCard for learning items, JobDigestItemCard for jobs items (based on category)
- Toolbar: Select All / Deselect All, item count, classification filter dropdown (for learning: article/lifehack/insight/tool/other)
- Bulk actions bar (when items selected): → Tasks, → Notes, → Job Hunt (jobs only), Skip
- Loading skeleton
- Empty state: "No items in this digest"
- Shows items count and "new" vs "actioned" counts

**Acceptance criteria:**
- Items fetched and rendered correctly
- Multi-select with bulk actions works
- Classification filter works
- Loading and empty states displayed
- Correct card type rendered based on category

**Verification:** Visual inspection + `npx tsc --noEmit`

---

### Task 6: Update DigestView — structured vs markdown rendering
**Description:** Modify DigestView to detect `digest_type` on the digest object. If "structured" — render DigestItemsView. If "markdown" (or absent) — render markdown as before. Update PulseDigest interface.

**Files:**
- `frontend/src/components/pulse/digest-view.tsx` — add digest_type detection
- `frontend/src/types/pulse-digest.ts` — already updated in Task 1

**Changes:**
- If `digest.digest_type === "structured"` → render `<DigestItemsView digestId={digest.id} category={digest.category} />`
- If markdown or missing → render existing ReactMarkdown output
- Metadata bar shows "items" count for structured, "messages" for markdown (already partially done)

**Acceptance criteria:**
- Structured digests show interactive items view
- Markdown digests (News, old digests) show markdown as before
- No visual regression for News tab

**Verification:** Visual inspection with both structured and markdown digests

---

### Task 7: Update Pulse page — remove Inbox view mode
**Description:** Remove the "Inbox" view mode tab and all related logic from the Pulse page. Learning category now shows digest items view via the updated DigestView (Latest tab). Remove auto-switch-to-inbox logic.

**Files:**
- `frontend/src/app/(dashboard)/pulse/page.tsx` — remove Inbox view mode

**Changes:**
- Remove `"inbox"` from `ViewMode` type → only `"latest" | "history"`
- Remove Inbox tab button from view toggle
- Remove `handleCategoryChange` auto-switch to inbox logic
- Remove `usePulseInbox` import and `inboxCount`
- Remove `<InboxView />` rendering branch
- Remove `InboxView` import

**Acceptance criteria:**
- Only "Latest" and "History" tabs remain
- Learning tab shows structured digest items in Latest view (via DigestView)
- Jobs tab shows structured digest items in Latest view (via DigestView)
- News tab shows markdown digest as before
- No references to inbox remain in page

**Verification:** Visual inspection, `npx tsc --noEmit`

---

### Task 8: Update DigestHistory for structured digests
**Description:** When expanding a structured digest in the History view, show interactive items (DigestItemsView) instead of markdown.

**Files:**
- `frontend/src/components/pulse/digest-history.tsx` — detect digest_type in expansion

**Changes:**
- `DigestHistoryItem`: when expanded, if `digest.digest_type === "structured"` → render `<DigestItemsView digestId={digest.id} category={digest.category} />`
- If markdown — render `<DigestView digest={digest} />` as before
- Note: DigestView already handles this (Task 6), so this may just work automatically. Verify.

**Acceptance criteria:**
- Old markdown digests expand to show markdown
- New structured digests expand to show interactive items with actions
- Actions work within expanded history items

**Verification:** Visual inspection with History tab

---

### Task 9: Update Dashboard Widget
**Description:** Update the Pulse dashboard widget to properly handle structured digests. For structured digests (Learning/Jobs), show items count instead of content_preview (which may be empty). Optionally show first few item titles as preview.

**Files:**
- `frontend/src/components/dashboard/pulse-digest-widget.tsx` — update CategoryRow

**Changes:**
- CategoryRow: if `items_count` is available and `content_preview` is empty → show "{items_count} new items" or list first 1-2 item titles
- The backend `content_preview` for structured digests will be empty string — handle gracefully
- Update the link to go directly to pulse page with category filter

**Acceptance criteria:**
- Structured digests show items count when no content_preview
- Markdown digests show content_preview as before
- Widget doesn't show empty/broken preview for structured digests

**Verification:** Visual inspection of dashboard

---

### Task 10: Remove old Inbox code
**Description:** Delete the old Inbox component, hooks, and types since the backend inbox endpoints were removed in Phase 40.

**Files:**
- `frontend/src/components/pulse/inbox-view.tsx` — DELETE
- `frontend/src/hooks/use-pulse-inbox.ts` — DELETE
- `frontend/src/types/pulse-inbox.ts` — DELETE

**Changes:**
- Delete the 3 files above
- Verify no remaining imports/references to inbox in the codebase
- Remove any test files that reference inbox

**Acceptance criteria:**
- All inbox-related frontend files removed
- No import errors or broken references
- Build passes cleanly

**Verification:** `npx tsc --noEmit && npm run build`

---

### Task 11: Frontend tests for digest items
**Description:** Write tests for the new digest items components and hooks.

**Files:**
- `frontend/src/tests/digest-items-view.test.tsx` — new test file (or appropriate test location)

**Test cases:**
- DigestItemCard: renders title, summary, classification badge, source names
- DigestItemCard: action buttons call correct callbacks
- DigestItemCard: actioned items show dimmed with action label
- JobDigestItemCard: renders vacancy metadata (company, salary, location, url)
- JobDigestItemCard: → Job Hunt button works
- DigestItemsView: fetches and renders items
- DigestItemsView: multi-select and bulk actions work
- DigestView: renders markdown for markdown digests
- DigestView: renders items view for structured digests
- Pulse page: no Inbox tab present

**Acceptance criteria:**
- All tests pass
- Coverage of main UI flows

**Verification:** `npm test`

## Dependencies

```
Task 1 (types) — no deps, do first
    ↓
Task 2 (hooks) — depends on 1
    ↓
Task 3, 4 (card components) — depend on 1
    ↓
Task 5 (items view) — depends on 2, 3, 4
    ↓
Task 6 (digest-view update) — depends on 5
    ↓
Task 7 (page update) — depends on 6
Task 8 (history update) — depends on 6
Task 9 (dashboard widget) — depends on 1
    ↓
Task 10 (remove inbox) — depends on 7 (inbox no longer used)
    ↓
Task 11 (tests) — depends on all above
```

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11
