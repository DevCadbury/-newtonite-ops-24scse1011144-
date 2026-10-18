# Design Audit — Admin Dashboard Reference

## Reference Project

**Location:** `E:\backup\desktop\project\admin_dashboard\`
**Framework:** React 18 + Vite + TypeScript + Tailwind CSS v4
**Note:** This is a Vite SPA, NOT a Next.js app. Cannot be run directly in this project.

---

## Technology Findings

| Finding | Detail |
|---|---|
| Framework | React 18 + Vite 6 + React Router 7 (NOT Next.js) |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`) |
| Components | Radix UI primitives (shadcn-style, same major versions) |
| Icons | lucide-react 0.487.x |
| Toasts | sonner 2.x |
| Themes | next-themes 0.4.x |
| Routing | React Router v7 (`useLocation`, `<Link>`) |

---

## Component Reuse Matrix

| Component | Location | Action | Reason |
|---|---|---|---|
| All `/ui/*.tsx` files | `src/app/components/ui/` | **Copy** | Pure Radix UI + Tailwind — framework-agnostic |
| `admin.css` | `src/app/admin/` | **Copy** | Purposeful transition animations, no framework dependency |
| `default_shadcn_theme.css` | project root | **Copy** | CSS variable design tokens, framework-agnostic |
| `AdminLayout.tsx` | `src/app/admin/layout/` | **Port** | Swap React Router `<Outlet>` with Next.js `{children}` |
| `AdminSidebar.tsx` | `src/app/admin/layout/` | **Port** | Swap `useLocation`/`Link` from React Router to Next.js |
| `AdminTopbar.tsx` | `src/app/admin/layout/` | **Port** | Replace auth context with Next.js session |
| `ActivityTimeline.tsx` | `src/app/admin/components/tickets/` | **Port** | Adapt event types for Newtonite's ActivityEventType |
| `StatusBadge.tsx` | `src/app/admin/components/tickets/` | **Port** | Replace ticket statuses with WorkItemStatus |
| `PriorityBadge.tsx` | `src/app/admin/components/tickets/` | **Port** | Replace ticket priorities with Priority enum |
| `TicketSidebar.tsx` | `src/app/admin/components/tickets/` | **Port as WorkItemSidebar** | Adapt for work item metadata + transitions |
| `TicketDetail.tsx` | `src/app/admin/pages/` | **Port as ItemDetail** | Two-panel layout pattern reused |
| `StatusHistoryPanel.tsx` | `src/app/admin/components/` | **Pattern** | Timeline pattern used in ActivityTimeline |
| `Users.tsx` | `src/app/admin/pages/` | **Pattern** | Table structure + filters used in WorkItemTable |
| `Dashboard.tsx` | `src/app/admin/pages/` | **Pattern** | Stat cards + activity feed used in dashboard page |
| `ActivityLogs.tsx` | `src/app/admin/pages/` | **Pattern** | Grouped timeline pattern used in activity view |

---

## Design Token Adoption

The `default_shadcn_theme.css` from the reference dashboard was copied verbatim into `app/globals.css`. This gives us:
- Neutral background (`#ffffff` / oklch dark equivalent)
- Muted foreground (`#717182`)
- Semantic destructive red (`#d4183d`)
- Border with 10% opacity (`rgba(0,0,0,0.1)`)
- CSS variable radius tokens (`--radius: 0.625rem`)
- Chart color tokens (oklch)

**Result:** The Newtonite app matches the admin dashboard's color palette exactly, with the same light/dark mode tokens.

---

## Design Decisions

1. **No neon/glassmorphism**: The admin dashboard uses neutral grays and minimal accents. We preserved this — no gradient backgrounds, no glowing borders.
2. **Practical layout**: Collapsible sidebar + fixed topbar + scrollable main matches the reference exactly.
3. **Status/Priority badges**: The pill badge pattern (dot + label, colored border) is directly ported from the admin dashboard's `StatusBadge`/`PriorityBadge`.
4. **Activity timeline**: The icon-per-event-type with vertical connector line pattern is directly ported from `ActivityTimeline.tsx`.
5. **Data tables**: The `Table` component from shadcn with hover rows and monospace IDs follows the `Users.tsx` pattern.

---

## What Was NOT Reused

- Authentication logic (`AdminAuthContext.tsx`) — replaced with JWT/cookie session
- Application business logic (help center, AI monitor, etc.) — not applicable
- Mock data files (`ticketData.ts`, `logsData.ts`) — replaced with real API data
- React Router routing — replaced with Next.js App Router
- Vite configuration — replaced with Next.js build pipeline
