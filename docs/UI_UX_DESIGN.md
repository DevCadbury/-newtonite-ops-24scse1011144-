# UI/UX Design

## Design Direction

This application is a practical, professional internal operations tool. The design priority is clarity, information density, and restrained styling — not visual novelty.

**Reference source:** `E:\backup\desktop\project\admin_dashboard` (React/Vite, Tailwind v4, Radix UI shadcn-style)

---

## Design Tokens (from admin dashboard)

Copied verbatim from `default_shadcn_theme.css`:

```css
:root {
  --background: #ffffff;
  --foreground: oklch(0.145 0 0);
  --card: #ffffff;
  --muted: #ececf0;
  --muted-foreground: #717182;     /* neutral secondary text */
  --primary: #030213;              /* near-black, not blue */
  --border: rgba(0, 0, 0, 0.1);   /* subtle dividers */
  --destructive: #d4183d;          /* error red */
  --radius: 0.625rem;
}
```

Dark mode tokens follow the same structure with oklch equivalents.

---

## Typography

| Element | Style |
|---|---|
| Page heading | `text-xl tracking-tight` |
| Section label | `text-sm text-muted-foreground` |
| Table cell | `text-sm` |
| Metadata label | `text-[11px] uppercase tracking-wider text-muted-foreground/70` |
| Timestamp / secondary | `text-[11px] text-muted-foreground` |

No custom fonts. System sans-serif via `font-sans antialiased`.

---

## Status and Priority Colors

### Status (WorkItemStatus)

| Status | Dot | Background | Text | Border |
|---|---|---|---|---|
| OPEN | blue-500 | blue-50 | blue-700 | blue-200 |
| IN_PROGRESS | amber-500 | amber-50 | amber-700 | amber-200 |
| AWAITING_APPROVAL | violet-500 | violet-50 | violet-700 | violet-200 |
| RESOLVED | emerald-500 | emerald-50 | emerald-700 | emerald-200 |
| CLOSED | slate-400 | muted | muted-foreground | border |

### Priority

| Priority | Color family |
|---|---|
| LOW | Slate (neutral) |
| MEDIUM | Blue |
| HIGH | Amber |
| CRITICAL | Red |

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar (w-60 / collapsed w-[60px])                          │
│  Logo • Nav sections • User + Logout                         │
├──────────────────────────────────────────────────────────────┤
│ Topbar (h-14)                                                 │
│  "Operations Tracker"                                        │
│                              [theme] | [avatar ▼]            │
├──────────────────────────────────────────────────────────────┤
│ Main (flex-1, overflow-y-auto, p-6)                          │
│  Page content                                                 │
└──────────────────────────────────────────────────────────────┘
```

The sidebar collapses to icon-only mode (w-[60px]) with tooltips on hover. State stored in `SidebarContext`.

---

## Key Screens

### Login (`/login`)
- Centered card, max-w-sm
- Email + password form
- Quick-login demo account grid below form
- No background gradient — plain muted surface

### Dashboard (`/`)
- 4 stat cards in a row
- 3 content panels: "Assigned to Me", "Unassigned & Urgent", "Awaiting My Approval"
- Recent activity feed

### Work Item List (`/items`)
- Quick-filter tab row (All / Assigned to Me / Unassigned Urgent / Awaiting Approval)
- Search + filter bar with expandable advanced filters
- Table: ID (mono, truncated), Title, Type badge, Priority badge, Status badge, Assignee, Team, Due date
- Overdue dates highlighted red
- "Load more" pagination button
- Inline count display

### Work Item Detail (`/items/:id`)
- Full-height split panel: main content left, sidebar right
- Left: title, description, comment thread + input
- Right sidebar (w-[300px]): metadata grid, assignee section, workflow action buttons, activity timeline
- Claim button appears only when item is unassigned and user is MEMBER+
- Action buttons show only transitions valid for the current user's role
- Conflict banner appears (non-dismissible) on 409 VERSION_CONFLICT

### Teams (`/teams`)
- Card grid, one card per team the user belongs to
- Shows user's role badge prominently
- Lists all team members with their roles

### Activity (`/activity`)
- Grouped by date (today, yesterday, etc.)
- Inline event cards with description, actor, linked item, time

---

## Component Reuse from Admin Dashboard

| Component | Source File | Action |
|---|---|---|
| All `/ui/*.tsx` | `src/app/components/ui/` | Copied |
| Layout structure | `AdminLayout.tsx` | Ported (Next.js links) |
| Sidebar | `AdminSidebar.tsx` | Ported (nav items updated) |
| Topbar | `AdminTopbar.tsx` | Ported (auth context replaced) |
| Activity timeline | `ActivityTimeline.tsx` | Ported (Newtonite event types) |
| Status badge | `StatusBadge.tsx` | Ported (work item statuses) |
| Priority badge | `PriorityBadge.tsx` | Ported |
| Item sidebar | `TicketSidebar.tsx` | Ported as `WorkItemSidebar` |
| Item detail layout | `TicketDetail.tsx` | Ported as `WorkItemDetailClient` |

---

## Accessibility

- All interactive elements use Radix UI primitives (built-in ARIA attributes)
- Focus rings preserved from the admin dashboard CSS
- `suppressHydrationWarning` on `<html>` for theme toggle
- `data-scroll-behavior="smooth"` on `<html>` per Next.js guidance
- Color contrast follows the shadcn theme defaults (not formally audited)
