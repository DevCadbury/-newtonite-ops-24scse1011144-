# Research Notes

## Why PostgreSQL for This Challenge

The PDF brief explicitly lists PostgreSQL's capabilities as the reason for the recommendation:
- **Row-level locking**: `SELECT FOR UPDATE SKIP LOCKED` (used in outbox worker)
- **Conditional UPDATE**: `UPDATE WHERE assignee_id IS NULL` (atomic claiming)
- **ACID transactions**: `BEGIN`/`COMMIT` across multiple table writes
- **Full-text search**: `ILIKE` with GIN indexes (not implemented here, but available)
- **Constraints**: `@@unique([key, userId])` for idempotency keys

MongoDB can approximate some of these (findOneAndUpdate with `$set` and `$inc`), but the UPDATE semantics for optimistic locking with arbitrary field changes are cleaner in SQL.

---

## Optimistic Locking Pattern

**Reference:** [Martin Fowler's "Optimistic Offline Lock"](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html)

The version field approach is the canonical implementation:
```sql
UPDATE work_items
SET title = $newTitle, version = version + 1
WHERE id = $id AND version = $expectedVersion
```
If 0 rows are affected, the version was stale — return 409 to the client.

**Alternative considered:** Timestamps (`updated_at`). Rejected because millisecond collisions are possible on fast machines; an integer version is unambiguous.

---

## Transactional Outbox Pattern

**Reference:** Microservices Patterns (Richardson, 2018), Chapter 3

The pattern: write the domain event and the outbox job record in the **same database transaction** as the business mutation. A separate worker processes the outbox asynchronously.

```
Application DB transaction:
  UPDATE work_items SET status='RESOLVED' WHERE id=$id AND version=$v
  INSERT INTO activity_events ...
  INSERT INTO outbox_jobs (type='ITEM_STATUS_CHANGED', payload={...})
COMMIT

Worker (separate process):
  SELECT ... FROM outbox_jobs WHERE status='PENDING' FOR UPDATE SKIP LOCKED
  → process job (send notification, webhook, etc.)
  UPDATE outbox_jobs SET status='DONE'
```

**Why not Redis/BullMQ:** No additional infrastructure required. The pattern achieves the same "at-least-once delivery with idempotent handler" guarantee using only PostgreSQL.

---

## Cursor-Based Pagination

**Reference:** [Slack Engineering: Evolving API Pagination at Slack](https://slack.engineering/evolving-api-pagination-at-slack/)

Offset pagination (`OFFSET 20 LIMIT 20`) is unstable: if a new item is inserted before the current page boundary, items shift and the next page duplicates or skips rows. Cursor pagination uses a stable position in the data:

```sql
WHERE (created_at < $cursorDate)
   OR (created_at = $cursorDate AND id < $cursorId)
ORDER BY created_at DESC, id DESC
LIMIT 21
```

If 21 rows are returned, there is a next page (pop the 21st, encode it as the cursor).

---

## Idempotency Key Design

**Reference:** [Stripe API Idempotency Keys](https://docs.stripe.com/api/idempotency)

The client generates a UUID for each **new logical operation** and reuses it on retries. The server stores `(key, userId, requestHash)`. On replay:
1. Same hash → return stored response
2. Different hash → 422 (client bug: reusing a key for a different operation)

The `userId` scope ensures two users can independently use the same key value without collision (`@@unique([key, userId])`).

---

## Next.js 16 + Prisma 7 Compatibility

Key findings from research during implementation:

1. **Prisma 7 requires `type: module`** in some contexts, but Next.js 16 handles ESM internally — no `"type": "module"` in `package.json` needed.

2. **`generated/prisma/enums.ts` is client-safe** — it exports plain `as const` objects with no Node.js imports. Client components should import from `@/generated/prisma/enums`, not `@/generated/prisma/client`.

3. **Turbopack (default in Next.js 16)** has a known WasmHash error with Node.js 24 on webpack; building with Turbopack (default) works correctly.

4. **Prisma 7 config** is in `prisma7.config.ts` (not `prisma.config.ts`), uses `defineConfig` from `prisma/config`, and the datasource URL is configured there rather than in `schema.prisma`.

5. **`proxy.ts`** replaces `middleware.ts` in Next.js 16 — the exported function must be named `proxy` (not `middleware`).
