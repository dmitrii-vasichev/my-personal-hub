# Phase 16: User Profile UI, Profile Import & AI Knowledge Base Settings

**PRD:** docs/prd-job-hunt-redesign.md
**Requirements:** FR-5, FR-6, FR-8 (frontend)
**Phase goal:** Build the professional profile page (editable sections for skills, experience, education, contacts, summary), text import via AI, and the Settings tabs for AI Instructions and AI Knowledge Base document management.

**Backend dependencies (Phase 15, already merged):**
- `GET/PUT /api/profile/` — profile CRUD
- `POST /api/profile/import` — AI text parse
- `GET/PUT/POST/DELETE /api/knowledge-base/` — KB document CRUD
- `POST /api/knowledge-base/{slug}/reset` — reset default doc
- `GET/PUT /api/settings/` — includes instruction_resume, instruction_ats_audit, instruction_gap_analysis, instruction_cover_letter

---

## Task 1: TypeScript types for UserProfile and Knowledge Base

**Description:** Add frontend type definitions matching the backend schemas for UserProfile and AiKnowledgeBase entities.

**Files:**
- `frontend/src/types/profile.ts` (new)
- `frontend/src/types/knowledge-base.ts` (new)
- `frontend/src/types/settings.ts` (edit — add instruction fields)

**Types to create:**

`profile.ts`:
- `SkillEntry` { name: string; level?: string; years?: number }
- `ExperienceEntry` { title: string; company: string; location?: string; start_date?: string; end_date?: string; description?: string }
- `EducationEntry` { degree: string; institution: string; year?: number }
- `ContactInfo` { email?: string; phone?: string; linkedin?: string; location?: string }
- `UserProfile` { id: number; user_id: number; summary?: string; skills: SkillEntry[]; experience: ExperienceEntry[]; education: EducationEntry[]; contacts: ContactInfo; raw_import?: string; created_at: string; updated_at: string }
- `ProfileUpdateInput` { summary?: string; skills?: SkillEntry[]; experience?: ExperienceEntry[]; education?: EducationEntry[]; contacts?: ContactInfo }
- `ProfileImportInput` { text: string }

`knowledge-base.ts`:
- `KBDocument` { id: number; user_id: number; slug: string; title: string; content: string; is_default: boolean; used_by: string[]; created_at: string; updated_at: string }
- `KBDocumentCreateInput` { slug: string; title: string; content: string; used_by: string[] }
- `KBDocumentUpdateInput` { title?: string; content?: string; used_by?: string[] }

`settings.ts` (add to UpdateSettingsInput & SettingsResponse):
- `instruction_resume?: string`
- `instruction_ats_audit?: string`
- `instruction_gap_analysis?: string`
- `instruction_cover_letter?: string`

**Acceptance Criteria:**
- [ ] Types match backend Pydantic schemas exactly
- [ ] No TypeScript errors

**Verification:** `npx tsc --noEmit`

---

## Task 2: React Query hooks for UserProfile

**Description:** Create hooks for fetching, updating, and importing the professional profile using existing API client patterns.

**Files:**
- `frontend/src/hooks/use-user-profile.ts` (new)

**Hooks:**
- `useUserProfile()` — `GET /api/profile/` (returns UserProfile, handles 404 gracefully)
- `useUpdateUserProfile()` — `PUT /api/profile/` (mutation, invalidates profile query)
- `useImportProfile()` — `POST /api/profile/import` (mutation, invalidates profile query)

**Acceptance Criteria:**
- [ ] Hooks follow existing patterns (useSettings, useJobs)
- [ ] 404 on GET handled as "no profile yet" (not error)
- [ ] Mutations invalidate profile query key on success

**Verification:** Used by Task 4 (Profile page)

---

## Task 3: React Query hooks for Knowledge Base

**Description:** Create hooks for KB document CRUD and reset operations.

**Files:**
- `frontend/src/hooks/use-knowledge-base.ts` (new)

**Hooks:**
- `useKBDocuments()` — `GET /api/knowledge-base/` (list all docs)
- `useKBDocument(slug)` — `GET /api/knowledge-base/{slug}`
- `useUpdateKBDocument()` — `PUT /api/knowledge-base/{slug}` (invalidates list + single)
- `useCreateKBDocument()` — `POST /api/knowledge-base/` (invalidates list)
- `useDeleteKBDocument()` — `DELETE /api/knowledge-base/{slug}` (invalidates list)
- `useResetKBDocument()` — `POST /api/knowledge-base/{slug}/reset` (invalidates list + single)

**Acceptance Criteria:**
- [ ] All CRUD operations work through hooks
- [ ] Query invalidation on mutations

**Verification:** Used by Task 8 (KB Settings tab)

---

## Task 4: Professional Profile page — Contact Info & Summary sections

**Description:** Redesign the existing `/profile` page to add professional profile sections. Keep existing identity/password sections. Add two new sections below: Contact Info and Summary. The Contact Info section has fields for email, phone, LinkedIn URL, and location. The Summary section has a textarea for professional summary.

**Files:**
- `frontend/src/app/(dashboard)/profile/page.tsx` (edit)

**Changes:**
- Import `useUserProfile`, `useUpdateUserProfile` from new hooks
- Add local state for contacts (email, phone, linkedin, location) and summary
- Add "Contact Info" section with 4 inputs (email, phone, linkedin, location)
- Add "Professional Summary" section with a textarea
- Add Save button for professional profile data (separate from display name save)
- Initialize state from useUserProfile data when loaded

**Acceptance Criteria:**
- [ ] Contact info fields displayed and editable
- [ ] Summary textarea displayed and editable
- [ ] Save button calls PUT /api/profile/ with contacts and summary
- [ ] Toast on success/error
- [ ] Existing identity and password sections unchanged

**Verification:** Visual check + API call verification

---

## Task 5: Professional Profile page — Skills section

**Description:** Add a Skills section to the profile page with tag-style skill input (name + optional level + optional years). Skills are displayed as tags/chips with ability to add and remove.

**Files:**
- `frontend/src/app/(dashboard)/profile/page.tsx` (edit) or extract component
- `frontend/src/components/profile/skills-editor.tsx` (new)

**Component: SkillsEditor**
- Displays skills as tag chips showing: "name" or "name • level" or "name • X yrs"
- Click on chip to edit (inline or small popover with name, level select, years input)
- Add new skill: input field with Enter to add, optional level dropdown (Beginner/Intermediate/Advanced/Expert), optional years input
- Remove skill: X button on chip
- Props: skills: SkillEntry[], onChange: (skills: SkillEntry[]) => void

**Acceptance Criteria:**
- [ ] Skills displayed as styled tags
- [ ] Can add new skills with optional level/years
- [ ] Can remove skills
- [ ] Changes saved when profile Save button clicked

**Verification:** Visual check, add/remove skills, save and reload

---

## Task 6: Professional Profile page — Experience & Education sections

**Description:** Add Experience and Education sections to the profile page. Each section shows a list of entries with add/edit/delete functionality.

**Files:**
- `frontend/src/components/profile/experience-editor.tsx` (new)
- `frontend/src/components/profile/education-editor.tsx` (new)
- `frontend/src/app/(dashboard)/profile/page.tsx` (edit)

**ExperienceEditor component:**
- List of experience entries, each showing: title, company, location, date range, description
- "Add experience" button opens inline form (not dialog) with fields: title*, company*, location, start_date, end_date, description (textarea)
- Edit: click entry to expand/edit inline
- Delete: trash icon per entry
- Props: experience: ExperienceEntry[], onChange: (exp: ExperienceEntry[]) => void

**EducationEditor component:**
- List of education entries showing: degree, institution, year
- "Add education" button opens inline form: degree*, institution*, year
- Edit/delete similar to experience
- Props: education: EducationEntry[], onChange: (edu: EducationEntry[]) => void

**Acceptance Criteria:**
- [ ] Experience entries displayed with all fields
- [ ] Can add, edit, delete experience entries
- [ ] Education entries displayed with all fields
- [ ] Can add, edit, delete education entries
- [ ] Changes saved when profile Save button clicked

**Verification:** Visual check, CRUD operations on entries

---

## Task 7: Profile Import from Text

**Description:** Add an "Import from text" button/section to the profile page that accepts pasted text (e.g., LinkedIn export, resume text) and uses AI to parse it into the structured profile format.

**Files:**
- `frontend/src/components/profile/profile-import-dialog.tsx` (new)
- `frontend/src/app/(dashboard)/profile/page.tsx` (edit — add import button + dialog)

**ProfileImportDialog component:**
- Dialog with large textarea for pasting text
- "Import" button that calls POST /api/profile/import
- Loading state while AI processes
- On success: closes dialog, profile query invalidated → new data shown
- On error: show error message in dialog

**Integration:**
- "Import from text" button in profile page header area
- Opens dialog
- After successful import, all profile sections update with parsed data

**Acceptance Criteria:**
- [ ] Import button visible on profile page
- [ ] Dialog opens with textarea
- [ ] Submitting calls API and shows loading state
- [ ] Success: dialog closes, profile refreshes with parsed data
- [ ] Error: message shown in dialog

**Verification:** Paste sample text, verify AI parses and populates profile sections

---

## Task 8: Settings — AI Instructions tab

**Description:** Add a new "AI Instructions" tab to the Settings page for admin users. This tab shows 4 editable text fields for custom AI instructions: Resume Generation, ATS Audit, Gap Analysis, Cover Letter.

**Files:**
- `frontend/src/components/settings/ai-instructions-tab.tsx` (new)
- `frontend/src/app/(dashboard)/settings/page.tsx` (edit — add tab)
- `frontend/src/types/settings.ts` (if not done in Task 1)

**AI Instructions Tab component:**
- 4 sections, each with:
  - Label (e.g., "Resume Generation Instruction")
  - Textarea for the instruction text
  - Brief helper text explaining what this instruction does
- Values come from existing settings (instruction_resume, etc.)
- Saved via existing settings save flow (PUT /api/settings/)

**Settings page changes:**
- Add "AI Instructions" tab to ADMIN_TABS array (after "AI & API Keys")
- Add state for 4 instruction fields
- Initialize from settings data
- Include instruction fields in handleSave payload

**Acceptance Criteria:**
- [ ] "AI Instructions" tab visible for admin users
- [ ] 4 instruction textareas displayed
- [ ] Values load from existing settings
- [ ] Changes saved via Save button
- [ ] Not visible for member users

**Verification:** Load settings, edit instructions, save, reload and verify persistence

---

## Task 9: Settings — AI Knowledge Base tab

**Description:** Add an "AI Knowledge Base" tab to Settings for admin users. This tab shows a list of KB documents with the ability to view/edit each document in a full Markdown editor, reset default documents, and add/delete custom documents.

**Files:**
- `frontend/src/components/settings/ai-knowledge-base-tab.tsx` (new)
- `frontend/src/app/(dashboard)/settings/page.tsx` (edit — add tab)

**AI Knowledge Base Tab component:**
- Document list view (default):
  - Card/row per document showing: title, used_by tags, is_default badge, last updated
  - Click to open editor view
  - "Add document" button for custom docs
- Document editor view:
  - Back button to return to list
  - Title (editable for custom docs, read-only for defaults)
  - Full-height textarea/editor for MD content
  - "used_by" multi-select checkboxes: resume_generation, ats_audit, gap_analysis, cover_letter
  - Save button
  - "Reset to default" button (only for default docs)
  - "Delete" button (only for custom docs)
- Uses hooks from Task 3

**Acceptance Criteria:**
- [ ] Document list displays all KB docs
- [ ] Can open, edit, and save any document
- [ ] Can reset default documents to original content
- [ ] Can add custom documents (slug, title, content, used_by)
- [ ] Can delete custom documents (not defaults — button hidden or disabled)
- [ ] Proper loading/error states

**Verification:** Visual check, edit document content, save, reset, add/delete custom

---

## Task 10: Tests — Profile page, KB Settings, and hooks

**Description:** Write tests for the new frontend components and hooks.

**Files:**
- `frontend/__tests__/profile-page.test.tsx` (new)
- `frontend/__tests__/ai-kb-settings.test.tsx` (new)

**Test cases:**
- Profile page renders with existing data (mock useUserProfile)
- Skills editor: add skill, remove skill
- Experience editor: add entry, delete entry
- Education editor: add entry, delete entry
- Import dialog: opens, submits, shows loading
- AI Instructions tab: renders 4 instruction fields, saves correctly
- AI KB tab: renders document list, opens editor, save/reset buttons work

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] API calls mocked (no real backend)
- [ ] Core interactions covered

**Verification:** `npm test`

---

## Execution Order

```
Task 1 (types)
  → Task 2 (profile hooks) + Task 3 (KB hooks) — parallel
    → Task 4 (profile contacts & summary)
      → Task 5 (skills editor)
        → Task 6 (experience & education)
          → Task 7 (profile import dialog)
    → Task 8 (AI Instructions tab)
    → Task 9 (AI KB tab) — depends on Task 3
  → Task 10 (tests) — depends on all above
```

Tasks 2+3 can run in parallel after Task 1.
Tasks 4-7 are sequential (profile page grows incrementally).
Tasks 8+9 can run in parallel with profile tasks (separate pages).
