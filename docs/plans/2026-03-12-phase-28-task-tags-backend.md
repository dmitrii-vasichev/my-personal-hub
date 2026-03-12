# Phase 28: Task Tags — Backend

**PRD:** `docs/prd-task-tags.md`
**Phase:** 28 (of 30 for Task Tags feature)
**Scope:** FR-1 through FR-5 — Data model, Tag CRUD API, Task–Tag assignment, Tag filter, Bulk tag endpoint

---

## Tasks

### Task 1: Alembic Migration — `tags` and `task_tags` tables
**Issue title:** `[Phase 28, Task 1] Alembic migration for tags and task_tags tables`
**Description:** Create migration `021_add_tags.py` with:
- `tags` table: `id` (PK), `user_id` (FK → users, CASCADE), `name` (varchar 50), `color` (varchar 7, default `#4f8ef7`), `created_at` (timestamptz)
- Unique constraint `uq_tags_user_name` on `(user_id, name)`
- Index `ix_tags_user_id` on `user_id`
- `task_tags` join table: `task_id` (FK → tasks, CASCADE), `tag_id` (FK → tags, CASCADE), composite PK
- Index `ix_task_tags_tag_id` on `tag_id`

**Files:** `backend/alembic/versions/021_add_tags.py`
**Acceptance criteria:**
- [ ] Migration runs without errors (`alembic upgrade head`)
- [ ] Downgrade drops both tables cleanly
- [ ] Foreign keys cascade on delete

---

### Task 2: Tag and TaskTag ORM Models
**Issue title:** `[Phase 28, Task 2] Tag and TaskTag SQLAlchemy models`
**Description:** Create `backend/app/models/tag.py` with `Tag` and `TaskTag` models. Add `tags` relationship to `Task` model (secondary="task_tags", lazy="noload"). Register models in `models/__init__.py`.

**Files:** `backend/app/models/tag.py`, `backend/app/models/task.py`, `backend/app/models/__init__.py`
**Acceptance criteria:**
- [ ] `Tag` model with id, user_id, name, color, created_at
- [ ] `TaskTag` model with composite PK (task_id, tag_id)
- [ ] `Task.tags` relationship defined
- [ ] Models importable from `app.models`

---

### Task 3: Tag Pydantic Schemas
**Issue title:** `[Phase 28, Task 3] Tag Pydantic schemas`
**Description:** Create `backend/app/schemas/tag.py` with: `TagCreate`, `TagUpdate`, `TagBrief`, `TagResponse`, `BulkTagRequest`, `BulkTagResponse`. Extend task schemas: add `tag_ids` to `TaskCreate`/`TaskUpdate`, add `tags: list[TagBrief]` to `TaskResponse`.

**Files:** `backend/app/schemas/tag.py`, `backend/app/schemas/task.py`
**Acceptance criteria:**
- [ ] TagCreate: name (str, max 50), color (str, default #4f8ef7)
- [ ] TagUpdate: optional name, optional color
- [ ] TagBrief: id, name, color (from_attributes=True)
- [ ] TagResponse: extends TagBrief + task_count, created_at
- [ ] BulkTagRequest: task_ids, add_tag_ids, remove_tag_ids
- [ ] TaskCreate has `tag_ids: list[int] = []`
- [ ] TaskUpdate has `tag_ids: list[int] | None = None`
- [ ] TaskResponse has `tags: list[TagBrief] = []`

---

### Task 4: Tag Service — CRUD Operations
**Issue title:** `[Phase 28, Task 4] Tag service with CRUD operations`
**Description:** Create `backend/app/services/tag.py` with:
- `get_user_tags(db, user_id)` — list all tags ordered by name, with task_count via subquery
- `create_tag(db, user_id, data)` — validate unique name (case-insensitive), enforce 20-tag limit
- `update_tag(db, tag_id, user_id, data)` — validate ownership + unique name
- `delete_tag(db, tag_id, user_id)` — validate ownership, cascade handles task_tags
- `get_tag(db, tag_id, user_id)` — get single tag by id, validate ownership

**Files:** `backend/app/services/tag.py`
**Acceptance criteria:**
- [ ] List returns tags with accurate task_count
- [ ] Create validates unique name (case-insensitive) per user
- [ ] Create enforces 20-tag limit
- [ ] Update validates ownership and unique name
- [ ] Delete validates ownership
- [ ] All functions are async

---

### Task 5: Tag CRUD API Router
**Issue title:** `[Phase 28, Task 5] Tag CRUD API endpoints`
**Description:** Create `backend/app/api/tags.py` with router prefix `/api/tags`:
- `GET /` — list user's tags
- `POST /` — create tag
- `PATCH /{tag_id}` — update tag
- `DELETE /{tag_id}` — delete tag

Register router in `main.py`.

**Files:** `backend/app/api/tags.py`, `backend/app/main.py`
**Acceptance criteria:**
- [ ] All endpoints require authentication (get_current_user)
- [ ] GET returns list of TagResponse with task_count
- [ ] POST returns 201 with created TagResponse
- [ ] POST returns 409 on duplicate name, 400 on tag limit exceeded
- [ ] PATCH returns updated TagResponse, 404 if not found/not owned
- [ ] DELETE returns 204, 404 if not found/not owned
- [ ] Router registered in main.py

---

### Task 6: Task Service — Tag Assignment on Create/Update
**Issue title:** `[Phase 28, Task 6] Integrate tag assignment into task create/update`
**Description:** Modify `task.py` service:
- `create_task`: after creating task, insert `task_tags` rows for provided `tag_ids` (validate tag ownership)
- `update_task`: if `tag_ids` is not None, delete existing `task_tags` + insert new ones
- Eager-load tags in task queries (selectinload)

**Files:** `backend/app/services/task.py`
**Acceptance criteria:**
- [ ] Creating a task with tag_ids creates task_tags rows
- [ ] tag_ids are validated to belong to current user
- [ ] Updating with tag_ids replaces all task_tags
- [ ] Updating with tag_ids=None leaves tags unchanged
- [ ] Tags are included in task responses

---

### Task 7: Kanban & List — Eager Load Tags + Tag Filter
**Issue title:** `[Phase 28, Task 7] Eager load tags in kanban/list and add tag_id filter`
**Description:** Modify task service:
- Add `selectinload(Task.tags)` to `list_tasks` and `get_kanban_board` queries
- Add `tag_id: int | None` parameter to `list_tasks` — filter via JOIN on `task_tags`
- Add `tag_id` query param to kanban and list API endpoints

**Files:** `backend/app/services/task.py`, `backend/app/api/tasks.py`
**Acceptance criteria:**
- [ ] Tasks in kanban/list responses include `tags` field
- [ ] `tag_id` filter returns only tasks with that tag
- [ ] Tag filter combines with existing filters (search, priority, status)
- [ ] No N+1 queries for tags

---

### Task 8: Bulk Tag Assignment Endpoint
**Issue title:** `[Phase 28, Task 8] Bulk tag assignment API endpoint`
**Description:** Add `POST /api/tasks/bulk-tag` endpoint:
- Body: `BulkTagRequest` (task_ids, add_tag_ids, remove_tag_ids)
- Validate all task_ids and tag_ids belong to current user
- Add/remove tags from multiple tasks
- Return `BulkTagResponse` with affected_tasks count
- Add `bulk_tag` function to tag service

**Files:** `backend/app/services/tag.py`, `backend/app/api/tasks.py`
**Acceptance criteria:**
- [ ] Adds specified tags to all specified tasks
- [ ] Removes specified tags from all specified tasks
- [ ] Validates ownership of all tasks and tags
- [ ] Returns count of affected tasks
- [ ] Handles up to 50 tasks per request

---

### Task 9: Backend Tests for Tag System
**Issue title:** `[Phase 28, Task 9] Tests for tag CRUD, assignment, filter, and bulk operations`
**Description:** Write tests covering:
- Tag CRUD (create, list, update, delete)
- Unique name validation (case-insensitive)
- 20-tag limit
- Task create/update with tags
- Kanban endpoint returns tags
- Tag filter
- Bulk tag operations
- Ownership validation

**Files:** `backend/tests/test_tags.py`
**Acceptance criteria:**
- [ ] All tag CRUD operations tested
- [ ] Unique name constraint tested
- [ ] Tag limit tested
- [ ] Task–tag integration tested
- [ ] Filter by tag tested
- [ ] Bulk operations tested
- [ ] All tests pass

---

## Dependencies

```
Task 1 (migration) → Task 2 (models) → Task 3 (schemas)
Task 3 → Task 4 (service) → Task 5 (API)
Task 4 → Task 6 (task service integration)
Task 6 → Task 7 (kanban/list + filter)
Task 4 → Task 8 (bulk tag)
Task 5 + Task 7 + Task 8 → Task 9 (tests)
```

## Execution Order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
