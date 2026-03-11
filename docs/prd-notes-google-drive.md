# PRD: Notes Module — Google Drive Integration

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-03-10 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

The Personal Hub currently has no way to store and access working notes, instructions, and reference documents. Professional documentation (task instructions, process guides, meeting prep notes) lives in Google Drive with no connection to the portal's entities — tasks, jobs, and calendar events. Users must manually navigate to Google Drive, find the right file, and mentally map it to the relevant task or job. There is no single place to browse notes or link them to portal entities for quick navigation.

## User Scenarios

### Scenario 1: Browse notes folder
**As a** user, **I want to** see the full tree structure (folders and files) of my designated Google Drive notes folder on the Notes page, **so that** I can navigate my notes the same way I would in a file explorer.

### Scenario 2: Read a note
**As a** user, **I want to** click on a Markdown file in the tree and see it rendered with proper formatting (headings, lists, code blocks, links, tables), **so that** I can read my notes comfortably without leaving the portal.

### Scenario 3: Link a note to a task
**As a** user, **I want to** attach a note (e.g., "Backend deployment guide") to a task, **so that** when I open the task I see the linked note and can click it to open the document instantly.

### Scenario 4: Link a note to a job
**As a** user, **I want to** attach a note (e.g., "Interview prep — System Design") to a job, **so that** all relevant preparation materials are accessible from the job detail page.

### Scenario 5: Link a note to a calendar event
**As a** user, **I want to** attach a note (e.g., "Meeting agenda") to a calendar event, **so that** I can quickly access the agenda when reviewing the event.

### Scenario 6: Configure notes folder
**As an** admin, **I want to** specify which Google Drive folder to use as the notes root in Settings, **so that** only the relevant folder is visible in the portal (not the entire Drive).

### Scenario 7: See linked notes on entity pages
**As a** user, **I want to** see a "Linked Notes" section on task detail, job detail, and event detail pages, **so that** I can access all related documents from one place.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: **Google Drive Folder Setting** — Add a "Notes Folder" field in Settings → Integrations tab. User pastes a Google Drive folder URL or ID. Stored in `user_settings.google_drive_notes_folder_id`. Validate that the folder is accessible via Drive API on save.
- [ ] FR-2: **Google Drive Scope Extension** — Extend existing Google OAuth scope to include `https://www.googleapis.com/auth/drive.readonly` alongside the existing Calendar scope. Handle incremental authorization (users who already connected Google Calendar should be prompted to grant Drive access on first Notes page visit).
- [ ] FR-3: **Drive Folder Tree API** — Backend endpoint `GET /api/notes/tree` that recursively reads the configured Google Drive folder and returns the full tree structure (folders and `.md` files only). Each node includes: `id` (Drive file ID), `name`, `type` (folder/file), `children` (for folders). Cached in memory with a configurable TTL (default 5 minutes) to avoid hitting Drive API on every request.
- [ ] FR-4: **Drive File Content API** — Backend endpoint `GET /api/notes/{file_id}/content` that fetches the raw Markdown content of a specific `.md` file from Google Drive. Returns plain text. Frontend handles rendering.
- [ ] FR-5: **Notes Page with Tree Browser** — New sidebar nav item "Notes" (icon: `FileText` from Lucide). Page layout: left panel — collapsible folder tree (like VS Code explorer); right panel — rendered Markdown content of the selected file. Tree shows folders (expandable/collapsible) and `.md` files with appropriate icons.
- [ ] FR-6: **Markdown Rendering** — Render `.md` file content using `react-markdown` with `remark-gfm` plugin. Support: headings (h1-h6), bold/italic, lists (ordered/unordered), code blocks with syntax highlighting (via `rehype-highlight` or `rehype-prism`), tables, links (open in new tab), images (if referenced by URL), blockquotes, horizontal rules.
- [ ] FR-7: **Note Model (metadata cache)** — Database table `notes` that caches metadata for Google Drive files: `id`, `user_id`, `google_file_id` (unique per user), `title`, `folder_path` (e.g., "Instructions/Backend"), `last_synced_at`. This table is used for linking — when a user links a note to a task, the link references `notes.id`, not the raw Google file ID. Metadata is synced when the tree is loaded.
- [ ] FR-8: **Note ↔ Task Linking** — `NoteTaskLink` many-to-many table. API: `POST/DELETE /api/notes/{id}/link-task/{task_id}`, `GET /api/notes/{id}/linked-tasks`, `GET /api/tasks/{id}/linked-notes`. On task detail page: "Linked Notes" section showing linked notes with click-to-open.
- [ ] FR-9: **Note ↔ Job Linking** — `NoteJobLink` many-to-many table. API: `POST/DELETE /api/notes/{id}/link-job/{job_id}`, `GET /api/notes/{id}/linked-jobs`, `GET /api/jobs/{id}/linked-notes`. On job detail page: "Linked Notes" section.
- [ ] FR-10: **Note ↔ Calendar Event Linking** — `NoteEventLink` many-to-many table. API: `POST/DELETE /api/notes/{id}/link-event/{event_id}`, `GET /api/notes/{id}/linked-events`, `GET /api/calendar/events/{id}/linked-notes`. On event detail page: "Linked Notes" section.
- [ ] FR-11: **Linked Notes Display on Entity Pages** — Each entity detail page (task, job, event) shows a "Linked Notes" section with: note title, folder path as breadcrumb, click opens the note on the Notes page (or in a side drawer). Link/unlink controls using a combobox search (search by note title).

### P1 (Should Have)

- [ ] FR-12: **Tree Refresh Button** — Manual "Refresh" button on the Notes page that forces a re-fetch of the folder tree from Google Drive (bypassing cache).
- [ ] FR-13: **Note Preview in Link Dialog** — When linking a note to an entity, show a small preview of the first few lines of the note in the search dialog.
- [ ] FR-14: **Breadcrumb Navigation** — When viewing a file, show a breadcrumb path above the content (e.g., "Notes > Instructions > Backend > deployment-guide.md") with clickable segments to navigate up.
- [ ] FR-15: **Last Opened Persistence** — Remember the last opened file per user session (localStorage). When returning to the Notes page, auto-open the last viewed file.

### P2 (Nice to Have)

- [ ] FR-16: **Full-text Search in Notes** — Search bar on the Notes page that searches note titles (and optionally content) across the synced metadata.
- [ ] FR-17: **Open in Google Drive** — "Open in Google Drive" button/link on each note that opens the file in Google Docs/Drive in a new tab.
- [ ] FR-18: **Note Side Drawer** — When clicking a linked note from a task/job/event page, open it in a side drawer (Sheet component) without leaving the current page.

## Non-Functional Requirements

- **Performance**: Tree loading should take <2s for folders with up to 200 files. Markdown rendering should be instant (<100ms) after content is fetched.
- **Caching**: Backend caches the folder tree in memory with 5-minute TTL. Frontend caches individual file content via React Query `staleTime` (5 minutes).
- **Security**: Google Drive access uses existing encrypted OAuth tokens. Drive scope is `readonly` — the portal never modifies files on Drive. All notes are user-scoped (same access control as other entities).
- **File Filtering**: Only `.md` files are shown in the tree. Other file types are silently excluded.
- **Error Handling**: If Google Drive is unreachable, show a friendly error state with "Retry" button. If the configured folder doesn't exist or access is denied, show clear instructions to update Settings.
- **UI Consistency**: Follow existing design-brief.md — dark/light theme, shadcn/ui components, same color palette and typography.

## Technical Design

### Stack (no changes to core stack)
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- New frontend dependencies: `react-markdown`, `remark-gfm`, `rehype-highlight` (or `rehype-prism-plus`)
- Backend: `google-api-python-client` (already installed) for Drive API v3

### Google Drive Integration Architecture

```
OAuth Flow (extended):
  Existing: SCOPES = ["calendar"]
  New:      SCOPES = ["calendar", "drive.readonly"]

  On first Notes page visit (if only calendar scope granted):
  → Prompt user to re-authorize with additional Drive scope
  → Google supports incremental auth (include_granted_scopes)

  Credential reuse:
  GoogleOAuthToken table already stores encrypted access/refresh
  tokens. Same tokens work for both Calendar and Drive APIs
  once the scope is expanded.

Drive API Usage:
  1. List folder (recursive):
     files.list(q="'<folder_id>' in parents",
                fields="files(id,name,mimeType,parents)")
     → Recurse into subfolders (mimeType=folder)
     → Filter: only folders + mimeType contains "text"
       or name ends with ".md"

  2. Read file content:
     files.get_media(fileId=<id>) → raw bytes → decode UTF-8
     (For Google Docs stored as .md, use files.export)

  3. Rate limits: 12,000 req/min per project — no concern
     for single-user usage
```

### New Database Entities

#### Note (metadata cache)
```
notes:
  id: int PK
  user_id: int FK→users
  google_file_id: varchar(255)  -- Google Drive file ID
  title: varchar(500)           -- file name without .md extension
  folder_path: varchar(1000)    -- relative path from root, e.g. "Instructions/Backend"
  mime_type: varchar(100)       -- e.g. "text/markdown"
  last_synced_at: timestamp
  created_at: timestamp
  updated_at: timestamp
  unique(user_id, google_file_id)
```

#### NoteTaskLink
```
note_task_links:
  id: int PK
  note_id: int FK→notes (cascade)
  task_id: int FK→tasks (cascade)
  unique(note_id, task_id)
```

#### NoteJobLink
```
note_job_links:
  id: int PK
  note_id: int FK→notes (cascade)
  job_id: int FK→jobs (cascade)
  unique(note_id, job_id)
```

#### NoteEventLink
```
note_event_links:
  id: int PK
  note_id: int FK→notes (cascade)
  event_id: int FK→calendar_events (cascade)
  unique(note_id, event_id)
```

#### UserSettings extension
```
user_settings (alter):
  google_drive_notes_folder_id: varchar(255) nullable  -- Google Drive folder ID
```

### Key API Endpoints (new)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes/tree` | Recursive folder tree from configured root |
| GET | `/api/notes/{file_id}/content` | Raw Markdown content of a file |
| GET | `/api/notes/` | List all synced note metadata (for search/linking) |
| GET | `/api/notes/{id}` | Get single note metadata |
| POST | `/api/notes/sync` | Force re-sync of metadata from Drive |
| POST/DELETE | `/api/notes/{id}/link-task/{task_id}` | Link/unlink note ↔ task |
| POST/DELETE | `/api/notes/{id}/link-job/{job_id}` | Link/unlink note ↔ job |
| POST/DELETE | `/api/notes/{id}/link-event/{event_id}` | Link/unlink note ↔ event |
| GET | `/api/tasks/{id}/linked-notes` | Get notes linked to a task |
| GET | `/api/jobs/{id}/linked-notes` | Get notes linked to a job |
| GET | `/api/calendar/events/{id}/linked-notes` | Get notes linked to an event |

### Backend Services (new)

| Service | Responsibility |
|---------|---------------|
| `google_drive.py` | Drive API wrapper: list folder, read file, validate folder access |
| `note.py` | Note metadata CRUD, tree building, metadata sync |
| `note_task_link.py` | Note ↔ Task link CRUD |
| `note_job_link.py` | Note ↔ Job link CRUD |
| `note_event_link.py` | Note ↔ Event link CRUD |

### Frontend Components (new/modified)

| Component | Description |
|-----------|-------------|
| NEW `notes/page.tsx` | Notes page — two-panel layout (tree + content) |
| NEW `notes/note-tree.tsx` | Recursive folder tree component with expand/collapse |
| NEW `notes/note-viewer.tsx` | Markdown content renderer |
| NEW `notes/note-breadcrumb.tsx` | Breadcrumb path above content |
| NEW `components/notes/note-link-section.tsx` | Reusable "Linked Notes" section for entity pages |
| NEW `components/notes/note-link-dialog.tsx` | Combobox dialog for searching & linking notes |
| MOD `components/layout/sidebar.tsx` | Add "Notes" nav item |
| MOD `settings/page.tsx` | Add "Notes Folder" field in Integrations tab |
| MOD `tasks/task-detail-*.tsx` | Add "Linked Notes" section |
| MOD `jobs/[id]/page.tsx` | Add "Linked Notes" section |
| MOD `calendar/event-detail-*.tsx` | Add "Linked Notes" section |

### Frontend Architecture

```
Notes Page Layout:
┌──────────────────────────────────────────────────────────┐
│  Notes                                    [Refresh] btn  │
├──────────────┬───────────────────────────────────────────┤
│  📁 Root     │  Instructions > Backend > deploy-guide    │
│  ├─📁 Instr  │  ─────────────────────────────────────    │
│  │ ├─📁 BE   │                                           │
│  │ │ ├─📄 d… │  # Deployment Guide                      │
│  │ │ └─📄 a… │                                           │
│  │ └─📁 FE   │  ## Prerequisites                         │
│  │   └─📄 …  │  - Docker installed                       │
│  ├─📁 Preps  │  - Railway CLI configured                 │
│  │ └─📄 …    │                                           │
│  └─📄 README │  ## Steps                                 │
│              │  1. Build image...                         │
│              │  2. Push to registry...                    │
│              │                                           │
│              │  ```bash                                   │
│              │  docker build -t app .                     │
│              │  ```                                       │
└──────────────┴───────────────────────────────────────────┘

Entity Detail — Linked Notes Section:
┌──────────────────────────────────────────┐
│  Linked Notes                   [+ Link] │
│  ┌────────────────────────────────────┐  │
│  │ 📄 Deployment Guide          [×]  │  │
│  │    Instructions / Backend          │  │
│  ├────────────────────────────────────┤  │
│  │ 📄 API Design Patterns       [×]  │  │
│  │    Instructions / Backend          │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

## Out of Scope
- Editing notes from the portal (read-only; edit in Google Drive/Docs)
- Creating new notes/folders from the portal
- Non-Markdown file support (PDF, DOCX, etc.)
- Real-time sync / webhooks from Google Drive (polling/manual refresh only)
- Multi-user shared notes (notes folder is per-user)
- Version history / diff view

## Acceptance Criteria
- [ ] AC-1: Admin can configure a Google Drive folder ID in Settings → Integrations
- [ ] AC-2: Notes page shows the full recursive tree of the configured folder (folders + .md files only)
- [ ] AC-3: Clicking a .md file renders its content with proper Markdown formatting (headings, lists, code blocks, tables, links)
- [ ] AC-4: User can link/unlink notes to tasks, jobs, and calendar events
- [ ] AC-5: Linked notes are visible on task detail, job detail, and event detail pages with click-to-open
- [ ] AC-6: Tree loads within 2 seconds for folders with up to 200 files
- [ ] AC-7: Re-visiting a previously opened note loads from cache (no visible delay)
- [ ] AC-8: If Google Drive is not connected or folder is not configured, Notes page shows a clear setup prompt
- [ ] AC-9: Extending OAuth scope to include Drive does not break existing Google Calendar integration
- [ ] AC-10: All existing data (tasks, jobs, events, settings) remains intact after migration

## Implementation Phases

### Phase 22: Google Drive Integration & Notes Backend
- FR-2: Extend OAuth scope (add `drive.readonly`)
- FR-1: Settings field for notes folder ID (backend: migration + schema + service)
- FR-7: Note model + migration
- FR-3: Drive folder tree API (`GET /api/notes/tree`)
- FR-4: Drive file content API (`GET /api/notes/{file_id}/content`)
- FR-7: Metadata sync service
- Backend tests for Drive service, note CRUD, tree endpoint

### Phase 23: Notes Page UI & Markdown Rendering
- FR-5: Notes page with tree browser (sidebar nav item, two-panel layout)
- FR-6: Markdown rendering (`react-markdown` + `remark-gfm` + syntax highlighting)
- FR-14 (P1): Breadcrumb navigation
- FR-12 (P1): Refresh button
- FR-1 (frontend): Settings → Integrations → Notes Folder field
- Frontend tests for tree component, markdown viewer

### Phase 24: Note Linking — Backend & API
- FR-8: NoteTaskLink model + API endpoints
- FR-9: NoteJobLink model + API endpoints
- FR-10: NoteEventLink model + API endpoints
- Link CRUD services (note_task_link, note_job_link, note_event_link)
- Backend tests for all link endpoints

### Phase 25: Note Linking — Frontend UI
- FR-11: "Linked Notes" section on task detail page
- FR-11: "Linked Notes" section on job detail page
- FR-11: "Linked Notes" section on event detail page
- Note link dialog component (combobox search)
- FR-15 (P1): Last opened file persistence
- Frontend tests for link sections

## Open Questions
- None at this time.
