# PRD: Outreach — Cold Outreach CRM for Russian-Speaking Businesses

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-03-27 |
| Status | Complete |
| Priority | P1 |

## Problem Statement

Current job search strategy relies on reactive channels: applying to posted vacancies via LinkedIn and job APIs. Many Russian-speaking businesses in the US don't post job listings but need automation services — they simply lack awareness or contacts. There's no tool to manage proactive outreach: finding prospects, generating personalized proposals, and tracking responses.

## User Scenarios

### Scenario 1: Parse contacts from a PDF magazine
**As a** user, **I want to** upload a PDF of a Russian-language newspaper/magazine, **so that** the system extracts business contacts (name, industry, email, phone, website, service description) into leads.

### Scenario 2: Manually add a lead
**As a** user, **I want to** manually create a lead with business details, **so that** I can track prospects found outside of PDF sources.

### Scenario 3: Generate a personalized proposal
**As a** user, **I want to** generate a commercial proposal for a lead based on their industry and specific services, **so that** I can send a relevant, personalized offer without writing each one from scratch.

### Scenario 4: Track outreach status
**As a** user, **I want to** move leads through a kanban pipeline (New → Sent → Replied → In Progress → Rejected → On Hold), **so that** I can manage the full outreach lifecycle.

### Scenario 5: Manage industry templates
**As a** user, **I want to** map industries to Markdown template files on Google Drive, **so that** AI uses relevant case studies and offerings when generating proposals.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: **Lead model** — store leads with fields: business_name, industry, contact_person, email, phone, website, service_description, source, status, notes, proposal_text, created_at, updated_at
- [ ] FR-2: **Lead CRUD** — create, read, update, delete leads via API
- [ ] FR-3: **Manual lead creation** — form to add leads by hand
- [ ] FR-4: **PDF upload & parsing** — upload PDF → convert pages to images → GPT-4o Vision extracts structured contacts → save as leads (batch)
- [ ] FR-5: **Industry registry** — manage list of industries with mapped Google Drive file IDs (Markdown templates)
- [ ] FR-6: **Proposal generation** — AI generates personalized proposal using: industry template (from Google Drive) + lead's service_description + lead's business_name
- [ ] FR-7: **Proposal display & copy** — show generated proposal with one-click copy to clipboard for manual email sending
- [ ] FR-8: **Kanban board** — drag-and-drop board with statuses: new, sent, replied, in_progress, rejected, on_hold
- [ ] FR-9: **Status history** — log every status change with timestamp and optional comment
- [ ] FR-10: **List view** — table view with search, filter by status/industry, sort by date/name/industry
- [ ] FR-11: **Navigation** — "Outreach" item in sidebar, separate from Job Hunt
- [ ] FR-11a: **Demo mode exclusion** — hide Outreach from sidebar and block API routes when `isDemo` (no demo seed data)

### P1 (Should Have)

- [ ] FR-12: **Bulk lead review** — after PDF parsing, show extracted leads for review/edit before saving (preview step)
- [ ] FR-13: **Proposal regeneration** — regenerate proposal with updated template or edited context
- [ ] FR-14: **Lead detail view** — expanded view with full info, proposal, status history, notes
- [ ] FR-15: **Industry auto-detection** — when creating lead from PDF, AI suggests industry based on service_description

### P2 (Nice to Have)

- [ ] FR-16: **PDF parsing progress** — show page-by-page progress during PDF processing
- [ ] FR-17: **Duplicate detection** — warn if lead with same email/phone already exists
- [ ] FR-18: **Analytics tab** — outreach funnel (sent → replied → in_progress conversion rates)

## Non-Functional Requirements

- **Performance:** PDF parsing (30 pages) should complete within 2-3 minutes
- **Cost:** ~$0.50 per PDF magazine (GPT-4o Vision), ~$0.01 per proposal generation
- **Consistency:** Follow existing Job Hunt module patterns (API structure, kanban, hooks, components)

## Technical Design

### Stack
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, dnd-kit
- AI: OpenAI GPT-4o (Vision for PDF), GPT-4o-mini (proposal generation)
- Storage: Google Drive (industry templates as Markdown files)

### Chosen Approach

**Architecture mirrors Job Hunt module** for consistency:

**Backend:**
- Model: `Lead` + `LeadStatusHistory` + `Industry` tables
- API: `/api/leads/` (CRUD, status, kanban) + `/api/leads/parse-pdf` + `/api/leads/{id}/generate-proposal` + `/api/industries/` (CRUD, mapping)
- Services: `lead.py` (CRUD/status), `lead_pdf_parser.py` (PDF → images → Vision API), `lead_proposal.py` (template + AI → proposal)
- PDF processing: `pdf2image` or `PyMuPDF` to convert pages → base64 images → OpenAI Vision API with structured extraction prompt → list of LeadCreate objects

**Frontend:**
- Page: `/outreach/page.tsx` with tabs: Leads | Kanban
- Components: `OutreachKanban`, `OutreachColumn`, `OutreachCard`, `LeadDialog`, `LeadsTable`, `LeadDetail`, `PdfUploadDialog`, `ProposalSection`, `IndustryManager`
- Hooks: `use-leads.ts` (React Query, same pattern as use-jobs.ts)
- Types: `lead.ts` (LeadStatus enum, Lead interface, Industry interface)

**AI Flow for Proposal Generation:**
1. Fetch industry template from Google Drive (Markdown file by mapped file_id)
2. Build prompt: system instruction + industry template content + lead.service_description + lead.business_name
3. Call LLM (GPT-4o-mini) → generate proposal text in Russian
4. Save to `lead.proposal_text`, display in UI

**AI Flow for PDF Parsing:**
1. Upload PDF → backend saves temporarily
2. Convert each page to image (png)
3. For each page: send image to GPT-4o Vision with extraction prompt
4. AI returns structured JSON: array of {business_name, industry_suggestion, contact_person, email, phone, website, service_description}
5. Merge results, show preview to user → user confirms → save as leads

### Data Model

```
leads
├── id (UUID, PK)
├── user_id (FK → users)
├── business_name (VARCHAR, required)
├── industry_id (FK → industries, nullable)
├── contact_person (VARCHAR, nullable)
├── email (VARCHAR, nullable)
├── phone (VARCHAR, nullable)
├── website (VARCHAR, nullable)
├── service_description (TEXT, nullable)
├── source (VARCHAR) — "pdf", "manual"
├── source_detail (VARCHAR, nullable) — PDF filename or other context
├── status (ENUM: new, sent, replied, in_progress, rejected, on_hold)
├── notes (TEXT, nullable)
├── proposal_text (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

lead_status_history
├── id (UUID, PK)
├── lead_id (FK → leads)
├── old_status (VARCHAR)
├── new_status (VARCHAR)
├── comment (TEXT, nullable)
└── changed_at (TIMESTAMP)

industries
├── id (UUID, PK)
├── user_id (FK → users)
├── name (VARCHAR, required) — "Legal Services", "Dental", "Real Estate", etc.
├── slug (VARCHAR, unique per user)
├── drive_file_id (VARCHAR, nullable) — Google Drive Markdown file ID
├── description (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```

Indexes:
- `ix_leads_user_status` (user_id, status) — kanban queries
- `ix_leads_user_industry` (user_id, industry_id) — filter by industry
- `ix_industries_user_slug` (user_id, slug) — unique industry lookup

## Implementation Phases

- **Phase 1: Foundation** — Lead model, CRUD API, manual creation, list/table view, kanban, navigation
- **Phase 2: PDF Parsing** — PDF upload, page-to-image conversion, GPT-4o Vision extraction, bulk preview & save
- **Phase 3: Proposals** — Industry registry, Google Drive template mapping, AI proposal generation, copy-to-clipboard
- **Phase 4: Polish** — Duplicate detection, analytics, regeneration, UX improvements

## Out of Scope

- Automatic email sending via Gmail integration
- Automatic website scraping for email discovery
- Online directory/catalog parsing
- Email open/click tracking
- Multi-language proposals (Russian only for v1)
- Integration with CRM systems (HubSpot, etc.)

## Acceptance Criteria

- [ ] AC-1: User can upload a PDF and see extracted leads in preview before saving
- [ ] AC-2: User can manually create, edit, and delete leads
- [ ] AC-3: User can drag leads across kanban columns, status history is logged
- [ ] AC-4: User can map an industry to a Google Drive Markdown file
- [ ] AC-5: User can generate a personalized proposal for a lead and copy it to clipboard
- [ ] AC-6: Outreach section is accessible from sidebar, independent from Job Hunt

## Risks & Open Questions

- **Risk:** PDF layout quality varies — some magazines may have low-resolution scans. Mitigation: allow manual correction of extracted data in preview step
- **Risk:** Google Drive token expiry during proposal generation. Mitigation: reuse existing refresh token flow from Notes module
- **Open:** Should proposal language be configurable (Russian/English)? Deferred to v2
- **Open:** Optimal prompt structure for PDF Vision extraction — will need iteration during Phase 2
