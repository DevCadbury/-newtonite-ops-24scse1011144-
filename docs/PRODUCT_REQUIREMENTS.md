# Product Requirements Document (PRD)

## Problem Statement

Newtonite operations teams manage incidents, customer issues, payments, compliance tasks, and engineering work across multiple teams simultaneously. Without a dedicated tracker, work items are tracked in spreadsheets or chat, making it impossible to enforce process (who can approve what), understand who owns what, or audit changes retrospectively.

## Target Users

| User | Role | Primary Need |
|---|---|---|
| Operations Manager | LEAD/ADMIN | Approve resolutions, monitor team workload, audit history |
| Operations Analyst | MEMBER | Create, claim, and progress work items |
| Compliance Officer | LEAD | Oversee compliance items, approve resolutions |
| Observer / Auditor | VIEWER | Read-only access to item history and current state |

## Goals

1. **Correctness:** Prevent duplicate work through atomic claiming; prevent stale overwrites through optimistic locking
2. **Accountability:** Every state change, assignment, and comment is permanently recorded
3. **Authorization:** Role-based access enforced on the server — Viewers cannot mutate; Leads control approvals
4. **Scalability:** Server-side pagination and filtering for tens of thousands of items
5. **Reliability:** Network retries (idempotency keys) produce consistent results

## Scope

### In Scope
- Work item lifecycle: create → claim → progress → approve → resolve → close
- Team-scoped access control (4 roles: Viewer, Member, Lead, Admin)
- Append-only activity log with actor, timestamp, and field-level change detail
- Server-side search, filtering, and cursor-based pagination
- Concurrent claim protection and optimistic locking
- Idempotency keys for safe retries
- Transactional outbox for reliable async processing

### Out of Scope (explicitly excluded per PDF brief)
- Email delivery or push notifications
- File attachments
- SSO / OAuth (seeded demo users only)
- Real-time WebSocket updates (15s polling is sufficient)
- Mobile app

## User Journeys

### Journey 1: Incident Response
1. Analyst logs in, sees "Unassigned & Urgent" dashboard panel
2. Claims the incident (atomic — cannot double-claim)
3. Investigates, adds comments, transitions to "Awaiting Approval"
4. Team Lead approves — item is Resolved and logged

### Journey 2: Compliance Audit
1. Compliance Lead views all OPEN items filtered to Compliance team
2. Assigns items to Members for remediation
3. Reviews activity timeline to confirm all steps were taken
4. Approves resolution — item is Closed

### Journey 3: Conflict Detection
1. Two analysts attempt to claim the same urgent item simultaneously
2. First claim succeeds (atomic update); second receives 409 with the current assignee name
3. Both analysts see the correct state immediately without a page refresh

## Success Criteria

- All 5 critical behaviors pass automated tests against real PostgreSQL
- Production build compiles with zero TypeScript errors
- `docker compose up db -d && npm run db:seed && npm run dev` produces a working app
- A LEAD can approve an item that a MEMBER cannot
- Cross-team item access returns 404 (not leaked data)
