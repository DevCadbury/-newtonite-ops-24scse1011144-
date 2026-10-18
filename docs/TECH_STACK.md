# Technology Stack

## Core Stack

| Technology | Role | Version | Required? | Docs |
|---|---|---|---|---|
| Node.js | Runtime | 24.x (≥20.19.0) | Required | https://nodejs.org |
| Next.js | Full-stack framework | 16.4.x | Required | https://nextjs.org/docs |
| React | UI | 19.x | Required (bundled with Next.js) | https://react.dev |
| TypeScript | Type safety | 5.x | Required | https://www.typescriptlang.org |
| Tailwind CSS | Utility CSS | 4.x | Required | https://tailwindcss.com |
| PostgreSQL | Database | 16.x | Required | https://www.postgresql.org |
| Prisma ORM 7 | Database client + migrations | 7.10.1 | Required | https://www.prisma.io/docs |
| `@prisma/adapter-pg` | Driver adapter for Prisma 7 | 7.10.1 | Required | https://www.prisma.io/docs/orm/overview/databases/postgresql |
| `pg` | PostgreSQL Node.js driver | 8.x | Required (Prisma 7 dependency) | https://node-postgres.com |

## Authentication & Security

| Technology | Role | Version | Notes |
|---|---|---|---|
| `jose` | JWT sign/verify (httpOnly cookies) | 5.x | RFC 7519 compliant, edge-compatible |
| `bcryptjs` | Password hashing | 2.x | Pure JS implementation, no native deps |
| `zod` | Request validation | 3.x | Runtime schema validation |

## UI

| Technology | Role | Version | Notes |
|---|---|---|---|
| Radix UI | Headless component primitives | various | Copied from admin dashboard |
| `lucide-react` | Icons | 0.487.x | Matched to admin dashboard version |
| `sonner` | Toast notifications | 2.x | Non-blocking feedback |
| `next-themes` | Dark mode | 0.4.x | CSS variable-based |
| `class-variance-authority` | Component variant styling | 0.7.x | shadcn-style variants |
| `tailwind-merge` | CSS class deduplication | 3.x | Used in `cn()` helper |

## Testing

| Technology | Role | Version | Notes |
|---|---|---|---|
| Vitest | Test runner | latest | ESM-native, globalSetup support |
| Real PostgreSQL | Test database | 16.x (Docker) | Required for concurrency tests |

## Development

| Technology | Role | Notes |
|---|---|---|
| Docker Compose | Local orchestration | PostgreSQL + app + worker |
| `tsx` | TypeScript execution | Used for seed script and worker |
| `dotenv` | Environment variables | Loaded by seed and worker |

## Why Prisma 7 (not 6)

Prisma 7 is the current stable release and is confirmed compatible with Node.js 24.x. Key differences from Prisma 6:
- `provider = "prisma-client"` (not `prisma-client-js`)
- `output` is required (generates to `generated/prisma/`)
- Requires an explicit driver adapter (`@prisma/adapter-pg`)
- Config in `prisma7.config.ts` (separate from `schema.prisma`)

## Alternatives Considered

| Alternative | Why Not Chosen |
|---|---|
| MongoDB | PDF explicitly requires PostgreSQL for row-level locking, transactions, and `UPDATE WHERE` semantics for atomic claiming |
| Redis/BullMQ | No extra infrastructure needed; PostgreSQL outbox achieves same guarantees |
| Express + React SPA | Extra complexity for a challenge; Next.js monorepo is cleaner |
| Auth.js (NextAuth) | Overkill for seeded users; simple JWT is sufficient and easier to explain |
| Drizzle ORM | Prisma is more familiar, has better migration tooling for a challenge setting |
