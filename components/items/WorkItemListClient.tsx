"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Filter, Plus, Loader2, CalendarClock, Clock, Copy, Check as CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/items/StatusBadge";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import type { WorkItemStatus, Priority, WorkItemType } from "@/generated/prisma/enums";
import { WorkItemStatuses, Priorities, WorkItemTypes } from "@/lib/constants";
import { shortId } from "@/lib/shortId";

interface WorkItem {
  id: string;
  title: string;
  type: WorkItemType;
  priority: Priority;
  status: WorkItemStatus;
  version: number;
  teamId: string;
  dueDate: string | null;
  updatedAt: string;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string };
  createdBy: { id: string; name: string };
}

interface Props { userId: string; userName: string; }

const QUICK_TABS = [
  { value: "all",      label: "All Items",           params: {},                                           emptyMsg: "No work items yet. Create one to get started." },
  { value: "me",       label: "Assigned to Me",      params: { me: "true" },                               emptyMsg: "Nothing assigned to you right now." },
  { value: "urgent",   label: "Unassigned & Urgent", params: { unassigned: "true", priority: "HIGH" },     emptyMsg: "No urgent unassigned items â€” the team is on top of it." },
  { value: "approval", label: "Awaiting Approval",   params: { status: "AWAITING_APPROVAL" },              emptyMsg: "No items waiting for your approval." },
] as const;

type QuickTab = (typeof QUICK_TABS)[number]["value"];

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

function relativeDue(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days <= 7) return `in ${days} days`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i} className="border-border/40">
          <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-12" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-full max-w-[260px]" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-16" /></TableCell>
          <TableCell><Skeleton className="h-3.5 w-14" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function AssigneeCell({ assignee }: { assignee: WorkItem["assignee"] }) {
  if (!assignee) return <span className="text-muted-foreground/40 text-xs italic">Unassigned</span>;
  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default w-fit">
          <Avatar className="size-5 shrink-0">
            <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
              {assignee.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-foreground/80 truncate max-w-[90px]">{assignee.name}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-48 p-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback className="text-sm bg-primary/20 text-primary font-medium">
              {assignee.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{assignee.name}</p>
            <p className="text-xs text-muted-foreground">Assigned member</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function FilterSheet({ status, priority, type, onStatusChange, onPriorityChange, onTypeChange, onClear, activeCount }: {
  status: string; priority: string; type: string;
  onStatusChange: (v: string) => void; onPriorityChange: (v: string) => void; onTypeChange: (v: string) => void;
  onClear: () => void; activeCount: number;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 h-9", activeCount > 0 && "border-primary/50 text-primary")}>
          <Filter className="size-3.5" />Filters
          {activeCount > 0 && (
            <Badge className="size-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground rounded-full">{activeCount}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader><SheetTitle className="text-base">Filter Items</SheetTitle></SheetHeader>
        <div className="mt-6 space-y-5">
          {[
            { label: "Status", value: status, onChange: onStatusChange, opts: ["all", ...WorkItemStatuses], fmt: (s: string) => s === "all" ? "All statuses" : s.replace(/_/g, " ") },
            { label: "Priority", value: priority, onChange: onPriorityChange, opts: ["all", ...Priorities], fmt: (s: string) => s === "all" ? "All priorities" : s },
            { label: "Type", value: type, onChange: onTypeChange, opts: ["all", ...WorkItemTypes], fmt: (s: string) => s === "all" ? "All types" : s.replace(/_/g, " ") },
          ].map(({ label, value, onChange, opts, fmt }, i) => (
            <div key={label}>
              {i > 0 && <Separator className="mb-5" />}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                <div className="space-y-1.5">
                  {opts.map((o) => (
                    <button key={o} onClick={() => onChange(o)} className={cn("w-full text-left px-3 py-2 rounded-md text-sm transition-colors", value === o ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                      {fmt(o)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {activeCount > 0 && (<><Separator /><Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground" onClick={onClear}><X className="size-3.5 mr-1.5" />Clear all filters</Button></>)}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function WorkItemListClient({ userId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (): QuickTab => {
    if (searchParams.get("me") === "true") return "me";
    if (searchParams.get("status") === "AWAITING_APPROVAL") return "approval";
    if (searchParams.get("unassigned") === "true") return "urgent";
    return "all";
  };

  const [items, setItems]           = useState<WorkItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab]   = useState<QuickTab>(initialTab);
  const [search, setSearch]         = useState(searchParams.get("q") ?? "");
  const [status, setStatus]         = useState(searchParams.get("status") ?? "all");
  const [priority, setPriority]     = useState(searchParams.get("priority") ?? "all");
  const [type, setType]             = useState(searchParams.get("type") ?? "all");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState(false);
  const [tabCounts, setTabCounts]   = useState<Record<string, number>>({});

  const debouncedSearch = useDebounce(search, 300);

  // Fetch tab counts from dashboard API
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setTabCounts({
          all: (d.stats?.openItems ?? 0),
          me: (d.stats?.assignedToMe ?? 0),
          urgent: 0,
          approval: (d.stats?.awaitingApproval ?? 0),
        });
      })
      .catch(() => {});
  }, []);

  const buildQuery = useCallback((cursor?: string) => {
    const tab = QUICK_TABS.find((t) => t.value === activeTab)!;
    const p = new URLSearchParams(tab.params as Record<string, string>);
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (status !== "all") p.set("status", status);
    if (priority !== "all") p.set("priority", priority);
    if (type !== "all") p.set("type", type);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [activeTab, debouncedSearch, status, priority, type]);

  const fetchItems = useCallback(async (cursor?: string) => {
    const isMore = !!cursor;
    if (isMore) setLoadingMore(true); else setLoading(true);
    try {
      const res = await fetch(`/api/items?${buildQuery(cursor)}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setItems((prev) => isMore ? [...prev, ...data.items] : data.items);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch { toast.error("Failed to load work items"); }
    finally { if (isMore) setLoadingMore(false); else setLoading(false); }
  }, [buildQuery]);

  useEffect(() => { fetchItems(); setSelected(new Set()); }, [fetchItems]);

  const isOverdue = (item: WorkItem) =>
    item.dueDate && new Date(item.dueDate) < new Date() && !["RESOLVED", "CLOSED"].includes(item.status);

  const isCritical = (item: WorkItem) => item.priority === "CRITICAL";

  const activeFilterCount = (status !== "all" ? 1 : 0) + (priority !== "all" ? 1 : 0) + (type !== "all" ? 1 : 0);
  const clearFilters = () => { setStatus("all"); setPriority("all"); setType("all"); };

  // Bulk: change priority
  const handleBulkPriority = async (newPriority: string) => {
    const ids = Array.from(selected);
    let done = 0;
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: item.version ?? 1, priority: newPriority }),
      });
      if (res.ok) done++;
    }
    toast.success(`Updated priority for ${done} item${done !== 1 ? "s" : ""}`);
    setSelected(new Set());
    fetchItems();
  };

  const emptyMsg = QUICK_TABS.find((t) => t.value === activeTab)?.emptyMsg ?? "No items found";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Tabs with counts */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as QuickTab); setSelected(new Set()); }}>
          <TabsList className="h-9 bg-muted/30 border border-border/40 p-0.5 rounded-lg">
            {QUICK_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="h-8 px-3 text-xs rounded-md data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-1.5">
                {tab.label}
                {tabCounts[tab.value] != null && tabCounts[tab.value] > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center rounded-full text-[10px] px-1.5 py-0 min-w-[18px] font-medium",
                    activeTab === tab.value
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tabCounts[tab.value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Search + filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input type="search" placeholder="Search itemsâ€¦" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/20 border-border/50 focus:border-primary/40" />
            {search && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <FilterSheet status={status} priority={priority} type={type} onStatusChange={setStatus} onPriorityChange={setPriority} onTypeChange={setType} onClear={clearFilters} activeCount={activeFilterCount} />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground gap-1" onClick={clearFilters}>
              <X className="size-3" />Clear
            </Button>
          )}
          <Link href="/items/new">
            <Button size="sm" className="gap-1.5 h-9"><Plus className="size-3.5" />New Item</Button>
          </Link>
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {status !== "all" && <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs cursor-pointer" onClick={() => setStatus("all")}>Status: {status.replace(/_/g, " ")}<X className="size-3 ml-0.5" /></Badge>}
            {priority !== "all" && <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs cursor-pointer" onClick={() => setPriority("all")}>Priority: {priority}<X className="size-3 ml-0.5" /></Badge>}
            {type !== "all" && <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 text-xs cursor-pointer" onClick={() => setType("all")}>Type: {type.replace(/_/g, " ")}<X className="size-3 ml-0.5" /></Badge>}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-xs font-medium text-primary">{selected.size} selected</span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                <Button key={p} variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleBulkPriority(p)}>
                  Set {p}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs text-muted-foreground" onClick={() => setSelected(new Set())}>
              Cancel
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20 border-border/60">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                    onCheckedChange={(v) => setSelected(v ? new Set(items.map((i) => i.id)) : new Set())}
                  />
                </TableHead>
                {["ID","Title","Type","Priority","Status","Assignee","Team","Due"].map((h) => (
                  <TableHead key={h} className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableSkeleton /> : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="size-12 rounded-full bg-muted/30 flex items-center justify-center">
                        <Search className="size-5 text-muted-foreground/40" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground/70">
                          {debouncedSearch ? `Nothing matches "${debouncedSearch}"` : activeFilterCount > 0 ? "No items match your filters" : emptyMsg}
                        </p>
                        {activeFilterCount > 0 && <p className="text-xs text-muted-foreground mt-0.5">Try clearing some filters</p>}
                      </div>
                      {activeFilterCount > 0 && <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <ContextMenu key={item.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className={cn(
                          "cursor-pointer border-border/40 transition-colors hover:bg-accent/40",
                          // CRITICAL: left red stripe
                          isCritical(item) && "border-l-2 border-l-red-500",
                          // Overdue: subtle red tint
                          isOverdue(item) && "bg-red-500/[0.03]",
                          selected.has(item.id) && "bg-primary/5"
                        )}
                        onClick={() => router.push(`/items/${item.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                v ? next.add(item.id) : next.delete(item.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[11px] font-mono font-bold text-muted-foreground/70 tracking-wider cursor-default">
                                {shortId(item.id)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-xs font-mono">{item.id}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="max-w-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm font-medium truncate block pr-3 cursor-default">{item.title}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs"><p className="text-xs">{item.title}</p></TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/50 border-border/40 rounded">
                            {item.type.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell><PriorityBadge priority={item.priority} size="sm" /></TableCell>
                        <TableCell><StatusBadge status={item.status} size="sm" /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}><AssigneeCell assignee={item.assignee} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.team.name}</TableCell>
                        <TableCell>
                          {item.dueDate ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn("flex items-center gap-1 text-xs w-fit", isOverdue(item) ? "text-red-400 font-medium" : "text-muted-foreground")}>
                                  {isOverdue(item) ? <CalendarClock className="size-3 shrink-0" /> : <Clock className="size-3 shrink-0" />}
                                  {relativeDue(item.dueDate)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">{new Date(item.dueDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : <span className="text-muted-foreground/25 text-xs">â€”</span>}
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    {/* Right-click context menu */}
                    <ContextMenuContent className="w-48">
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="text-xs">Change Priority</ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          {Priorities.map((p) => (
                            <ContextMenuItem key={p} className="text-xs" onClick={async () => {
                              const res = await fetch(`/api/items/${item.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: (item as any).version ?? 1, priority: p }),
                              });
                              if (res.ok) { const data = await res.json(); setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, priority: data.priority, version: data.version } : i)); toast.success(`Priority set to ${p}`); }
                              else toast.error("Failed to update priority");
                            }}>
                              <PriorityBadge priority={p as Priority} size="sm" />
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                      <ContextMenuItem className="text-xs" onClick={() => { navigator.clipboard.writeText(shortId(item.id)); toast.success("ID copied"); }}>
                        <Copy className="size-3 mr-2" />Copy ID ({shortId(item.id)})
                      </ContextMenuItem>
                      <ContextMenuItem className="text-xs" onClick={() => router.push(`/items/${item.id}`)}>
                        Open item
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {hasMore && (
          <div className="flex justify-center pt-1">
            <Button variant="outline" size="sm" onClick={() => fetchItems(nextCursor!)} disabled={loadingMore} className="gap-2 min-w-[120px]">
              {loadingMore ? <><Loader2 className="size-3.5 animate-spin" />Loadingâ€¦</> : "Load more"}
            </Button>
          </div>
        )}
        {!loading && items.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/50">
            {items.length} item{items.length !== 1 ? "s" : ""}{hasMore ? " â€” more available" : ""}
            {selected.size > 0 && ` Â· ${selected.size} selected`}
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}