# Known Limitations

## Verified Limitations (Genuine)

### No real-time updates
Activity and comments refresh every 15 seconds via polling in `WorkItemDetailClient.tsx`. WebSockets or Server-Sent Events were explicitly out of scope per the PDF brief ("polling/refetch is enough").

### Outbox worker not deployable on Vercel serverless
Vercel's serverless functions have a request-scoped lifecycle; a persistent polling loop cannot run there. To deploy the outbox worker, use a worker-capable host such as Railway, Fly.io, or a VPS. The `docker-compose.yml` handles this correctly for local development.

### No email or notification delivery
The outbox worker processes jobs and logs them, but the `processJob()` function is a stub — it does not send emails, webhooks, or Slack messages. The transactional outbox pattern is fully implemented; adding a real handler is a straightforward extension.

### No file attachments
Deliberately excluded per the PDF brief. The work item `description` field supports up to 5,000 characters for context.

### No SSO / OAuth
Uses seeded JWT authentication only. Adding NextAuth.js or Clerk would be straightforward but was out of scope.

### No bulk operations
The UI does not support bulk status changes, bulk assignment, or bulk deletion. Work items must be managed individually.

### Seed data uses sequential timestamps
The 500 seeded work items use random timestamps within the last 90 days. In a production system, timestamps would reflect real creation times.

### Viewer role cannot comment
The AUTHORIZATION_MATRIX.md documents this as intentional: VIEWER is read-only. To allow comments from VIEWERs, update the `requireTeamRole(userId, teamId, TeamRole.MEMBER)` check in `POST /api/items/:id/comments`.

### Version conflict on the detail page is shown as a banner, not an inline diff
The conflict UI shows the current server state but doesn't diff the two versions side-by-side. A future improvement would be a visual diff.

---

## Unverified / Pending

### Production deployment
The Docker Compose setup is verified locally. A complete production deployment (Vercel + Neon + Railway) has not been validated as part of this submission. The DEPLOYMENT.md documents the steps.

### Load testing at scale
The brief mentions "tens of thousands of items." The indexes are in place, but no load test has been run. The cursor pagination and indexed queries are designed to scale, but actual throughput has not been measured.

### Cross-browser accessibility
WCAG compliance has not been formally audited. The UI uses semantic HTML and Radix UI (which provides ARIA attributes), but manual testing with screen readers has not been performed.

---

## Update Log

- **Oct 18, 2026:** Initial implementation. All 31 automated tests pass. Build verified. Docker Compose verified.
