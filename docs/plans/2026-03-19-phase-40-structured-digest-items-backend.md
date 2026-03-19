# Phase 40: Structured Digest Items — Backend

## Overview
Replace raw Inbox + markdown Digest with structured, actionable digest items for Learning and Jobs categories. News remains unchanged (markdown digest).

## Tasks

### Task 1: PulseDigestItem model + migration
**Description:** Create new `pulse_digest_items` SQLAlchemy model and Alembic migration.

**Files:**
- `backend/app/models/telegram.py` — add PulseDigestItem model
- `backend/alembic/versions/032_add_pulse_digest_items.py` — migration

**Model fields:**
- `id` (UUID, PK)
- `digest_id` (UUID, FK → pulse_digests, ON DELETE CASCADE)
- `user_id` (UUID, FK → users, ON DELETE CASCADE)
- `title` (String 500)
- `summary` (Text)
- `classification` (String 50) — article/lifehack/insight/tool/other/vacancy
- `metadata` (JSON) — category-specific: {company, position, salary_range, location, url} for Jobs
- `source_names` (JSON) — list of source display names
- `source_message_ids` (JSON) — list of PulseMessage UUID strings
- `status` (String 20, default "new") — new/actioned/skipped
- `actioned_at` (DateTime, nullable)
- `action_type` (String 20, nullable) — to_task/to_note/to_job/skip
- `action_result_id` (UUID, nullable) — ID of created Task/Note/Job
- `created_at` (DateTime)

**Indexes:** `(digest_id)`, `(user_id, status)`

**Acceptance criteria:**
- Migration runs without errors
- Model can be imported and used in queries
- Rollback works cleanly

**Verification:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

### Task 2: Make PulseDigest.content nullable + add digest_type field
**Description:** Existing `content` (markdown) field must become nullable since Learning/Jobs digests will store items instead. Add `digest_type` field to distinguish markdown vs structured digests.

**Files:**
- `backend/app/models/telegram.py` — update PulseDigest model
- `backend/alembic/versions/032_add_pulse_digest_items.py` — same migration as Task 1

**Changes:**
- `PulseDigest.content` — make nullable
- `PulseDigest.digest_type` — new String(20) field: "markdown" (default) / "structured"
- Add relationship: `PulseDigest.items` → list of PulseDigestItem

**Acceptance criteria:**
- Old digests with content remain valid (digest_type defaults to "markdown")
- New digests can be created with content=None and digest_type="structured"

**Verification:** Run migration, verify existing digest records unchanged

---

### Task 3: Modify digest generation — structured output for Learning
**Description:** Change `generate_digest()` in pulse_digest.py so that for Learning category, the AI outputs a JSON array of structured items instead of markdown.

**Files:**
- `backend/app/services/pulse_digest.py` — modify generate_digest(), add new system prompts

**Changes:**
- New system prompt `LEARNING_STRUCTURED_PROMPT` — instructs AI to return JSON array of items with fields: title, summary, classification, source_names, message_indices
- Parse LLM response as JSON
- Create PulseDigestItem rows for each item
- Set digest_type="structured", content=None
- Map message_indices back to actual PulseMessage IDs for source_message_ids

**Acceptance criteria:**
- Learning digest generates structured items stored in pulse_digest_items
- Each item has title, summary, classification, source references
- Original messages marked as "in_digest" as before
- Error handling: if JSON parse fails, fall back to markdown

**Verification:** Unit tests — generate digest with mock LLM, verify items created

---

### Task 4: Modify digest generation — structured output for Jobs
**Description:** Same as Task 3 but for Jobs category. AI extracts vacancy information into structured items.

**Files:**
- `backend/app/services/pulse_digest.py` — add JOBS_STRUCTURED_PROMPT, handle jobs items

**Changes:**
- New system prompt `JOBS_STRUCTURED_PROMPT` — instructs AI to return JSON array with: title, summary, classification="vacancy", metadata={company, position, salary_range, location, url}, source_names, message_indices
- Create PulseDigestItem rows with metadata field populated
- Same fallback-to-markdown on parse error

**Acceptance criteria:**
- Jobs digest generates structured items with vacancy metadata
- Each item has company/position/salary/url when available in source messages

**Verification:** Unit tests — generate jobs digest with mock LLM, verify items + metadata

---

### Task 5: Digest items API — list and get
**Description:** Create API endpoints to retrieve structured digest items.

**Files:**
- `backend/app/api/pulse_digests.py` — add new endpoints
- `backend/app/schemas/` or inline Pydantic models — DigestItemResponse

**Endpoints:**
- `GET /api/pulse/digests/{digest_id}/items?classification=&status=&limit=&offset=` — list items for a specific digest
- `GET /api/pulse/digests/latest/items?category=learning` — shortcut for latest digest items

**Response model (DigestItemResponse):**
- id, digest_id, title, summary, classification, metadata, source_names, status, action_type, action_result_id, created_at

**Acceptance criteria:**
- Items returned with pagination
- Filterable by classification and status
- Only returns items owned by requesting user
- Returns 404 for non-existent digest

**Verification:** Unit tests — create digest with items, query via API, verify response

---

### Task 6: Digest items API — actions (to_task, to_note, to_job, skip)
**Description:** Create endpoints for acting on digest items — routing to Task, Note, Job Hunt, or skipping.

**Files:**
- `backend/app/api/pulse_digests.py` — add action endpoints
- `backend/app/services/pulse_digest_items.py` — new service for item actions

**Endpoints:**
- `POST /api/pulse/digests/items/{item_id}/action` — body: {action: "to_task"|"to_note"|"to_job"|"skip"}
- `POST /api/pulse/digests/items/bulk-action` — body: {item_ids: [...], action: ...}

**Action logic:**
- **to_task**: Create task via TaskService (title=item.title, description=item.summary, tag="pulse-learning")
- **to_note**: Create note via NoteService (title=item.title, content=item.summary) — requires Google credentials
- **to_job**: Create Job entity (title=metadata.position or item.title, company=metadata.company, salary_min/max from metadata.salary_range, url=metadata.url, source="pulse")
- **skip**: Just update status

**Update item:** status="actioned"/"skipped", actioned_at=now, action_type=action, action_result_id=created entity ID

**Acceptance criteria:**
- Each action creates the correct entity and updates item status
- to_job creates a Job with pre-filled fields from metadata
- Bulk action processes all items
- Ownership validation on all endpoints

**Verification:** Unit tests — action on item, verify Task/Note/Job created, item status updated

---

### Task 7: Remove per-message AI classification for Learning
**Description:** Stop classifying individual learning messages during collection. Classification now happens at digest generation time.

**Files:**
- `backend/app/services/pulse_scheduler.py` — modify `_apply_ai_filter()`
- `backend/app/services/pulse_ai_filter.py` — simplify learning analysis

**Changes:**
- In `_apply_ai_filter()`: skip AI analysis for learning category messages (only keep for jobs)
- In `analyze_relevance()`: learning branch no longer called during collection
- Learning messages get ai_relevance=None, ai_classification=None (raw storage only)

**Acceptance criteria:**
- Learning messages collected without AI analysis (faster, cheaper)
- Jobs messages still get AI relevance scoring (needed for urgent alerts)
- News messages unchanged (always 1.0, no classification)

**Verification:** Unit tests — mock poll, verify learning messages have no ai_relevance/ai_classification

---

### Task 8: Remove old Inbox endpoints and service
**Description:** Deprecate and remove the old raw-message Inbox system since it's replaced by digest items.

**Files:**
- `backend/app/api/pulse_inbox.py` — remove or gut endpoints
- `backend/app/services/pulse_inbox.py` — remove service
- `backend/app/api/__init__.py` or router registration — remove inbox router

**Changes:**
- Remove `GET /api/pulse/inbox/`
- Remove `POST /api/pulse/inbox/{message_id}/action`
- Remove `POST /api/pulse/inbox/bulk-action`
- Remove `pulse_inbox.py` service
- Keep the files but mark as removed (or delete entirely)

**Acceptance criteria:**
- Old inbox endpoints return 404 / are not registered
- No references to inbox service remain in active code
- Existing tests updated or removed

**Verification:** `pytest` passes, old endpoints not accessible

---

### Task 9: Backwards compatibility for old markdown digests
**Description:** Ensure old digests (digest_type="markdown" or NULL) continue to render correctly alongside new structured digests.

**Files:**
- `backend/app/api/pulse_digests.py` — update response logic

**Changes:**
- `GET /api/pulse/digests/{id}` — if digest_type is "markdown" or None, return content as before
- `GET /api/pulse/digests/{id}/items` — if digest_type is "markdown", return empty list with a flag `is_markdown: true`
- `GET /api/pulse/digests/latest` — works for both types
- Set default digest_type="markdown" for all existing records in migration

**Acceptance criteria:**
- Old markdown digests display unchanged
- API clearly indicates whether a digest is markdown or structured
- No data loss on existing digests

**Verification:** Query old digest via API, verify content returned; query new digest, verify items returned

---

### Task 10: Tests for digest items pipeline
**Description:** Comprehensive tests for the new structured digest items flow.

**Files:**
- `backend/tests/test_pulse_digest_items.py` — new test file

**Test cases:**
- Generate Learning digest → verify items created with correct fields
- Generate Jobs digest → verify items with vacancy metadata
- Generate News digest → verify still markdown, no items
- Action: to_task → verify Task created, item status updated
- Action: to_job → verify Job created with metadata fields
- Action: to_note → verify Note created
- Action: skip → verify status updated
- Bulk action → verify all items processed
- Backwards compat: old markdown digest still returns content
- Error handling: LLM returns invalid JSON → fallback to markdown

**Acceptance criteria:**
- All tests pass
- Coverage of main flows: generation, actions, backwards compat, error handling

**Verification:** `pytest backend/tests/test_pulse_digest_items.py -v`

## Dependencies

```
Task 1, 2 (model + migration) — no deps, do first
    ↓
Task 3, 4 (digest generation) — depends on 1, 2
    ↓
Task 5 (items API - list) — depends on 1, 2
    ↓
Task 6 (items API - actions) — depends on 5
    ↓
Task 7 (remove per-message AI) — independent, can be done after 3
Task 8 (remove inbox) — depends on 6 (replacement ready)
Task 9 (backwards compat) — depends on 2, 5
Task 10 (tests) — depends on all above
```

## Execution Order
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
