import { cn } from "@/components/ui/utils";
import type { Priority } from "@/generated/prisma/enums";

interface PriorityConfig {
  label: string;
  dotClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export const priorityConfig: Record<Priority, PriorityConfig> = {
  LOW: {
    label: "Low",
    dotClass: "bg-slate-400",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
  MEDIUM: {
    label: "Medium",
    dotClass: "bg-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-900/20",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800",
  },
  HIGH: {
    label: "High",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-900/20",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  CRITICAL: {
    label: "Critical",
    dotClass: "bg-red-500",
    bgClass: "bg-red-50 dark:bg-red-900/20",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-red-200 dark:border-red-800",
  },
};

interface PriorityBadgeProps {
  priority: Priority;
  size?: "sm" | "default" | "lg";
  showDot?: boolean;
}

export function PriorityBadge({
  priority,
  size = "default",
  showDot = true,
}: PriorityBadgeProps) {
  const cfg = priorityConfig[priority];
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

