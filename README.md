# Newtonite Ops — Operations Tracker

**Newtonite Software Engineering Challenge: "Operations Under Pressure"**
**GU CCIO Advisory — Galgotias University**

An internal operational work-item tracker built to demonstrate engineering correctness under pressure:
atomic claiming, optimistic locking, idempotency, server-enforced workflow, resource-level
authorization, transactional data integrity, and cursor-based pagination.

---

## Screenshots

### Dashboard
The operations dashboard shows stat cards, assigned items, urgent unassigned items, and awaiting-approval panels — all scoped to the logged-in user's teams.

![Dashboard](screenshot/dashboard.png)

---

### Work Items List
Filterable, searchable, cursor-paginated table with status/priority badges, short alphanumeric IDs, and quick-filter tabs.

![Work Items](screenshot/items.png)

---

### Work Item Detail
Split-panel detail view with inline editing, colorful workflow step tracker, atomic claim button, and activity timeline.

![Work Item Detail](screenshot/ticket.png)

---

### Teams
Team membership cards showing all members, roles, and an expandable profile sheet.

![Teams](screenshot/teams.png)

---

### Team Member Profile
Slide-in profile sheet showing a member's active assigned items, stat summary, and recent activity.

![Team Member Profile](screenshot/team_profile.png)

---

### Activity Log
Chronological event log with semantic color-coded event-type chips, grouped by date.

![Activity Log](screenshot/activity.png)

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 20.19.0 |
| Docker | >= 24.x |
| Docker Compose | >= 2.x |
| npm | >= 9.x |

### 1. Clone and configure

```bash
git clone https://github.com/<your-username>/newtonite-ops-<rollno>.git
cd newtonite-ops-<rollno>
cp .env.example .env
# Edit .env: set a strong JWT_SECRET (min 32 chars)
```

### 2. Start PostgreSQL

```bash
docker compose up db -d
# Wait until: docker compose ps shows db as "healthy"
```

### 3. Install, migrate, seed

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

### 4. Start the application

```bash
npm run dev   # http://localhost:3000
```

### 5. (Optional) Start the outbox worker

```bash
# In a separate terminal
npm run worker
```

---

## Demo Accounts

All accounts use password: **`password123`**

| Email | Team | Role | Capabilities |
|-------|------|------|-------------|
| alice.ops@newtonite.dev | Ops | **Lead** | Approve, reassign, escalate |
| bob.ops@newtonite.dev | Ops | Member | Create, claim, transition |
| carol.ops@newtonite.dev | Ops | Viewer | Read-only |
| dan.pay@newtonite.dev | Payments | **Lead** | Approve, reassign, escalate |
| eve.pay@newtonite.dev | Payments | Member | Create, claim, transition |
| frank.pay@newtonite.dev | Payments | Viewer | Read-only |
| grace.comp@newtonite.dev | Compliance | **Admin** | All Lead permissions |
| henry.comp@newtonite.dev | Compliance | **Lead** | Approve, reassign, escalate |
| iris.comp@newtonite.dev | Compliance | Member | Create, claim, transition |
| jack.eng@newtonite.dev | Engineering | **Admin** | All Lead permissions |
| kate.eng@newtonite.dev | Engineering | **Lead** | Approve, reassign, escalate |
| leo.eng@newtonite.dev | Engineering | Member | Create, claim, transition |

---

## Commands Reference

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run db:generate  # Regenerate Prisma client
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed demo data (idempotent)
npm run worker       # Start outbox worker process
npm test             # Run all 31 automated tests
```

---

## Architecture

```
Browser
  |
  v
proxy.ts (Next.js Middleware)
  JWT cookie verification
  Redirect unauthenticated requests to /login
  |
  v
Next.js App Router
  Server Components  ---> PostgreSQL (via Prisma)
  Route Handlers     ---> Service layer --> $transaction
  |
  v
outbox_jobs table
  |
  v
worker/outbox.worker.ts (separate process)
  Poll FOR UPDATE SKIP LOCKED
  Bounded retries, exponential backoff
```

### Workflow State Machine

```
OPEN --> IN_PROGRESS --> AWAITING_APPROVAL --> RESOLVED --> CLOSED
  |                            ^                   |
  |                            |                   |
  +----------------------------+    (Lead only) ----+
       (reject returns to IN_PROGRESS)
```

**Role required per transition:**
- `OPEN -> IN_PROGRESS`: Member+
- `IN_PROGRESS -> AWAITING_APPROVAL`: Member+
- `AWAITING_APPROVAL -> RESOLVED` (approve): **Lead or Admin only**
- `AWAITING_APPROVAL -> IN_PROGRESS` (reject): **Lead or Admin only**
- `RESOLVED -> CLOSED`: Lead or Admin only

---

## Critical Behaviors Implemented

| # | Behavior | Implementation | Test |
|---|----------|---------------|------|
| 1 | **Atomic claiming** | `UPDATE WHERE assignee_id IS NULL` — zero read-then-write | `concurrent-claim.test.ts` |
| 2 | **Optimistic locking** | `UPDATE WHERE version = $expected` — increments atomically | `optimistic-lock.test.ts` |
| 3 | **Idempotency keys** | `idempotency_keys` table with `@@unique([key, userId])` | `idempotency.test.ts` |
| 4 | **Workflow enforcement** | `ALLOWED_TRANSITIONS` map enforced server-side | `workflow.test.ts` |
| 5 | **Resource-level auth** | Every query scoped to `teamId IN (user's teams)` | `authorization.test.ts` |
| 6 | **Transactional history** | Item + ActivityEvent + OutboxJob in one `$transaction` | `transaction.test.ts` |
| 7 | **Cursor pagination** | Keyset on `(createdAt, id)` — stable under concurrent writes | `pagination.test.ts` |

---

## Data Model

```
users            -- email, passwordHash
teams            -- name, description
memberships      -- userId, teamId, role (VIEWER/MEMBER/LEAD/ADMIN)
work_items       -- title, type, priority, status, version, teamId, assigneeId
activity_events  -- append-only, written in same $transaction as item mutation
comments         -- linked to work_items
idempotency_keys -- key + userId + requestHash + stored response
outbox_jobs      -- status (PENDING/PROCESSING/DONE/FAILED), attempts, processAfter
```

### Short Item IDs

Work items use a deterministic 5-character alphanumeric short ID (e.g. `T4K2R`) generated from
the internal CUID. The short ID is consistent — the same item always gets the same ID. Full
CUIDs are shown in tooltips.

---

## Technology Stack

| Technology | Role | Version |
|-----------|------|---------|
| Next.js | Full-stack framework (App Router) | 16.x |
| React | UI library | 19.x |
| TypeScript | Type safety | 5.x |
| Tailwind CSS | Styling | 4.x |
| Radix UI | Headless component primitives | latest |
| Prisma ORM 7 | Database client + migrations | 7.x |
| `@prisma/adapter-pg` | PostgreSQL driver adapter | 7.x |
| PostgreSQL | Database | 16.x |
| `jose` | JWT (httpOnly cookies) | 5.x |
| `bcryptjs` | Password hashing | 2.x |
| `zod` | Request validation | 3.x |
| `@hookform/resolvers` | Form validation | 5.x |
| `react-hook-form` | Form state management | 7.x |
| `date-fns` | Date formatting | latest |
| Vitest | Test runner | latest |
| Docker Compose | Local orchestration | — |

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Login, returns JWT cookie |
| POST | `/api/auth/logout` | Optional | Clears session cookie |
| GET | `/api/auth/me` | Required | Current user + memberships |
| GET | `/api/items` | Required | Paginated, filtered item list |
| POST | `/api/items` | Member+ | Create item (idempotency supported) |
| GET | `/api/items/:id` | Member | Item detail |
| PATCH | `/api/items/:id` | Member+ | Update with optimistic lock |
| POST | `/api/items/:id/claim` | Member+ | Atomic claim |
| POST | `/api/items/:id/transition` | Member+ / Lead | Workflow transition |
| GET | `/api/items/:id/activity` | Member | Activity timeline |
| GET | `/api/items/:id/comments` | Member | Comments list |
| POST | `/api/items/:id/comments` | Member+ | Add comment (idempotency supported) |
| GET | `/api/dashboard` | Required | Stats + dashboard sections |
| GET | `/api/teams/:id/members` | Member | Team member list |
| GET | `/api/users/:id/summary` | Member | User profile + assigned items |

### Pagination

All list endpoints return `{ items, nextCursor, hasMore }`.

Pass `?cursor=<value>` to fetch the next page. The cursor encodes `(createdAt, id)` as a
Base64 JSON string — it is stable under concurrent inserts and does not skip or duplicate rows.

### Idempotency

Send `Idempotency-Key: <uuid>` on POST requests. The server stores the response and replays it
on retry with the same key + payload. A different payload with the same key returns `422`.

---

## Authorization

All permissions are enforced **server-side**. The UI shows/hides controls as a UX convenience only.

| Action | VIEWER | MEMBER | LEAD | ADMIN |
|--------|:------:|:------:|:----:|:-----:|
| Read items | Y | Y | Y | Y |
| Create item | — | Y | Y | Y |
| Claim item | — | Y | Y | Y |
| Edit item | — | Y | Y | Y |
| Comment | — | Y | Y | Y |
| Approve / Reject | — | — | Y | Y |
| Reassign / Escalate | — | — | Y | Y |
| Close item | — | — | Y | Y |

Cross-team items return `404` (not `403`) to prevent team enumeration.

---

## Testing

```bash
# PostgreSQL must be running
docker compose up db -d
npm test
```

**Result:** 7 test files, 31 tests, all pass. Tests run against real PostgreSQL — no mocking
of the database layer for concurrency and transaction tests.

| Test File | What It Covers |
|-----------|---------------|
| `concurrent-claim.test.ts` | Two simultaneous claims -> exactly one succeeds |
| `optimistic-lock.test.ts` | Stale version rejected, no false activity event |
| `idempotency.test.ts` | Same key replays; different payload returns 422 |
| `workflow.test.ts` | Invalid transitions rejected; Lead-only approval enforced |
| `authorization.test.ts` | Cross-team 404; role checks; Viewer cannot claim |
| `transaction.test.ts` | Item + event commit atomically; rollback leaves no partial state |
| `pagination.test.ts` | Keyset cursor stable; no duplicates across pages |

---

## Environment Variables

```env
DATABASE_URL=postgresql://newtonite:newtonite_dev@localhost:5432/newtonite
JWT_SECRET=<min-32-char-random-string>
NODE_ENV=development
```

Never commit `.env`. Use `.env.example` as a template.

---

## Docker Compose

```bash
# Start everything (app + PostgreSQL + worker)
docker compose up

# Start only PostgreSQL for local development
docker compose up db -d

# Stop without destroying data
docker compose stop

# Destroy all containers AND the database volume (destructive!)
docker compose down -v
```

The PostgreSQL data lives in the named Docker volume `pgdata`. Stopping and restarting
containers without `-v` preserves all records.

---

## Repository Structure

```
app/                     Next.js App Router pages + API routes
  (auth)/login/          Login page
  (dashboard)/           Protected dashboard routes
    page.tsx             Operations dashboard
    items/               Work item list + detail + new item form
    teams/               Team membership view
    activity/            System activity log
  api/                   Route Handlers
    auth/                login, logout, me
    items/               CRUD + claim + transition + comments + activity
    teams/               Team member lookup
    users/               User profile summary
components/
  items/                 WorkItemListClient, WorkItemDetailClient, NewItemForm, badges
  layout/                AppSidebar, AppTopbar
  shared/                CommandPalette, Providers
  teams/                 TeamsList, MemberProfileSheet
lib/                     auth, prisma, permissions, transitions, idempotency, shortId
generated/prisma/        Prisma 7 generated client
prisma/
  schema.prisma          Full database schema
  migrations/            Versioned SQL migrations
  seed.ts                Demo data seeder
worker/
  outbox.worker.ts       Transactional outbox background processor
tests/                   Vitest test suite (7 files, 31 tests)
docs/                    Full documentation set (16 files)
```

---

## Submission Checklist

Before submitting, rename the directory:
```bash
# Replace 'student' with your actual roll number
mv newtonite-ops-student newtonite-ops-<rollno>
```

Required files present:
- [x] `README.md`
- [x] `ENGINEERING_DECISIONS.md` (5 decisions)
- [x] `docker-compose.yml`
- [x] `.env.example`
- [x] Public GitHub repo named `newtonite-ops-<rollno>`
- [x] All tests pass with `npm test`
- [x] Seed users and passwords documented above
- [x] `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, `docs/API_SPECIFICATION.md`, etc.

---


## License

Built for the Newtonite Software Engineering Challenge, Galgotias University, October 2026.
