# API Specification

## Authentication

All endpoints (except `POST /api/auth/login`) require an authenticated session cookie (`newtonite_session`).

Authentication failures return `401 Unauthorized`.
Authorization failures return `403 Forbidden` (or `404` for cross-team reads to prevent enumeration).

---

## Auth Endpoints

### `POST /api/auth/login`
**Auth:** None required

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Responses:**
- `200`: `{ user: { id, name, email } }` + sets httpOnly cookie
- `400`: Validation error
- `401`: Invalid credentials

---

### `POST /api/auth/logout`
**Auth:** Cookie (cleared on response)

**Responses:** `200`: `{ ok: true }`

---

### `GET /api/auth/me`
**Auth:** Cookie

**Responses:**
- `200`: `{ user: { id, name, email, memberships: [{ role, team: { id, name } }] } }`
- `401`: Not authenticated

---

## Work Items

### `GET /api/items`
**Auth:** Cookie
**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `status` | WorkItemStatus | Filter by status |
| `priority` | Priority | Filter by priority |
| `type` | WorkItemType | Filter by type |
| `teamId` | string | Scope to one team (must be user's team) |
| `assigneeId` | string | Filter by assignee |
| `me` | `"true"` | Return only items assigned to current user |
| `unassigned` | `"true"` | Return only unassigned items |
| `q` | string | Full-text search on title + description |
| `cursor` | string | Base64 pagination cursor from previous page |
| `limit` | number | Page size (max 50, default 20) |

**Response:**
```json
{
  "items": [WorkItem],
  "nextCursor": "string | null",
  "hasMore": boolean
}
```

**Cursor format:** Base64-encoded JSON `{ "createdAt": "ISO string", "id": "string" }`

---

### `POST /api/items`
**Auth:** Cookie, MEMBER+ in `teamId`
**Headers:** `Idempotency-Key: <uuid>` (optional but recommended)

**Body:**
```json
{
  "title": "string (required, max 255)",
  "description": "string (optional, max 5000)",
  "type": "INCIDENT | CUSTOMER_ISSUE | PAYMENT | COMPLIANCE | TASK",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "teamId": "cuid (required)",
  "assigneeId": "cuid (optional)",
  "dueDate": "ISO datetime (optional)"
}
```

**Responses:**
- `201`: Created work item
- `400`: Validation error
- `403`: Insufficient role in team

---

### `GET /api/items/:id`
**Auth:** Cookie, any membership in item's team

**Responses:**
- `200`: Work item with relations
- `401`: Not authenticated
- `404`: Not found or cross-team (prevents enumeration)

---

### `PATCH /api/items/:id`
**Auth:** Cookie, MEMBER+ in item's team
**Body:**
```json
{
  "version": "number (required — current version from GET)",
  "title": "string (optional)",
  "description": "string | null (optional)",
  "priority": "Priority (optional)",
  "assigneeId": "string | null (optional)",
  "dueDate": "ISO datetime | null (optional)"
}
```

**Responses:**
- `200`: Updated item
- `400`: Missing version or validation error
- `403`: Insufficient role
- `404`: Not found / cross-team
- `409 VERSION_CONFLICT`: `{ error: "VERSION_CONFLICT", currentItem: WorkItem }`

---

### `POST /api/items/:id/claim`
**Auth:** Cookie, MEMBER+ in item's team
**Headers:** `Idempotency-Key: <uuid>` (optional)

**Responses:**
- `200`: Claimed item (assignee set, status → IN_PROGRESS)
- `403`: Insufficient role
- `404`: Not found / cross-team
- `409 ALREADY_CLAIMED`: `{ error: "ALREADY_CLAIMED", currentItem: WorkItem }`
- `422`: Cannot claim in current status

**Implementation note:** Uses `UPDATE WHERE assignee_id IS NULL` — atomic, no read-then-write.

---

### `POST /api/items/:id/transition`
**Auth:** Cookie, role depends on transition (see AUTHORIZATION_MATRIX.md)
**Body:**
```json
{
  "toStatus": "WorkItemStatus",
  "version": "number (required)"
}
```

**Responses:**
- `200`: Transitioned item
- `403`: Insufficient role for this transition
- `404`: Not found / cross-team
- `409 VERSION_CONFLICT`: `{ error: "VERSION_CONFLICT", currentItem: WorkItem }`
- `422 INVALID_TRANSITION`: `{ error: "INVALID_TRANSITION", from, to, message }`

---

### `GET /api/items/:id/activity`
**Auth:** Cookie, any membership in item's team
**Query:** `limit` (max 100, default 50)

**Response:** `{ events: ActivityEvent[] }` ordered by `createdAt DESC`

---

### `GET /api/items/:id/comments`
**Auth:** Cookie, any membership in item's team

**Response:** `{ comments: Comment[] }` ordered by `createdAt ASC`

---

### `POST /api/items/:id/comments`
**Auth:** Cookie, MEMBER+ in item's team
**Headers:** `Idempotency-Key: <uuid>` (recommended)
**Body:** `{ "content": "string (1–10000 chars)" }`

**Responses:**
- `201`: Created comment
- `403`: Insufficient role
- `404`: Not found / cross-team

---

## Dashboard

### `GET /api/dashboard`
**Auth:** Cookie

**Response:**
```json
{
  "stats": { "openItems": 0, "assignedToMe": 0, "awaitingApproval": 0, "overdue": 0 },
  "assignedToMe": [WorkItem],
  "unassignedUrgent": [WorkItem],
  "awaitingApproval": [WorkItem],
  "recentActivity": [ActivityEvent]
}
```

All data is scoped to the authenticated user's teams.
