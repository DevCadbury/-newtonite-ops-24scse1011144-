"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Crown, Eye, Shield, User, Mail, ExternalLink, Briefcase, Activity } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/items/StatusBadge";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { shortId } from "@/lib/shortId";
import { cn } from "@/components/ui/utils";
import type { TeamRole, WorkItemStatus, Priority, ActivityEventType } from "@/generated/prisma/enums";

/* ── Role config ─────────────────────────────────────────────────────────── */
const ROLE_CONFIG: Record<TeamRole, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
}> = {
  VIEWER: { label: "Viewer", icon: Eye,    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25" },
  MEMBER: { label: "Member", icon: User,   chipClass: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25" },
  LEAD:   { label: "Lead",   icon: Crown,  chipClass: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25" },
  ADMIN:  { label: "Admin",  icon: Shield, chipClass: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25" },
};

/* ── Activity event labels ───────────────────────────────────────────────── */
const EVENT_LABEL: Partial<Record<ActivityEventType, string>> = {
  CREATED:             "Created",
  STATUS_CHANGED:      "Status changed",
  ASSIGNED:            "Assigned",
  UNASSIGNED:          "Unassigned",
  PRIORITY_CHANGED:    "Priority changed",
  COMMENTED:           "Commented",
  DESCRIPTION_UPDATED: "Description edit",
  TITLE_UPDATED:       "Title edit",
};

const EVENT_COLOR: Partial<Record<ActivityEventType, string>> = {
  CREATED:          "bg-blue-500/15 text-blue-400",
  STATUS_CHANGED:   "bg-indigo-500/15 text-indigo-400",
  ASSIGNED:         "bg-cyan-500/15 text-cyan-400",
  PRIORITY_CHANGED: "bg-orange-500/15 text-orange-400",
  COMMENTED:        "bg-violet-500/15 text-violet-400",
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Types ───────────────────────────────────────────────────────────────── */
interface MemberSummary {
  user: { id: string; name: string; email: string };
  memberships: Array<{ teamId: string; teamName: string; role: TeamRole }>;
  assignedItems: Array<{
    id: string; title: string;
    status: WorkItemStatus; priority: Priority;
    team: { id: string; name: string };
  }>;
  counts: { total: number; active: number; byStatus: Record<string, number> };
  recentActivity: Array<{
    id: string; type: ActivityEventType;
    description: string; createdAt: string;
    workItem: { id: string; title: string };
  }>;
}

interface Props { memberId: string | null; onClose: () => void; }

/* ── Skeleton ────────────────────────────────────────────────────────────── */
function ProfileSkeleton() {
  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full shrink-0" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Separator />
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════════════ */
export function MemberProfileSheet({ memberId, onClose }: Props) {
  const [data, setData]       = useState<MemberSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) { setData(null); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/users/${memberId}/summary`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [memberId]);

  return (
    <Sheet open={!!memberId} onOpenChange={(v) => !v && onClose()}>
      {/*
        max-w-[min(420px,100vw)] ensures the sheet never exceeds the viewport.
        overflow-hidden at BOTH the SheetContent and inner ScrollArea levels
        ensures nothing bleeds past the right edge.
      */}
      <SheetContent
        side="right"
        className="w-[420px] max-w-[100vw] p-0 flex flex-col overflow-hidden"
      >
        {loading ? (
          <ProfileSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6">
            {error}
          </div>
        ) : data ? (
          <>
            {/* ── Profile header ───────────────────────────────────────── */}
            <SheetHeader className="px-4 pt-5 pb-4 border-b border-border/50 shrink-0 gap-0">
              <div className="flex items-start gap-3">
                <Avatar className="size-14 shrink-0">
                  <AvatarFallback className="text-lg font-bold bg-primary/20 text-primary">
                    {data.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-base font-semibold leading-tight truncate">
                    {data.user.name}
                  </SheetTitle>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground min-w-0">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">{data.user.email}</span>
                  </div>
                  {/* Role chips — wrap so they don't overflow */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {data.memberships.map((m) => {
                      const cfg = ROLE_CONFIG[m.role];
                      return (
                        <span
                          key={m.teamId}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cfg.chipClass}`}
                        >
                          <cfg.icon className="size-2.5" />
                          {m.teamName} · {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* ── Scrollable body ──────────────────────────────────────── */}
            <ScrollArea className="flex-1 overflow-x-hidden">
              <div className="px-4 py-4 space-y-5">

                {/* Stats — 2 columns so nothing overflows */}
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">
                    <Briefcase className="size-3" />
                    Work Items
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Active",
                        value: data.counts.active,
                        valueClass: "text-blue-400",
                        bg: "bg-blue-500/8 border-blue-500/20",
                      },
                      {
                        label: "Total",
                        value: data.counts.total,
                        valueClass: "text-foreground/80",
                        bg: "bg-muted/30 border-border/40",
                      },
                      {
                        label: "Resolved",
                        value: (data.counts.byStatus["RESOLVED"] ?? 0) + (data.counts.byStatus["CLOSED"] ?? 0),
                        valueClass: "text-emerald-400",
                        bg: "bg-emerald-500/8 border-emerald-500/20",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className={`rounded-lg border p-2.5 text-center ${stat.bg}`}
                      >
                        <p className={`text-xl font-bold ${stat.valueClass}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Assigned items — each row uses a stacked layout */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      <Briefcase className="size-3" />
                      Assigned Items
                    </p>
                    {data.assignedItems.length > 0 && (
                      <Link
                        href={`/items?assigneeId=${data.user.id}`}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                        onClick={onClose}
                      >
                        View all
                        <ExternalLink className="size-2.5" />
                      </Link>
                    )}
                  </div>

                  {data.assignedItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic py-2">No active assigned items</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.assignedItems.map((item) => (
                        <Link
                          key={item.id}
                          href={`/items/${item.id}`}
                          onClick={onClose}
                          className="block rounded-lg border border-border/40 bg-muted/10 hover:bg-accent/50 transition-colors p-2.5 group"
                        >
                          {/* Row 1: ID + title */}
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground tracking-wider">
                              {shortId(item.id)}
                            </span>
                            <span className="text-xs font-medium truncate flex-1 min-w-0 group-hover:text-foreground">
                              {item.title}
                            </span>
                          </div>
                          {/* Row 2: team + badges — no overflow possible */}
                          <div className="flex items-center gap-2 mt-1.5 min-w-0">
                            <span className="text-[10px] text-muted-foreground/60 truncate flex-1">
                              {item.team.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <PriorityBadge priority={item.priority} size="sm" />
                              <StatusBadge status={item.status} size="sm" />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Recent activity */}
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2.5">
                    <Activity className="size-3" />
                    Recent Activity
                  </p>

                  {data.recentActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 italic py-2">No recent activity</p>
                  ) : (
                    <div className="space-y-0">
                      {data.recentActivity.map((event) => {
                        const label  = EVENT_LABEL[event.type] ?? event.type.replace(/_/g, " ");
                        const chipCls = EVENT_COLOR[event.type] ?? "bg-slate-500/15 text-slate-400";
                        return (
                          <div
                            key={event.id}
                            className="py-2.5 border-b border-border/25 last:border-0"
                          >
                            {/* Row 1: chip + timestamp */}
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <span className={cn(
                                "shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                                chipCls
                              )}>
                                {label}
                              </span>
                              <span className="text-[10px] text-muted-foreground/40 shrink-0 whitespace-nowrap">
                                {formatRelative(event.createdAt)}
                              </span>
                            </div>
                            {/* Row 2: description */}
                            <p className="text-xs text-foreground/70 mt-1 line-clamp-1">{event.description}</p>
                            {/* Row 3: item link */}
                            <Link
                              href={`/items/${event.workItem.id}`}
                              onClick={onClose}
                              className="text-[11px] text-primary/70 hover:text-primary transition-colors mt-0.5 block truncate"
                            >
                              ↳ {event.workItem.title}
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom padding */}
                <div className="h-2" />
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
