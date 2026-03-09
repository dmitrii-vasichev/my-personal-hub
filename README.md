# my-personal-hub

Personal productivity hub — task manager, job hunt tracker, calendar, and dashboard.

## Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI (Python), PostgreSQL, SQLAlchemy, Alembic
- **Deploy**: Vercel (frontend) + Railway (backend)

## Local Development

### Prerequisites

- Node.js 18+, Python 3.10+, PostgreSQL

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

## Deployment

### Backend → Railway

1. Create a new Railway project and add a PostgreSQL service.
2. Connect the `backend/` directory (or the whole repo with root set to `backend/`).
3. Railway uses `railway.toml` for build and start commands automatically.
4. Set environment variables in Railway dashboard (see `.env.example`):
   - `DATABASE_URL` — provided by Railway PostgreSQL plugin
   - `JWT_SECRET_KEY` — generate a strong random secret
   - `CORS_ORIGINS` — your Vercel frontend URL (e.g. `https://my-hub.vercel.app`)
   - `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (if using Google Calendar)
   - `APP_ENV=production`

Health check: `GET /api/health` — returns `{"status": "ok"}`.

### Frontend → Vercel

1. Import the repo in Vercel and set the root directory to `frontend/`.
2. Set environment variables:
   - `NEXT_PUBLIC_API_URL` — your Railway backend URL (e.g. `https://my-hub.railway.app`)
3. `vercel.json` configures API rewrites automatically.

### Environment Variables Reference

See `.env.example` for all required variables and descriptions.
