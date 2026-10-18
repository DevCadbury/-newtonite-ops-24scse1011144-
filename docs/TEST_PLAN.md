# Test Plan

## Test Framework

- **Runner:** Vitest 2.x with `globalSetup` for one-time fixture creation
- **Database:** Real PostgreSQL 16 (Docker) — no mocking for concurrency/transaction tests
- **Run command:** `npm test`
- **Setup:** `tests/globalSetup.ts` creates test fixtures before all files run; `teardown()` cleans up after

---

## Test Files and Coverage

### `tests/concurrent-claim.test.ts` — Critical Behavior 1

| Test | What It Verifies |
|---|---|
| Two simultaneous claims → exactly one success | `UPDATE WHERE assignee_id IS NULL` prevents double-claim |
| Cannot claim an already-assigned item | 0 rows updated → `null` returned |

**Why real PostgreSQL is required:** Simulated concurrency via `Promise.all()` exercises real row-level atomicity. A mock cannot verify this.

---

### `tests/optimistic-lock.test.ts` — Critical Behavior 2

| Test | What It Verifies |
|---|---|
| Stale version rejected; DB state preserved | `UPDATE WHERE version = $expected` returns 0 rows |
| No spurious activity event on rejected update | Transaction rolled back — event not committed |
| Concurrent updates to different items both succeed | No false positives from the version check |

---

### `tests/idempotency.test.ts` — Critical Behavior 3

| Test | What It Verifies |
|---|---|
| Same key+payload → one handler call, same response | Stored response returned on second call |
| Same key+different payload → 422 | `requestHash` mismatch detected |
| Different users can use the same key independently | `@@unique([key, userId])` — user-scoped |

---

### `tests/workflow.test.ts` — Critical Behavior 4

| Test | What It Verifies |
|---|---|
| OPEN→CLOSED is forbidden | `isTransitionAllowed()` returns false |
| OPEN→RESOLVED is forbidden | Direct jump blocked |
| OPEN→IN_PROGRESS is allowed | Standard path |
| AWAITING_APPROVAL→RESOLVED requires Lead | `transitionRequiresLead()` returns true |
| MEMBER cannot approve (role hierarchy) | `ROLE_HIERARCHY["MEMBER"] < ROLE_HIERARCHY["LEAD"]` |
| LEAD can approve | `ROLE_HIERARCHY["LEAD"] >= ROLE_HIERARCHY["LEAD"]` |
| ADMIN can approve (Admin ≥ Lead) | `ROLE_HIERARCHY["ADMIN"] >= ROLE_HIERARCHY["LEAD"]` |
| Full workflow lifecycle in DB | OPEN→IN_PROGRESS→AWAITING_APPROVAL→RESOLVED |

---

### `tests/authorization.test.ts` — Critical Behavior 5

| Test | What It Verifies |
|---|---|
| Null role for user not in team | Cross-team membership query returns null |
| Correct MEMBER role returned | Membership lookup works |
| Correct LEAD role returned | Role hierarchy preserved |
| Insufficient role throws | `requireTeamRole()` throws with code INSUFFICIENT_ROLE |
| Sufficient role passes | LEAD satisfies MEMBER+ requirement |
| `getUserTeamIds` scoped correctly | Only returns user's teams |
| Cross-team item not visible | `WHERE teamId IN (userTeamIds)` filters correctly |
| VIEWER cannot claim (role check) | `ROLE_HIERARCHY["VIEWER"] < ROLE_HIERARCHY["MEMBER"]` |

---

### `tests/transaction.test.ts` — Critical Behavior 6

| Test | What It Verifies |
|---|---|
| Create item writes exactly one CREATED event | Item + event committed together |
| Transaction rollback leaves no partial state | Intentional throw → both item and event rolled back |
| Status change + event commit atomically | Raw SQL update + event in same `$transaction` |

---

### `tests/pagination.test.ts` — Critical Behavior 7

| Test | What It Verifies |
|---|---|
| First page returns PAGE_SIZE items with cursor | Keyset pagination works |
| Pages have no duplicates or gaps | Compound cursor `(createdAt, id)` is stable |
| Last page has `hasMore=false` | Termination condition correct |

---

## Manual Verification Checklist

Run these manually against the running dev server after `npm run dev`:

- [ ] Login with each of the 12 demo accounts → correct team/role shown in sidebar
- [ ] Create a work item → appears in list with correct status
- [ ] Claim an item → assignee updates, status transitions to IN_PROGRESS
- [ ] Try to claim an already-assigned item → 409 toast appears
- [ ] Transition to AWAITING_APPROVAL → status badge updates
- [ ] Log in as MEMBER → try to approve → 403 toast appears
- [ ] Log in as LEAD → approve → status becomes RESOLVED
- [ ] Edit item from two browser tabs → second save shows conflict banner
- [ ] Navigate to /teams → correct role per team displayed
- [ ] Navigate to /activity → chronological event log
- [ ] Dark mode toggle works without hydration flash
- [ ] Pagination: "Load more" loads next page without duplicates

---

## Actual Test Results (as of Oct 18, 2026)

```
Test Files  7 passed (7)
Tests       31 passed (31)
Duration    ~1.4s
```

All 31 automated tests pass against real PostgreSQL.
