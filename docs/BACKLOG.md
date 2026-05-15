# Telegram Claude Bridge Decommission Backlog

Last updated: 2026-05-15

## In Scope For This Rollout

- Stop the local Telegram bridge LaunchAgent.
- Remove the standalone bridge bot package.
- Remove bridge-specific backend endpoints, schemas, tests, user fields, and
  migration state.
- Remove bridge-specific frontend settings UI, hooks, and types.
- Preserve Telegram Pulse, Telegram Mini App, reminder callback, and channel
  digest functionality.

## Deferred

- Revoke the BotFather token from Telegram if the owner wants the bot identity
  invalidated outside the repository.
- Revoke the old Hub `telegram-bridge` API token from the portal if it still
  exists.

## Historical Completed Work

Telegram-to-Claude-Code bridge Phases 1-5 were shipped in April 2026 and are
now intentionally decommissioned. Historical details remain in
`docs/archive/shipped-log.md`.
