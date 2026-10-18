import { cn } from "@/components/ui/utils";
import type { WorkItemStatus } from "@/generated/prisma/enums";

interface StatusConfig {
  label: string;
  dotClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const statusConfig: Record<WorkItemStatus, StatusConfig> = {
  OPEN: {
    label: "Open",
    dotClass: "bg-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  AWAITING_APPROVAL: {
    label: "Awaiting Approval",
    dotClass: "bg-violet-500",
    bgClass: "bg-violet-50 dark:bg-violet-900/20",
    textClass: "text-violet-700 dark:text-violet-400",
    borderClass: "border-violet-200 dark:border-violet-800",
  },
  RESOLVED: {
    label: "Resolved",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/20",
    textClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-800",
  },
  CLOSED: {
    label: "Closed",
    dotClass: "bg-slate-400",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
};

interface StatusBadgeProps {
  status: WorkItemStatus;
  size?: "sm" | "default" | "lg";
  showDot?: boolean;
}

export function StatusBadge({ status, size = "default", showDot = true }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 select-none",
        cfg.bgClass,
        cfg.textClass,
        cfg.borderClass,
        size === "sm" && "px-2 py-px text-[11px]",
        size === "default" && "text-xs",
        size === "lg" && "px-3 py-1 text-sm"
      )}
    >
      {showDot && (
        <span
          className={cn(
            "inline-block rounded-full shrink-0",
            cfg.dotClass,
            size === "sm" ? "size-1" : "size-1.5"
          )}
        />
      )}
      {cfg.label}
    </span>
  );
}

