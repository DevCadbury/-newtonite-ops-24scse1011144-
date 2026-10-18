import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Activity } from "lucide-react";
import type { ActivityEventType } from "@/generated/prisma/enums";

const EVENT_CHIP: Partial<Record<ActivityEventType, { label: string; className: string }>> = {
  CREATED:             { label: "Created",           className: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25" },
  STATUS_CHANGED:      { label: "Status Changed",    className: "bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/25" },
  ASSIGNED:            { label: "Assigned",           className: "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25" },
  UNASSIGNED:          { label: "Unassigned",         className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25" },
  PRIORITY_CHANGED:    { label: "Priority Changed",   className: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25" },
  COMMENTED:           { label: "Comment",            className: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25" },
  DESCRIPTION_UPDATED: { label: "Description Edit",   className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25" },
  TITLE_UPDATED:       { label: "Title Edit",         className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25" },
};

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userTeamIds = await getUserTeamIds(session.sub);

  const events = await prisma.activityEvent.findMany({
    where: { workItem: { teamId: { in: userTeamIds } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { id: true, name: true } },
      workItem: {
        select: {
          id: true, title: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  // Group by date
  type Ev = (typeof events)[0];
  const grouped: Array<{ label: string; events: Ev[] }> = [];
  const seen = new Map<string, Ev[]>();

  for (const e of events) {
    const d = new Date(e.createdAt);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    let label: string;
    if (d.toDateString() === now.toDateString()) label = "Today";
    else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
    else label = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    if (!seen.has(label)) { seen.set(label, []); grouped.push({ label, events: seen.get(label)! }); }
    seen.get(label)!.push(e);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All recent events across your teams
        </p>
      </div>

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-border/50 bg-card/50">
          <Activity className="size-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, events: dateEvents }) => (
            <div key={label}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                  {dateEvents.length} event{dateEvents.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-1">
                {dateEvents.map((event) => {
                  const chip = EVENT_CHIP[event.type as ActivityEventType] ?? {
                    label: (event.type as string).replace(/_/g, " "),
                    className: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25",
                  };

                  return (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/60 hover:bg-card transition-colors px-3.5 py-2.5"
                    >
                      {/* Event type chip */}
                      <span
                        className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${chip.className}`}
                      >
                        {chip.label}
                      </span>

                      {/* Description + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground/90">{event.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {event.actor.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <Link
                            href={`/items/${event.workItem.id}`}
                            className="text-[11px] text-primary/80 hover:text-primary truncate max-w-[200px] transition-colors"
                          >
                            {event.workItem.title}
                          </Link>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-muted-foreground/50">
                            {(event.workItem as any).team?.name}
                          </span>
                        </div>
                      </div>

                      {/* Time */}
                      <span className="text-[11px] text-muted-foreground/40 shrink-0 mt-0.5">
                        {new Date(event.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
