# Finish-Out Backlog

Last updated: 2026-04-27

## Completed In This Finish-Out Pass

### D14 — Task Primary Draft Link

Added `linked_document_id` to tasks and wired `JUMP TO DRAFT` in Today.

### D15 — Pulse Item Read State

Added item-level read/unread state and restored `Pulse unread` in Today.

### E18 — Telegram Bot Project Refresh

Added `/refresh` to rediscover sibling projects without restarting the LaunchAgent.

### E17 — Telegram Bot Per-Project Settings Overlay

Merged project-local `.claude/settings.json` with the global locked/unlocked profile at runtime.

### E16 — Whisper Benchmark And Optional Device

Added live latency logging, benchmark tooling, and opt-in Whisper device selection.

### Frontend Test Debt Cleanup

Restored the broad frontend Vitest suite, removed lint warnings, and kept production build green.

## Deferred / Manual

- D13 production backfill rehearsal against a production snapshot.
- Full browser smoke for D13 event dialog link/clear flow.
- Full browser smoke for D12 focus session reload behavior.
- Cleanup old local/remote branches if the owner wants repository hygiene later.

## Parking Lot

- Command palette backend search endpoint if recent entities grow beyond local filtering scale.
- Searchable job selector for calendar event linking if the job list exceeds roughly 50 active jobs.
- Optimize D13 backfill from O(events × jobs-query) to one jobs prefetch per user if production data grows.
