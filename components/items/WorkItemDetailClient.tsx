"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";
import {
  ArrowLeft, Send, Pencil, X, Check,
  UserCheck, CalendarIcon, ChevronDown, Info,
  CheckCircle2, AlertTriangle, Lock, ArrowUpCircle,
  UserCog, Users, Shield, Crown, Eye, User,
  Trash2, Copy, CheckCheck, Bell,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  HoverCard, HoverCardContent, HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import { StatusBadge } from "@/components/items/StatusBadge";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { ActivityTimeline, type ActivityEvent } from "@/components/items/ActivityTimeline";
import { getAllowedTransitions } from "@/lib/transitions";
import type { WorkItemStatus, Priority, TeamRole } from "@/generated/prisma/enums";
import { Priorities } from "@/lib/constants";
import { shortId } from "@/lib/shortId";

function makeUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface WorkItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  priority: Priority;
  status: WorkItemStatus;
  version: number;
  teamId: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string } | null;
  team: { id: string; name: string };
  createdBy: { id: string; name: string };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
}

interface ConflictDiffData {
  yours: {
    title: string;
    description: string | null;
    priority: Priority;
    dueDate: string | null;
  };
  theirs: WorkItem;
}

interface Props {
  initialItem: WorkItem;
  initialActivity: ActivityEvent[];
  initialComments: Comment[];
  userId: string;
  userName: string;
  userRole: TeamRole;
}

const WORKFLOW_STEPS: Array<{
  status: WorkItemStatus;
  label: string;
  shortLabel: string;
  activeColor: string;
  doneColor: string;
  lineColor: string;
  textColor: string;
}> = [
  {
    status: "OPEN",
    label: "Open",
    shortLabel: "Open",
    activeColor: "bg-blue-500 ring-4 ring-blue-500/25",
    doneColor:   "bg-blue-500",
    lineColor:   "bg-blue-500",
    textColor:   "text-blue-400",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    shortLabel: "In Progress",
    activeColor: "bg-amber-500 ring-4 ring-amber-500/25",
    doneColor:   "bg-amber-500",
    lineColor:   "bg-amber-500",
    textColor:   "text-amber-400",
  },
  {
    status: "AWAITING_APPROVAL",
    label: "Awaiting Approval",
    shortLabel: "Approval",
    activeColor: "bg-violet-500 ring-4 ring-violet-500/25",
    doneColor:   "bg-violet-500",
    lineColor:   "bg-violet-500",
    textColor:   "text-violet-400",
  },
  {
    status: "RESOLVED",
    label: "Resolved",
    shortLabel: "Resolved",
    activeColor: "bg-emerald-500 ring-4 ring-emerald-500/25",
    doneColor:   "bg-emerald-500",
    lineColor:   "bg-emerald-500",
    textColor:   "text-emerald-400",
  },
  {
    status: "CLOSED",
    label: "Closed",
    shortLabel: "Closed",
    activeColor: "bg-teal-500 ring-4 ring-teal-500/25",
    doneColor:   "bg-teal-500",
    lineColor:   "bg-teal-500",
    textColor:   "text-teal-400",
  },
];

const TRANSITION_CONFIG: Partial<Record<WorkItemStatus, {
  label: string;
  description?: string;
  requiresConfirm?: boolean;
  confirmTitle?: string;
  confirmDesc?: string;
  variant?: "default" | "destructive";
}>> = {
  OPEN:              { label: "Reopen",                description: "Return to open state" },
  IN_PROGRESS:       { label: "Start Working",         description: "Mark as in progress" },
  AWAITING_APPROVAL: { label: "Submit for Approval",   description: "Request lead review" },
  RESOLVED: {
    label: "Approve & Resolve",
    description: "Approve -- Lead or Admin only",
    requiresConfirm: true,
    confirmTitle: "Approve this item?",
    confirmDesc: "This marks the item as Resolved. This action requires Lead or Admin role.",
    variant: "default",
  },
  CLOSED: {
    label: "Close Item",
    description: "Archive -- Lead or Admin only",
    requiresConfirm: true,
    confirmTitle: "Close this item?",
    confirmDesc: "Closing archives the item. You can still reopen it from the Closed state.",
    variant: "destructive",
  },
};

const ROLE_CONFIG: Record<TeamRole, { label: string; Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  VIEWER: { label: "Viewer", Icon: Eye,    cls: "text-slate-400 bg-slate-500/10" },
  MEMBER: { label: "Member", Icon: User,   cls: "text-blue-400 bg-blue-500/10" },
  LEAD:   { label: "Lead",   Icon: Crown,  cls: "text-amber-400 bg-amber-500/10" },
  ADMIN:  { label: "Admin",  Icon: Shield, cls: "text-violet-400 bg-violet-500/10" },
};

const editSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
  dueDate: z.date().optional().nullable(),
});
type EditValues = z.infer<typeof editSchema>;

/* ============================================================
   WorkflowTracker
   ============================================================ */
function WorkflowTracker({ status }: { status: WorkItemStatus }) {
  const currentIdx = WORKFLOW_STEPS.findIndex((s) => s.status === status);
  return (
    <div className="flex items-center w-full overflow-x-auto px-1 py-1 scrollbar-none">
      {WORKFLOW_STEPS.map((step, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture  = idx > currentIdx;
        return (
          <div key={step.status} className="flex items-center flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={cn(
                      "size-5 rounded-full flex items-center justify-center transition-all duration-300",
                      isDone    && step.doneColor,
                      isCurrent && step.activeColor,
                      isFuture  && "bg-muted border-2 border-muted-foreground/20"
                    )}
                  >
                    {isDone ? (
                      <Check className="size-3 text-white" strokeWidth={3} />
                    ) : isCurrent ? (
                      <div className="size-2 rounded-full bg-white" />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-medium whitespace-nowrap hidden sm:block transition-colors",
                      isDone    && step.textColor + " opacity-70",
                      isCurrent && step.textColor + " font-bold",
                      isFuture  && "text-muted-foreground/30"
                    )}
                  >
                    {step.shortLabel}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">{step.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {isDone ? "Completed" : isCurrent ? "Current stage" : "Upcoming"}
                </p>
              </TooltipContent>
            </Tooltip>
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1.5 rounded-full overflow-hidden">
                {isDone ? (
                  <div className={cn("h-full w-full", step.lineColor)} />
                ) : isCurrent ? (
                  <div className="h-full w-full bg-muted-foreground/15">
                    <div className={cn("h-full w-1/2", step.lineColor, "opacity-50")} />
                  </div>
                ) : (
                  <div className="h-full w-full bg-muted-foreground/10" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   AssigneeProfile
   ============================================================ */
function AssigneeProfile({
  assignee, activity, teamName, canEdit, onReassign,
}: {
  assignee: WorkItem["assignee"] | null;
  activity: ActivityEvent[];
  teamName: string;
  canEdit: boolean;
  onReassign?: () => void;
}) {
  if (!assignee) return null;
  const theirEvents = activity.filter((e) => e.actor.id === assignee.id).slice(0, 4);
  return (
    <HoverCard openDelay={300} closeDelay={200}>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer w-fit">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold">
              {assignee.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="text-sm font-medium leading-tight">{assignee.name}</p>
            <p className="text-[11px] text-muted-foreground">Assigned</p>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-0 overflow-hidden" side="left" align="start">
        <div className="p-3 bg-muted/20 border-b border-border/50">
          <div className="flex items-start gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/20 text-primary text-base font-bold">
                {assignee.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{assignee.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-muted-foreground">{teamName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] text-muted-foreground/60">
                  {theirEvents.length} action{theirEvents.length !== 1 ? "s" : ""} on this item
                </span>
              </div>
            </div>
          </div>
        </div>
        {theirEvents.length > 0 && (
          <div className="p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
              Their actions on this item
            </p>
            <div className="space-y-1.5">
              {theirEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <div className="size-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/80 truncate">{e.description}</p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {canEdit && onReassign && (
          <div className="p-2 border-t border-border/50">
            <Button
              variant="ghost" size="sm"
              className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={onReassign}
            >
              <UserCog className="size-3.5" />
              Reassign this item
            </Button>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/* ============================================================
   ReassignDialog
   ============================================================ */
function ReassignDialog({
  open, onClose, teamId, currentAssigneeId, onReassign,
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  currentAssigneeId: string | null;
  onReassign: (userId: string | null) => Promise<void>;
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/teams/" + teamId + "/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .finally(() => setLoading(false));
  }, [open, teamId]);

  const handleSave = async () => {
    setSaving(true);
    await onReassign(selectedId);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Reassign Item
          </DialogTitle>
          <DialogDescription className="text-sm">
            Select a team member to reassign this item to, or unassign it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <button
            onClick={() => setSelectedId(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
              selectedId === null ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-accent/50"
            )}
          >
            <div className="size-8 rounded-full bg-muted/50 flex items-center justify-center">
              <X className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Unassign</p>
              <p className="text-xs text-muted-foreground">Remove current assignee</p>
            </div>
            {selectedId === null && <Check className="size-4 text-primary ml-auto" />}
          </button>
          {loading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading members...</div>
          ) : (
            members.filter((m) => m.role !== "VIEWER").map((m) => {
              const cfg = ROLE_CONFIG[m.role];
              const isSelected = selectedId === m.id;
              const isCurrent  = m.id === currentAssigneeId;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
                    isSelected ? "border-primary/50 bg-primary/5" : "border-border/50 hover:bg-accent/50"
                  )}
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
                      {m.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      {isCurrent && (
                        <span className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">current</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <cfg.Icon className={cn("size-2.5", cfg.cls.split(" ")[0])} />
                      <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="size-4 text-primary ml-auto shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : selectedId ? "Assign to " + (members.find((m) => m.id === selectedId)?.name ?? "member") : "Unassign"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   ConflictDiffDialog  (NEW)
   Shows per-field mine vs theirs on a 409 VERSION_CONFLICT
   ============================================================ */
function ConflictDiffDialog({
  data, itemVersion, itemId, onResolved, onDiscard,
}: {
  data: ConflictDiffData;
  itemVersion: number;
  itemId: string;
  onResolved: (updated: WorkItem) => Promise<void>;
  onDiscard: () => void;
}) {
  type FieldKey = "title" | "description" | "priority" | "dueDate";
  const [selections, setSelections] = useState<Record<FieldKey, "mine" | "theirs">>({
    title: "mine", description: "mine", priority: "mine", dueDate: "mine",
  });
  const [saving, setSaving] = useState(false);

  const fields: Array<{ key: FieldKey; label: string; yours: string; theirs: string; differs: boolean }> = [
    {
      key: "title", label: "Title",
      yours: data.yours.title, theirs: data.theirs.title,
      differs: data.yours.title !== data.theirs.title,
    },
    {
      key: "description", label: "Description",
      yours: data.yours.description ?? "(no description)",
      theirs: data.theirs.description ?? "(no description)",
      differs: (data.yours.description ?? "") !== (data.theirs.description ?? ""),
    },
    {
      key: "priority", label: "Priority",
      yours: data.yours.priority, theirs: data.theirs.priority,
      differs: data.yours.priority !== data.theirs.priority,
    },
    {
      key: "dueDate", label: "Due Date",
      yours: data.yours.dueDate ? new Date(data.yours.dueDate).toLocaleDateString() : "No date",
      theirs: data.theirs.dueDate ? new Date(data.theirs.dueDate).toLocaleDateString() : "No date",
      differs: data.yours.dueDate !== data.theirs.dueDate,
    },
  ];

  const diffFields = fields.filter((f) => f.differs);

  const handleSaveMerged = async () => {
    setSaving(true);
    try {
      const body = {
        version: itemVersion,
        title:       selections.title       === "mine" ? data.yours.title       : data.theirs.title,
        description: selections.description === "mine" ? data.yours.description : data.theirs.description,
        priority:    selections.priority    === "mine" ? data.yours.priority    : data.theirs.priority,
        dueDate:     selections.dueDate     === "mine" ? data.yours.dueDate     : data.theirs.dueDate,
      };
      const res = await fetch("/api/items/" + itemId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const updated = await res.json();
      if (!res.ok) { toast.error(updated.error ?? "Failed to save merged changes"); return; }
      await onResolved(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onDiscard()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-400" />
            Version Conflict
          </DialogTitle>
          <DialogDescription>
            This item was modified while you were editing. Choose which version to keep for each changed field, then save.
          </DialogDescription>
        </DialogHeader>

        {diffFields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No field differences found.</p>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-1">
              {diffFields.map((f) => (
                <div key={f.key} className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/30 border-b border-border/50">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {f.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/50">
                    <button
                      type="button"
                      className={cn(
                        "p-3 text-left transition-colors",
                        selections[f.key] === "mine"
                          ? "bg-amber-500/10 hover:bg-amber-500/15"
                          : "hover:bg-muted/20"
                      )}
                      onClick={() => setSelections((s) => ({ ...s, [f.key]: "mine" }))}
                    >
                      <p className="text-[10px] text-muted-foreground/60 mb-1.5 flex items-center gap-1">
                        {selections[f.key] === "mine" && <Check className="size-2.5 text-amber-400" />}
                        Your version
                      </p>
                      <p className="text-xs break-words line-clamp-4">{f.yours}</p>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "p-3 text-left transition-colors",
                        selections[f.key] === "theirs"
                          ? "bg-blue-500/10 hover:bg-blue-500/15"
                          : "hover:bg-muted/20"
                      )}
                      onClick={() => setSelections((s) => ({ ...s, [f.key]: "theirs" }))}
                    >
                      <p className="text-[10px] text-muted-foreground/60 mb-1.5 flex items-center gap-1">
                        {selections[f.key] === "theirs" && <Check className="size-2.5 text-blue-400" />}
                        Current version
                      </p>
                      <p className="text-xs break-words line-clamp-4">{f.theirs}</p>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex gap-2 pt-2 border-t border-border/50">
          <Button className="flex-1" onClick={handleSaveMerged} disabled={saving}>
            {saving ? "Saving..." : "Save selected"}
          </Button>
          <Button variant="outline" onClick={onDiscard} disabled={saving}>Keep current</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Main Component
   ============================================================ */
export default function WorkItemDetailClient({
  initialItem,
  initialActivity,
  initialComments,
  userId,
  userName,
  userRole,
}: Props) {
  const router = useRouter();

  // Core state
  const [item, setItem]         = useState<WorkItem>(initialItem);
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [conflict, setConflict] = useState<string | null>(null);
  const [conflictDiff, setConflictDiff] = useState<ConflictDiffData | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [metaOpen, setMetaOpen] = useState(true);

  // New UX state
  const [copiedId, setCopiedId] = useState(false);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try { return sessionStorage.getItem("detail_tab_" + initialItem.id) ?? "details"; }
      catch { return "details"; }
    }
    return "details";
  });

  // Dialogs
  const [pendingTransition, setPendingTransition] = useState<WorkItemStatus | null>(null);
  const [showReassign, setShowReassign]           = useState(false);
  const [showEscalate, setShowEscalate]           = useState(false);

  const commentKey    = useRef(makeUUID());
  const activeTabRef  = useRef(activeTab);
  activeTabRef.current = activeTab;

  // Stable ref for keyboard shortcut handler (avoids re-registering on every render)
  const kbRef = useRef({
    editing: false,
    canClaim: false,
    canEdit: false,
    claiming: false,
    handleClaim: async () => {},
  });

  // Derived
  const canEdit     = userRole !== "VIEWER";
  const canLead     = userRole === "LEAD" || userRole === "ADMIN";
  const canClaim    = !item.assignee && item.status === "OPEN" && canEdit;
  const canEscalate = canLead && item.priority !== "CRITICAL" && !["CLOSED"].includes(item.status);
  const isOverdue   = item.dueDate &&
    new Date(item.dueDate) < new Date() &&
    !["RESOLVED", "CLOSED"].includes(item.status);
  const allowedTransitions = getAllowedTransitions(item.status, userRole);
  const itemShortId = shortId(item.id);

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title:       item.title,
      description: item.description ?? "",
      priority:    item.priority,
      dueDate:     item.dueDate ? new Date(item.dueDate) : null,
    },
  });

  useEffect(() => {
    if (!editing) {
      editForm.reset({
        title:       item.title,
        description: item.description ?? "",
        priority:    item.priority,
        dueDate:     item.dueDate ? new Date(item.dueDate) : null,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, editing]);

  /* ---- beforeunload guard ------------------------------------------ */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (editing) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing]);

  /* ---- Activity polling with notification dot ----------------------- */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/items/" + item.id + "/activity");
        if (res.ok) {
          const data = await res.json();
          const incoming: ActivityEvent[] = data.events;
          setActivity((prev) => {
            if (incoming.length > prev.length && activeTabRef.current !== "activity") {
              setNewActivityCount((c) => c + (incoming.length - prev.length));
            }
            return incoming;
          });
        }
      } catch { /* ignore polling errors */ }
    }, 15_000);
    return () => clearInterval(id);
  }, [item.id]);

  /* ---- Keyboard shortcuts (registered once via ref) ----------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { editing: ed, canClaim: cc, canEdit: ce, claiming: cl, handleClaim: hc } = kbRef.current;
      const tag    = (document.activeElement as HTMLElement)?.tagName ?? "";
      const inInput = tag === "INPUT" || tag === "TEXTAREA" ||
        Boolean((document.activeElement as HTMLElement)?.isContentEditable);
      if (e.key === "Escape" && ed) { setEditing(false); setConflict(null); return; }
      if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === "k" || e.key === "K") && cc && !cl) { e.preventDefault(); hc(); }
      else if ((e.key === "e" || e.key === "E") && ce && !ed) { e.preventDefault(); setEditing(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []); // stable -- reads from kbRef

  /* ---- refreshActivity --------------------------------------------- */
  const refreshActivity = async () => {
    try {
      const res = await fetch("/api/items/" + item.id + "/activity");
      if (res.ok) setActivity((await res.json()).events);
    } catch { /* ignore */ }
  };

  /* ---- Tab change --------------------------------------------------- */
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    try { sessionStorage.setItem("detail_tab_" + item.id, value); } catch { /* ignore */ }
    if (value === "activity") setNewActivityCount(0);
  };

  /* ---- Copy ID ------------------------------------------------------ */
  const handleCopyId = () => {
    navigator.clipboard.writeText(itemShortId)
      .then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); })
      .catch(() => toast.error("Failed to copy"));
  };

  /* ---- Claim -------------------------------------------------------- */
  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res  = await fetch("/api/items/" + item.id + "/claim", { method: "POST" });
      const data = await res.json();
      if (res.status === 409) {
        toast.error("Already claimed by " + (data.currentItem?.assignee?.name ?? "someone"));
        if (data.currentItem) setItem(data.currentItem);
        return;
      }
      if (!res.ok) { toast.error(data.error ?? "Failed to claim"); return; }
      setItem(data);
      toast.success("Item claimed");
      await refreshActivity();
    } finally { setClaiming(false); }
  };

  // Keep kbRef in sync every render (before effects fire)
  kbRef.current = { editing, canClaim, canEdit, claiming, handleClaim };

  /* ---- Transition (optimistic) ------------------------------------- */
  const doTransition = async (toStatus: WorkItemStatus) => {
    const prevItem = item;
    setItem((prev) => ({ ...prev, status: toStatus })); // optimistic update
    try {
      const res = await fetch("/api/items/" + item.id + "/transition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus, version: item.version }),
      });
      const data = await res.json();
      if (res.status === 403) { setItem(prevItem); toast.error(data.message ?? "Insufficient role"); return; }
      if (res.status === 422) { setItem(prevItem); toast.error(data.message ?? "Invalid transition"); return; }
      if (res.status === 409) {
        toast.error("Version conflict -- showing latest");
        setItem(data.currentItem ?? prevItem);
        return;
      }
      if (!res.ok) { setItem(prevItem); toast.error("Failed to update status"); return; }
      setItem(data);
      await refreshActivity();
      toast.success("Status -> " + toStatus.replace(/_/g, " "));
    } catch { setItem(prevItem); toast.error("Network error"); }
  };

  const handleTransitionClick = (toStatus: WorkItemStatus) => {
    const cfg = TRANSITION_CONFIG[toStatus];
    if (cfg?.requiresConfirm) setPendingTransition(toStatus);
    else doTransition(toStatus);
  };

  /* ---- Escalate ----------------------------------------------------- */
  const handleEscalate = async () => {
    const res  = await fetch("/api/items/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: item.version, priority: "CRITICAL" }),
    });
    const data = await res.json();
    if (res.status === 409) {
      toast.error("Version conflict -- please refresh");
      if (data.currentItem) setItem(data.currentItem);
      return;
    }
    if (!res.ok) { toast.error(data.error ?? "Failed to escalate"); return; }
    setItem(data);
    await refreshActivity();
    toast.success("Item escalated to CRITICAL priority");
  };

  /* ---- Reassign ----------------------------------------------------- */
  const handleReassign = async (newAssigneeId: string | null) => {
    const res  = await fetch("/api/items/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: item.version, assigneeId: newAssigneeId }),
    });
    const data = await res.json();
    if (res.status === 409) {
      toast.error("Version conflict");
      if (data.currentItem) setItem(data.currentItem);
      return;
    }
    if (!res.ok) { toast.error(data.error ?? "Failed to reassign"); return; }
    setItem(data);
    await refreshActivity();
    toast.success(newAssigneeId ? "Item reassigned" : "Item unassigned");
  };

  /* ---- Save edits (with conflict diff on 409) ----------------------- */
  const handleSave = async (values: EditValues) => {
    const res = await fetch("/api/items/" + item.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version:     item.version,
        title:       values.title,
        description: values.description || null,
        priority:    values.priority,
        dueDate:     values.dueDate ? values.dueDate.toISOString() : null,
      }),
    });
    const data = await res.json();
    if (res.status === 409) {
      if (data.currentItem) {
        setConflictDiff({
          yours: {
            title:       values.title,
            description: values.description ?? null,
            priority:    values.priority,
            dueDate:     values.dueDate ? values.dueDate.toISOString() : null,
          },
          theirs: data.currentItem,
        });
        setItem(data.currentItem);
      } else {
        setConflict("concurrently modified");
      }
      setEditing(false);
      return;
    }
    if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
    setItem(data);
    setEditing(false);
    setConflict(null);
    await refreshActivity();
    toast.success("Changes saved");
  };

  /* ---- Comment (post) ----------------------------------------------- */
  const handleComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/items/" + item.id + "/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": commentKey.current,
        },
        body: JSON.stringify({ content: commentText }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to post comment"); return; }
      setComments((p) => [...p, data]);
      setCommentText("");
      commentKey.current = makeUUID();
      await refreshActivity();
    } finally { setSubmitting(false); }
  };

  /* ---- Comment (delete own) ----------------------------------------- */
  const handleDeleteComment = async (commentId: string) => {
    setDeletingComment(commentId);
    try {
      const res = await fetch("/api/items/" + item.id + "/comments/" + commentId, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Failed to delete comment");
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
      await refreshActivity();
    } finally { setDeletingComment(null); }
  };

  /* ================================================================
     RENDER
     ================================================================ */
  return (
    <TooltipProvider>
      <div className="flex flex-col -m-6" style={{ height: "calc(100vh - 56px)" }}>

        {/* ---- Top bar ---------------------------------------------- */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-card shrink-0">
          <Button
            variant="ghost" size="sm"
            className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (editing && !window.confirm("You have unsaved changes. Leave anyway?")) return;
              router.back();
            }}
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-4" />

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Short ID badge with copy-on-hover */}
            <div className="group flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="font-mono text-[11px] px-2 py-0.5 cursor-default tracking-wider"
                  >
                    {itemShortId}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-[11px] font-mono text-muted-foreground">{item.id}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="size-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                    onClick={handleCopyId}
                  >
                    {copiedId
                      ? <CheckCheck className="size-2.5 text-emerald-400" />
                      : <Copy className="size-2.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{copiedId ? "Copied!" : "Copy ID"}</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-3.5 shrink-0" />
            <p className="text-sm truncate font-medium">{item.title}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={item.priority} size="sm" />
            <StatusBadge status={item.status} size="sm" />
            {/* Keyboard hint */}
            {(canClaim || canEdit) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground/40 font-mono cursor-default hidden lg:inline">
                    {[canClaim ? "K" : "", canEdit ? "E" : ""].filter(Boolean).join(" ")}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="text-xs space-y-1">
                    {canClaim && (
                      <p><kbd className="bg-muted px-1 rounded text-[10px]">K</kbd> Claim item</p>
                    )}
                    {canEdit && (
                      <p><kbd className="bg-muted px-1 rounded text-[10px]">E</kbd> Edit item</p>
                    )}
                    <p><kbd className="bg-muted px-1 rounded text-[10px]">Esc</kbd> Cancel edit</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ---- Workflow tracker ------------------------------------- */}
        <div className="px-5 pt-3 pb-2.5 border-b border-border/50 bg-card shrink-0">
          <WorkflowTracker status={item.status} />
        </div>

        {/* ---- Conflict banner (for non-save conflicts) ------------- */}
        {conflict && (
          <Alert className="mx-5 mt-3 border-amber-500/30 bg-amber-500/10 shrink-0 relative">
            <AlertTriangle className="size-4 text-amber-400" />
            <AlertDescription className="text-xs text-amber-300">
              <strong>Version conflict:</strong> This item was modified ({conflict}).
              The latest version is shown.
            </AlertDescription>
            <Button
              variant="ghost" size="icon"
              className="absolute right-2 top-2 size-6 text-amber-400/60 hover:text-amber-300"
              onClick={() => setConflict(null)}
            >
              <X className="size-3" />
            </Button>
          </Alert>
        )}

        {/* ---- Main split ------------------------------------------- */}
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT: content + comments */}
          <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5 border-r border-border">

            {/* Title/description */}
            {editing ? (
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleSave)} className="space-y-4">
                  <FormField control={editForm.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Title</FormLabel>
                      <FormControl>
                        <Input {...field} className="text-sm font-medium" autoFocus />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Add a description..."
                          className="text-sm resize-none min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={editForm.control} name="priority" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Priority</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Priorities.map((p) => (
                              <SelectItem key={p} value={p} className="text-sm">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Due Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full h-9 justify-start text-left font-normal text-sm",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 size-3.5" />
                                {field.value ? format(field.value, "PP") : "No date"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value ?? undefined}
                              onSelect={field.onChange}
                            />
                            {field.value && (
                              <div className="border-t p-2 flex justify-end">
                                <Button
                                  variant="ghost" size="sm" className="text-xs h-7"
                                  onClick={() => field.onChange(null)}
                                >
                                  Clear date
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit" size="sm" className="gap-1.5"
                      disabled={editForm.formState.isSubmitting}
                    >
                      <Check className="size-3.5" />
                      {editForm.formState.isSubmitting ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      type="button" size="sm" variant="ghost"
                      className="text-muted-foreground gap-1.5"
                      onClick={() => { setEditing(false); setConflict(null); }}
                    >
                      <X className="size-3.5" />Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="group relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold leading-snug">{item.title}</h2>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                        {item.description}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground/30 mt-2 italic">No description</p>
                    )}
                  </div>
                  {canEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="size-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                          onClick={() => setEditing(true)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit item (E)</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comments</h3>
                {comments.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{comments.length}</Badge>
                )}
              </div>
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground/40 italic py-2">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5 group/comment">
                  <Avatar className="size-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
                      {c.author.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold">{c.author.name}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[11px] text-muted-foreground cursor-default">
                            {new Date(c.createdAt).toLocaleDateString(undefined, {
                              month: "short", day: "numeric",
                            })}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{new Date(c.createdAt).toLocaleString()}</TooltipContent>
                      </Tooltip>
                      {/* Delete button -- own comments only */}
                      {c.author.id === userId && (
                        <div className="ml-auto opacity-0 group-hover/comment:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost" size="icon"
                                className="size-5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteComment(c.id)}
                                disabled={deletingComment === c.id}
                              >
                                {deletingComment === c.id
                                  ? <span className="text-[9px]">...</span>
                                  : <Trash2 className="size-3" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete comment</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  </div>
                </div>
              ))}
              {canEdit && (
                <div className="flex gap-2.5 pt-1">
                  <Avatar className="size-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment... (Ctrl+Enter to post)"
                      className="text-sm resize-none min-h-[80px] bg-muted/20 border-border/40"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment();
                      }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/40">Ctrl+Enter to post</span>
                      <Button
                        size="sm" onClick={handleComment}
                        disabled={submitting || !commentText.trim()}
                        className="gap-1.5 h-8"
                      >
                        <Send className="size-3.5" />
                        {submitting ? "Posting..." : "Comment"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Sidebar with Tabs */}
          <div className="w-[300px] xl:w-[320px] shrink-0 bg-card border-l border-border">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
              <TabsList className="w-full rounded-none border-b border-border bg-transparent px-2 pt-2 h-10 justify-start gap-1 shrink-0">
                <TabsTrigger value="details" className="text-xs h-8 px-3 rounded-md data-[state=active]:bg-muted">
                  Details
                </TabsTrigger>
                <TabsTrigger value="activity" className="relative text-xs h-8 px-3 rounded-md data-[state=active]:bg-muted">
                  Activity
                  {activity.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                      {activity.length}
                    </Badge>
                  )}
                  {/* Notification dot */}
                  {newActivityCount > 0 && activeTab !== "activity" && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-blue-500" />
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Details tab */}
              <TabsContent value="details" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-5">

                    <Collapsible open={metaOpen} onOpenChange={setMetaOpen}>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center justify-between w-full text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors">
                          <span>Item Details</span>
                          <ChevronDown className={cn("size-3.5 transition-transform duration-200", metaOpen && "rotate-180")} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Status</span>
                              <StatusBadge status={item.status} size="sm" />
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Priority</span>
                              <PriorityBadge priority={item.priority} size="sm" />
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Team</span>
                              <span className="font-medium">{item.team.name}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Type</span>
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {item.type.replace(/_/g, " ")}
                              </Badge>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Created</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">
                                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                                      month: "short", day: "numeric",
                                    })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{new Date(item.createdAt).toLocaleString()}</TooltipContent>
                              </Tooltip>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Updated</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">
                                    {new Date(item.updatedAt).toLocaleDateString(undefined, {
                                      month: "short", day: "numeric",
                                    })}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{new Date(item.updatedAt).toLocaleString()}</TooltipContent>
                              </Tooltip>
                            </div>
                            {item.dueDate && (
                              <div className="col-span-2">
                                <span className="text-muted-foreground/60 block mb-1">Due date</span>
                                <span className={cn("font-medium", isOverdue && "text-red-400")}>
                                  {new Date(item.dueDate).toLocaleDateString(undefined, {
                                    weekday: "short", month: "short", day: "numeric",
                                  })}
                                  {isOverdue && (
                                    <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                                      Overdue
                                    </Badge>
                                  )}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Item ID</span>
                              <span className="font-mono font-bold text-xs tracking-wider">{itemShortId}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60 block mb-1">Version</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="font-mono text-xs cursor-default">v{item.version}</span>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Optimistic lock version</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Separator />

                    {/* Assignee */}
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60 mb-2">Assignee</p>
                      {item.assignee ? (
                        <AssigneeProfile
                          assignee={item.assignee}
                          activity={activity}
                          teamName={item.team.name}
                          canEdit={canLead}
                          onReassign={() => setShowReassign(true)}
                        />
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground/50 italic">Unassigned</p>
                          {canClaim && (
                            <Button
                              variant="outline" size="sm"
                              className="w-full h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                              onClick={handleClaim}
                              disabled={claiming}
                            >
                              <UserCheck className="size-3.5" />
                              {claiming ? "Claiming..." : "Claim this item (K)"}
                            </Button>
                          )}
                          {canLead && (
                            <Button
                              variant="outline" size="sm"
                              className="w-full h-8 text-xs gap-1.5 border-border/50 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowReassign(true)}
                            >
                              <Users className="size-3.5" />
                              Assign to team member
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Workflow actions */}
                    {(allowedTransitions.length > 0 || canEscalate || canLead) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Actions</p>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="size-3 text-muted-foreground/40 cursor-default" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs">
                              Workflow transitions and escalation are server-enforced with role checks.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="space-y-1.5">
                          {allowedTransitions.map((toStatus) => {
                            const cfg = TRANSITION_CONFIG[toStatus];
                            const isDestructive = cfg?.variant === "destructive";
                            const isApprove     = toStatus === "RESOLVED";
                            return (
                              <Tooltip key={toStatus}>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline" size="sm"
                                    className={cn(
                                      "w-full h-9 text-xs justify-start gap-2 font-normal transition-colors",
                                      isDestructive
                                        ? "hover:border-destructive/50 hover:text-destructive hover:bg-destructive/5"
                                        : isApprove
                                        ? "hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5"
                                        : "hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                                    )}
                                    onClick={() => handleTransitionClick(toStatus)}
                                  >
                                    {isDestructive
                                      ? <Lock className="size-3.5 opacity-60" />
                                      : isApprove
                                      ? <CheckCircle2 className="size-3.5 opacity-60" />
                                      : <span className="opacity-40">{"->"}</span>}
                                    {cfg?.label ?? toStatus.replace(/_/g, " ")}
                                  </Button>
                                </TooltipTrigger>
                                {cfg?.description && (
                                  <TooltipContent side="left">
                                    <p className="text-xs">{cfg.description}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            );
                          })}

                          {canEscalate && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline" size="sm"
                                  className="w-full h-9 text-xs justify-start gap-2 font-normal hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                                  onClick={() => setShowEscalate(true)}
                                >
                                  <ArrowUpCircle className="size-3.5 opacity-60" />
                                  Escalate to Critical
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">Sets priority to CRITICAL and notifies the team</p>
                              </TooltipContent>
                            </Tooltip>
                          )}

                          {canLead && item.assignee && (
                            <Button
                              variant="outline" size="sm"
                              className="w-full h-9 text-xs justify-start gap-2 font-normal text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setShowReassign(true)}
                            >
                              <UserCog className="size-3.5 opacity-60" />
                              Reassign
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Activity tab */}
              <TabsContent value="activity" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {/* New activity banner */}
                    {newActivityCount > 0 && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="size-3.5 text-blue-400" />
                          <span className="text-xs text-blue-400 font-medium">
                            {newActivityCount} new event{newActivityCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="h-6 px-2 text-[11px] text-blue-400 hover:text-blue-300"
                          onClick={() => setNewActivityCount(0)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                    <ActivityTimeline events={activity} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* ---- Confirm transition AlertDialog --------------------------- */}
      {pendingTransition && (() => {
        const cfg = TRANSITION_CONFIG[pendingTransition]!;
        return (
          <AlertDialog open onOpenChange={(open) => !open && setPendingTransition(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  {cfg.variant === "destructive"
                    ? <AlertTriangle className="size-5 text-destructive" />
                    : <CheckCircle2 className="size-5 text-emerald-400" />}
                  {cfg.confirmTitle}
                </AlertDialogTitle>
                <AlertDialogDescription>{cfg.confirmDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={cfg.variant === "destructive"
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"}
                  onClick={() => { doTransition(pendingTransition); setPendingTransition(null); }}
                >
                  {cfg.label}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}

      {/* ---- Escalate AlertDialog ------------------------------------ */}
      <AlertDialog open={showEscalate} onOpenChange={setShowEscalate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="size-5 text-red-400" />
              Escalate to Critical?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This sets the priority to <strong>CRITICAL</strong> and records an escalation event.
              Use this when the item requires immediate attention.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { handleEscalate(); setShowEscalate(false); }}
            >
              Escalate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---- Reassign Dialog ----------------------------------------- */}
      <ReassignDialog
        open={showReassign}
        onClose={() => setShowReassign(false)}
        teamId={item.teamId}
        currentAssigneeId={item.assignee?.id ?? null}
        onReassign={handleReassign}
      />

      {/* ---- Conflict Diff Dialog (409 on save) ----------------------- */}
      {conflictDiff && (
        <ConflictDiffDialog
          data={conflictDiff}
          itemVersion={item.version}
          itemId={item.id}
          onResolved={async (updated) => {
            setItem(updated);
            setConflictDiff(null);
            await refreshActivity();
            toast.success("Merged changes saved");
          }}
          onDiscard={() => setConflictDiff(null)}
        />
      )}
    </TooltipProvider>
  );
}