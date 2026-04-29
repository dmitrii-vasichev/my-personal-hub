# Actions Unification Backlog

Last updated: 2026-04-29

## In Scope For This Rollout

- Ship `/actions` as the primary daily action/reminder section.
- Keep `/api/reminders` compatible while introducing `/api/actions`.
- Support inbox, anytime, and scheduled action modes.
- Move birthdays to `/actions/birthdays`.
- Add focus sessions linked to Actions.
- Remove old Tasks from visible frontend surfaces.
- Add task-linked reminder cleanup dry-run and preservation helpers.

## Deferred

- Execute hard deletion of task data after owner review and action-time confirmation.
- Add structured note/job/calendar links to Actions.
- Build a dedicated digest UI for inbox/anytime Actions.
- Add a dedicated mobile offline/PWA smoke pass.

## Historical Completed Work

The previous finish-out pass shipped task primary draft links, Pulse item read state, Telegram project refresh, per-project Telegram settings overlay, Whisper benchmark controls, and frontend test debt cleanup. Historical status details remain in `docs/STATUS.md`.
