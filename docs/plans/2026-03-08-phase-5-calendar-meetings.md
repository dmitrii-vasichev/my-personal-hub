# Phase 5: Calendar & Meetings

**PRD Reference:** FR-31 through FR-36
**Date:** 2026-03-08
**Phase:** 5 of 6

## Overview

Add Google Calendar integration with bidirectional sync, weekly/monthly calendar views, local event creation, and meeting notes. Users can connect their Google Calendar via OAuth2, view all events in the portal, create new events that sync back to Google, and attach local notes to any meeting.

## GitHub Issues

| Task | Issue | Title |
|------|-------|-------|
| 1 | #47 | DB Migration — Calendar Events, Event Notes, Google OAuth Tokens |
| 2 | #48 | Pydantic Schemas for Calendar Module |
| 3 | #49 | Backend — Calendar Events CRUD Service + Router |
| 4 | #50 | Backend — Event Notes CRUD |
| 5 | #51 | Backend — Google OAuth2 Flow |
| 6 | #52 | Backend — Google Calendar Sync Service |
| 7 | #53 | Frontend — Calendar Types + API Hooks |
| 8 | #54 | Frontend — Calendar Page with Month View |
| 9 | #55 | Frontend — Calendar Week View |
| 10 | #56 | Frontend — Create/Edit Event Dialog |
| 11 | #57 | Frontend — Event Detail Page + Notes |
| 12 | #58 | Frontend — Google Calendar Connect UI |
| 13 | #59 | Backend + Frontend Tests |

## Tasks

### Task 1: DB Migration — Calendar Events, Event Notes, Google OAuth Tokens (#47)

**Description:** Create Alembic migration `005` with three tables: `calendar_events`, `event_notes`, and `google_oauth_tokens`. Create corresponding SQLAlchemy models.

**Files:**
- `backend/app/models/calendar.py` (new)
- `backend/alembic/versions/005_create_calendar_tables.py` (new)
- `backend/alembic/env.py` (add import)

**Schema:**

```
calendar_events:
  id: int PK
  user_id: int FK(users.id, ondelete=CASCADE), index
  google_event_id: str nullable, unique index
  title: str not null
  description: text nullable
  start_time: datetime(tz) not null
  end_time: datetime(tz) not null
  location: str nullable
  all_day: bool default false
  source: enum('local', 'google') default 'local'
  synced_at: datetime(tz) nullable
  created_at: datetime(tz) server_default=now()
  updated_at: datetime(tz) server_default=now(), onupdate=now()

event_notes:
  id: int PK
  event_id: int FK(calendar_events.id, ondelete=CASCADE), index
  user_id: int FK(users.id, ondelete=CASCADE)
  content: text not null
  created_at: datetime(tz) server_default=now()
  updated_at: datetime(tz) server_default=now(), onupdate=now()

google_oauth_tokens:
  id: int PK
  user_id: int FK(users.id, ondelete=CASCADE), unique index
  access_token: str (encrypted via Fernet)
  refresh_token: str (encrypted via Fernet)
  token_expiry: datetime(tz)
  calendar_id: str default 'primary'
  created_at: datetime(tz) server_default=now()
  updated_at: datetime(tz) server_default=now(), onupdate=now()
```

**Acceptance Criteria:**
- [ ] Migration runs without errors (`alembic upgrade head`)
- [ ] Migration rollback works (`alembic downgrade 004`)
- [ ] Models follow existing patterns (Mapped, mapped_column)
- [ ] Fernet encryption used for OAuth tokens (reuse existing `encrypt_value`/`decrypt_value`)

**Verification:** `cd backend && alembic upgrade head && alembic downgrade 004 && alembic upgrade head`

---

### Task 2: Pydantic Schemas for Calendar Module

**Description:** Create Pydantic v2 schemas for calendar events, event notes, and Google OAuth status.

**Files:**
- `backend/app/schemas/calendar.py` (new)

**Schemas:**
- `CalendarEventCreate` — title, description, start_time, end_time, location, all_day
- `CalendarEventUpdate` — all fields optional
- `CalendarEventResponse` — full event with id, notes count, source, synced_at
- `EventNoteCreate` — content
- `EventNoteUpdate` — content
- `EventNoteResponse` — id, event_id, user_id, content, timestamps
- `GoogleOAuthStatus` — connected (bool), calendar_id, last_synced

**Acceptance Criteria:**
- [ ] All schemas validate correctly
- [ ] Response schemas include all necessary fields
- [ ] Follow existing Pydantic v2 patterns (model_config, from_attributes)

---

### Task 3: Backend — Calendar Events CRUD Service + Router

**Description:** Implement local calendar event CRUD (without Google sync). Create service layer and API router.

**Files:**
- `backend/app/services/calendar.py` (new)
- `backend/app/api/calendar.py` (new)
- `backend/app/main.py` (add router)

**Endpoints:**
- `GET /api/calendar/events/` — list events with date range filter (start, end query params)
- `GET /api/calendar/events/{id}` — get event with notes
- `POST /api/calendar/events/` — create event (source='local')
- `PATCH /api/calendar/events/{id}` — update event
- `DELETE /api/calendar/events/{id}` — delete event

**Acceptance Criteria:**
- [ ] CRUD operations work for local events
- [ ] Date range filtering works (events between start and end)
- [ ] Admin sees all events, user sees only own
- [ ] Event detail includes notes list
- [ ] Tests pass

**Verification:** Run tests + manual curl for each endpoint

---

### Task 4: Backend — Event Notes CRUD

**Description:** Add endpoints for managing notes on calendar events (stored locally, never synced to Google).

**Files:**
- `backend/app/services/calendar.py` (extend)
- `backend/app/api/calendar.py` (extend)

**Endpoints:**
- `GET /api/calendar/events/{event_id}/notes/` — list notes for event
- `POST /api/calendar/events/{event_id}/notes/` — add note
- `PATCH /api/calendar/notes/{note_id}` — update note
- `DELETE /api/calendar/notes/{note_id}` — delete note

**Acceptance Criteria:**
- [ ] Notes CRUD works
- [ ] User can only edit/delete own notes
- [ ] Deleting event cascades to notes
- [ ] Tests pass

---

### Task 5: Backend — Google OAuth2 Flow

**Description:** Implement Google OAuth2 connect/disconnect flow. Store encrypted tokens. Add config for Google credentials.

**Files:**
- `backend/app/services/google_oauth.py` (new)
- `backend/app/api/calendar.py` (extend with OAuth endpoints)
- `backend/app/core/config.py` (add Google env vars)
- `backend/requirements.txt` (add google packages)

**Endpoints:**
- `GET /api/calendar/oauth/connect` — returns Google OAuth2 authorization URL
- `GET /api/calendar/oauth/callback` — handles OAuth callback, stores tokens
- `POST /api/calendar/oauth/disconnect` — revokes tokens, deletes from DB
- `GET /api/calendar/oauth/status` — returns connection status

**Dependencies to add:**
```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-api-python-client>=2.0.0
```

**Config env vars:**
```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

**Acceptance Criteria:**
- [ ] OAuth flow redirects to Google consent screen
- [ ] Callback stores encrypted access_token + refresh_token
- [ ] Disconnect revokes token and removes from DB
- [ ] Status endpoint returns correct connected state
- [ ] Token refresh handled automatically when expired
- [ ] Tests pass (mocked Google API)

---

### Task 6: Backend — Google Calendar Sync Service

**Description:** Implement bidirectional sync: pull events from Google Calendar, push local events to Google.

**Files:**
- `backend/app/services/google_calendar.py` (new)
- `backend/app/api/calendar.py` (extend with sync endpoints)

**Endpoints:**
- `POST /api/calendar/sync` — trigger full sync (pull + push)
- `GET /api/calendar/events/` — (modify) auto-sync if stale (>5 min since last sync)

**Sync Logic:**
1. **Pull:** Fetch events from Google Calendar API → upsert into `calendar_events` (match by `google_event_id`)
2. **Push:** Local events (source='local', no google_event_id) → create on Google Calendar → save `google_event_id`
3. **Update:** If local event has google_event_id and was updated locally → push update to Google
4. **Delete:** If Google event was deleted → mark local event as deleted or remove

**Acceptance Criteria:**
- [ ] Pull creates new events and updates existing ones
- [ ] Push creates events on Google Calendar and stores google_event_id
- [ ] Sync handles token refresh
- [ ] Graceful handling when Google API is unavailable
- [ ] Events without Google connection still work (local-only mode)
- [ ] Tests pass (mocked Google API)

---

### Task 7: Frontend — Calendar Types + API Hooks

**Description:** Create TypeScript types and TanStack Query hooks for calendar module.

**Files:**
- `frontend/src/types/calendar.ts` (new)
- `frontend/src/hooks/use-calendar.ts` (new)

**Types:**
- `CalendarEvent` — id, userId, googleEventId, title, description, startTime, endTime, location, allDay, source, syncedAt, notesCount, createdAt, updatedAt
- `EventNote` — id, eventId, userId, content, createdAt, updatedAt
- `GoogleOAuthStatus` — connected, calendarId, lastSynced
- `CalendarEventCreate`, `CalendarEventUpdate`

**Hooks:**
- `useCalendarEvents(start, end)` — query events in date range
- `useCalendarEvent(id)` — single event with notes
- `useCreateCalendarEvent()` — mutation
- `useUpdateCalendarEvent()` — mutation
- `useDeleteCalendarEvent()` — mutation
- `useEventNotes(eventId)` — query notes
- `useCreateEventNote()` — mutation
- `useUpdateEventNote()` — mutation
- `useDeleteEventNote()` — mutation
- `useGoogleOAuthStatus()` — query connection status
- `useSyncCalendar()` — trigger sync mutation

**Acceptance Criteria:**
- [ ] All types match backend schemas
- [ ] Hooks follow existing pattern (useQuery/useMutation + invalidation)
- [ ] Calendar events query uses date range params

---

### Task 8: Frontend — Calendar Page with Month View

**Description:** Create the main calendar page with a month grid view. Shows events as colored dots/bars on dates.

**Files:**
- `frontend/src/app/(dashboard)/calendar/page.tsx` (new)
- `frontend/src/components/calendar/month-view.tsx` (new)
- `frontend/src/components/calendar/event-pill.tsx` (new)

**UI Spec (per design-brief.md):**
- Month grid: 7 columns (Mon–Sun), 5-6 rows
- Current day highlighted with accent border
- Events shown as small pills (title truncated, colored by source)
- Navigation: prev/next month buttons + "Today" button
- Click on date → open create event dialog (pre-filled date)
- Click on event pill → navigate to event detail page
- Header: "Calendar" h1 + "New Event" button + view toggle (Month/Week) + Google sync status

**Acceptance Criteria:**
- [ ] Month grid renders correctly
- [ ] Events display on correct dates
- [ ] Navigation between months works
- [ ] "Today" button returns to current month
- [ ] Responsive on mobile (stacked or scrollable)
- [ ] Follows design-brief.md colors and spacing

---

### Task 9: Frontend — Calendar Week View

**Description:** Add week view to the calendar page. Shows events as time blocks in a day-hour grid.

**Files:**
- `frontend/src/components/calendar/week-view.tsx` (new)
- `frontend/src/app/(dashboard)/calendar/page.tsx` (extend with view toggle)

**UI Spec:**
- 7-day columns with hour rows (8:00–22:00 visible, scrollable)
- Events as positioned blocks (top = start_time, height = duration)
- All-day events in a separate row at the top
- Navigation: prev/next week + "Today" button
- Click on empty slot → create event dialog (pre-filled date + time)

**Acceptance Criteria:**
- [ ] Week grid renders correctly with hour markers
- [ ] Events positioned by time and duration
- [ ] All-day events shown separately
- [ ] Navigation between weeks works
- [ ] View toggle between Month/Week persists selection

---

### Task 10: Frontend — Create/Edit Event Dialog

**Description:** Dialog form for creating and editing calendar events.

**Files:**
- `frontend/src/components/calendar/event-dialog.tsx` (new)

**Form Fields:**
- Title (required)
- Description (optional, textarea)
- Start date + time (required)
- End date + time (required)
- Location (optional)
- All-day toggle (when on, hide time pickers)

**Acceptance Criteria:**
- [ ] Create event works and refreshes calendar
- [ ] Edit event pre-fills form
- [ ] Validation: title required, end > start
- [ ] All-day toggle hides/shows time inputs
- [ ] Dialog follows design-brief.md (shadcn Dialog, 480px max-width)
- [ ] If Google connected, new events sync automatically

---

### Task 11: Frontend — Event Detail Page + Notes

**Description:** Event detail page at `/calendar/[id]` showing full event info and notes list.

**Files:**
- `frontend/src/app/(dashboard)/calendar/[id]/page.tsx` (new)
- `frontend/src/components/calendar/event-notes.tsx` (new)

**Layout:**
- Event title as page heading
- Meta info: date/time, location, source (local/Google), sync status
- Edit/Delete buttons
- Notes section: list of notes with add form
- Each note: content, author, timestamp, edit/delete actions

**Acceptance Criteria:**
- [ ] Event details display correctly
- [ ] Notes CRUD works inline (no page reload)
- [ ] Delete event with confirmation dialog
- [ ] Back link to calendar page
- [ ] Follows design-brief.md styles

---

### Task 12: Frontend — Google Calendar Connect UI

**Description:** Add Google Calendar connection controls to the calendar page header or settings page.

**Files:**
- `frontend/src/components/calendar/google-connect.tsx` (new)
- `frontend/src/app/(dashboard)/calendar/page.tsx` (extend)

**UI:**
- Connection status badge in calendar header (Connected/Not connected)
- "Connect Google Calendar" button → opens OAuth popup/redirect
- When connected: "Sync Now" button + "Disconnect" option
- Last synced timestamp display

**Acceptance Criteria:**
- [ ] Connect button redirects to Google OAuth
- [ ] Callback handles token storage
- [ ] Status updates after connect/disconnect
- [ ] Sync button triggers manual sync
- [ ] Disconnect shows confirmation

---

### Task 13: Backend + Frontend Tests

**Description:** Write tests for all new calendar endpoints and critical frontend interactions.

**Files:**
- `backend/tests/test_calendar.py` (new)
- `backend/tests/test_google_oauth.py` (new)

**Backend Tests:**
- Calendar events CRUD (create, read, update, delete, list with date range)
- Event notes CRUD
- Google OAuth endpoints (mocked Google API)
- Sync service (mocked Google API)
- Access control (user sees only own events)
- Edge cases: all-day events, overlapping events

**Acceptance Criteria:**
- [ ] All backend tests pass
- [ ] Google API calls are mocked (no real API calls in tests)
- [ ] Lint passes
- [ ] Build succeeds

**Verification:** `cd backend && python -m pytest tests/test_calendar.py tests/test_google_oauth.py -v`

---

## Task Dependencies

```
Task 1 (DB) ─────────┬──→ Task 2 (Schemas) ──→ Task 3 (CRUD) ──→ Task 4 (Notes)
                      │                                │
                      │                                └──→ Task 5 (OAuth) ──→ Task 6 (Sync)
                      │
                      └──→ Task 7 (FE Types) ──→ Task 8 (Month) ──→ Task 9 (Week)
                                    │                      │
                                    │                      └──→ Task 10 (Dialog)
                                    │
                                    └──→ Task 11 (Detail) ──→ Task 12 (Google UI)

Task 13 (Tests) — after Tasks 3-6 (backend) are done
```

## Execution Order

1. Task 1 — DB Migration + Models
2. Task 2 — Pydantic Schemas
3. Task 3 — Calendar Events CRUD (backend)
4. Task 4 — Event Notes CRUD (backend)
5. Task 5 — Google OAuth2 Flow (backend)
6. Task 6 — Google Calendar Sync (backend)
7. Task 7 — Frontend Types + Hooks
8. Task 8 — Month View
9. Task 9 — Week View
10. Task 10 — Create/Edit Event Dialog
11. Task 11 — Event Detail Page + Notes
12. Task 12 — Google Calendar Connect UI
13. Task 13 — Tests
