# Functional Requirements

## Authentication

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-AUTH-001 | User can log in with email and password | Returns JWT cookie on valid credentials; 401 on invalid |
| FR-AUTH-002 | Session cookie is httpOnly and Secure in production | Cookie inaccessible to JavaScript; HTTPS-only in prod |
| FR-AUTH-003 | Protected routes redirect to /login when unauthenticated | Proxy intercepts requests; returns 401 for API routes |
| FR-AUTH-004 | User can log out | Cookie cleared; subsequent requests return 401 |

## Teams and Roles

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TEAM-001 | Users belong to teams with a role per team | Memberships table stores (userId, teamId, role) |
| FR-TEAM-002 | Roles are: VIEWER, MEMBER, LEAD, ADMIN | Higher roles include all lower-role permissions |
| FR-TEAM-003 | Users can belong to multiple teams | Each team membership is independent |
| FR-TEAM-004 | Admin has all Lead capabilities | `ROLE_HIERARCHY["ADMIN"] >= ROLE_HIERARCHY["LEAD"]` |

## Work Items

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-ITEM-001 | MEMBER+ can create work items in their team | POST /api/items; VIEWER gets 403 |
| FR-ITEM-002 | Work items have: title, description, type, priority, status, assignee, due_date, version | All fields stored; version starts at 1 |
| FR-ITEM-003 | Items are scoped to a single team | teamId required; user must be a member |
| FR-ITEM-004 | Items list is server-paginated with cursor | GET /api/items returns `{items, nextCursor, hasMore}` |
| FR-ITEM-005 | Items can be filtered by status, priority, type, team, assignee | All filters applied server-side with indexes |
| FR-ITEM-006 | Full-text search on title and description | ILIKE query on both fields |

## Critical Behavior: Atomic Claiming (CB-1)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-CLAIM-001 | MEMBER+ can claim an unassigned item | POST /api/items/:id/claim; sets assignee, transitions to IN_PROGRESS |
| FR-CLAIM-002 | Two users cannot both claim the same item | `UPDATE WHERE assignee_id IS NULL`; second returns 409 |
| FR-CLAIM-003 | 409 response includes current assignee | `{error: "ALREADY_CLAIMED", currentItem: {...}}` |
| FR-CLAIM-004 | Activity event written in same transaction | ASSIGNED event visible immediately after claim |

## Critical Behavior: Optimistic Locking (CB-2)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-LOCK-001 | All PATCH requests must include current version | Missing version → 400 |
| FR-LOCK-002 | Stale version is rejected atomically | `UPDATE WHERE version=$expected`; 0 rows → 409 |
| FR-LOCK-003 | 409 includes current item state | `{error: "VERSION_CONFLICT", currentItem: {...}}` |
| FR-LOCK-004 | No activity event created on failed update | Transaction rolled back; no false history |

## Critical Behavior: Idempotency (CB-3)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-IDEM-001 | Same key+payload returns stored response | Handler called once; second call returns stored result |
| FR-IDEM-002 | Same key+different payload returns 422 | `{error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"}` |
| FR-IDEM-003 | Keys expire after 24 hours | After expiry, same key is treated as a new operation |

## Critical Behavior: Workflow Enforcement (CB-4)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-WF-001 | Workflow: OPEN → IN_PROGRESS → AWAITING_APPROVAL → RESOLVED → CLOSED | Direct jumps rejected with 422 |
| FR-WF-002 | AWAITING_APPROVAL → RESOLVED requires LEAD+ | MEMBER gets 403; LEAD gets 200 |
| FR-WF-003 | AWAITING_APPROVAL → IN_PROGRESS (reject) requires LEAD+ | Same role check as approval |
| FR-WF-004 | Invalid transitions return 422 with allowed list | `{error: "INVALID_TRANSITION", from, to}` |

## Critical Behavior: Authorization (CB-5)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-AUTHZ-001 | Every API route verifies session | No route reachable without valid JWT cookie |
| FR-AUTHZ-002 | All queries scoped to user's team memberships | `WHERE teamId IN (userTeamIds)` on all item queries |
| FR-AUTHZ-003 | Cross-team item reads return 404 | Prevents team/item enumeration |
| FR-AUTHZ-004 | Role checks happen after resource resolution | Team is determined from DB, not client input |

## Activity History (CB-6)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-ACT-001 | Every mutation writes an ActivityEvent in the same transaction | Item change + event commit or both roll back |
| FR-ACT-002 | Activity is append-only | No UPDATE/DELETE on activity_events table |
| FR-ACT-003 | Events include: type, actor, description, metadata, timestamp | All fields stored for each event type |
| FR-ACT-004 | GET /api/items/:id/activity returns events ordered newest-first | Paginated, latest 50 by default |

## Dashboard

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-DASH-001 | "Assigned to Me" shows items assigned to current user | Filtered by assigneeId = currentUserId, non-terminal status |
| FR-DASH-002 | "Unassigned & Urgent" shows HIGH/CRITICAL OPEN items with no assignee | Scoped to user's teams |
| FR-DASH-003 | "Awaiting My Approval" shows AWAITING_APPROVAL items in teams where user is LEAD+ | Scoped by role |
| FR-DASH-004 | Stat cards: open count, assigned to me, awaiting approval, overdue | All counts are real-time DB queries |
