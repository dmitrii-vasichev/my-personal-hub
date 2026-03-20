# My Personal Hub

A full-stack personal productivity platform that consolidates task management, job hunting, calendar, notes, Telegram monitoring, and health tracking into a single dashboard.

**[Live Demo](https://hub.dmitrii-vasichev.com)**

<!-- TODO: Add screenshots -->
<!-- ![Dashboard](docs/screenshots/dashboard.png) -->

## Features

- **Task Manager** — Kanban board with drag-and-drop, priorities, reminders, analytics, and backlog
- **Job Hunt Tracker** — Table & Kanban views, AI-powered job matching, cover letter generation, resume management
- **Calendar** — Google Calendar integration, event-task-note linking
- **Notes** — Google Drive sync, Markdown rendering, cross-entity linking (tasks, jobs, events)
- **Telegram Pulse** — Monitor Telegram channels, AI-generated digests, learning inbox with structured items
- **Vitals** — Garmin health metrics sync, AI daily briefings, trend charts
- **Dashboard** — Centralized overview with widgets for all modules
- **Tags** — Cross-entity tagging system with multi-tag filtering
- **Demo Mode** — Built-in demo role with seed data for showcasing
- **User Management** — Role-based access control, visibility settings

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, SQLAlchemy, Alembic |
| Database | PostgreSQL (async via asyncpg) |
| AI | OpenAI, Anthropic, Google Gemini |
| Integrations | Google Calendar, Google Drive, Telegram (MTProto + Bot API), Garmin Connect |
| Testing | Pytest (backend), Vitest + React Testing Library (frontend) |
| Deploy | Vercel (frontend), Railway (backend + PostgreSQL) |

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│         Next.js · React · Tailwind · shadcn/ui   │
│                  (Vercel)                        │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│                   Backend                        │
│       FastAPI · SQLAlchemy · Alembic · AI        │
│                  (Railway)                       │
├──────────────┬───────────┬──────────────────────┤
│  PostgreSQL  │  External │  AI Providers         │
│  (asyncpg)   │  APIs     │  OpenAI / Anthropic / │
│              │  Google   │  Gemini               │
│              │  Telegram │                       │
│              │  Garmin   │                       │
└──────────────┴───────────┴──────────────────────┘
```

## Local Development

### Prerequisites

- Node.js 20+, Python 3.12+, PostgreSQL

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # edit DATABASE_URL and secrets
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Docker

```bash
docker compose up
```

### Running Tests

```bash
# Backend
cd backend && pytest

# Frontend
cd frontend && npm test
```

## Deployment

### Backend → Railway

1. Create a Railway project with a PostgreSQL service.
2. Connect the repo (root directory: `backend/`).
3. Set environment variables (see `.env.example`):
   - `DATABASE_URL` — provided by Railway PostgreSQL plugin
   - `JWT_SECRET_KEY` — generate a strong random secret
   - `CORS_ORIGINS` — your Vercel frontend URL
   - `APP_ENV=production`
4. Railway uses `railway.toml` for build/start commands automatically.

Health check: `GET /api/health`

### Frontend → Vercel

1. Import the repo (root directory: `frontend/`).
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL.
3. API rewrites are configured in `next.config.ts`.

### Environment Variables

See [`.env.example`](.env.example) for all required variables and descriptions.

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   └── core/         # Config, security, middleware
│   ├── alembic/          # Database migrations
│   └── tests/            # Pytest test suite
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js pages & layouts
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # API client, utilities
│   │   └── types/        # TypeScript type definitions
│   └── __tests__/        # Vitest test suite
└── docs/                 # PRDs and implementation plans
```

## License

[MIT](LICENSE)
