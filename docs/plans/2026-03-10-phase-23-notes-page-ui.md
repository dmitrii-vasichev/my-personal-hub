# Phase 23: Notes Page UI & Markdown Rendering

## Overview

Build the frontend for the Notes module: a two-panel page with a folder tree explorer and Markdown viewer, breadcrumb navigation, refresh button, and the Settings field for configuring the Google Drive notes folder. Phase 22 backend is already in place.

## Prerequisites

- Phase 22 merged (Google Drive integration & Notes backend)
- Backend endpoints available: `GET /api/notes/tree`, `GET /api/notes/{file_id}/content`, `POST /api/notes/sync`, `GET /api/notes/`

## Tasks

### Task 1: Install Markdown dependencies

**Description:** Add `react-markdown`, `remark-gfm`, and `rehype-highlight` to the frontend.

**Files:**
- `frontend/package.json`

**Steps:**
1. `cd frontend && npm install react-markdown remark-gfm rehype-highlight`
2. Verify installation, no conflicts

**Acceptance Criteria:**
- [ ] `react-markdown`, `remark-gfm`, `rehype-highlight` in dependencies
- [ ] `npm run build` succeeds
- [ ] No peer dependency warnings

**Verification:** `npm ls react-markdown remark-gfm rehype-highlight`

---

### Task 2: Create Note types

**Description:** Add TypeScript interfaces for note tree nodes and note metadata.

**Files:**
- NEW `frontend/src/types/note.ts`
- MOD `frontend/src/types/settings.ts` — add `google_drive_notes_folder_id`

**Details:**
```typescript
// types/note.ts
export interface NoteTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  google_file_id: string;
  children?: NoteTreeNode[];
}

export interface Note {
  id: number;
  user_id: number;
  google_file_id: string;
  title: string;
  folder_path: string;
  mime_type: string;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}
```

**Acceptance Criteria:**
- [ ] `NoteTreeNode` and `Note` interfaces exported
- [ ] `settings.ts` updated with `google_drive_notes_folder_id` field
- [ ] Build succeeds

**Verification:** `npm run build`

---

### Task 3: Create Notes React Query hooks

**Description:** Add data fetching hooks following existing patterns (see `use-tasks.ts`).

**Files:**
- NEW `frontend/src/hooks/use-notes.ts`

**Hooks:**
- `useNotesTree()` — `GET /api/notes/tree` → `NoteTreeNode`
- `useNoteContent(fileId: string)` — `GET /api/notes/${fileId}/content` → `string`, enabled only when fileId is truthy
- `useNotes()` — `GET /api/notes/` → `Note[]` (for linking in future phases)
- `useRefreshNotesTree()` — mutation `POST /api/notes/sync`, invalidates tree query on success

**Acceptance Criteria:**
- [ ] All 4 hooks exported
- [ ] Follow existing pattern: `api.get()`, `useMutation` with `queryClient.invalidateQueries`
- [ ] Build succeeds

**Verification:** `npm run build`

---

### Task 4: Create NoteTree component

**Description:** Recursive folder tree component for the left panel. Shows folders (expandable/collapsible) and `.md` files with icons. Highlights the selected file.

**Files:**
- NEW `frontend/src/components/notes/note-tree.tsx`

**Details:**
- Props: `tree: NoteTreeNode`, `selectedFileId: string | null`, `onSelectFile: (fileId: string, filePath: string) => void`
- Recursively render children for folders
- Use `ChevronRight`/`ChevronDown` + `Folder`/`FolderOpen` for folders, `FileText` for files (lucide-react)
- Expand/collapse on folder click (local state per folder, default: root expanded)
- Selected file: highlight with `bg-accent/10` and text accent color
- Scrollable container: `overflow-y-auto`
- Sort: folders first, then files, alphabetically

**Acceptance Criteria:**
- [ ] Renders recursive tree structure
- [ ] Folders expand/collapse on click
- [ ] Files trigger `onSelectFile` callback
- [ ] Selected file is visually highlighted
- [ ] Build succeeds

**Verification:** `npm run build`, manual UI check

---

### Task 5: Create NoteViewer component (Markdown renderer)

**Description:** Render Markdown content with proper formatting using `react-markdown`, `remark-gfm`, and `rehype-highlight`.

**Files:**
- NEW `frontend/src/components/notes/note-viewer.tsx`

**Details:**
- Props: `content: string`
- Use `ReactMarkdown` with `remarkGfm` and `rehypeHighlight` plugins
- Wrap in `prose` classes: `prose prose-sm max-w-none dark:prose-invert`
- Support: headings, bold/italic, lists, code blocks with syntax highlighting, tables, links (open in new tab via custom `a` component), blockquotes, horizontal rules
- Import highlight.js theme CSS (pick a theme that works in both dark and light modes, or use two themes)
- Style overrides via Tailwind to match design-brief colors

**Acceptance Criteria:**
- [ ] Renders headings h1-h6
- [ ] Renders code blocks with syntax highlighting
- [ ] Renders tables (GFM)
- [ ] Links open in new tab
- [ ] Works in both dark and light themes
- [ ] Build succeeds

**Verification:** `npm run build`, manual UI check with sample markdown

---

### Task 6: Create NoteBreadcrumb component

**Description:** Breadcrumb path above the content panel showing the file's location in the folder structure.

**Files:**
- NEW `frontend/src/components/notes/note-breadcrumb.tsx`

**Details:**
- Props: `path: string` (e.g., "Instructions/Backend/deploy-guide.md")
- Split path by `/`, render each segment as a breadcrumb
- Last segment (filename) is bold/non-clickable
- Use `ChevronRight` separator (lucide-react)
- Compact styling: `text-sm text-muted-foreground`

**Acceptance Criteria:**
- [ ] Renders path segments separated by chevrons
- [ ] Last segment styled differently (current file)
- [ ] Responsive — wraps on small screens
- [ ] Build succeeds

**Verification:** `npm run build`

---

### Task 7: Create Notes page

**Description:** Main Notes page with two-panel layout: tree explorer (left) and Markdown viewer (right). Header with "Notes" title and Refresh button.

**Files:**
- NEW `frontend/src/app/(dashboard)/notes/page.tsx`

**Details:**
- Layout: `grid lg:grid-cols-[300px_1fr]` — tree on left, content on right
- Tree panel: bordered container, scrollable, fixed height (`h-[calc(100vh-var)]`)
- Content panel: breadcrumb + NoteViewer
- State: `selectedFileId` and `selectedFilePath` (useState)
- Data: `useNotesTree()` for tree, `useNoteContent(selectedFileId)` for content
- Refresh button: calls `useRefreshNotesTree().mutate()`, shows loading spinner
- Empty states:
  - No folder configured → prompt to go to Settings
  - Google not connected → prompt to connect Google account
  - Folder empty → "No notes found"
  - No file selected → "Select a file from the tree"
- Loading states: skeleton/spinner for tree and content separately
- Error states: error message with Retry button

**Acceptance Criteria:**
- [ ] Two-panel layout renders correctly on desktop
- [ ] Stacks on mobile (tree above content)
- [ ] Tree loads from API and renders
- [ ] Clicking a file loads and renders its Markdown content
- [ ] Refresh button triggers sync and reloads tree
- [ ] Empty/error states display appropriately
- [ ] Build succeeds

**Verification:** `npm run build`, manual end-to-end test

---

### Task 8: Add Notes to sidebar navigation

**Description:** Add "Notes" nav item to the sidebar between "Job Hunt" and "Settings".

**Files:**
- MOD `frontend/src/components/layout/sidebar.tsx`

**Details:**
- Add `{ label: "Notes", href: "/notes", icon: FileText }` to `navItems` array
- Import `FileText` from `lucide-react`
- Position: after "Job Hunt", before "Settings"

**Acceptance Criteria:**
- [ ] "Notes" appears in sidebar with FileText icon
- [ ] Active state works when on /notes
- [ ] Clicking navigates to /notes
- [ ] Build succeeds

**Verification:** `npm run build`, manual check

---

### Task 9: Add Notes Folder field to Settings → Integrations

**Description:** Add a "Google Drive — Notes Folder" section to the Integrations tab in Settings. User can enter a Drive folder ID. Show configured/not-configured status.

**Files:**
- MOD `frontend/src/components/settings/integrations-tab.tsx`
- MOD `frontend/src/types/settings.ts` (if not done in Task 2)

**Details:**
- New section below Google Calendar section, same visual style
- Icon: `FolderOpen` from lucide-react
- Title: "Google Drive — Notes Folder"
- Status badge: "✓ Configured" / "Not configured"
- Input field for folder ID with placeholder "Paste Google Drive folder ID"
- Help text explaining where to find the folder ID
- Save happens with the existing settings save flow

**Acceptance Criteria:**
- [ ] Notes Folder section visible in Settings → Integrations
- [ ] Status badge shows correct state
- [ ] Folder ID can be entered and saved
- [ ] Saved value persists on page reload
- [ ] Build succeeds

**Verification:** `npm run build`, manual check in Settings page

---

### Task 10: Frontend tests

**Description:** Write tests for the key components: NoteTree, NoteViewer, NoteBreadcrumb.

**Files:**
- NEW `frontend/src/__tests__/notes/note-tree.test.tsx`
- NEW `frontend/src/__tests__/notes/note-viewer.test.tsx`
- NEW `frontend/src/__tests__/notes/note-breadcrumb.test.tsx`

**Test cases:**
1. **NoteTree:**
   - Renders folder and file nodes
   - Expanding a folder shows children
   - Clicking a file calls onSelectFile with correct ID and path
   - Selected file has highlight styling

2. **NoteViewer:**
   - Renders heading elements from markdown
   - Renders code blocks
   - Renders tables (GFM)
   - Links have `target="_blank"`

3. **NoteBreadcrumb:**
   - Renders path segments
   - Last segment is styled as current

**Acceptance Criteria:**
- [ ] All tests pass (`npm test`)
- [ ] Tests cover rendering and basic interactions
- [ ] No lint errors

**Verification:** `npm test`, `npm run lint`

---

## Task Dependencies

```
Task 1 (deps) ──┐
Task 2 (types) ──┼──> Task 3 (hooks) ──> Task 7 (page)
                 │                              │
Task 4 (tree) ───┤                              │
Task 5 (viewer) ─┤                              │
Task 6 (crumb) ──┘                              │
                                                │
Task 8 (sidebar) ── independent ────────────────┘
Task 9 (settings) ── independent
Task 10 (tests) ── after Tasks 4-6
```

## Execution Order

1. Task 1 → Task 2 → Task 3 (sequential: deps → types → hooks)
2. Tasks 4, 5, 6 (parallel: tree, viewer, breadcrumb components)
3. Task 7 (page — depends on all above)
4. Tasks 8, 9 (parallel: sidebar, settings)
5. Task 10 (tests — after components are done)

## Estimated Scope

- 10 tasks
- 7 new files, 3 modified files
- Focus: UI components, data fetching, markdown rendering
