# Phase 24: Note Linking — Backend & API

## Overview

Add many-to-many linking between Notes and three entity types: Tasks, Jobs, and Calendar Events. Create link models, services, API endpoints, migration, and backend tests. Follow existing link patterns (TaskEventLink, JobTaskLink, JobEventLink).

## Prerequisites

- Phase 22 merged (Notes backend: Note model, notes service, Drive API)
- Phase 23 merged (Notes page UI)
- Existing link patterns in codebase for reference

## Tasks

### Task 1: Alembic migration for note link tables

**Description:** Create migration `017_add_note_links.py` that adds three join tables: `note_task_links`, `note_job_links`, `note_event_links`.

**Files:**
- NEW `backend/alembic/versions/017_add_note_links.py`

**Details:**
Each table follows the same pattern:
- `id` — Integer, primary key
- `note_id` — Integer, FK → `notes.id` CASCADE, NOT NULL
- `{entity}_id` — Integer, FK → `{entity_table}.id` CASCADE, NOT NULL
- UniqueConstraint on `(note_id, {entity}_id)`
- Indexes on both FK columns

Tables:
1. `note_task_links` — `note_id` + `task_id` (FK → `tasks.id`), constraint `uq_note_task`
2. `note_job_links` — `note_id` + `job_id` (FK → `jobs.id`), constraint `uq_note_job`
3. `note_event_links` — `note_id` + `event_id` (FK → `calendar_events.id`), constraint `uq_note_event`

Downgrade: drop indexes then tables in reverse order.

**Acceptance Criteria:**
- [ ] Migration runs without errors (`alembic upgrade head`)
- [ ] All 3 tables created with correct columns, FKs, constraints, indexes
- [ ] Downgrade works cleanly

**Verification:** `cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

### Task 2: NoteTaskLink model

**Description:** Create SQLAlchemy model for `note_task_links` table.

**Files:**
- NEW `backend/app/models/note_task_link.py`
- MOD `backend/app/models/__init__.py` — export `NoteTaskLink`

**Details:**
Follow `TaskEventLink` pattern exactly:
```python
class NoteTaskLink(Base):
    __tablename__ = "note_task_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (UniqueConstraint("note_id", "task_id", name="uq_note_task"),)
```

**Acceptance Criteria:**
- [ ] Model file created with correct fields and constraints
- [ ] Exported from `models/__init__.py`
- [ ] No import errors

**Verification:** `python -c "from app.models import NoteTaskLink"`

---

### Task 3: NoteJobLink model

**Description:** Create SQLAlchemy model for `note_job_links` table.

**Files:**
- NEW `backend/app/models/note_job_link.py`
- MOD `backend/app/models/__init__.py` — export `NoteJobLink`

**Details:**
Same pattern as Task 2 but with `job_id` FK → `jobs.id`.

```python
class NoteJobLink(Base):
    __tablename__ = "note_job_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (UniqueConstraint("note_id", "job_id", name="uq_note_job"),)
```

**Acceptance Criteria:**
- [ ] Model file created with correct fields and constraints
- [ ] Exported from `models/__init__.py`
- [ ] No import errors

**Verification:** `python -c "from app.models import NoteJobLink"`

---

### Task 4: NoteEventLink model

**Description:** Create SQLAlchemy model for `note_event_links` table.

**Files:**
- NEW `backend/app/models/note_event_link.py`
- MOD `backend/app/models/__init__.py` — export `NoteEventLink`

**Details:**
Same pattern with `event_id` FK → `calendar_events.id`.

```python
class NoteEventLink(Base):
    __tablename__ = "note_event_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    note_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (UniqueConstraint("note_id", "event_id", name="uq_note_event"),)
```

**Acceptance Criteria:**
- [ ] Model file created with correct fields and constraints
- [ ] Exported from `models/__init__.py`
- [ ] No import errors

**Verification:** `python -c "from app.models import NoteEventLink"`

---

### Task 5: LinkedNoteBrief schema

**Description:** Add response schema for linked notes returned from entity endpoints.

**Files:**
- MOD `backend/app/schemas/note.py` — add `LinkedNoteBrief`

**Details:**
```python
class LinkedNoteBrief(BaseModel):
    id: int
    title: str
    folder_path: Optional[str] = None
    google_file_id: str

    model_config = {"from_attributes": True}
```

This schema is used by GET endpoints that return notes linked to a task/job/event. It includes `google_file_id` so the frontend can navigate to the note on the Notes page.

**Acceptance Criteria:**
- [ ] `LinkedNoteBrief` schema exported
- [ ] Includes `id`, `title`, `folder_path`, `google_file_id`
- [ ] No import errors

**Verification:** `python -c "from app.schemas.note import LinkedNoteBrief"`

---

### Task 6: NoteTaskLink service

**Description:** CRUD service for note ↔ task linking. Follow `task_event_link.py` pattern.

**Files:**
- NEW `backend/app/services/note_task_link.py`

**Functions:**
- `async link_note_task(db, note_id, task_id, user) → bool` — create link (idempotent), verify both entities belong to user
- `async unlink_note_task(db, note_id, task_id, user) → bool` — delete link
- `async get_note_linked_tasks(db, note_id, user) → Optional[list[Task]]` — get tasks linked to a note (return None if note not found)
- `async get_task_linked_notes(db, task_id, user) → Optional[list[Note]]` — get notes linked to a task (return None if task not found)
- `async _get_note(db, note_id, user) → Optional[Note]` — private helper
- `async _get_task(db, task_id, user) → Optional[Task]` — private helper

**Pattern details:**
- Both `_get_note` and `_get_task` filter by `user_id == user.id`
- `link_note_task`: check both entities exist, check existing link, create if not exists
- `get_task_linked_notes`: join `Note` with `NoteTaskLink` on `note_id`, filter by `task_id`, order by `Note.title`
- `get_note_linked_tasks`: join `Task` with `NoteTaskLink` on `task_id`, filter by `note_id`, order by `Task.title`

**Acceptance Criteria:**
- [ ] All 6 functions implemented
- [ ] Ownership checks on both entities
- [ ] Idempotent link creation
- [ ] Returns None/False appropriately

**Verification:** Backend tests (Task 10)

---

### Task 7: NoteJobLink service

**Description:** CRUD service for note ↔ job linking. Same pattern as Task 6.

**Files:**
- NEW `backend/app/services/note_job_link.py`

**Functions:**
- `async link_note_job(db, note_id, job_id, user) → bool`
- `async unlink_note_job(db, note_id, job_id, user) → bool`
- `async get_note_linked_jobs(db, note_id, user) → Optional[list[Job]]`
- `async get_job_linked_notes(db, job_id, user) → Optional[list[Note]]`
- `async _get_note(db, note_id, user) → Optional[Note]`
- `async _get_job(db, job_id, user) → Optional[Job]`

**Acceptance Criteria:**
- [ ] All 6 functions implemented
- [ ] Ownership checks, idempotent creation

**Verification:** Backend tests (Task 10)

---

### Task 8: NoteEventLink service

**Description:** CRUD service for note ↔ calendar event linking. Same pattern as Task 6.

**Files:**
- NEW `backend/app/services/note_event_link.py`

**Functions:**
- `async link_note_event(db, note_id, event_id, user) → bool`
- `async unlink_note_event(db, note_id, event_id, user) → bool`
- `async get_note_linked_events(db, note_id, user) → Optional[list[CalendarEvent]]`
- `async get_event_linked_notes(db, event_id, user) → Optional[list[Note]]`
- `async _get_note(db, note_id, user) → Optional[Note]`
- `async _get_event(db, event_id, user) → Optional[CalendarEvent]`

**Acceptance Criteria:**
- [ ] All 6 functions implemented
- [ ] Ownership checks, idempotent creation

**Verification:** Backend tests (Task 10)

---

### Task 9: API endpoints for note linking

**Description:** Add link/unlink/list endpoints to the notes router, plus linked-notes endpoints on tasks, jobs, and calendar routers.

**Files:**
- MOD `backend/app/api/notes.py` — add link endpoints
- MOD `backend/app/api/tasks.py` — add `GET /api/tasks/{task_id}/linked-notes`
- MOD `backend/app/api/jobs.py` — add `GET /api/jobs/{job_id}/linked-notes`
- MOD `backend/app/api/calendar.py` — add `GET /api/calendar/events/{event_id}/linked-notes`

**Endpoints on notes router:**

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| POST | `/api/notes/{note_id}/link-task/{task_id}` | 204 | Link note to task |
| DELETE | `/api/notes/{note_id}/link-task/{task_id}` | 204 | Unlink note from task |
| POST | `/api/notes/{note_id}/link-job/{job_id}` | 204 | Link note to job |
| DELETE | `/api/notes/{note_id}/link-job/{job_id}` | 204 | Unlink note from job |
| POST | `/api/notes/{note_id}/link-event/{event_id}` | 204 | Link note to event |
| DELETE | `/api/notes/{note_id}/link-event/{event_id}` | 204 | Unlink note from event |
| GET | `/api/notes/{note_id}/linked-tasks` | list[TaskBrief] | Get tasks linked to note |
| GET | `/api/notes/{note_id}/linked-jobs` | list[JobBrief] | Get jobs linked to note |
| GET | `/api/notes/{note_id}/linked-events` | list[EventBrief] | Get events linked to note |

**Endpoints on entity routers:**

| Method | Path | Response | Description |
|--------|------|----------|-------------|
| GET | `/api/tasks/{task_id}/linked-notes` | list[LinkedNoteBrief] | Get notes linked to task |
| GET | `/api/jobs/{job_id}/linked-notes` | list[LinkedNoteBrief] | Get notes linked to job |
| GET | `/api/calendar/events/{event_id}/linked-notes` | list[LinkedNoteBrief] | Get notes linked to event |

**Pattern:**
- POST/DELETE return `Response(status_code=204)` on success
- Return 404 with detail message if either entity not found
- All endpoints require `get_current_user` dependency
- Use service functions for all DB operations

**Acceptance Criteria:**
- [ ] All 12 endpoints implemented
- [ ] POST/DELETE return 204
- [ ] GET returns correct linked entities
- [ ] 404 for non-existent entities
- [ ] Auth required on all endpoints

**Verification:** Backend tests (Task 10)

---

### Task 10: Backend tests for note linking

**Description:** Write comprehensive tests for all link services and API endpoints.

**Files:**
- NEW `backend/tests/test_note_task_link.py`
- NEW `backend/tests/test_note_job_link.py`
- NEW `backend/tests/test_note_event_link.py`

**Test cases per link type:**

1. **Service tests:**
   - Link note to entity → returns True
   - Link duplicate → idempotent (returns True, no error)
   - Unlink existing → returns True
   - Unlink non-existent → returns False
   - Get linked entities → returns correct list
   - Get linked entities for non-existent entity → returns None
   - Ownership check → cannot link other user's entities

2. **API tests:**
   - POST link → 204
   - DELETE unlink → 204
   - GET linked entities → 200 + correct list
   - POST with non-existent note → 404
   - POST with non-existent entity → 404
   - GET linked notes from entity router → 200 + correct list
   - Unauthorized → 401

**Acceptance Criteria:**
- [ ] All tests pass (`pytest tests/test_note_*_link.py`)
- [ ] Service and API level coverage
- [ ] Ownership and auth tests included
- [ ] No lint errors

**Verification:** `cd backend && python -m pytest tests/test_note_task_link.py tests/test_note_job_link.py tests/test_note_event_link.py -v`

---

## Task Dependencies

```
Task 1 (migration) ──┐
                     ├──> Tasks 2, 3, 4 (models) ──> Task 5 (schema)
                     │                                    │
                     │                                    ├──> Tasks 6, 7, 8 (services)
                     │                                    │         │
                     │                                    │         ▼
                     │                                    └──> Task 9 (API endpoints)
                     │                                              │
                     │                                              ▼
                     └────────────────────────────────────── Task 10 (tests)
```

## Execution Order

1. Task 1 (migration)
2. Tasks 2, 3, 4 (models — can be parallel)
3. Task 5 (schema)
4. Tasks 6, 7, 8 (services — can be parallel)
5. Task 9 (API endpoints)
6. Task 10 (tests)

## Estimated Scope

- 10 tasks
- 7 new files, 5 modified files
- Focus: models, services, API endpoints, tests
- All backend — no frontend changes in this phase
