# Phase 15: User Profile & AI Knowledge Base (Backend Foundation)

**PRD:** docs/prd-job-hunt-redesign.md
**Requirements:** FR-4, FR-8 (backend), Job.match_result extension
**Phase goal:** Backend models, migrations, API endpoints, services, and tests for UserProfile, AiKnowledgeBase, and prompt assembly. Also add match_result field to Job model and instruction fields to UserSettings.

---

## Task 1: DB Migration — UserProfile table + Job.match_result + UserSettings instructions

**Description:** Create Alembic migration `012_add_profile_kb_match.py` that:
- Creates `user_profiles` table (id, user_id FK unique, summary, skills JSON, experience JSON, education JSON, contacts JSON, raw_import, created_at, updated_at)
- Adds `match_result` JSON nullable column to `jobs` table
- Adds 4 instruction columns to `user_settings` table (instruction_resume, instruction_ats_audit, instruction_gap_analysis, instruction_cover_letter — all Text nullable)

**Files:**
- `backend/alembic/versions/012_add_profile_kb_match.py` (new)

**Acceptance Criteria:**
- [ ] Migration runs without errors (upgrade + downgrade)
- [ ] Existing data not affected
- [ ] All new columns nullable

**Verification:** `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

## Task 2: DB Migration — AiKnowledgeBase table

**Description:** Create Alembic migration `013_create_ai_knowledge_base.py` that:
- Creates `ai_knowledge_base` table (id, user_id FK, slug varchar(100), title varchar(255), content Text, is_default bool, used_by JSON, created_at, updated_at)
- Unique constraint on (user_id, slug)
- Index on user_id

**Files:**
- `backend/alembic/versions/013_create_ai_knowledge_base.py` (new)

**Acceptance Criteria:**
- [ ] Migration runs without errors
- [ ] Unique constraint prevents duplicate slugs per user

**Verification:** `alembic upgrade head`

---

## Task 3: UserProfile model + schemas

**Description:** Create the SQLAlchemy model and Pydantic schemas for UserProfile.

**Model fields:**
- id (PK), user_id (FK→users, unique), summary (Text nullable), skills (JSON default=[]), experience (JSON default=[]), education (JSON default=[]), contacts (JSON default={}), raw_import (Text nullable), created_at, updated_at

**Schemas:**
- `ProfileUpdate`: summary?, skills?, experience?, education?, contacts?
- `ProfileResponse`: all fields
- `ProfileImportRequest`: text (str)
- Nested types: `SkillEntry` (name, level?, years?), `ExperienceEntry` (title, company, location?, start_date, end_date?, description?), `EducationEntry` (degree, institution, year?), `ContactInfo` (email?, phone?, linkedin?, location?)

**Files:**
- `backend/app/models/profile.py` (new)
- `backend/app/models/__init__.py` (add import)
- `backend/app/schemas/profile.py` (new)

**Acceptance Criteria:**
- [ ] Model matches migration schema
- [ ] Schemas validate input correctly
- [ ] JSON fields have proper default values

---

## Task 4: UserProfile service + API endpoints

**Description:** Create the service layer and API router for UserProfile CRUD + import.

**Service functions:**
- `get_profile(db, user) → UserProfile | None`
- `upsert_profile(db, user, data: ProfileUpdate) → UserProfile`
- `import_profile_from_text(db, user, text: str) → UserProfile` — calls LLM to parse text into structured profile, saves raw_import

**API endpoints:**
- `GET /api/profile/` — get current user's profile (404 if not created)
- `PUT /api/profile/` — create or update profile
- `POST /api/profile/import` — AI-parse text blob into profile

**Files:**
- `backend/app/services/profile.py` (new)
- `backend/app/api/profile.py` (new)
- `backend/app/main.py` (register router)

**Acceptance Criteria:**
- [ ] GET returns profile or 404
- [ ] PUT upserts (create if missing, update if exists)
- [ ] Import endpoint calls LLM and returns parsed profile
- [ ] All endpoints user-scoped (user sees only own profile)

**Verification:** Manual API test + automated tests

---

## Task 5: AiKnowledgeBase model + schemas

**Description:** Create the SQLAlchemy model and Pydantic schemas for AI Knowledge Base documents.

**Model fields:**
- id (PK), user_id (FK→users), slug (varchar 100), title (varchar 255), content (Text), is_default (bool default=True), used_by (JSON default=[]), created_at, updated_at
- UniqueConstraint(user_id, slug)

**Schemas:**
- `KBDocumentCreate`: slug, title, content, used_by (list[str])
- `KBDocumentUpdate`: title?, content?, used_by?
- `KBDocumentResponse`: all fields

**Files:**
- `backend/app/models/knowledge_base.py` (new)
- `backend/app/models/__init__.py` (add import)
- `backend/app/schemas/knowledge_base.py` (new)

**Acceptance Criteria:**
- [ ] Model matches migration schema
- [ ] Schemas validate slugs and used_by values

---

## Task 6: Default KB documents — seed data

**Description:** Create the 4 default knowledge base documents from OpenClaw resume-optimizer content. Store as Python constants in a dedicated module.

**Documents:**
1. `resume-writing-rules` — from best-practices.md (action verbs, STAR method, bullet structure, format standards)
2. `ats-optimization` — from ats-optimization.md (ATS formatting, keyword strategies, pitfalls)
3. `analysis-checklist` — from analysis-checklist.md (100-point scoring rubric, section criteria)
4. `cover-letter-rules` — cover letter writing best practices

**Seeding logic:**
- Function `seed_kb_for_user(db, user_id)` — creates 4 default docs if they don't exist
- Called from `get_or_create_settings()` or a dedicated seed endpoint
- `is_default=True` for seeded docs

**Files:**
- `backend/app/services/kb_defaults.py` (new) — contains DEFAULT_KB_DOCUMENTS constant + seed function

**Acceptance Criteria:**
- [ ] 4 documents with correct slugs, titles, used_by mappings
- [ ] Seed function is idempotent (doesn't duplicate on re-run)
- [ ] Content is meaningful and comprehensive (not placeholder)

---

## Task 7: AiKnowledgeBase service + API endpoints

**Description:** Create service layer and API router for KB document CRUD + reset.

**Service functions:**
- `list_documents(db, user) → list[AiKnowledgeBase]`
- `get_document(db, user, slug) → AiKnowledgeBase | None`
- `update_document(db, user, slug, data) → AiKnowledgeBase`
- `create_document(db, user, data) → AiKnowledgeBase`
- `delete_document(db, user, slug) → bool` — only non-default docs
- `reset_document(db, user, slug) → AiKnowledgeBase` — restore default content

**API endpoints:**
- `GET /api/knowledge-base/` — list all user's KB docs
- `GET /api/knowledge-base/{slug}` — get single doc
- `PUT /api/knowledge-base/{slug}` — update doc
- `POST /api/knowledge-base/` — create custom doc
- `DELETE /api/knowledge-base/{slug}` — delete custom doc (403 for defaults)
- `POST /api/knowledge-base/{slug}/reset` — reset to default content

**Files:**
- `backend/app/services/knowledge_base.py` (new)
- `backend/app/api/knowledge_base.py` (new)
- `backend/app/main.py` (register router)

**Acceptance Criteria:**
- [ ] CRUD works correctly
- [ ] Cannot delete default documents (returns 403)
- [ ] Reset restores original content from kb_defaults
- [ ] Auto-seeds KB docs on first GET if none exist
- [ ] All endpoints user-scoped

---

## Task 8: Prompt assembly service

**Description:** Create the prompt assembly service that builds complete prompts for AI operations using the two-layer architecture.

**Function:**
```python
async def assemble_prompt(
    db: AsyncSession,
    user: User,
    operation: str,  # "resume_generation" | "ats_audit" | "gap_analysis" | "cover_letter"
    context: dict,   # job_description, resume_text, user_profile, etc.
) -> tuple[str, str]:  # (system_prompt, user_prompt)
```

**Logic:**
1. Get user's custom instruction from UserSettings (fallback to hardcoded default)
2. Get all KB documents where `used_by` includes the operation
3. Assemble system_prompt = instruction
4. Assemble user_prompt = reference docs + context data + output format spec

**Files:**
- `backend/app/services/prompt_assembly.py` (new)

**Acceptance Criteria:**
- [ ] Returns correct (system_prompt, user_prompt) tuple
- [ ] Includes relevant KB docs based on used_by mapping
- [ ] Falls back to default instruction if custom not set
- [ ] Handles missing KB docs gracefully

---

## Task 9: Update Job model + UserSettings model

**Description:** Add `match_result` field to Job model and 4 instruction fields to UserSettings model to match new migration columns.

**Changes:**
- Job: add `match_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)`
- UserSettings: add `instruction_resume`, `instruction_ats_audit`, `instruction_gap_analysis`, `instruction_cover_letter` (all Text nullable)
- Update SettingsUpdate schema to accept instruction fields
- Update SettingsResponse to include instruction fields

**Files:**
- `backend/app/models/job.py` (edit)
- `backend/app/models/settings.py` (edit)
- `backend/app/schemas/settings.py` (edit)
- `backend/app/schemas/job.py` (edit — add match_result to JobResponse)
- `backend/app/services/settings.py` (edit — handle instruction fields in update)

**Acceptance Criteria:**
- [ ] match_result visible in JobResponse
- [ ] Instructions readable/writable via Settings API
- [ ] Existing settings behavior unchanged

---

## Task 10: Tests for Profile, KB, and Prompt Assembly

**Description:** Write tests covering the new backend functionality.

**Test cases:**
- Profile CRUD: create, read, update, upsert behavior
- Profile import: text → structured profile (mock LLM)
- KB: list, get, update, create custom, delete custom, cannot delete default, reset
- KB seeding: first-time seed, idempotency
- Prompt assembly: correct docs selected per operation, fallback to defaults
- Job match_result: saved and returned in API responses
- Settings instructions: read/write via API

**Files:**
- `backend/tests/test_profile.py` (new)
- `backend/tests/test_knowledge_base.py` (new)
- `backend/tests/test_prompt_assembly.py` (new)

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] LLM calls mocked (no real API calls in tests)
- [ ] Coverage of happy paths + edge cases (empty profile, missing KB docs)

---

## Execution Order

```
Task 1 (migration profile+job+settings)
  → Task 3 (UserProfile model+schemas)
    → Task 4 (UserProfile service+API)
Task 2 (migration KB table)
  → Task 5 (KB model+schemas)
    → Task 6 (KB seed data)
      → Task 7 (KB service+API)
Task 9 (Job+Settings model updates) — depends on Task 1
Task 8 (prompt assembly) — depends on Tasks 5, 6, 9
Task 10 (tests) — depends on all above
```

Tasks 1+2 can run in parallel. Tasks 3+5 can run in parallel after their migrations.
