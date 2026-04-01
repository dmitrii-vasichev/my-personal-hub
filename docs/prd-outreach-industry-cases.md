# PRD: Outreach Industry Cases Management

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev, Antigravity (AI) |
| Date | 2026-03-31 |
| Status | Draft |
| Priority | P1 |
| Context | B2B Outreach Automation |

## Problem Statement

The Outreach module categorizes leads by Industry. To generate highly relevant and personalized commercial proposals for these leads, the system needs specific "use-cases" or "automation ideas" mapped to each industry.
Currently, managing these instructions on a per-industry basis (either via individual UI input fields or individual Google Docs per industry) creates significant friction. The user, operating with an AI-assisted workflow, wants to bulk-generate and bulk-edit these industry cases using LLMs (e.g., passing a list of 50 industries to Claude to write use-cases for all of them at once). A fragmented 1-to-1 editing approach makes mass updates impossible.

## Goals & Non-Goals

### Goals
- Enable a seamless, bulk-editing workflow for Industry cases using external LLMs.
- Eliminate the need to manually click through and edit dozens of individual industry cards or separate Google Docs.
- Automatically contextualize the AI proposal generator for leads based on their specific industry's pre-defined cases.

### Non-Goals
- Real-time two-way synchronization with 50+ individual Google Docs.
- Complex UI builders for generating prompts inside the app.
- Fully autonomous case generation (the user acts as the "editor in chief" bridging the app and the LLM).

## Core Concept: The "Master Markdown" Workflow

To support the user's desire for bulk AI processing, we will shift from a "1 Google Doc per Industry" model to a **"Markdown Export/Import"** model. 

### How it works:
1. **Export:** In the Industries section, the user clicks "Export to Markdown". The system generates a single text payload containing all active industries formatted as Markdown headers (e.g., `# Real Estate\n[No cases defined]\n\n# Restaurants\n...`).
2. **AI Processing:** The user copies this text, pastes it into Claude/ChatGPT, and prompts: *"I am a BI/Data developer. Fill in 2-3 specific automation and dashboard use-cases for each of these industries."*
3. **Import:** The user takes the LLM's Markdown output and pastes it into an "Import Cases" modal in the Hub.
4. **Parsing:** The backend automatically parses the Markdown file. It matches the `# Headers` to the industry names in the database and updates a new `prompt_instructions` text field for each industry.
5. **Execution:** When the user clicks "Generate Proposal" on a Lead, the backend pulls the text from that Lead's Industry `prompt_instructions` and injects it into the system prompt.

*(Alternative approach if Google Drive is strictly preferred: Link ONE "Master Cases Google Doc" to the entire system, and the backend syncs and parses it by H1/H2 headers periodically. However, the manual Export/Import Markdown approach is usually more robust and less prone to API sync errors).*

## Functional Requirements (FR)

### Database Layer
- [ ] **FR-1:** Add a `prompt_instructions` (TEXT, nullable) column to the `industries` table (via Alembic migration).

### API Layer
- [ ] **FR-2:** `GET /api/outreach/industries/cases/export` -> Returns a plain-text/markdown string with all industries and their current `prompt_instructions`.
- [ ] **FR-3:** `POST /api/outreach/industries/cases/import` -> Accepts a markdown string, parses it by headers (`# Industry Name`), and bulk-updates the `prompt_instructions` for matching industries. Returns a summary of matched/updated records.

### LLM / Proposal Generation Layer
- [ ] **FR-4:** Update the `generate_proposal` LLM chain to fetch the associated `Industry`. If `industry.prompt_instructions` is not null, inject it into the system prompt: *"When drafting the proposal, focus on offering the following specific use-cases for the lead's industry: {industry.prompt_instructions}"*.

### Frontend Layer
- [ ] **FR-5:** Add a "Manage Cases (Bulk)" dropdown or buttons in the Industries list view, triggering two modals: "Export Cases" (with a simple "Copy to Clipboard" button) and "Import Cases" (with a large textarea and "Save" button).
- [ ] **FR-6:** In the individual Industry edit dialog, expose `prompt_instructions` as a standard textarea, for minor one-off tweaks without needing the full import process.

## Decisions
1. **Workflow:** The user has agreed to the Markdown Export/Import workflow via UI.
2. **Missing Industries:** If an imported Markdown file contains an industry (`# <Name>`) that is not present in the database, the system will **IGNORE** that block rather than creating a new industry.
3. **Google Drive Link Removal:** The previous `drive_file_id` logic (linking an individual Google Doc to each industry) is now completely obsolete. That field will be removed from the database, UI, and proposal generation service `lead_proposal.py`.
