# Engineering Decisions

## ED-001: Full-Stack Next.js Over Separate Backend

**Context:** The challenge requires a functional web app with auth, APIs, and a database. A common split is a separate Express/FastAPI backend plus a React frontend.

**Options Considered:**
- A. Next.js App Router (full-stack monorepo)
- B. Express + React SPA (separate processes)
- C. NestJS + Next.js (separate)

**Choice:** Option A — Next.js App Router as the full-stack framework.

**Reasoning:** For a one-day challenge with 8–10 working hours, a monorepo eliminates the overhead of CORS configuration, two deployment targets, and two dev servers. Route Handlers in `/app/api/` provide the same capabilities as an Express server while sharing types with the frontend. The service layer (`services/`) keeps business logic separate and testable.

**Trade-offs:** Next.js Route Handlers are not as feature-rich as Express (no built-in request logging, middleware chaining). For a production system with a dedicated backend team, a separate service would be preferable.

**Consequences:** One `docker compose up db` command starts everything. One `vercel deploy` deploys the whole app. However, the outbox worker must be deployed to a separate worker-capable environment (not Vercel serverless), as documented in DEPLOYMENT.md.

---

## ED-002: Cursor-Based Pagination Over Offset

**Context:** The brief explicitly states "tens of thousands of items; pagination, indexes, and server-side filtering expected." The system needs stable, efficient listing.

**Options Considered:**
- A. Offset/limit (`OFFSET 20 LIMIT 20`)
- B. Keyset/cursor pagination using `(createdAt, id)`
- C. Relay-style cursor with opaque IDs

**Choice:** Option B — compound keyset cursor with base64-encoded `{createdAt, id}`.

**Reasoning:** Offset pagination skips or duplicates rows when items are inserted or deleted between page loads. With 500+ items and concurrent workers creating items, this is not hypothetical. The compound cursor `(createdAt, id)` is stable: `WHERE (created_at < $1 OR (created_at = $1 AND id < $2))` produces correct results even under concurrent writes. The base64 encoding keeps the cursor opaque to clients.

**Trade-offs:** Cursor pagination does not support jump-to-page-N. For an ops dashboard, "Load more" is appropriate. Keyset also requires the sort order to match the cursor columns.

**Consequences:** API always returns `{ items, nextCursor, hasMore }`. All filter combinations work correctly with cursor continuation. Tested in `tests/pagination.test.ts`.

---

## ED-003: Transactional Outbox Over Redis/BullMQ

**Context:** The brief asks for reliable async work: "Transactional outbox: job row written with the change; worker retries with backoff, caps attempts, idempotent handler."

**Options Considered:**
- A. Redis + BullMQ (external queue)
- B. PostgreSQL outbox table (same DB as application)
- C. Database triggers

**Choice:** Option B — PostgreSQL-backed transactional outbox.

**Reasoning:** Writing the OutboxJob in the same `prisma.$transaction` as the item mutation guarantees atomicity: if the transition commits, the job exists; if it rolls back, no job is orphaned. Redis introduces an additional infrastructure component with its own failure modes and deployment cost. For this challenge, a second process polling a table every 5 seconds is operationally simpler and equally correct. The `FOR UPDATE SKIP LOCKED` in the worker prevents dual processing under concurrent workers.

**Trade-offs:** Polling introduces up to 5-second latency. For real-time notifications, a proper queue would be preferable. The outbox table grows over time if jobs accumulate (add a cleanup cron in production).

**Consequences:** `docker-compose.yml` has a `worker` service. Zero extra infrastructure cost. Crash recovery is built in: jobs stuck in `PROCESSING` for more than 5 minutes are automatically recovered. Tested in Task 13 (manual verification via psql).

---

## ED-004: Optimistic Locking Over Pessimistic Row-Level Locks

**Context:** Multiple users may edit the same work item concurrently. The system must reject stale writes without data corruption.

**Options Considered:**
- A. Pessimistic locking (`SELECT FOR UPDATE`)
- B. Optimistic locking (version field, `UPDATE WHERE version = $expected`)
- C. Last-write-wins (no concurrency control)

**Choice:** Option B — optimistic locking with a `version Int` field.

**Reasoning:** For an ops tracker with low edit-collision probability, optimistic locking provides better throughput. Pessimistic locks hold the row locked for the full request duration and risk deadlocks when multiple rows are locked in different orders. The version check is a single atomic `UPDATE` statement: if it returns 0 rows updated, the client sent a stale version. The client receives a 409 with the current item state and can reapply changes if appropriate.

**Trade-offs:** In high-contention scenarios (many users editing the same item simultaneously), optimistic locking causes more retries than pessimistic. For this use case, that trade-off is acceptable.

**Consequences:** Every PATCH and transition must include the `version` field. Missing version → 400. Stale version → 409 with `currentItem` in the response body. Frontend shows a conflict banner and refreshes to the latest state. Tested in `tests/optimistic-lock.test.ts`.

---

## ED-005: httpOnly JWT Cookies Over Bearer Tokens

**Context:** The application needs a session mechanism for the seeded demo users.

**Options Considered:**
- A. Bearer token in `Authorization: Bearer <token>` header (client stores in localStorage or sessionStorage)
- B. JWT in httpOnly, Secure, SameSite=Lax cookie (server sets, browser sends automatically)
- C. Server-side sessions (database-backed, stateless JWT verification not needed)

**Choice:** Option B — JWT in httpOnly cookies via `jose`.

**Reasoning:** localStorage tokens are vulnerable to XSS — any injected script can read them. An httpOnly cookie cannot be read by JavaScript. `SameSite=Lax` prevents the cookie from being sent in cross-origin requests initiated by navigation to third-party sites, providing practical CSRF protection for this API. `Secure` is set to `true` in production to ensure HTTPS-only transmission. The JWT is stateless, which avoids database round-trips on every request (the middleware only needs to verify the signature).

**Trade-offs:** httpOnly cookies cannot be read by the JavaScript client, so the current user's identity must come from a server-side source (e.g., the `/api/auth/me` endpoint or the session passed as a prop from a Server Component). Logout requires a server round-trip to clear the cookie.

**Consequences:** Every API Route Handler calls `getSessionFromRequest(req)` first. Verified in `tests/authorization.test.ts`. `SameSite=Lax` means the cookie is sent on same-origin `fetch` calls (our use case) but not on cross-site POST forms (CSRF protection).
