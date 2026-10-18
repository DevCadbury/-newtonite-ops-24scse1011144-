import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  AlertCircle, CheckCircle, Clock, ListChecks,
  Plus, UserCheck, RefreshCw, MessageSquare, ArrowUpCircle, Edit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/items/StatusBadge";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { prisma } from "@/lib/prisma";
import { getUserTeamIds, getUserTeamMemberships, ROLE_HIERARCHY } from "@/lib/permissions";
import type { ActivityEventType } from "@/generated/prisma/enums";

/* ─── Per-event-type presentation for the dashboard activity feed ─── */
const ACTIVITY_CHIP: Partial<Record<ActivityEventType, { label: string; className: string }>> = {
  CREATED:             { label: "Created",          className: "bg-blue-500/15 text-blue-400" },
  STATUS_CHANGED:      { label: "Status changed",   className: "bg-indigo-500/15 text-indigo-400" },
  ASSIGNED:            { label: "Assigned",          className: "bg-cyan-500/15 text-cyan-400" },
  UNASSIGNED:          { label: "Unassigned",        className: "bg-slate-500/15 text-slate-400" },
  PRIORITY_CHANGED:    { label: "Priority changed",  className: "bg-orange-500/15 text-orange-400" },
  COMMENTED:           { label: "Comment",           className: "bg-violet-500/15 text-violet-400" },
  DESCRIPTION_UPDATED: { label: "Description edit",  className: "bg-slate-500/15 text-slate-400" },
  TITLE_UPDATED:       { label: "Title edit",        className: "bg-slate-500/15 text-slate-400" },
};

async function getDashboardData(userId: string) {
  const [userTeamIds, memberships] = await Promise.all([
    getUserTeamIds(userId),
    getUserTeamMemberships(userId),
  ]);

  if (userTeamIds.length === 0) {
    return {
      stats: { openItems: 0, assignedToMe: 0, awaitingApproval: 0, overdue: 0 },
      assignedToMe: [], unassignedUrgent: [], awaitingApproval: [], recentActivity: [],
    };
  }

  const leadTeamIds = memberships
    .filter((m) => ROLE_HIERARCHY[m.role] >= ROLE_HIERARCHY.LEAD)
    .map((m) => m.teamId);

  const now = new Date();

  const [
    openCount, assignedCount, awaitingCount, overdueCount,
    assignedToMe, unassignedUrgent, awaitingApproval, recentActivity,
  ] = await Promise.all([
    prisma.workItem.count({ where: { status: "OPEN", teamId: { in: userTeamIds } } }),
    prisma.workItem.count({ where: { assigneeId: userId, teamId: { in: userTeamIds }, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    leadTeamIds.length > 0
      ? prisma.workItem.count({ where: { status: "AWAITING_APPROVAL", teamId: { in: leadTeamIds } } })
      : Promise.resolve(0),
    prisma.workItem.count({
      where: { teamId: { in: userTeamIds }, dueDate: { lt: now }, status: { notIn: ["RESOLVED", "CLOSED"] } },
    }),
    prisma.workItem.findMany({
      where: { assigneeId: userId, teamId: { in: userTeamIds }, status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: { updatedAt: "desc" }, take: 5,
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.workItem.findMany({
      where: { teamId: { in: userTeamIds }, assigneeId: null, priority: { in: ["HIGH", "CRITICAL"] }, status: "OPEN" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 5,
      include: { team: { select: { id: true, name: true } } },
    }),
    leadTeamIds.length > 0
      ? prisma.workItem.findMany({
          where: { status: "AWAITING_APPROVAL", teamId: { in: leadTeamIds } },
          orderBy: { updatedAt: "asc" }, take: 5,
          include: {
            team: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.activityEvent.findMany({
      where: { workItem: { teamId: { in: userTeamIds } } },
      orderBy: { createdAt: "desc" }, take: 12,
      include: {
        actor: { select: { id: true, name: true } },
        workItem: { select: { id: true, title: true } },
      },
    }),
  ]);

  return {
    stats: { openItems: openCount, assignedToMe: assignedCount, awaitingApproval: awaitingCount, overdue: overdueCount },
    assignedToMe,
    unassignedUrgent,
    awaitingApproval: awaitingApproval as any[],
    recentActivity,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { stats, assignedToMe, unassignedUrgent, awaitingApproval, recentActivity } =
    await getDashboardData(session.sub);

  const statCards = [
    {
      title: "Open Items",
      value: stats.openItems,
      href: "/items",
      icon: ListChecks,
      iconClass: "text-blue-400",
      bgClass: "bg-blue-500/10",
    },
    {
      title: "Assigned to Me",
      value: stats.assignedToMe,
      href: "/items?me=true",
      icon: CheckCircle,
      iconClass: "text-emerald-400",
      bgClass: "bg-emerald-500/10",
    },
    {
      title: "Awaiting Approval",
      value: stats.awaitingApproval,
      href: "/items?status=AWAITING_APPROVAL",
      icon: Clock,
      iconClass: "text-violet-400",
      bgClass: "bg-violet-500/10",
    },
    {
      title: "Overdue",
      value: stats.overdue,
      href: "/items?unassigned=false",
      icon: AlertCircle,
      iconClass: "text-red-400",
      bgClass: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {session.name}
        </p>
      </div>

      {/* Stat cards — all are clickable navigation links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.title} href={s.href}>
              <Card className="admin-card border-border/60 cursor-pointer hover:border-border transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground">{s.title}</span>
                    <div className={`flex size-8 items-center justify-center rounded-lg ${s.bgClass}`}>
                      <Icon className={`size-4 ${s.iconClass}`} />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Click to view →</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Three-column panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Assigned to me */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Link href="/items?me=true" className="text-sm font-medium hover:text-primary transition-colors">
                Assigned to Me
              </Link>
              <Link
                href="/items?me=true"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {assignedToMe.length === 0 ? (
              <div className="py-6 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground/60 italic">
                  No active items assigned to you
                </p>
                <Link href="/items" className="text-xs text-primary hover:underline">
                  Browse all items →
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {(assignedToMe as any[]).map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-accent/60 active:bg-accent transition-colors group"
                  >
                    <span className="text-xs truncate text-foreground/90 group-hover:text-foreground font-medium">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-muted-foreground">{item.team.name}</span>
                      <StatusBadge status={item.status} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Unassigned & Urgent */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Link href="/items?unassigned=true&priority=HIGH" className="text-sm font-medium hover:text-primary transition-colors">
                Unassigned & Urgent
              </Link>
              <Link
                href="/items?unassigned=true&priority=HIGH"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {unassignedUrgent.length === 0 ? (
              <div className="py-6 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground/60 italic">
                  No urgent unassigned items — team is on top of it
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {(unassignedUrgent as any[]).map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-accent/60 active:bg-accent transition-colors group"
                  >
                    <span className="text-xs truncate text-foreground/90 group-hover:text-foreground font-medium">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-muted-foreground">{item.team.name}</span>
                      <PriorityBadge priority={item.priority} size="sm" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Awaiting approval */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Link href="/items?status=AWAITING_APPROVAL" className="text-sm font-medium hover:text-primary transition-colors">
                Awaiting My Approval
              </Link>
              <Link
                href="/items?status=AWAITING_APPROVAL"
                className="text-xs text-primary hover:text-primary/80 transition-colors"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {awaitingApproval.length === 0 ? (
              <div className="py-6 flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground/60 italic">
                  No items awaiting your approval
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {awaitingApproval.map((item: any) => (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 hover:bg-accent/60 active:bg-accent transition-colors group"
                  >
                    <span className="text-xs truncate text-foreground/90 group-hover:text-foreground font-medium">
                      {item.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-muted-foreground">{item.team.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity feed */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Link
              href="/activity"
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 py-4 text-center italic">
              No recent activity
            </p>
          ) : (
            <div className="space-y-0">
              {(recentActivity as any[]).map((event: any) => {
                const chip = ACTIVITY_CHIP[event.type as ActivityEventType] ?? {
                  label: event.type.replace(/_/g, " "),
                  className: "bg-slate-500/15 text-slate-400",
                };
                return (
                  <Link
                    key={event.id}
                    href={`/items/${event.workItem.id}`}
                    className="flex items-start gap-3 py-2.5 px-1 rounded-md border-b border-border/30 last:border-0 hover:bg-accent/40 transition-colors group"
                  >
                    {/* Event type chip */}
                    <span
                      className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${chip.className}`}
                    >
                      {chip.label}
                    </span>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-foreground/90 group-hover:text-foreground truncate">{event.description}</p>
                        <span className="text-[11px] text-muted-foreground/50 shrink-0">
                          {new Date(event.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                        <span className="font-medium">{event.actor.name}</span>
                        {" · "}
                        <span className="group-hover:text-primary transition-colors">{event.workItem.title}</span>
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
