# PRD: Structured Digest Items for Learning & Jobs

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-19 |
| Status | Approved |
| Priority | P0 |

## Problem Statement

The current Pulse system has two disconnected experiences for Learning content:
- **Inbox** shows raw individual Telegram messages with AI classification tags. Most items are noise — short chat replies like "yes", "no", fragments of conversations land as separate "insights" with low relevance scores.
- **Digest** generates a useful AI summary but is a read-only markdown wall with zero interactivity — users cannot act on individual items (route to Task, Note, or Job Hunt).

For Jobs, only markdown digest exists — there is no way to send a found vacancy to Job Hunt (FR-32 from Telegram Pulse PRD was planned as P1 but never implemented).

**Result:** Learning inbox is unusable (too noisy), digest is useful but not actionable, and Jobs-to-JobHunt integration is missing entirely.

## User Scenarios

### Scenario 1: Review Learning Digest
**As a** hub user, **I want to** see a digest of structured, AI-aggregated learning items (not raw messages), **so that** I only see meaningful insights synthesized from multiple messages, not individual chat noise.

### Scenario 2: Route Learning Item
**As a** hub user, **I want to** click → Task or → Note on a specific digest item, **so that** I can save valuable findings without manual copy-paste.

### Scenario 3: Save Job to Job Hunt
**As a** hub user, **I want to** click → Job Hunt on a vacancy found in the Jobs digest, **so that** a Job entity is created with pre-filled fields (title, company, salary, URL, source).

### Scenario 4: Skip or Dismiss Items
**As a** hub user, **I want to** skip/dismiss digest items I'm not interested in, **so that** they don't clutter my view.

## Functional Requirements

### P0 (Must Have)

#### Structured Digest Generation
- [ ] FR-1: Modify digest generation for Learning and Jobs categories — AI outputs a JSON array of structured items instead of a markdown string
- [ ] FR-2: Each structured item contains: `title`, `summary`, `classification` (for Learning: article/lifehack/insight/tool/other), `sources` (list of source names), `source_message_ids` (references to original PulseMessages)
- [ ] FR-3: For Jobs items, additionally include: `company`, `position`, `salary_range`, `location`, `url` (extracted by AI from messages)
- [ ] FR-4: News category remains unchanged — keeps generating markdown digests as before

#### Digest Item Data Model
- [ ] FR-5: New `pulse_digest_items` table to store individual structured items linked to a digest
- [ ] FR-6: Each item has a `status` field: "new" / "actioned" / "skipped" — for tracking user actions
- [ ] FR-7: Digest-level `content` field (markdown) becomes nullable — Learning and Jobs digests store items instead of markdown

#### Digest Item Actions
- [ ] FR-8: Learning items support actions: → Task (creates task with `pulse-learning` tag), → Note (creates Google Drive note), Skip
- [ ] FR-9: Jobs items support action: → Job Hunt (creates Job entity with pre-filled title, company, salary_range, location, url, source)
- [ ] FR-10: Bulk actions — select multiple items and apply the same action

#### Remove Per-Message AI Classification
- [ ] FR-11: Remove individual AI classification during message collection for Learning category — classification now happens at digest generation time as part of item synthesis
- [ ] FR-12: Keep AI relevance scoring for Jobs during collection (needed for urgent job alerts which fire before digest)

#### API Changes
- [ ] FR-13: New `GET /api/pulse/digests/{id}/items` — list structured items for a digest (paginated, filterable by classification/status)
- [ ] FR-14: New `GET /api/pulse/digests/latest/items?category=learning` — shortcut for latest digest items
- [ ] FR-15: New `POST /api/pulse/digests/items/{item_id}/action` — route item: `to_task`, `to_note`, `to_job`, `skip`
- [ ] FR-16: New `POST /api/pulse/digests/items/bulk-action` — bulk route multiple items
- [ ] FR-17: Deprecate and remove `GET /api/pulse/inbox/` and related inbox endpoints

#### UI Changes
- [ ] FR-18: Replace Inbox view with interactive digest items view for Learning tab — cards with title, summary, classification badge, source, action buttons
- [ ] FR-19: Add interactive digest items view for Jobs tab — cards with vacancy details and → Job Hunt button
- [ ] FR-20: News tab — unchanged, keeps showing markdown digest
- [ ] FR-21: Update Pulse dashboard widget to reflect new item counts instead of inbox count

### P1 (Should Have)
- [ ] FR-22: Item detail expansion — click to see full summary and referenced original messages
- [ ] FR-23: Filter items by classification tag within a digest

## Non-Functional Requirements

- **Performance:** Digest generation with structured items should complete within 45 seconds for up to 500 messages
- **Backwards compatibility:** Existing markdown digests in history remain viewable — old digests render as markdown, new digests render as structured items
- **Data integrity:** Original PulseMessages are preserved; digest items reference them but don't replace them

## Technical Design

### Stack
- Existing: FastAPI, SQLAlchemy, AI providers (OpenAI/Anthropic/Google)
- No new dependencies required

### Chosen Approach

Extend the existing digest generation pipeline to output structured JSON items for Learning and Jobs categories, while keeping markdown for News. A new `pulse_digest_items` table stores individual items with their own status lifecycle. The existing Inbox system (raw message routing) is removed and replaced by digest item routing.

**Key change in AI pipeline:**
- Current: Messages → AI → markdown string (stored in `pulse_digests.content`)
- New (Learning/Jobs): Messages → AI → JSON array of items → stored in `pulse_digest_items` rows
- New (News): Unchanged — messages → AI → markdown string

### Data Model

#### `pulse_digest_items` (new)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| digest_id | UUID | FK → pulse_digests, ON DELETE CASCADE |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| title | String | AI-generated item title |
| summary | Text | AI-generated summary |
| classification | String | article/lifehack/insight/tool/other (Learning) or "vacancy" (Jobs) |
| metadata | JSON | Category-specific fields: {company, position, salary_range, location, url} for Jobs |
| source_names | JSON | List of source display names |
| source_message_ids | JSON | List of PulseMessage UUIDs referenced |
| status | String | "new" / "actioned" / "skipped" |
| actioned_at | DateTime(tz) | When action was taken (nullable) |
| action_type | String | "to_task" / "to_note" / "to_job" / "skip" (nullable) |
| action_result_id | UUID | ID of created Task/Note/Job (nullable) |
| created_at | DateTime(tz) | |

### API Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pulse/digests/{id}/items` | List items for a digest |
| GET | `/api/pulse/digests/latest/items?category=learning` | Latest digest items by category |
| POST | `/api/pulse/digests/items/{item_id}/action` | Action on item: to_task, to_note, to_job, skip |
| POST | `/api/pulse/digests/items/bulk-action` | Bulk action on multiple items |

**Removed endpoints:**
- `GET /api/pulse/inbox/`
- `POST /api/pulse/inbox/{id}/action`
- `POST /api/pulse/inbox/bulk-action`

## Implementation Phases

| Phase | Name | Scope |
|-------|------|-------|
| 40 | Structured Digest Items — Backend | New `pulse_digest_items` table + migration. Modified digest generation (AI outputs JSON items for Learning/Jobs, markdown for News). Digest items API (list, action, bulk-action). Jobs → Job Hunt integration (create Job from item). Remove per-message AI classification for Learning. Remove old Inbox endpoints. Backwards compat for old markdown digests. |
| 41 | Structured Digest Items — Frontend | Replace Inbox view with interactive digest items view for Learning. Add interactive items view for Jobs with → Job Hunt button. News tab unchanged. Update dashboard widget. Bulk actions UI. |

## Out of Scope
- Changes to News category digest format
- Changes to message collection/polling logic
- Changes to digest scheduling mechanism
- Changes to Job Hunt module itself (beyond accepting pre-filled data)
- Telegram bot notification changes
- Real-time updates / WebSocket for new items

## Open Questions
- How should items that span multiple sources be displayed? (e.g., same topic discussed in 2 channels) — **Proposed:** single item with multiple sources listed
- Should relevance scores be visible on items? — **Proposed:** hide from UI, use internally for ordering items within digest
