"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
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

const EVENT_TYPES = Object.entries(EVENT_CHIP).map(([k, v]) => ({ value: k, label: v!.label }));

interface Event {
  id: string;
  type: ActivityEventType;
  description: string;
  createdAt: string;
  actor: { id: string; name: string };
  workItem: { id: string; title: string; team?: { name: string } };
}

interface Props {
  events: Event[];
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function ActivityClient({ events }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesType = typeFilter === "all" || e.type === typeFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || [
        e.description,
        e.actor.name,
        e.workItem.title,
      ].some((s) => s?.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [events, search, typeFilter]);

  // Group by date
  const grouped: Array<{ label: string; events: Event[] }> = [];
  const seen = new Map<string, Event[]>();
  for (const e of filtered) {
    const label = formatRelativeDate(e.createdAt);
    if (!seen.has(label)) { seen.set(label, []); grouped.push({ label, events: seen.get(label)! }); }
    seen.get(label)!.push(e);
  }

  const activeFilters = (typeFilter !== "all" ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All recent events across your teams
          </p>
        </div>
        <span className="text-xs text-muted-foreground/60 tabular-nums">
          {filtered.length} of {events.length} events
        </span>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by actor, item, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/20 border-border/50"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
              onClick={() => setSearch("")}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", activeFilters > 0 && "border-primary/50 text-primary")}
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal className="size-3.5" />
          Filter
          {activeFilters > 0 && (
            <Badge className="size-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground rounded-full">
              {activeFilters}
            </Badge>
          )}
        </Button>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => { setSearch(""); setTypeFilter("all"); }}>
            <X className="size-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Event type filter pills */}
      {showFilters && (
        <div className="flex items-center gap-1.5 flex-wrap p-3 rounded-lg bg-muted/20 border border-border/40">
          <button
            onClick={() => setTypeFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs border transition-colors",
              typeFilter === "all"
                ? "bg-primary/15 text-primary border-primary/30"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            All types
          </button>
          {EVENT_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                typeFilter === value
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-border/50 bg-card/50">
          <Search className="size-10 text-muted-foreground/20 mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || typeFilter !== "all" ? "No events match your filters" : "No activity yet"}
          </p>
          {(search || typeFilter !== "all") && (
            <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setSearch(""); setTypeFilter("all"); }}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, events: dateEvents }) => (
            <div key={label}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider shrink-0">{label}</span>
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
                    <Link
                      key={event.id}
                      href={`/items/${event.workItem.id}`}
                      className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/60 hover:bg-card transition-colors px-3.5 py-2.5 group"
                    >
                      <span className={`shrink-0 mt-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${chip.className}`}>
                        {chip.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground/90 group-hover:text-foreground">{event.description}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-medium text-muted-foreground">{event.actor.name}</span>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <span className="text-[11px] text-primary/80 group-hover:text-primary truncate max-w-[200px] transition-colors">
                            {event.workItem.title}
                          </span>
                          {event.workItem.team?.name && (
                            <>
                              <span className="text-[11px] text-muted-foreground/40">·</span>
                              <span className="text-[11px] text-muted-foreground/50">{event.workItem.team.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground/40 shrink-0 mt-0.5">
                        {new Date(event.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </Link>
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