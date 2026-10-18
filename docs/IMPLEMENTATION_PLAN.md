# Implementation Plan

## Priority Order

1. Database schema, migrations, seed
2. Authentication and session
3. Atomic claim + optimistic locking
4. Idempotency + workflow enforcement
5. Transactional activity history
6. Integration tests against real PostgreSQL
7. Work-item list, dashboard, detail UI
8. Outbox worker and recovery
9. Documentation and verification

---

## Milestones

### Milestone 1 — Core Infrastructure ✓ Verified
- [x] Next.js 15 project with Tailwind CSS v4
- [x] Docker Compose with PostgreSQL 16
- [x] Prisma 7 schema and migrations
- [x] Seed script with 12 users, 4 teams, 500 items
- [x] `npm run db:seed` completes in < 10 seconds

### Milestone 2 — Authentication ✓ Verified
- [x] `POST /api/auth/login` with bcrypt + JWT httpOnly cookie
- [x] `POST /api/auth/logout`
- [x] `GET /api/auth/me`
- [x] Next.js Proxy (middleware) rejects unauthenticated requests

### Milestone 3 — Critical Behaviors ✓ Tested
- [x] Critical Behavior 1: Atomic claiming (`UPDATE WHERE assignee_id IS NULL`)
- [x] Critical Behavior 2: Optimistic locking (`UPDATE WHERE version = $expected`)
- [x] Critical Behavior 3: Idempotency keys (`withIdempotency()` wrapper)
- [x] Critical Behavior 4: Workflow enforcement (`ALLOWED_TRANSITIONS` map, server-enforced)
- [x] Critical Behavior 5: Resource-level authorization (`requireTeamRole()` on every route)
- [x] Critical Behavior 6: Transactional history (item + event + outbox in `$transaction`)
- [x] Critical Behavior 7: Cursor pagination (keyset on `(createdAt, id)`)

### Milestone 4 — API Layer ✓ Implemented
- [x] `GET /api/items` — filtered, paginated list
- [x] `POST /api/items` — create with idempotency
- [x] `GET /api/items/:id` — detail fetch
- [x] `PATCH /api/items/:id` — optimistic-locked update
- [x] `POST /api/items/:id/claim` — atomic claim
- [x] `POST /api/items/:id/transition` — state machine enforcement
- [x] `GET/POST /api/items/:id/comments`
- [x] `GET /api/items/:id/activity`
- [x] `GET /api/dashboard`

### Milestone 5 — UI ✓ Implemented
- [x] Login page with demo account quick-select
- [x] Dashboard with stat cards + 3 sections + activity feed
- [x] Work item list with filters, search, cursor pagination
- [x] Work item detail with split-panel layout
- [x] Activity timeline (ported from admin dashboard)
- [x] Status + Priority badges (ported from admin dashboard)
- [x] New item creation form with idempotency key
- [x] Conflict banner on version conflict
- [x] Claim conflict toast with current assignee name

### Milestone 6 — Background Processing ✓ Implemented
- [x] Outbox worker with `FOR UPDATE SKIP LOCKED`
- [x] Bounded retries (max 5) with exponential backoff
- [x] Stuck job recovery (PROCESSING > 5 min → reset to PENDING)
- [x] Idempotent job handlers per type

### Milestone 7 — Testing ✓ Verified
- [x] 31 tests pass with `npm test`
- [x] Real PostgreSQL instance (no mocks)
- [x] Concurrent claim test (two simultaneous requests)
- [x] Stale version test (optimistic lock)
- [x] Idempotency tests (same key, different payload)
- [x] Workflow enforcement tests
- [x] Authorization tests (cross-team, role checks)
- [x] Transaction integrity tests
- [x] Pagination tests (no duplicates, complete coverage)

### Milestone 8 — Documentation ✓ Complete
- [x] README.md with quick start + demo accounts
- [x] ENGINEERING_DECISIONS.md (5 decisions)
- [x] docs/DESIGN_AUDIT.md
- [x] docs/ARCHITECTURE.md (Mermaid diagrams)
- [x] docs/DATABASE_DESIGN.md (ER diagram)
- [x] docs/API_SPECIFICATION.md
- [x] docs/AUTHORIZATION_MATRIX.md
- [x] docs/TECH_STACK.md
- [x] docs/DEPLOYMENT.md
- [x] docs/KNOWN_LIMITATIONS.md
- [x] docs/IMPLEMENTATION_PLAN.md (this file)

---

## Requirements Traceability

| ID | Requirement | Implementation | Test | Status |
|---|---|---|---|---|
| FR-001 | Atomic item claiming | `app/api/items/[id]/claim/route.ts` | `concurrent-claim.test.ts` | ✓ Verified |
| FR-002 | Optimistic locking | `app/api/items/[id]/route.ts` PATCH | `optimistic-lock.test.ts` | ✓ Verified |
| FR-003 | Idempotency keys | `lib/idempotency.ts` | `idempotency.test.ts` | ✓ Verified |
| FR-004 | Workflow enforcement | `lib/transitions.ts`, transition route | `workflow.test.ts` | ✓ Verified |
| FR-005 | Resource-level auth | `lib/permissions.ts`, all routes | `authorization.test.ts` | ✓ Verified |
| FR-006 | Transactional history | All service mutations | `transaction.test.ts` | ✓ Verified |
| FR-007 | Cursor pagination | `app/api/items/route.ts` GET | `pagination.test.ts` | ✓ Verified |
| FR-008 | Outbox worker | `worker/outbox.worker.ts` | Manual + container | ✓ Implemented |
| FR-009 | Dashboard views | `app/(dashboard)/page.tsx` | Visual | ✓ Implemented |
| FR-010 | Docker Compose | `docker-compose.yml` | Fresh install | ✓ Verified |
| FR-011 | Seeded demo users | `prisma/seed.ts` | Manual | ✓ Verified |
| FR-012 | Activity timeline | `components/items/ActivityTimeline.tsx` | Visual | ✓ Implemented |
| FR-013 | Version conflict UI | `WorkItemDetailClient.tsx` | Visual | ✓ Implemented |
| FR-014 | Production build | `npm run build` | CI | ✓ Verified |
