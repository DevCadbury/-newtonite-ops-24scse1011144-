# Non-Functional Requirements

## Security

| ID | Requirement | Implementation |
|---|---|---|
| NFR-SEC-001 | Passwords stored as bcrypt hash (min cost factor 10) | `bcrypt.hash(password, 10)` in auth.service |
| NFR-SEC-002 | JWT secret minimum 32 characters, stored in env | Validated at runtime in `lib/auth.ts` |
| NFR-SEC-003 | Session cookie: httpOnly, Secure (prod), SameSite=Lax | `sessionCookieOptions()` in lib/auth.ts |
| NFR-SEC-004 | No secrets committed to repository | `.env` in `.gitignore`; `.env.example` has placeholders |
| NFR-SEC-005 | Authorization enforced server-side, not client-side | Every Route Handler re-checks role; UI shows/hides for UX only |
| NFR-SEC-006 | Cross-team reads return 404, not 403 | Prevents enumeration of team/item IDs |
| NFR-SEC-007 | All API inputs validated with Zod before processing | Missing/invalid fields return 400 before DB access |

## Correctness (Concurrency)

| ID | Requirement | Implementation |
|---|---|---|
| NFR-CORR-001 | Two concurrent claims produce exactly one success | `UPDATE WHERE assignee_id IS NULL`; tested in `concurrent-claim.test.ts` |
| NFR-CORR-002 | Stale writes rejected without corrupting data | `UPDATE WHERE version = $expected`; tested in `optimistic-lock.test.ts` |
| NFR-CORR-003 | Retried requests with same idempotency key are safe | `idempotency_keys` table with unique constraint |
| NFR-CORR-004 | Item mutation and history commit atomically | `prisma.$transaction()` for all mutations |

## Performance

| ID | Requirement | Notes |
|---|---|---|
| NFR-PERF-001 | Item list pagination with cursor (stable under writes) | Tested with 500+ items |
| NFR-PERF-002 | DB indexes on common query patterns | Status+team, assigneeId, (createdAt, id) |
| NFR-PERF-003 | API responses < 500ms under normal load | Target — not load tested in this submission |

## Scalability

| ID | Requirement | Notes |
|---|---|---|
| NFR-SCALE-001 | Cursor pagination correct at any scale | No offset pagination (avoids skip/duplicate issues) |
| NFR-SCALE-002 | Activity events indexed by (workItemId, createdAt) | Efficient timeline fetch even at millions of events |
| NFR-SCALE-003 | Outbox worker uses `FOR UPDATE SKIP LOCKED` | Multiple workers can run without processing the same job |

## Reliability

| ID | Requirement | Implementation |
|---|---|---|
| NFR-REL-001 | Outbox jobs are retried up to 5 times with exponential backoff | `max_attempts=5`; `processAfter = now + min(2^attempts * 1000, 60000)ms` |
| NFR-REL-002 | Jobs stuck in PROCESSING > 5min are recovered | Worker polls for stuck jobs and resets them to PENDING |
| NFR-REL-003 | Seed script is idempotent | `if (await prisma.user.count() > 0) return` guard |

## Maintainability

| ID | Requirement | Implementation |
|---|---|---|
| NFR-MAINT-001 | Business logic in service layer, not route handlers | `services/items.service.ts` |
| NFR-MAINT-002 | All critical behaviors have automated tests | 31 tests in 7 files |
| NFR-MAINT-003 | TypeScript strict mode with zero errors | `npx tsc --noEmit` clean |
| NFR-MAINT-004 | No secrets in source code | All credentials via environment variables |

## Reproducibility

| ID | Requirement | Implementation |
|---|---|---|
| NFR-REPRO-001 | One-command local setup with Docker Compose | `docker compose up db -d && npm install && npx prisma migrate deploy && npm run db:seed && npm run dev` |
| NFR-REPRO-002 | All dependencies pinned in package.json | Exact versions installed |
| NFR-REPRO-003 | Database migrations are versioned | `prisma/migrations/` directory with timestamped SQL files |
