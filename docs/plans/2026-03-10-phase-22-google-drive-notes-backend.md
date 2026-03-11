# Phase 22: Google Drive Integration & Notes Backend

**Date:** 2026-03-10
**PRD:** docs/prd-notes-google-drive.md
**Phase:** 22 of 25 (Notes Module — Google Drive Integration)

## Overview

Set up the backend foundation for the Notes module: extend Google OAuth with Drive scope, add notes folder setting, create Note model with metadata cache, build Google Drive API service, and expose tree/content endpoints.

## Tasks

### Task 1: Alembic migration — add `google_drive_notes_folder_id` to `user_settings` + create `notes` table

**Description:** Create migration `016` that:
1. Adds `google_drive_notes_folder_id` (varchar 255, nullable) column to `user_settings`
2. Creates `notes` table: `id`, `user_id` (FK→users, cascade), `google_file_id` (varchar 255), `title` (varchar 500), `folder_path` (varchar 1000), `mime_type` (varchar 100), `last_synced_at` (timestamp tz), `created_at`, `updated_at`, unique constraint on `(user_id, google_file_id)`

**Files:**
- NEW `backend/alembic/versions/016_add_notes_module.py`

**Acceptance Criteria:**
- [ ] Migration runs without errors (`alembic upgrade head`)
- [ ] Downgrade works (`alembic downgrade -1`)
- [ ] `user_settings` table has new column
- [ ] `notes` table created with correct schema and unique constraint

---

### Task 2: Note model + UserSettings extension

**Description:** Create SQLAlchemy `Note` model and add `google_drive_notes_folder_id` field to `UserSettings`. Register Note in `models/__init__.py`.

**Files:**
- NEW `backend/app/models/note.py`
- MOD `backend/app/models/settings.py` — add `google_drive_notes_folder_id` field
- MOD `backend/app/models/__init__.py` — import Note

**Acceptance Criteria:**
- [ ] `Note` model matches PRD schema (id, user_id, google_file_id, title, folder_path, mime_type, last_synced_at, created_at, updated_at)
- [ ] Unique constraint on (user_id, google_file_id)
- [ ] `UserSettings.google_drive_notes_folder_id` field exists
- [ ] Note imported in `__init__.py`

---

### Task 3: Note schemas (Pydantic)

**Description:** Create Pydantic schemas for Note responses and settings update extension.

**Files:**
- NEW `backend/app/schemas/note.py` — `NoteResponse`, `NoteTreeNode`, `NoteTreeResponse`
- MOD `backend/app/schemas/settings.py` — add `google_drive_notes_folder_id` to `SettingsUpdate` and `SettingsResponse`

**Acceptance Criteria:**
- [ ] `NoteResponse` has all fields from model
- [ ] `NoteTreeNode` has: id, name, type (folder/file), google_file_id, children (recursive)
- [ ] Settings schemas include notes folder field
- [ ] `SettingsResponse` exposes `google_drive_notes_folder_id` as plain string (not a secret)

---

### Task 4: Settings service & API — notes folder field

**Description:** Update settings service and API to handle `google_drive_notes_folder_id` (plain text, not encrypted — it's a folder ID, not a secret).

**Files:**
- MOD `backend/app/services/settings.py` — handle new field in `update_settings()`
- MOD `backend/app/services/settings.py` — include in `to_response()`

**Acceptance Criteria:**
- [ ] Admin can save `google_drive_notes_folder_id` via settings update
- [ ] Field returned in settings response
- [ ] Non-admin users cannot update this field (admin-only like other integration settings)

---

### Task 5: Extend Google OAuth scope with `drive.readonly`

**Description:** Add `drive.readonly` scope to the existing Google OAuth flow. Since `include_granted_scopes="true"` is already used, existing Calendar tokens will request the additional scope on next re-auth. No separate OAuth flow needed.

**Files:**
- MOD `backend/app/services/google_oauth.py` — add `drive.readonly` to `SCOPES` list

**Acceptance Criteria:**
- [ ] `SCOPES` includes both `calendar` and `drive.readonly`
- [ ] Existing OAuth flow still works for Calendar
- [ ] New authorizations request both scopes
- [ ] `include_granted_scopes` already set (incremental auth)

---

### Task 6: Google Drive service — folder tree & file content

**Description:** Create a service that wraps Google Drive API v3 for:
1. Listing folder contents recursively (folders + `.md` files only)
2. Reading raw file content (UTF-8 markdown)
3. Validating folder access
4. In-memory cache with TTL for tree responses

**Files:**
- NEW `backend/app/services/google_drive.py`

**Acceptance Criteria:**
- [ ] `list_folder_tree(credentials, folder_id)` → recursive tree of folders + .md files
- [ ] `get_file_content(credentials, file_id)` → raw markdown string
- [ ] `validate_folder_access(credentials, folder_id)` → bool
- [ ] Filters: only `mimeType=folder` and files ending with `.md` (or `text/markdown`)
- [ ] In-memory cache dict with 5-minute TTL for tree results
- [ ] Handles Google API errors gracefully

---

### Task 7: Note service — metadata sync & CRUD

**Description:** Create note service for syncing metadata from Drive tree to DB, and basic CRUD for note records.

**Files:**
- NEW `backend/app/services/note.py`

**Acceptance Criteria:**
- [ ] `sync_metadata(db, user, tree)` — upserts Note records from Drive tree, updates title/folder_path/last_synced_at
- [ ] `get_notes(db, user)` — list all user's notes
- [ ] `get_note(db, user, note_id)` — get single note
- [ ] `get_note_by_google_file_id(db, user, google_file_id)` — lookup by Drive file ID
- [ ] Removes stale notes (files no longer in Drive tree)

---

### Task 8: Notes API router — tree, content, list, sync endpoints

**Description:** Create FastAPI router for notes with endpoints:
- `GET /api/notes/tree` — fetch and return folder tree (triggers metadata sync)
- `GET /api/notes/{file_id}/content` — fetch and return markdown content
- `GET /api/notes/` — list synced note metadata
- `GET /api/notes/{id}` — get single note metadata
- `POST /api/notes/sync` — force re-sync metadata

**Files:**
- NEW `backend/app/api/notes.py`
- MOD `backend/app/main.py` — register notes router

**Acceptance Criteria:**
- [ ] All endpoints require authentication (`get_current_user`)
- [ ] `GET /api/notes/tree` returns recursive tree structure
- [ ] `GET /api/notes/{file_id}/content` returns raw markdown
- [ ] Returns 400 if notes folder not configured
- [ ] Returns 401 if Google not connected
- [ ] Proper error messages for Drive API failures
- [ ] Router registered in `main.py`

---

### Task 9: Backend tests for Notes module

**Description:** Write tests covering:
1. Note model creation and constraints
2. Google Drive service (mocked API calls)
3. Note service (sync, CRUD)
4. Notes API endpoints (mocked dependencies)
5. Settings — notes folder field handling

**Files:**
- NEW `backend/tests/test_notes.py`

**Acceptance Criteria:**
- [ ] Test note metadata sync (creates/updates/removes records)
- [ ] Test Drive tree building with mocked API responses
- [ ] Test file content fetching with mocked API
- [ ] Test folder validation
- [ ] Test settings update with notes folder field
- [ ] Test unauthorized access returns 401
- [ ] Test missing folder config returns appropriate error
- [ ] All tests pass

## Dependencies

```
Task 1 (migration) → Task 2 (model) → Task 3 (schemas)
                                     → Task 4 (settings)
Task 5 (OAuth scope) — independent
Task 6 (Drive service) — depends on Task 5
Task 7 (Note service) — depends on Task 2
Task 8 (API router) — depends on Task 3, 6, 7
Task 9 (tests) — depends on all above
```

## Execution Order

1. Task 1 — Migration
2. Task 2 — Note model + settings extension
3. Task 3 + Task 5 — Schemas + OAuth scope (parallel)
4. Task 4 — Settings service update
5. Task 6 — Google Drive service
6. Task 7 — Note service
7. Task 8 — API router
8. Task 9 — Tests
