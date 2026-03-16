# Phase 36 — Learning Inbox & Notes Write

## Overview
Add learning inbox with AI classification and routing actions (→ Task, → Note, skip). Extend Notes module with write support via Google Drive.

## PRD References
FR-19, FR-20, FR-21, FR-22, FR-23

## Tasks

| # | Issue | Task | Status |
|---|-------|------|--------|
| 1 | #513 | Google Drive write scope + create_file() | pending |
| 2 | #514 | Notes write service — create_note() | pending |
| 3 | #515 | POST /api/notes/ endpoint | pending |
| 4 | #516 | Notes write backend tests | pending |
| 5 | #517 | Learning inbox Pydantic schemas | pending |
| 6 | #518 | Learning inbox service | pending |
| 7 | #519 | Learning inbox API endpoints | pending |
| 8 | #520 | Learning inbox backend tests | pending |
| 9 | #521 | Frontend: use-pulse-inbox hook | pending |
| 10 | #522 | Frontend: InboxView component | pending |
| 11 | #523 | Frontend: integrate inbox into Pulse page | pending |
| 12 | #524 | Frontend: learning inbox tests | pending |

## Dependencies
- Tasks 1→2→3→4 (notes write chain)
- Tasks 5→6→7→8 (inbox backend chain)
- Tasks 9→10→11→12 (frontend chain)
- Task 6 depends on Task 3 (to_note action needs notes write)

## Key Decisions
- OAuth scope: `drive.file` (not full `drive`) — only accesses files created by the app
- Inbox items = PulseMessage — no new model, query existing messages with learning category + classification
- Items inherit message TTL; status "skipped" hides from inbox
