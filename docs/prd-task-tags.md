# PRD: Task Tags

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-12 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

Tasks in the Personal Hub currently have no way to be grouped by project, area of life, or context. A user working on multiple projects (e.g. a web portal, job search) while also managing personal tasks (e.g. car maintenance, household chores) sees all tasks mixed together on the Kanban board. There is no mechanism to filter by context and focus on a specific area — the only available filters are search and priority.

A tagging system is needed to let users categorize tasks by project/context, visually distinguish them on the board, and filter to see only relevant tasks.

## Solution: Flat Tags with Many-to-Many Relationship

Flat (non-hierarchical) tags stored as a separate entity with a join table. Each task can have zero or more tags. Tags have a user-defined name and color. Tags are user-scoped (each user has their own set of tags).

### Why flat tags (not hierarchical)
- Simpler to implement and use — no tree navigation when assigning tags
- A task can belong to multiple contexts via multiple tags (e.g. `Work` + `Portal`)
- For a personal tool with 5-15 tags, hierarchy adds unnecessary complexity
- The mental link between tags (e.g. "Portal is part of Work") exists in the user's head and doesn't need to be formalized in the system

## User Scenarios

### Scenario 1: Create Tags for My Contexts
**As a** user, **I want to** create tags like "Work", "Portal", "Personal", "Home", "Car", **so that** I can later assign them to tasks.

### Scenario 2: Assign Tags When Creating a Task
**As a** user, **I want to** select one or more tags when creating a task, **so that** the task is categorized from the start.

### Scenario 3: Assign Tags to Existing Tasks
**As a** user, **I want to** add or remove tags on an existing task, **so that** I can recategorize tasks as needed.

### Scenario 4: Filter Kanban Board by Tag
**As a** user, **I want to** select a tag in the filter bar and see only tasks with that tag, **so that** I can focus on one project/context at a time.

### Scenario 5: Visually Identify Task Context on Cards
**As a** user, **I want to** see colored tag pills on task cards, **so that** I can quickly identify which project/context a task belongs to without opening it.

### Scenario 6: Manage My Tags in Settings
**As a** user, **I want to** see all my tags in one place (Settings), rename, recolor, or delete them, and see how many tasks use each tag, **so that** I can keep my tag list clean and relevant.

### Scenario 7: Bulk Tag Assignment
**As a** user, **I want to** select multiple tasks and assign or remove a tag in one action, **so that** I can quickly categorize a batch of tasks without editing each one individually.

## Functional Requirements

### Phase 1: Core Tag System (Backend + Basic Frontend)

#### FR-1: Tag Data Model (Backend)
- [ ] FR-1.1: Create `tags` table: `id` (PK), `user_id` (FK → users), `name` (varchar 50, unique per user), `color` (varchar 7, hex like `#4f8ef7`), `created_at`
- [ ] FR-1.2: Create `task_tags` join table: `task_id` (FK → tasks, CASCADE), `tag_id` (FK → tags, CASCADE), composite PK `(task_id, tag_id)`
- [ ] FR-1.3: Add index on `task_tags(tag_id)` for efficient filtering
- [ ] FR-1.4: Add index on `tags(user_id)` for listing user's tags
- [ ] FR-1.5: Alembic migration for both tables

#### FR-2: Tag CRUD API (Backend)
- [ ] FR-2.1: `GET /api/tags` — list all tags for the current user, ordered by name. Each tag includes `task_count` (number of tasks using it)
- [ ] FR-2.2: `POST /api/tags` — create a tag (name, color). Validate unique name per user (case-insensitive). Return created tag
- [ ] FR-2.3: `PATCH /api/tags/{id}` — update tag name and/or color. Validate ownership + unique name
- [ ] FR-2.4: `DELETE /api/tags/{id}` — delete tag (cascade removes entries from `task_tags`, tasks themselves are unaffected)
- [ ] FR-2.5: Limit: max 20 tags per user (prevent abuse, keep UX clean)

#### FR-3: Task–Tag Assignment API (Backend)
- [ ] FR-3.1: Extend `TaskCreate` schema: add optional `tag_ids: list[int] = []`
- [ ] FR-3.2: Extend `TaskUpdate` schema: add optional `tag_ids: list[int] | None = None` (None = no change, [] = remove all tags)
- [ ] FR-3.3: Extend `TaskResponse` schema: add `tags: list[TagBrief]` where `TagBrief = {id, name, color}`
- [ ] FR-3.4: Task service: on create/update, sync `task_tags` rows (delete old + insert new)
- [ ] FR-3.5: Kanban board endpoint: include tags in each task response (eager load via join)

#### FR-4: Tag Filter (Backend)
- [ ] FR-4.1: Add `tag_id: int | None` query parameter to task list / kanban board endpoints
- [ ] FR-4.2: When `tag_id` is provided, return only tasks that have that tag (INNER JOIN on `task_tags`)
- [ ] FR-4.3: Filter works in combination with existing filters (search, priority)

#### FR-5: Bulk Tag Assignment API (Backend)
- [ ] FR-5.1: `POST /api/tasks/bulk-tag` — body: `{ task_ids: list[int], add_tag_ids: list[int], remove_tag_ids: list[int] }`. Adds/removes tags from multiple tasks in one request
- [ ] FR-5.2: Validate all task_ids belong to the current user
- [ ] FR-5.3: Validate all tag_ids belong to the current user
- [ ] FR-5.4: Return count of affected tasks

### Phase 2: Frontend — Kanban & Task Dialog

#### FR-6: Frontend Types and Hooks
- [ ] FR-6.1: Add `Tag` type: `{ id: number, name: string, color: string, task_count: number, created_at: string }`
- [ ] FR-6.2: Add `TagBrief` type: `{ id: number, name: string, color: string }`
- [ ] FR-6.3: Extend `Task` type: add `tags: TagBrief[]`
- [ ] FR-6.4: Extend `CreateTaskInput` and `UpdateTaskInput`: add `tag_ids?: number[]`
- [ ] FR-6.5: Extend `TaskFilters`: add `tag_id?: number`
- [ ] FR-6.6: Create `use-tags` hook: `useTags()` (list), `useCreateTag()`, `useUpdateTag()`, `useDeleteTag()`, `useBulkTag()`

#### FR-7: Tag Pills on Task Card (Frontend)
- [ ] FR-7.1: Display tags as compact colored pills below the task title on `TaskCard`
- [ ] FR-7.2: Pill style: rounded-full, bg is tag color at 15% opacity, text is tag color, font-size 10px, padding 1px 8px
- [ ] FR-7.3: If more than 2 tags — show first 2 + "+N" indicator
- [ ] FR-7.4: On `TaskCardOverlay` (drag): show same pills

#### FR-8: Tag Picker in Task Dialog (Frontend)
- [ ] FR-8.1: Add a "Tags" field to `TaskDialog` (create) and task detail page (edit)
- [ ] FR-8.2: Tag picker UI: multi-select dropdown showing all user's tags with color dots
- [ ] FR-8.3: Selected tags shown as removable pills below the dropdown
- [ ] FR-8.4: Inline "Create tag" option at the bottom of the dropdown (name + color picker) for quick creation without leaving the dialog

#### FR-9: Tag Filter in Filter Bar (Frontend)
- [ ] FR-9.1: Add a tag dropdown to `TaskFiltersBar` (after priority filter)
- [ ] FR-9.2: Dropdown shows all user's tags with color dots
- [ ] FR-9.3: Single-select: picking a tag filters the board; picking again or "All tags" clears the filter
- [ ] FR-9.4: Active tag filter is included in the `activeCount` for the "Clear" button
- [ ] FR-9.5: Tag filter sends `tag_id` query param to the kanban/list API
- [ ] FR-9.6: Tag filter state persists in URL search params

### Phase 3: Tag Management & Bulk Operations (Frontend)

#### FR-10: Tag Management in Settings (Frontend)
- [ ] FR-10.1: Add a "Tags" tab/section to the existing Settings page
- [ ] FR-10.2: Display all tags as a list: color swatch, name, task count (e.g. "Portal — 12 tasks")
- [ ] FR-10.3: Inline edit: click tag name to rename, click color swatch to pick new color
- [ ] FR-10.4: Delete button with confirmation dialog: "Delete tag 'Portal'? It will be removed from 12 tasks. Tasks themselves won't be deleted."
- [ ] FR-10.5: "Create tag" button at the top — opens inline row with name input + color picker
- [ ] FR-10.6: Show current count vs limit: "5 / 20 tags"

#### FR-11: Bulk Tag Assignment UI (Frontend)
- [ ] FR-11.1: Add multi-select mode to Kanban: long-press or checkbox on cards to select multiple tasks
- [ ] FR-11.2: When tasks are selected, show a floating action bar at the bottom: "N tasks selected — Add tag / Remove tag / Cancel"
- [ ] FR-11.3: "Add tag" opens tag picker dropdown (same component as FR-8)
- [ ] FR-11.4: "Remove tag" opens tag picker showing only tags that exist on selected tasks
- [ ] FR-11.5: After bulk action, deselect all and refresh the board

## Non-Functional Requirements

- Tags load with the initial kanban board request (no extra round-trips for display)
- Tag CRUD operations should invalidate relevant React Query caches (tags list + tasks)
- Tag filter should use URL search params so filtered state survives page refresh
- Max 20 tags per user to keep dropdown usable
- Tag colors should work well on both dark and light themes (the 15% opacity pill pattern handles this)
- Bulk tag API should handle up to 50 tasks in one request

## Technical Design

### Backend

#### 1. Models (`models/tag.py` — new file)
```python
class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#4f8ef7")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )

class TaskTag(Base):
    __tablename__ = "task_tags"

    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True
    )
```

#### 2. Relationships (add to existing `Task` model)
```python
# In Task model
tags: Mapped[list["Tag"]] = relationship(
    "Tag", secondary="task_tags", lazy="noload"
)
```

#### 3. Schemas (`schemas/tag.py` — new file)
```python
class TagCreate(BaseModel):
    name: str  # max 50 chars
    color: str = "#4f8ef7"  # hex color

class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class TagBrief(BaseModel):
    id: int
    name: str
    color: str
    model_config = {"from_attributes": True}

class TagResponse(TagBrief):
    task_count: int = 0
    created_at: datetime

class BulkTagRequest(BaseModel):
    task_ids: list[int]
    add_tag_ids: list[int] = []
    remove_tag_ids: list[int] = []

class BulkTagResponse(BaseModel):
    affected_tasks: int
```

#### 4. Extend Task Schemas (`schemas/task.py`)
```python
# TaskCreate — add:
tag_ids: list[int] = []

# TaskUpdate — add:
tag_ids: Optional[list[int]] = None

# TaskResponse — add:
tags: list[TagBrief] = []
```

#### 5. API (`api/tags.py` — new file)
Standard CRUD router: `GET /`, `POST /`, `PATCH /{id}`, `DELETE /{id}`
Plus: `POST /api/tasks/bulk-tag` (can live in `api/tasks.py`)
All endpoints scoped to current user.

#### 6. Service (`services/tag.py` — new file)
- `get_user_tags(user_id)` — list all tags ordered by name, with task_count via subquery
- `create_tag(user_id, data)` — validate unique name (case-insensitive), enforce 20-tag limit
- `update_tag(tag_id, user_id, data)` — validate ownership + unique name
- `delete_tag(tag_id, user_id)` — validate ownership, cascade handles task_tags
- `bulk_tag(user_id, data)` — add/remove tags from multiple tasks

#### 7. Task Service Updates (`services/task.py`)
- `create_task`: after creating the task, insert `task_tags` rows for provided `tag_ids`
- `update_task`: if `tag_ids` is not None, delete existing `task_tags` for this task + insert new ones
- `get_kanban_board`: eager-load tags via `selectinload(Task.tags)` — add to existing query options
- Task list queries: add optional `tag_id` filter via `JOIN task_tags` when provided

#### 8. Alembic Migration
```python
def upgrade():
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("color", sa.String(7), nullable=False, server_default="#4f8ef7"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )
    op.create_index("ix_tags_user_id", "tags", ["user_id"])

    op.create_table(
        "task_tags",
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_task_tags_tag_id", "task_tags", ["tag_id"])

def downgrade():
    op.drop_table("task_tags")
    op.drop_table("tags")
```

### Frontend

#### 1. Types (`types/tag.ts` — new file)
```typescript
export interface Tag {
  id: number;
  name: string;
  color: string;
  task_count: number;
  created_at: string;
}

export interface TagBrief {
  id: number;
  name: string;
  color: string;
}
```

#### 2. Hooks (`hooks/use-tags.ts` — new file)
React Query hooks for tag CRUD: `useTags()`, `useCreateTag()`, `useUpdateTag()`, `useDeleteTag()`, `useBulkTag()`.

#### 3. Components

**`TagPill` (new, reusable)**
Compact pill component: color dot or colored background, tag name, optional remove button.

**`TagPicker` (new)**
Multi-select dropdown for choosing tags. Shows all user tags with color dots. Includes inline "Create new tag" option.

**`TaskCard` (modify)**
Add tag pills below the title. Max 2 visible + "+N" overflow.

**`TaskDialog` (modify)**
Add TagPicker field between priority and checklist sections.

**`TaskFiltersBar` (modify)**
Add tag dropdown after the priority filter. Single-select for filtering.

**Task detail page (modify)**
Show tags with ability to edit (TagPicker in edit mode).

**Settings Tags section (new)**
Tag management list with inline edit, delete, create, task counts, and limit indicator.

**Bulk selection bar (new)**
Floating action bar for multi-task operations. Appears when tasks are selected on the Kanban board.

#### 4. Preset Colors
Offer a predefined palette of 8 colors for quick tag creation (user can also type a custom hex):
| Color | Hex | Name |
|-------|-----|------|
| Blue | `#4f8ef7` | Default (accent) |
| Teal | `#2dd4bf` | accent-teal |
| Violet | `#a78bfa` | accent-violet |
| Amber | `#fbbf24` | accent-amber |
| Red | `#f87171` | danger |
| Green | `#34d399` | success |
| Pink | `#f472b6` | — |
| Orange | `#fb923c` | — |

These map to the existing design system tokens where possible.

## Implementation Order

The recommended implementation order (each phase builds on the previous):

1. **Phase 1** — Backend: migration, models, tag CRUD API, task-tag assignment, filter endpoint, bulk-tag endpoint
2. **Phase 2** — Frontend: types, hooks, TagPill, TagPicker, TaskCard pills, TaskDialog integration, filter bar
3. **Phase 3** — Frontend: Settings tag management page, bulk selection UI on Kanban

## Out of Scope
- Hierarchical / nested tags
- Tag-based views (dedicated page per tag)
- Tags for other entities (notes, jobs) — can be extended later using the same `tags` table
- Tag ordering / pinning
- Shared tags between family members

## Acceptance Criteria
- [ ] AC-1: User can create tags with a name and color via the UI
- [ ] AC-2: User can assign multiple tags to a task during creation
- [ ] AC-3: User can add/remove tags on existing tasks
- [ ] AC-4: Task cards on the Kanban board display colored tag pills (max 2 + overflow)
- [ ] AC-5: Tag filter in the filter bar filters the Kanban board by selected tag
- [ ] AC-6: Tag filter works in combination with search and priority filters
- [ ] AC-7: Tags are included in task responses from all API endpoints (list, kanban, detail)
- [ ] AC-8: Deleting a tag removes it from all tasks but does not delete the tasks
- [ ] AC-9: Tag names are unique per user (case-insensitive validation)
- [ ] AC-10: Maximum 20 tags per user enforced by the backend
- [ ] AC-11: Tag pills render correctly on both dark and light themes
- [ ] AC-12: Tag filter state persists in URL search params
- [ ] AC-13: Settings page shows all tags with task counts, supports rename/recolor/delete
- [ ] AC-14: User can select multiple tasks on Kanban and add/remove tags in bulk
- [ ] AC-15: Bulk operations correctly update all selected tasks and refresh the board

## Open Questions
- None
