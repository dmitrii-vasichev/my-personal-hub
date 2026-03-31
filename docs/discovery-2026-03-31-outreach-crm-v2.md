# Discovery: Outreach CRM v2 — Activity Log, Gmail Integration & Batch Outreach

## Metadata
| Field | Value |
|-------|-------|
| Date | 2026-03-31 |
| Status | Discovery complete |

## Summary

Evolve the existing Outreach module from a simple kanban board into a full CRM with interaction tracking, Gmail integration, and batch outreach capabilities.

### Current State
- Kanban with 6 statuses: new, sent, replied, in_progress, rejected, on_hold
- Status history tracking (status changes only, no activity log)
- PDF parsing → lead creation (GPT-4o Vision)
- AI proposal generation (per lead, with industry templates from Google Drive)
- Duplicate detection (email + phone)
- Google OAuth already configured (Calendar + Drive scopes, encrypted token storage, refresh mechanism)

### What's Missing
- No activity/interaction log beyond status changes
- No email sending from the interface
- No way to see conversation history in a lead card
- No batch proposal generation or batch sending
- Statuses don't capture the nuance of ongoing conversations

## Key Decisions

### 1. Extended Kanban Statuses
Replace current 6 statuses with 8:
```
Pipeline: new → contacted → follow_up → responded → negotiating
Terminal: won, lost, on_hold
```
- `contacted` replaces `sent` — first outreach made
- `follow_up` — sent again, no reply yet (distinguishes from single contact)
- `responded` replaces `replied` — lead replied at least once
- `negotiating` replaces `in_progress` — active back-and-forth discussion
- `won` — deal closed / collaboration started
- `lost` replaces `rejected` — explicit refusal or dead end

### 2. Activity Log
New table `lead_activities`:
- `id`, `lead_id`, `activity_type`, `subject`, `body`, `gmail_message_id`, `gmail_thread_id`, `created_at`
- Types: `outbound_email`, `inbound_email`, `proposal_sent`, `note`, `outbound_call`, `inbound_call`, `meeting`
- Displayed as chronological timeline in lead detail card

### 3. Gmail Integration — Sending
- Add `gmail.send` scope to existing Google OAuth (incremental authorization)
- Send from lead card: proposal_text → email to lead's address
- Auto-create activity `outbound_email` with `gmail_message_id` and `gmail_thread_id`
- Auto-transition status: `new → contacted`

### 4. Gmail Integration — Incoming Tracking
- Add `gmail.readonly` scope
- Background polling (every 5-10 min) checks saved `thread_id`s for new messages
- New inbound message → auto-create activity `inbound_email`
- Auto-transition status: `contacted → responded`
- Full email thread visible in lead card without opening Gmail

### 5. Batch Outreach Flow
- Filter leads (e.g., all `new` in industry "Restaurants")
- Click "Prepare batch" → AI generates proposals for leads missing `proposal_text`
- Preview screen: table with expandable proposals, editable, toggleable per lead
- "Send" → backend queue sends emails with 2-3 min random delay between each
- Preview screen becomes progress screen:
  - Progress bar (12/25 sent)
  - Per-lead status: ✅ sent, ⏳ next, ⏸ queued
  - "Pause" and "Cancel remaining" buttons
  - Page can be closed — sending continues on backend
  - Notification when complete

### 6. Both Workflows Supported
- **Single**: Open card → generate proposal → review → send email
- **Batch**: Filter → prepare batch → preview/edit → send all with progress tracking

## Stack
- Gmail API v1 via existing Google OAuth infrastructure
- Backend queue for delayed sending (asyncio tasks or background worker)
- Existing patterns: google_oauth.py, google_calendar.py, google_drive.py → new google_gmail.py

## MVP Scope
- Extended statuses with migration of existing data
- Activity log table + timeline UI in lead card
- Gmail send from card (single)
- Gmail incoming tracking (polling by thread_id)
- Batch proposal generation
- Batch send with progress tracking

## Out of Scope
- Telegram / WhatsApp / SMS integration
- Email templates (beyond AI-generated proposals)
- Lead scoring / qualification algorithms
- Team collaboration / lead assignment
- Webhook-based Gmail push notifications (Pub/Sub) — polling is sufficient for MVP
- Email open/click tracking

## Open Questions
- None — all decisions made during discovery

## Spam Mitigation Strategy
- Gmail limits: 500/day (regular) or 2000/day (Workspace)
- AI-generated proposals are unique per lead — not template spam
- Sending from real Gmail account (not bulk sender)
- Rate limiting: 20-30 emails/hour max, 2-3 min random interval
- Skip leads without email addresses
- For the expected volume (tens of contacts) — minimal spam risk
