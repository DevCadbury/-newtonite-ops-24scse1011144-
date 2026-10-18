"use client";

import { cn } from "@/components/ui/utils";
import {
  MessageSquare,
  RefreshCw,
  UserCheck,
  UserMinus,
  AlertTriangle,
  Plus,
  Edit,
  Tag,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  Lock,
  FileText,
} from "lucide-react";
import type { ActivityEventType } from "@/generated/prisma/enums";
import type { ReactNode } from "react";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string };
}

/* ─── Event presentation config ─────────────────────────────────────────── */
interface EventConfig {
  icon: ReactNode;
  label: string;
  /** Tailwind classes: icon bg + text on dark + light */
  chipClass: string;
  /** dot color class for the connector line */
  dotClass: string;
}

const EVENT_CONFIG: Partial<Record<ActivityEventType, EventConfig>> = {
  CREATED: {
    icon: <Plus className="size-3" />,
    label: "Item Created",
    chipClass: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
    dotClass:  "bg-blue-400",
  },
  STATUS_CHANGED: {
    icon: <RefreshCw className="size-3" />,
    label: "Status Changed",
    chipClass: "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30",
    dotClass:  "bg-indigo-400",
  },
  ASSIGNED: {
    icon: <UserCheck className="size-3" />,
    label: "Assigned / Claimed",
    chipClass: "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/30",
    dotClass:  "bg-cyan-400",
  },
  UNASSIGNED: {
    icon: <UserMinus className="size-3" />,
    label: "Unassigned",
    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
    dotClass:  "bg-slate-400",
  },
  PRIORITY_CHANGED: {
    icon: <ArrowUpCircle className="size-3" />,
    label: "Priority Changed",
    chipClass: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
    dotClass:  "bg-orange-400",
  },
  COMMENTED: {
    icon: <MessageSquare className="size-3" />,
    label: "Comment Added",
    chipClass: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30",
    dotClass:  "bg-violet-400",
  },
  DESCRIPTION_UPDATED: {
    icon: <FileText className="size-3" />,
    label: "Description Updated",
    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
    dotClass:  "bg-slate-400",
  },
  TITLE_UPDATED: {
    icon: <Edit className="size-3" />,
    label: "Title Updated",
    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
    dotClass:  "bg-slate-400",
  },
};

/** Extra semantic override for specific status transitions */
function resolveConfig(event: ActivityEvent): EventConfig {
  const base = EVENT_CONFIG[event.type];

  // Enrich STATUS_CHANGED based on the target status in metadata
  if (event.type === "STATUS_CHANGED") {
    const toStatus = (event.metadata as any)?.toStatus as string | undefined;
    if (toStatus === "RESOLVED") {
      return {
        icon: <CheckCircle className="size-3" />,
        label: "Approval Completed",
        chipClass: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
        dotClass:  "bg-emerald-400",
      };
    }
    if (toStatus === "IN_PROGRESS" && (event.metadata as any)?.fromStatus === "AWAITING_APPROVAL") {
      return {
        icon: <XCircle className="size-3" />,
        label: "Approval Rejected",
        chipClass: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30",
        dotClass:  "bg-amber-400",
      };
    }
    if (toStatus === "CLOSED") {
      return {
        icon: <Lock className="size-3" />,
        label: "Item Closed",
        chipClass: "bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30",
        dotClass:  "bg-teal-400",
      };
    }
  }

  // Enrich PRIORITY_CHANGED: critical = red
  if (event.type === "PRIORITY_CHANGED") {
    const toPriority = (event.metadata as any)?.priority?.to as string | undefined;
    if (toPriority === "CRITICAL") {
      return {
        icon: <AlertTriangle className="size-3" />,
        label: "Critical Priority Set",
        chipClass: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
        dotClass:  "bg-red-400",
      };
    }
  }

  if (base) return base;

  // Fallback for unknown types
  return {
    icon: <Tag className="size-3" />,
    label: event.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30",
    dotClass:  "bg-slate-500",
  };
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Render a compact before → after if metadata contains them */
function MetadataHint({ metadata }: { metadata?: Record<string, unknown> | null }) {
  if (!metadata) return null;
  const pairs: Array<{ key: string; from?: unknown; to?: unknown }> = [];

  // Standard patterns we emit: { fromStatus, toStatus } | { priority: {from,to} } | { assigneeId }
  if (metadata.fromStatus && metadata.toStatus) {
    pairs.push({ key: "status", from: metadata.fromStatus, to: metadata.toStatus });
  }
  if ((metadata.priority as any)?.from || (metadata.priority as any)?.to) {
    pairs.push({ key: "priority", from: (metadata.priority as any).from, to: (metadata.priority as any).to });
  }
  if (metadata.assigneeName) {
    pairs.push({ key: "assignee", to: metadata.assigneeName });
  }

  if (pairs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {pairs.map(({ key, from, to }) => (
        <span key={key} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {from !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-muted/50 line-through opacity-60">
              {String(from).replace(/_/g, " ")}
            </span>
          )}
          {from !== undefined && to !== undefined && <span className="opacity-40">{"→"}</span>}
          {to !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-muted/80">
              {String(to).replace(/_/g, " ")}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

interface ActivityTimelineProps {
  events: ActivityEvent[];
  className?: string;
}

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6 italic">
        No activity recorded yet
      </p>
    );
  }

  return (
    <div className={cn("relative space-y-0", className)}>
      {events.map((event, index) => {
        const cfg = resolveConfig(event);

        return (
          <div key={event.id} className="flex gap-3 group">
            {/* Icon + connector */}
            <div className="flex flex-col items-center pt-0.5">
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full",
                  cfg.chipClass
                )}
              >
                {cfg.icon}
              </div>
              {index < events.length - 1 && (
                <div className="w-px flex-1 bg-border/50 min-h-[18px] mt-0.5" />
              )}
            </div>

            {/* Content */}
            <div className={cn("flex-1 min-w-0 pb-3", index === events.length - 1 && "pb-0")}>
              {/* Event type chip + label */}
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    cfg.chipClass
                  )}
                >
                  {cfg.label}
                </span>
              </div>

              {/* Human description from backend */}
              <p className="text-[12px] text-foreground leading-snug">
                {event.description}
              </p>

              {/* Metadata before → after */}
              <MetadataHint metadata={event.metadata} />

              {/* Actor + time */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {event.actor.name}
                </span>
                <span className="text-[11px] text-muted-foreground/40">·</span>
                <span className="text-[11px] text-muted-foreground/60">
                  {formatRelative(event.createdAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
