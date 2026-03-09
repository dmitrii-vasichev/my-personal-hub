# Phase 4: Job Hunt — Search & AI

## Overview
Add external job search integrations, AI-powered resume/cover letter generation, job hunt analytics, and user settings to the Job Hunt module.

**PRD References:** FR-20 through FR-30

## Dependencies
- Phase 3 complete (Job CRUD, Application tracking, Kanban)
- External API keys needed at runtime: Adzuna, SerpAPI/JSearch, OpenAI/Anthropic/Gemini

## Tasks

### Task 1: Database Migration — Settings, Resumes, Cover Letters
**FR:** FR-29, FR-23, FR-26

Create Alembic migration `004_create_settings_resumes_cover_letters.py`:

**user_settings** table:
- `id`, `user_id` (FK, unique), `default_location`, `target_roles` (JSON array)
- `min_match_score` (int, default 0), `excluded_companies` (JSON array)
- `stale_threshold_days` (int, default 14)
- `llm_provider` (VARCHAR: openai/anthropic/gemini, default "openai")
- `api_key_openai` (TEXT, encrypted), `api_key_anthropic` (TEXT, encrypted), `api_key_gemini` (TEXT, encrypted)
- `updated_at`

**resumes** table:
- `id`, `application_id` (FK), `version` (int), `resume_json` (JSON)
- `pdf_url` (TEXT, nullable), `ats_score` (int, nullable)
- `ats_audit_result` (JSON, nullable), `gap_analysis` (JSON, nullable)
- `created_at`

**cover_letters** table:
- `id`, `application_id` (FK), `content` (TEXT), `version` (int)
- `created_at`

**Files:** `backend/app/models/settings.py`, `backend/app/models/resume.py`, migration file

---

### Task 2: Encryption Utility for API Keys
**FR:** FR-29

Create `backend/app/core/encryption.py`:
- Use `cryptography.fernet` for symmetric encryption
- Encryption key from env var `ENCRYPTION_KEY`
- `encrypt_value(plaintext) -> str` and `decrypt_value(ciphertext) -> str`
- Never log or expose decrypted keys in API responses

**Files:** `backend/app/core/encryption.py`, update `backend/app/core/config.py`

---

### Task 3: User Settings API + UI
**FR:** FR-29

**Backend:**
- Schemas: `SettingsUpdate`, `SettingsResponse` (API keys masked in response)
- Service: `settings.py` — get/upsert settings, encrypt API keys on save, decrypt on read (for internal use)
- Routes: `GET /api/settings/`, `PUT /api/settings/`

**Frontend:**
- New page: `/settings` — form with sections:
  - Job Search: target roles (tag input), default location, excluded companies (tag input), min match score
  - AI Provider: LLM provider select, API key inputs (masked display)
  - Preferences: stale threshold days
- Add "Settings" to sidebar navigation
- Hooks: `useSettings()`, `useUpdateSettings()`
- Types: `UserSettings`, `UpdateSettingsInput`

**Files:** Backend schemas/service/routes, frontend page + components + hooks

---

### Task 4: Fetch Job Description from URL
**FR:** FR-30

**Backend:**
- Service: `scraper.py` — fetch URL content, extract job description text
- SSRF protection: block private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, ::1), validate URL scheme (http/https only)
- Use `httpx` async client with timeout (10s), follow redirects (max 3)
- HTML parsing with `beautifulsoup4` — extract main content, strip scripts/styles
- Route: `POST /api/jobs/fetch-description` — accepts `{ url: string }`, returns `{ description: string }`
- Apply to job detail: "Fetch Description" button fills description field

**Frontend:**
- Add "Fetch Description" button to job dialog when URL is provided
- Loading state while fetching
- Auto-fill description field with result

**Files:** `backend/app/services/scraper.py`, update job routes, update `job-dialog.tsx`

---

### Task 5: External Job Search — Backend
**FR:** FR-20, FR-21

**Backend:**
- Service: `search.py` — unified search interface with provider adapters
- Provider adapters (each in `backend/app/services/providers/`):
  - `adzuna.py` — Adzuna API (app_id + app_key from settings)
  - `serpapi.py` — SerpAPI Google Jobs (api_key from settings)
  - `jsearch.py` — JSearch/RapidAPI (api_key from settings)
- Common response format: `SearchResult(title, company, location, url, description, salary_min, salary_max, source, found_at)`
- Routes:
  - `POST /api/search/` — search across selected provider(s), params: query, location, provider, page
  - `POST /api/search/save` — save search result as a Job (set source to provider name)
- Config: provider API keys stored in user_settings (encrypted)

**Files:** `backend/app/services/search.py`, `backend/app/services/providers/`, search routes

---

### Task 6: External Job Search — Frontend
**FR:** FR-20, FR-21

- New tab "Search" on jobs page (alongside "Jobs" and "Pipeline")
- Search form: query input, location input, provider select (Adzuna/SerpAPI/JSearch)
- Results list: title, company, location, salary, source badge
- "Save" button on each result → creates Job via `POST /api/search/save`
- Already-saved indicator (match by URL)
- Pagination (load more)
- Empty state, loading skeleton

**Files:** New components in `frontend/src/components/jobs/`, update jobs page, new hooks

---

### Task 7: AI Resume Generation
**FR:** FR-23, FR-27

**Backend:**
- Service: `ai.py` — multi-provider LLM client
  - Factory pattern: `get_llm_client(provider, api_key)` → returns adapter
  - Adapters: `openai_adapter.py`, `anthropic_adapter.py`, `gemini_adapter.py`
  - Common interface: `generate(system_prompt, user_prompt) -> str`
- Service: `resume.py`:
  - `generate_resume(application_id, user_settings)` — builds prompt from job description + user profile, calls LLM, returns structured resume JSON
  - Resume JSON format: contact, summary, experience[], education[], skills[], certifications[]
  - Store result in `resumes` table
- Route: `POST /api/resumes/generate` — params: application_id
- Route: `GET /api/resumes/{application_id}` — list resumes for application
- PDF generation: use `weasyprint` or `reportlab` to render resume JSON → PDF
- Route: `GET /api/resumes/{id}/pdf` — returns PDF file

**Frontend:**
- Resume section in application detail page
- "Generate Resume" button → calls API, shows loading
- Resume preview (rendered from JSON)
- "Download PDF" button
- Version history (list of generated resumes)

**Files:** Backend AI service + adapters, resume service/routes/schemas, frontend components

---

### Task 8: ATS Audit & Gap Analysis
**FR:** FR-24, FR-25

**Backend:**
- Extend `resume.py` service:
  - `ats_audit(resume_id)` — sends resume + job description to LLM, returns ATS score (0-100) + audit details (keyword matches, formatting issues, suggestions)
  - `gap_analysis(resume_id)` — matching keywords, missing keywords, strengths, recommendations
- Store results in `resumes` table (ats_score, ats_audit_result JSON, gap_analysis JSON)
- Routes:
  - `POST /api/resumes/{id}/ats-audit` — run ATS audit
  - `POST /api/resumes/{id}/gap-analysis` — run gap analysis

**Frontend:**
- ATS score badge on resume card
- Expandable audit results: keyword matches, formatting issues, suggestions
- Gap analysis panel: matching/missing keywords with visual indicators, recommendations list

**Files:** Update resume service/routes, new frontend components

---

### Task 9: Cover Letter Generation
**FR:** FR-26

**Backend:**
- Service: extend `resume.py` or separate `cover_letter.py`:
  - `generate_cover_letter(application_id, user_settings)` — prompt with job description + resume, returns cover letter text
  - Store in `cover_letters` table
- Routes:
  - `POST /api/cover-letters/generate` — params: application_id
  - `GET /api/cover-letters/{application_id}` — list cover letters

**Frontend:**
- Cover letter section in application detail page
- "Generate Cover Letter" button
- Preview with copy-to-clipboard
- Version history

**Files:** Backend cover letter service/routes/schemas, frontend components

---

### Task 10: Job Hunt Analytics
**FR:** FR-28

**Backend:**
- Service: `analytics.py` — query-based analytics:
  - `get_funnel()` — count applications per status
  - `get_timeline()` — applications over time (weekly/monthly)
  - `get_skills_demand()` — most common tags/skills from jobs
  - `get_sources()` — jobs by source breakdown
  - `get_response_rates()` — applied → interview conversion, response time averages
  - `get_ats_scores()` — average ATS scores, distribution
- Routes:
  - `GET /api/analytics/funnel`
  - `GET /api/analytics/timeline`
  - `GET /api/analytics/skills`
  - `GET /api/analytics/sources`
  - `GET /api/analytics/summary` — combined key metrics

**Frontend:**
- New tab "Analytics" on jobs page (or sub-page `/jobs/analytics`)
- Charts using `recharts`:
  - Funnel chart (applications by status)
  - Timeline chart (applications over time)
  - Bar chart (top skills/tags)
  - Pie chart (sources breakdown)
  - KPI cards (total jobs, applications, interview rate, avg ATS score)
- Date range filter

**Files:** Backend analytics service/routes, frontend analytics page + chart components

---

### Task 11: Auto-Search (Saved Searches)
**FR:** FR-22

**Backend:**
- This is a stretch goal — auto-search runs based on saved target roles and location from user_settings
- For MVP: add a "Quick Search" button that searches using target roles from settings
- Route: `POST /api/search/auto` — uses target_roles + default_location from settings, searches across all configured providers

**Frontend:**
- "Auto Search" button on search tab — runs search with saved preferences
- Results merge from multiple providers, deduplicated by URL

**Files:** Update search service/routes, frontend search components

---

## Implementation Order

1. Task 1 — DB migration (foundation for everything)
2. Task 2 — Encryption utility (needed for settings)
3. Task 3 — User Settings (needed for search + AI)
4. Task 4 — Fetch job description (useful standalone, needed for AI)
5. Task 5 — External search backend
6. Task 6 — External search frontend
7. Task 7 — AI Resume generation
8. Task 8 — ATS audit & gap analysis
9. Task 9 — Cover letter generation
10. Task 10 — Job Hunt analytics
11. Task 11 — Auto-search

## Technical Notes

- All new backend dependencies: `httpx`, `beautifulsoup4`, `cryptography`, `openai`, `anthropic`, `google-generativeai`, `weasyprint` or `reportlab`
- API keys for external services are per-user (stored encrypted in user_settings)
- LLM prompts should be well-structured with clear instructions for resume/cover letter format
- SSRF protection is critical for URL fetching
- Analytics queries should be optimized (consider materialized views if performance is an issue)
