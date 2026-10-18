# Authorization Matrix

## Role Definitions

Roles are per-team (a user can be LEAD in Team A and VIEWER in Team B). Roles are additive — higher roles include all permissions of lower roles.

| Role | Level | Description |
|---|---|---|
| VIEWER | 0 | Read-only access to team items and activity |
| MEMBER | 1 | Can create, claim, edit, comment, and transition items (except approval) |
| LEAD | 2 | All MEMBER permissions + approve/reject, reassign, close resolved items |
| ADMIN | 3 | All LEAD permissions (Admin ≥ Lead) + team management |

> **Note on ADMIN and approval:** The PDF specifies "Lead-only" approval. ADMIN is documented as subsuming LEAD within a team. An ADMIN can approve because `ROLE_HIERARCHY["ADMIN"] >= ROLE_HIERARCHY["LEAD"]`. This is documented here and in ENGINEERING_DECISIONS.md (ED-004).

---

## Permission Table

| Action | VIEWER | MEMBER | LEAD | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Read items in own team | ✓ | ✓ | ✓ | ✓ |
| Read activity events | ✓ | ✓ | ✓ | ✓ |
| Read comments | ✓ | ✓ | ✓ | ✓ |
| Create work item | — | ✓ | ✓ | ✓ |
| Claim (assign to self) | — | ✓ | ✓ | ✓ |
| Edit item fields | — | ✓ | ✓ | ✓ |
| Add comment | — | ✓ | ✓ | ✓ |
| Transition: OPEN → IN_PROGRESS | — | ✓ | ✓ | ✓ |
| Transition: IN_PROGRESS → AWAITING_APPROVAL | — | ✓ | ✓ | ✓ |
| Transition: IN_PROGRESS → OPEN (unassign) | — | — | ✓ | ✓ |
| **Approve: AWAITING_APPROVAL → RESOLVED** | — | — | **✓** | **✓** |
| **Reject: AWAITING_APPROVAL → IN_PROGRESS** | — | — | **✓** | **✓** |
| Transition: RESOLVED → CLOSED | — | — | ✓ | ✓ |
| Reassign item | — | — | ✓ | ✓ |
| Access items from another team | ✗ | ✗ | ✗ | ✗ |

---

## Enforcement

### Where authorization is enforced

Authorization is **server-side only**. The UI shows/hides buttons as a UX convenience, but every API route re-checks permissions independently.

1. **Proxy (proxy.ts):** Verifies JWT cookie is present and valid. Rejects unauthenticated requests before they reach any route handler.

2. **Every Route Handler:** Calls `getSessionFromRequest(req)` → 401 if no session. Then resolves the resource and its `teamId`, calls `requireTeamRole(userId, teamId, minRole)` → 403 if insufficient.

3. **Query scoping:** All `findMany` queries for work items include `teamId: { in: userTeamIds }`. A user from Team A cannot read Team B's items even with a crafted request.

4. **404 for cross-team reads:** `GET /api/items/:id` returns 404 (not 403) when the item belongs to a team the user is not a member of. This prevents team/item enumeration.

### What is NOT trusted from the client

- `teamId` in request bodies — validated against user's actual memberships
- Role in JWT payload — role is always re-fetched from the `memberships` table
- `version` — used for optimistic locking, not authorization
- Any `userId` in request body — actor is always the authenticated session user
