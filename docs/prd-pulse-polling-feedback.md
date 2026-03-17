# PRD: Pulse Polling Feedback

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-16 |
| Status | Approved |
| Priority | P1 |

## Problem Statement
When a user clicks "Poll Now" or a scheduled poll runs in the background, the only feedback is a brief toast "Polling started for N sources" that disappears after a few seconds. After that, there is no indication of whether polling is in progress, has completed, or has failed. The user has no way to know if new messages were collected or if something went wrong.

## User Scenarios

### Scenario 1: Manual Poll
**As a** user, **I want to** see polling progress and results after clicking "Poll Now", **so that** I know whether new messages were found and when polling finished.

### Scenario 2: Scheduled Poll
**As a** user, **I want to** see the result of the last automatic poll (when it ran, how many messages were found), **so that** I can verify the system is working without manually triggering polls.

## Functional Requirements

### P0 (Must Have)
- [ ] FR-1: Add `poll_status` field to PulseSource model (`idle` | `polling` | `error`)
- [ ] FR-2: Add `last_poll_error` field to PulseSource model (nullable string)
- [ ] FR-3: Add `last_poll_message_count` field to PulseSource model (number of new messages found in last poll)
- [ ] FR-4: Backend updates `poll_status` to `polling` before starting collection for each source
- [ ] FR-5: Backend updates `poll_status` to `idle` on success, `error` on failure (with `last_poll_error` message)
- [ ] FR-6: Backend updates `last_poll_message_count` after successful collection
- [ ] FR-7: New API endpoint `GET /api/pulse/sources/poll-status` — returns current poll status for all active sources (lightweight, no auth overhead beyond token check)
- [ ] FR-8: Frontend polls `/poll-status` every 2 seconds while any source has `poll_status == "polling"`, stops when all sources are `idle` or `error`
- [ ] FR-9: Show inline polling indicator on Sources list — spinner + "Polling..." next to each source being polled
- [ ] FR-10: Show completion toast: "Poll complete: X new messages" (or "Poll complete: no new messages")
- [ ] FR-11: Show error toast if any source failed: "Poll failed for <source>: <error>"
- [ ] FR-12: Auto-refresh sources list, inbox, and latest digest after polling completes

### P1 (Should Have)
- [ ] FR-13: Show last poll result on each source card: "Last poll: 5 min ago · 3 new messages" or "Last poll: 2 min ago · error"
- [ ] FR-14: Scheduled poll results visible without manual page refresh — next time user opens Sources page, they see updated `last_polled_at` and `last_poll_message_count`

## Non-Functional Requirements
- Performance: `/poll-status` endpoint must respond in < 50ms (simple DB query, no joins)
- No WebSocket/SSE needed — simple short-polling is sufficient for this use case
- Polling interval (2s) should stop automatically after 5 minutes max (safety timeout)

## Technical Design

### Stack
- Backend: FastAPI + SQLAlchemy (existing)
- Frontend: React Query mutations/queries (existing pattern)
- DB: PostgreSQL — 3 new columns on `pulse_sources` table

### Chosen Approach
**Short-polling from frontend** — the simplest approach that gives good UX:

1. Backend adds 3 fields to `PulseSource`: `poll_status`, `last_poll_error`, `last_poll_message_count`
2. `pulse_collector.py` updates these fields during collection (before/after each source)
3. New lightweight endpoint `/poll-status` returns status for all sources
4. Frontend starts polling `/poll-status` every 2s after triggering manual poll OR on page load if any source shows `polling` status
5. Frontend stops polling when all sources are `idle`/`error`, shows result toast, invalidates React Query caches

### Data Model Changes
```sql
ALTER TABLE pulse_sources ADD COLUMN poll_status VARCHAR(10) NOT NULL DEFAULT 'idle';
ALTER TABLE pulse_sources ADD COLUMN last_poll_error TEXT;
ALTER TABLE pulse_sources ADD COLUMN last_poll_message_count INTEGER NOT NULL DEFAULT 0;
```

### API Design
```
GET /api/pulse/sources/poll-status
Response: {
  "sources": [
    {
      "id": 1,
      "title": "Channel Name",
      "poll_status": "polling" | "idle" | "error",
      "last_poll_error": null | "Connection timeout",
      "last_poll_message_count": 5,
      "last_polled_at": "2026-03-16T12:00:00Z"
    }
  ],
  "any_polling": true
}
```

## Out of Scope
- Per-message streaming progress (which message is being processed)
- WebSocket/SSE real-time updates
- Retry mechanism for failed sources (existing behavior: retries on next scheduled poll)
- Push notifications for scheduled poll results

## Open Questions
- None at this point
