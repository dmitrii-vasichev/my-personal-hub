# PRD: Telegram Pulse

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-16 |
| Status | Approved |
| Priority | P0 |

## Problem Statement

Manually monitoring 15–20 Telegram channels and groups is time-consuming. Important information (job postings, learning materials, industry news) gets lost in the stream. There is no tool for systematically collecting, filtering, and summarizing this content — or for routing actionable items into existing hub modules (Tasks, Jobs, Notes).

**Telegram Pulse** solves this by automatically collecting messages from user-subscribed Telegram sources, applying keyword + AI filtering, generating structured digests, and providing an inbox for routing findings into existing hub modules.

## Goals & Non-Goals

### Goals
- Let users connect their Telegram account and manage monitored sources from the hub UI
- Automatically collect and filter messages from channels/groups on a configurable schedule
- Generate AI-powered digests grouped by category and subcategory
- Provide a learning inbox with AI classification and routing actions (→ Task, → Note, skip)
- Send Telegram bot notifications when digests are ready or urgent jobs are found
- Integrate seamlessly with existing Tasks, Jobs, and Notes modules
- Maintain full data isolation between users (each user has their own Telegram session, sources, and messages)

### Non-Goals
- Real-time monitoring (WebSocket / event listener) — polling only for MVP
- Analytics on collected data (trends, charts)
- Sources beyond Telegram (RSS, Twitter, etc.)
- Multi-language message processing (AI works with whatever language the message is in)
- Full-text editing in Notes (only create-from-content; editing stays in Google Drive)

## User Scenarios

### Scenario 1: Connect Telegram
**As a** hub user, **I want to** link my Telegram account via phone number + verification code, **so that** the system can read my subscribed channels and groups.

### Scenario 2: Manage Sources
**As a** hub user, **I want to** add Telegram channels/groups as monitored sources with category and filtering settings, **so that** only relevant content is collected.

### Scenario 3: View Daily Digest
**As a** hub user, **I want to** receive a structured AI-generated digest (grouped by category → subcategory), **so that** I can quickly review what happened across all my sources without reading every message.

### Scenario 4: Process Learning Inbox
**As a** hub user, **I want to** see AI-classified findings (articles, lifehacks, insights) and route them to Tasks or Notes with one click, **so that** valuable content doesn't get lost.

### Scenario 5: Get Job Alerts
**As a** hub user, **I want to** receive urgent Telegram bot notifications when a matching job is found, **so that** I can act fast on time-sensitive opportunities.

### Scenario 6: Generate Digest On-Demand
**As a** hub user, **I want to** click "Generate now" to get a fresh digest at any time, **so that** I don't have to wait for the scheduled run.

## Functional Requirements

### P0 (Must Have)

#### Telegram Connection
- [ ] FR-1: Telethon authorization flow — phone number → verification code → optional 2FA password
- [ ] FR-2: Encrypted session storage in DB using Fernet (same pattern as Google OAuth tokens)
- [ ] FR-3: Session bound to `user_id`, inaccessible to other users including admin
- [ ] FR-4: Disconnect / revoke Telegram session from Settings UI
- [ ] FR-5: Cascading session deletion when user account is removed

#### Sources Management
- [ ] FR-6: CRUD for Telegram sources (channels/groups) — add by username or invite link
- [ ] FR-7: Three built-in categories with specialized processing logic:
  - **news** — read-only digest (summarize and present)
  - **jobs** — vacancy list with "Add to Jobs" action
  - **learning** — AI-classified inbox with routing actions
- [ ] FR-8: Custom categories (user-created) — behave like news (digest only)
- [ ] FR-9: Per-source settings: subcategory (free text, e.g. "Russia", "AI"), keywords (for filtering noisy groups), criteria (JSON — for jobs: grade, stack, salary range, location)

#### Message Collection
- [ ] FR-10: Periodic polling via background scheduler (default: every 1 hour, configurable per user)
- [ ] FR-11: Two-stage filter pipeline:
  1. Fast keyword filter (instant, no AI cost)
  2. AI relevance analysis for matched messages (against user criteria)
- [ ] FR-12: Message storage with configurable TTL (cleanup after N days, default: 30)
- [ ] FR-13: Deduplication — skip already-collected messages (track by Telegram message ID + channel ID)

#### AI Digests
- [ ] FR-14: Scheduled digest generation (configurable: daily at HH:MM / every N days / weekly on day)
- [ ] FR-15: "Generate now" button for on-demand digest
- [ ] FR-16: AI provider from user settings (`llm_provider` — OpenAI / Anthropic / Google)
- [ ] FR-17: Digest structured per category, with blocks grouped by source subcategory
- [ ] FR-18: Digest stored as markdown in DB, viewable in Pulse UI

#### Learning Inbox
- [ ] FR-19: AI auto-classification of learning items (article, lifehack/instruction, insight, tool, other)
- [ ] FR-20: Per-item actions: "→ Task" (creates task with pulse-learning tag), "→ Note" (creates note), "skip/archive"
- [ ] FR-21: Inbox is temporary — items disappear after action or TTL expiry

#### Notes Write Support
- [ ] FR-22: Extend Notes module — `POST /api/notes/` to create a note (title + markdown content) in Google Drive
- [ ] FR-23: New note appears in the Notes tree after creation

#### Telegram Bot Notifications
- [ ] FR-24: Bot sends brief summary when digest is ready (e.g. "3 vacancies, 5 insights, news from 12 sources")
- [ ] FR-25: Urgent alerts for jobs matching criteria — sent immediately, not waiting for digest
- [ ] FR-26: Notification preferences configurable in Settings (enable/disable per type)

#### UI
- [ ] FR-27: Dashboard "Pulse" widget — compact summary (unread items count, last digest timestamp) with click-through to Pulse section
- [ ] FR-28: "Pulse" section in main navigation — single page with tabs per category
- [ ] FR-29: Each tab: latest digest + list of items with actions
- [ ] FR-30: Sources management sub-page (add/edit/delete sources, set categories and filters)
- [ ] FR-31: Pulse settings sub-page (schedule, polling interval, notification preferences, TTL)

### P1 (Should Have)
- [ ] FR-32: Job items in digest — "Add to Jobs" creates a Job entity with pre-filled fields (title, company, URL, source)
- [ ] FR-33: Source health indicator — show if source is unreachable or returns no messages
- [ ] FR-34: Digest history — view past digests, not just the latest
- [ ] FR-35: Bulk actions in learning inbox — select multiple items and route together

### P2 (Nice to Have)
- [ ] FR-36: Preview messages before digest (raw collected messages view)
- [ ] FR-37: Digest comparison — highlight what's new vs. previous digest
- [ ] FR-38: Export digest as PDF

## Non-Functional Requirements

- **Performance:** Polling 20 sources should complete within 60 seconds. Digest generation within 30 seconds for up to 500 messages.
- **Security:** Telegram sessions encrypted at rest (Fernet). No session files on disk. Session accessible only by owning user. All Pulse API endpoints enforce `user_id` ownership check.
- **Reliability:** Failed polling for one source must not block others. Retry with exponential backoff on transient Telegram errors.
- **Storage:** Messages cleaned up by TTL. No unbounded growth.
- **Multi-user:** Complete data isolation — each user has their own Telegram session, sources, messages, digests, and settings.

## Technical Architecture

### Stack
- **Telethon** — MTProto client for reading channels/groups from user's Telegram account
- **python-telegram-bot** — Bot API for sending notifications to users
- **APScheduler** — background task scheduling (polling + digest generation)
- **FastAPI** — existing backend (new routers + services)
- **SQLAlchemy** — new models for Pulse entities
- **Fernet** — session encryption (existing `encryption.py`)
- **AI providers** — existing integration (OpenAI / Anthropic / Google)

### Chosen Approach: Hybrid — Telethon + Bot API

**Rationale:** Telethon (userbot via MTProto) provides full access to any channel the user is subscribed to, without requiring bot admin rights. Bot API is used solely for outbound notifications — clean separation of read (Telethon) vs. notify (Bot).

**Alternative considered:** Bot-only approach — rejected because bots can only read channels where they are added as admin, which severely limits usability.

### API Design

#### Telegram Connection
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pulse/telegram/start-auth` | Send phone number, receive code request |
| POST | `/api/pulse/telegram/verify-code` | Submit verification code (+ optional 2FA) |
| GET | `/api/pulse/telegram/status` | Check connection status |
| DELETE | `/api/pulse/telegram/disconnect` | Revoke session and delete from DB |

#### Sources
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pulse/sources/` | List all user's sources |
| POST | `/api/pulse/sources/` | Add a new source |
| PATCH | `/api/pulse/sources/{id}` | Update source settings |
| DELETE | `/api/pulse/sources/{id}` | Remove source |
| GET | `/api/pulse/sources/{id}/resolve` | Resolve channel/group info from Telegram |

#### Digests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pulse/digests/` | List digests (paginated) |
| GET | `/api/pulse/digests/latest` | Get latest digest |
| GET | `/api/pulse/digests/{id}` | Get specific digest |
| POST | `/api/pulse/digests/generate` | Trigger on-demand generation |

#### Messages & Inbox
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pulse/messages/` | List collected messages (filtered by category/source) |
| GET | `/api/pulse/inbox/` | Learning inbox items |
| POST | `/api/pulse/inbox/{id}/action` | Route item: `to_task`, `to_note`, `skip` |
| POST | `/api/pulse/inbox/bulk-action` | Bulk route multiple items |

#### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pulse/settings/` | Get Pulse settings |
| PUT | `/api/pulse/settings/` | Update Pulse settings |

### Data Model

#### `telegram_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, unique, ON DELETE CASCADE |
| session_data | Text | Fernet-encrypted Telethon session |
| phone_number | String | Fernet-encrypted |
| is_active | Boolean | default true |
| connected_at | DateTime(tz) | |
| last_used_at | DateTime(tz) | |

#### `pulse_sources`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| telegram_id | BigInteger | Telegram channel/group numeric ID |
| username | String | @channel_name (nullable for private groups) |
| title | String | Display name |
| category | String | "news" / "jobs" / "learning" / custom |
| subcategory | String | Free text for digest grouping (nullable) |
| keywords | JSON | List of filter keywords (nullable) |
| criteria | JSON | Category-specific criteria (nullable) |
| is_active | Boolean | default true |
| last_polled_at | DateTime(tz) | |
| created_at | DateTime(tz) | |

#### `pulse_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| source_id | UUID | FK → pulse_sources, ON DELETE CASCADE |
| telegram_message_id | BigInteger | For dedup |
| text | Text | Message content |
| sender_name | String | |
| message_date | DateTime(tz) | Original Telegram timestamp |
| category | String | Inherited from source |
| ai_relevance | Float | 0.0–1.0 (nullable, set after AI check) |
| ai_classification | String | For learning: article/lifehack/insight/tool/other |
| status | String | "new" / "in_digest" / "actioned" / "skipped" / "expired" |
| collected_at | DateTime(tz) | When we fetched it |
| expires_at | DateTime(tz) | collected_at + TTL |

**Unique constraint:** `(user_id, source_id, telegram_message_id)` for deduplication.

#### `pulse_digests`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| category | String | Digest category (or "all") |
| content | Text | Markdown digest |
| message_count | Integer | Messages processed |
| generated_at | DateTime(tz) | |
| period_start | DateTime(tz) | Earliest message included |
| period_end | DateTime(tz) | Latest message included |

#### `pulse_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, unique, ON DELETE CASCADE |
| polling_interval_minutes | Integer | default 60 |
| digest_schedule | String | "daily" / "every_N_days" / "weekly" |
| digest_time | Time | default 09:00 |
| digest_day | Integer | Day of week for weekly (nullable) |
| digest_interval_days | Integer | For every_N_days (nullable) |
| message_ttl_days | Integer | default 30 |
| bot_token | Text | Fernet-encrypted (nullable) |
| bot_chat_id | BigInteger | User's chat with the bot (nullable) |
| notify_digest_ready | Boolean | default true |
| notify_urgent_jobs | Boolean | default true |
| updated_at | DateTime(tz) | |

### Integration Points

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| Tasks module | Pulse → Task | `POST /api/tasks/` with `title`, `description`, tag "pulse-learning" |
| Notes module | Pulse → Note | New `POST /api/notes/` endpoint (FR-22) — creates Google Drive doc |
| Jobs module | Pulse → Job | `POST /api/jobs/` with pre-filled fields from parsed vacancy |
| Dashboard | Pulse → Widget | New dashboard widget with summary data |
| AI providers | Pulse → AI | Existing `user_settings.llm_provider` + encrypted API keys |
| Encryption | Pulse → Fernet | Existing `encryption.py` for session + bot token storage |

## Phasing

| Phase | Name | Scope |
|-------|------|-------|
| 32 | Telegram Connection & Pulse Models | DB models, migrations, Telethon auth flow, encrypted session storage, connection status API, disconnect. Settings UI tab for Telegram connection. |
| 33 | Sources Management | Source CRUD API + UI. Category system (news/jobs/learning/custom). Source resolution from Telegram. Sources management page. |
| 34 | Message Collection & Filtering | Background scheduler (APScheduler). Periodic polling. Keyword filter + AI relevance filter. Message storage with TTL cleanup. |
| 35 | AI Digests | Digest generation service. Scheduled + on-demand generation. Markdown digest grouped by category/subcategory. Digest API + Pulse UI (tabs per category, digest view). |
| 36 | Learning Inbox & Notes Write | Inbox API + UI. AI classification. Routing actions (→ Task, → Note, skip). Extend Notes module with write support (Google Drive). |
| 37 | Bot Notifications & Dashboard Widget | Telegram bot setup. Notification service. Digest-ready + urgent job alerts. Dashboard Pulse widget. Polish & integration testing. |

## Out of Scope
- Real-time monitoring (WebSocket / event listener)
- Analytics on collected data (trends, charts)
- Sources beyond Telegram (RSS, Twitter, etc.)
- Multi-language message processing
- Full Notes editor (only create-from-content)

## Acceptance Criteria
- [ ] AC-1: User can connect Telegram account, see connection status, and disconnect — session is encrypted and isolated
- [ ] AC-2: User can add/edit/remove sources with categories and filters
- [ ] AC-3: System automatically polls sources on schedule and stores filtered messages
- [ ] AC-4: AI digest is generated on schedule and on-demand, displayed in Pulse UI with category tabs
- [ ] AC-5: Learning inbox shows AI-classified items; routing to Task/Note works with one click
- [ ] AC-6: Telegram bot sends notifications when digest is ready and for urgent job matches
- [ ] AC-7: Dashboard shows Pulse widget with summary
- [ ] AC-8: All data is isolated per user; session deletion cascades properly
- [ ] AC-9: Messages are cleaned up after TTL expiry

## Risks & Open Questions
- **Telegram rate limits:** Telethon has rate limits for reading channels. Mitigation: polling interval minimum 15 minutes, sequential source reading with delays.
- **Telethon session persistence:** StringSession can be serialized and encrypted. Need to verify reconnection reliability after server restart.
- **Bot token management:** Each user needs to create their own bot via @BotFather (or use a shared project bot). Decision: user provides their own bot token in settings.
- **APScheduler persistence:** Need job store that survives backend restarts. Decision: use SQLAlchemy job store or store schedule in DB and recreate jobs on startup.
