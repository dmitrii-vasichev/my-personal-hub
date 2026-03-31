# PRD: Outreach CRM v2 — Activity Log, Gmail Integration & Batch Outreach

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-03-31 |
| Status | Draft |
| Priority | P1 |
| Discovery | docs/discovery-2026-03-31-outreach-crm-v2.md |
| Predecessor | docs/prd-outreach.md (v1 — Complete) |

## Problem Statement

The Outreach module currently works as a lead tracker with proposal generation, but stops short of actual outreach execution. Users must manually copy proposals into Gmail, track conversations in their heads, and have no visibility into interaction history. There's no way to:
- Send emails directly from the interface
- See conversation history in a lead card
- Track which leads have been contacted and when
- Send batch outreach to multiple leads efficiently

## Goals & Non-Goals

### Goals
- Transform Outreach from a **lead tracker** into a **full outreach execution tool**
- Enable sending personalized emails directly from lead cards via Gmail API
- Provide full interaction history (activity log) per lead
- Support batch outreach: generate proposals → preview → send with rate limiting
- Auto-track incoming replies via Gmail polling

### Non-Goals
- Telegram / WhatsApp / SMS integration
- Email templates beyond AI-generated proposals
- Lead scoring or qualification algorithms
- Team collaboration / lead assignment
- Webhook-based Gmail push notifications (Pub/Sub) — polling is sufficient
- Email open/click tracking
- Multi-language proposals (Russian only)

## User Scenarios

### Scenario 1: Send a proposal from lead card
**As a** user, **I want to** generate a proposal and send it as an email directly from the lead card, **so that** I don't have to switch to Gmail and copy-paste.

### Scenario 2: See full interaction history
**As a** user, **I want to** see a chronological timeline of all interactions (emails sent, replies received, notes, calls) in the lead card, **so that** I have full context before the next touchpoint.

### Scenario 3: Track incoming replies automatically
**As a** user, **I want** the system to detect when a lead replies to my email, **so that** I see it immediately in the activity log and the lead status updates automatically.

### Scenario 4: Batch outreach to filtered leads
**As a** user, **I want to** select multiple leads (e.g., all "new" in industry "Restaurants"), generate proposals for them, preview/edit each one, and send them all with a single action, **so that** I can scale outreach without repetitive manual work.

### Scenario 5: Monitor batch sending progress
**As a** user, **I want to** see real-time progress of a batch send (sent/queued/failed per lead), pause or cancel it, and close the page knowing it continues in the background, **so that** I stay in control without babysitting the process.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: **Extended statuses** — migrate from 6 to 8 statuses: `new → contacted → follow_up → responded → negotiating → won | lost | on_hold`
- [ ] FR-2: **Status migration** — map existing data: `sent → contacted`, `replied → responded`, `in_progress → negotiating`, `rejected → lost`
- [ ] FR-3: **Activity log model** — `lead_activities` table: `id, lead_id, activity_type, subject, body, gmail_message_id, gmail_thread_id, created_at`
- [ ] FR-4: **Activity types** — `outbound_email, inbound_email, proposal_sent, note, outbound_call, inbound_call, meeting`
- [ ] FR-5: **Activity timeline UI** — chronological timeline in lead detail card showing all activities
- [ ] FR-6: **Activity CRUD API** — create, list (per lead), delete activities
- [ ] FR-7: **Gmail send scope** — add `gmail.send` to existing Google OAuth (incremental authorization)
- [ ] FR-8: **Send email from card** — compose and send email to lead's address from lead detail view
- [ ] FR-9: **Auto-log outbound email** — sending creates `outbound_email` activity with `gmail_message_id` and `gmail_thread_id`
- [ ] FR-10: **Auto-status on send** — sending first email transitions `new → contacted`
- [ ] FR-11: **Gmail read scope** — add `gmail.readonly` for incoming message tracking
- [ ] FR-12: **Incoming email polling** — background task polls Gmail threads (by saved `thread_id`) every 5-10 min for new messages
- [ ] FR-13: **Auto-log inbound email** — new reply creates `inbound_email` activity with message content
- [ ] FR-14: **Auto-status on reply** — inbound email transitions `contacted/follow_up → responded`
- [ ] FR-15: **Batch proposal generation** — filter leads → generate proposals for all that lack `proposal_text`
- [ ] FR-16: **Batch preview screen** — table of leads with expandable proposals, editable, toggleable per lead
- [ ] FR-17: **Batch send** — send all toggled proposals as emails with 2-3 min random delay between each
- [ ] FR-18: **Batch progress UI** — progress bar, per-lead status (✅ sent / ⏳ next / ⏸ queued), pause & cancel buttons
- [ ] FR-19: **Background sending** — page can be closed, sending continues on backend, notification when complete

### P1 (Should Have)

- [ ] FR-20: **Manual activity creation** — add notes, log calls, meetings from UI
- [ ] FR-21: **Follow-up tracking** — if no reply within N days after `contacted`, suggest follow-up
- [ ] FR-22: **Email thread view** — show full email thread (outbound + inbound) in lead card without opening Gmail
- [ ] FR-23: **Batch send resume** — if backend restarts during batch send, resume from last sent

### P2 (Nice to Have)

- [ ] FR-24: **Activity filters** — filter timeline by activity type
- [ ] FR-25: **Batch outreach templates** — save common subject lines for reuse
- [ ] FR-26: **Outreach analytics v2** — time-to-response metrics, best outreach times, conversion by industry

## Non-Functional Requirements

- **Performance:** Batch proposal generation for 50 leads should complete within 5 minutes
- **Rate limiting:** Max 20-30 emails/hour, 2-3 min random interval between sends
- **Gmail limits:** Stay well under 500/day (regular) or 2000/day (Workspace)
- **Reliability:** Batch send state persists across page reloads; backend process survives disconnection
- **Security:** Gmail tokens use existing encrypted storage; email content stored only as activity records

## Technical Design

### Stack
- Gmail API v1 via existing Google OAuth infrastructure (google_oauth.py)
- New service: `google_gmail.py` (following pattern of google_calendar.py, google_drive.py)
- Background tasks: asyncio tasks for batch sending and Gmail polling
- Existing patterns for all CRUD, API routes, and frontend components

### Data Model Changes

```
lead_activities (NEW)
├── id (UUID, PK)
├── lead_id (FK → leads, CASCADE)
├── activity_type (ENUM: outbound_email, inbound_email, proposal_sent, note, outbound_call, inbound_call, meeting)
├── subject (VARCHAR, nullable) — email subject or activity title
├── body (TEXT, nullable) — email body or note content
├── gmail_message_id (VARCHAR, nullable) — for dedup and threading
├── gmail_thread_id (VARCHAR, nullable) — for polling replies
└── created_at (TIMESTAMP)

leads (MODIFIED)
├── status: ENUM updated → new, contacted, follow_up, responded, negotiating, won, lost, on_hold
└── (all other fields unchanged)

batch_outreach_jobs (NEW)
├── id (UUID, PK)
├── user_id (FK → users)
├── status (ENUM: preparing, sending, paused, completed, cancelled, failed)
├── total_count (INT)
├── sent_count (INT, default 0)
├── failed_count (INT, default 0)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

batch_outreach_items (NEW)
├── id (UUID, PK)
├── job_id (FK → batch_outreach_jobs, CASCADE)
├── lead_id (FK → leads)
├── subject (VARCHAR)
├── body (TEXT) — proposal email body
├── status (ENUM: queued, sending, sent, failed, skipped)
├── error_message (TEXT, nullable)
├── sent_at (TIMESTAMP, nullable)
└── created_at (TIMESTAMP)
```

Indexes:
- `ix_lead_activities_lead_id` (lead_id) — timeline queries
- `ix_lead_activities_gmail_thread` (gmail_thread_id) — polling lookups
- `ix_batch_items_job_status` (job_id, status) — progress queries

### API Design

**Activities:**
- `POST /api/leads/{id}/activities` — create activity (manual note, call, etc.)
- `GET /api/leads/{id}/activities` — list activities for lead (paginated, chronological)
- `DELETE /api/leads/activities/{id}` — delete activity

**Gmail:**
- `POST /api/leads/{id}/send-email` — send email to lead, auto-create activity
- `POST /api/gmail/check-replies` — trigger manual poll for replies (also runs on schedule)
- `GET /api/gmail/status` — check Gmail connection status and scopes

**Batch Outreach:**
- `POST /api/outreach/batch/prepare` — filter leads + generate missing proposals → return batch preview
- `POST /api/outreach/batch/send` — start batch send job
- `GET /api/outreach/batch/{job_id}` — get batch job status + per-item progress
- `POST /api/outreach/batch/{job_id}/pause` — pause batch
- `POST /api/outreach/batch/{job_id}/cancel` — cancel remaining

### Gmail Integration Architecture

```
Sending:
  UI "Send Email" → POST /api/leads/{id}/send-email
    → google_gmail.py send_email(to, subject, body)
    → Gmail API messages.send()
    → Store gmail_message_id + gmail_thread_id in activity
    → Update lead status if applicable

Polling:
  Background task (every 5 min):
    → Query all lead_activities with gmail_thread_id (distinct)
    → For each thread: Gmail API threads.get(id, format=metadata)
    → If new messages found → create inbound_email activity
    → Update lead status if applicable

Batch:
  POST /api/outreach/batch/send → create batch_outreach_job
    → asyncio.create_task(process_batch_job(job_id))
    → For each item: send email → update item status → sleep(random 120-180s)
    → Update job counters in real-time
    → Frontend polls GET /api/outreach/batch/{job_id} for progress
```

### Frontend Changes

**Lead Detail Dialog — new "Activity" tab/section:**
- Chronological timeline (newest first)
- Each activity: icon by type, subject, timestamp, expandable body
- Quick-add buttons: "Note", "Log call", "Log meeting"
- Email compose section with subject + body fields

**Batch Outreach — new UI flow:**
- Filter bar + "Prepare Batch" button on leads tab
- Batch preview dialog: table with columns [Lead, Industry, Subject, Proposal, Include ✓]
- Expandable rows to edit proposal text
- "Send All" → progress dialog
- Progress dialog: progress bar, per-lead status list, pause/cancel buttons

## Implementation Phases

### Phase 1: Activity Log & Extended Statuses
- Migrate statuses (6 → 8) with data migration
- Create `lead_activities` table + API
- Activity timeline UI in lead detail card
- Manual activity creation (notes, calls, meetings)
- Update kanban, filters, analytics for new statuses

### Phase 2: Gmail Integration — Send & Track
- Add Gmail scopes to Google OAuth (incremental)
- `google_gmail.py` service (send, read thread)
- Send email from lead card UI
- Auto-log outbound emails as activities
- Auto-status transitions on send
- Gmail reply polling (background task)
- Auto-log inbound emails, auto-status on reply

### Phase 3: Batch Outreach
- Batch proposal generation (filter → generate missing)
- Batch preview/edit screen
- `batch_outreach_jobs` + `batch_outreach_items` tables
- Background batch send with rate limiting
- Progress UI with pause/cancel
- Resume on backend restart (P1)

## Out of Scope

- Telegram / WhatsApp / SMS integration
- Email templates beyond AI-generated proposals
- Lead scoring / qualification algorithms
- Team collaboration / lead assignment
- Gmail push notifications via Pub/Sub (polling is sufficient for expected volume)
- Email open/click tracking
- Multi-language proposals

## Acceptance Criteria

- [ ] AC-1: Statuses updated to 8-value set; existing leads migrated correctly
- [ ] AC-2: Activity timeline visible in lead card with chronological history
- [ ] AC-3: User can send email from lead card; email appears in Gmail sent folder
- [ ] AC-4: Outbound email auto-logged as activity with gmail_message_id
- [ ] AC-5: Lead status auto-transitions: new → contacted on first send
- [ ] AC-6: Incoming reply detected by polling and logged as inbound_email activity
- [ ] AC-7: Lead status auto-transitions: contacted → responded on reply
- [ ] AC-8: User can prepare batch (filter + generate proposals), preview, edit, and send
- [ ] AC-9: Batch send runs in background with rate limiting (2-3 min intervals)
- [ ] AC-10: Progress UI shows real-time status per lead with pause/cancel

## Risks & Open Questions

- **Risk:** Gmail OAuth scope upgrade may require user re-authorization. Mitigation: incremental authorization flow preserves existing tokens
- **Risk:** Gmail polling at scale — many threads could be slow. Mitigation: for expected volume (tens-hundreds of leads) this is negligible; optimize only if needed
- **Risk:** Batch send interrupted by backend restart. Mitigation: Phase 3 P1 — persist job state, resume on startup
- **Spam risk:** Minimal — AI-generated proposals are unique per lead, sent from real Gmail, rate-limited to 20-30/hour, expected volume is tens of contacts per batch
