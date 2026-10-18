# Deployment Guide

## Local Development (Docker Compose)

### Prerequisites
- Docker Desktop ≥ 24.x
- Node.js ≥ 20.19.0
- npm ≥ 9.x

### Steps

```bash
# 1. Clone
git clone https://github.com/<username>/newtonite-ops-<rollno>.git
cd newtonite-ops-<rollno>

# 2. Environment
cp .env.example .env
# Edit .env: set a strong JWT_SECRET (min 32 chars)

# 3. Start PostgreSQL
docker compose up db -d

# Wait for healthcheck to pass:
docker compose ps   # should show db as "healthy"

# 4. Install dependencies
npm install

# 5. Run migrations
npx prisma migrate deploy

# 6. Seed demo data
npm run db:seed

# 7. Start application
npm run dev    # http://localhost:3000

# 8. (Optional) Start outbox worker in a separate terminal
npm run worker
```

### Running tests

```bash
# PostgreSQL must be running
docker compose up db -d
npm test
```

---

## Production Deployment (Recommended)

### Option A: Vercel + Neon + Railway

**App:** Vercel (Next.js native)
**Database:** Neon.tech (serverless PostgreSQL, free tier)
**Worker:** Railway or Fly.io (persistent process)

#### Steps

1. **Create Neon database**
   - Go to https://neon.tech, create a project
   - Copy the `postgresql://...` connection string

2. **Deploy to Vercel**
   ```bash
   npm install -g vercel
   vercel --prod
   ```
   Set environment variables in Vercel dashboard:
   - `DATABASE_URL` — Neon connection string
   - `JWT_SECRET` — strong random string (≥32 chars)
   - `NODE_ENV=production`

3. **Run migrations on Neon**
   ```bash
   DATABASE_URL=<neon-url> npx prisma migrate deploy
   DATABASE_URL=<neon-url> npm run db:seed
   ```

4. **Deploy worker to Railway**
   - Create a Railway project, connect GitHub repo
   - Set `DATABASE_URL` env var
   - Set start command: `node -r dotenv/config worker/outbox.worker.js`
   - Deploy

#### Important: Worker on Vercel
Vercel serverless functions have a per-request lifecycle. The outbox worker (a persistent polling loop) **cannot run on Vercel**. It must be on Railway, Fly.io, a VPS, or a container host that supports long-running processes.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Min 32 chars; used to sign/verify session JWTs |
| `NODE_ENV` | No | `development` | Set to `production` in production |

---

## Health Checks

- **App:** `GET /` — returns 200 if Next.js is running
- **Database:** `pg_isready -U newtonite` (Docker Compose healthcheck)
- **Worker:** Logs `[worker] Outbox worker started` on startup; polls every 5 seconds

---

## Secrets and Security

- Never commit `.env` to Git (it's in `.gitignore`)
- Rotate `JWT_SECRET` invalidates all active sessions
- Database passwords should be strong and unique in production
- Use `NODE_ENV=production` to enable `Secure` flag on cookies (HTTPS-only)
