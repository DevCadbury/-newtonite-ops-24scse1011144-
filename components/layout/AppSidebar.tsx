"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Activity,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { SessionPayload } from "@/lib/auth";

interface AppSidebarProps {
  user: SessionPayload;
}

const navSections: Array<{
  label: string;
  items: Array<{
    path: string;
    label: string;
    icon: React.ComponentType<any>;
    exact?: boolean;
    tooltip: string;
  }>;
}> = [
  {
    label: "Overview",
    items: [
      { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, tooltip: "Operations overview" },
    ],
  },
  {
    label: "Work",
    items: [
      { path: "/items", label: "Work Items", icon: ListChecks, tooltip: "All work items" },
    ],
  },
  {
    label: "Admin",
    items: [
      { path: "/teams", label: "Teams", icon: Users, tooltip: "Team memberships" },
      { path: "/activity", label: "Activity", icon: Activity, tooltip: "System activity log" },
    ],
  },
];

export default function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleSidebar } = useSidebar();

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return pathname === path;
    return pathname === path || (path !== "/" && pathname.startsWith(path));
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    /* Use the dedicated sidebar surface (#151C2C dark) */
    <aside
      className={cn(
        "flex flex-col border-r shrink-0 transition-all duration-200 ease-in-out",
        "bg-[var(--sidebar)] border-[var(--sidebar-border)]",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Logo / collapse toggle */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-[var(--sidebar-border)] shrink-0",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary">
              <Zap className="size-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium tracking-tight text-[var(--sidebar-foreground)]">
              Newtonite Ops
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="size-7 shrink-0 text-[var(--muted-foreground)] hover:text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <TooltipProvider delayDuration={0}>
          {navSections.map((section, sIdx) => (
            <div key={section.label} className={cn(sIdx > 0 && "mt-1")}>
              {!collapsed && sIdx > 0 && (
                <Separator className="mx-3 mb-2 bg-[var(--sidebar-border)]" />
              )}
              {!collapsed && (
                <div className="px-4 py-1.5">
                  <span className="text-[10px] tracking-widest uppercase text-[var(--muted-foreground)] opacity-60">
                    {section.label}
                  </span>
                </div>
              )}
              {collapsed && sIdx > 0 && (
                <Separator className="mx-2 my-1 bg-[var(--sidebar-border)]" />
              )}
              <div className="space-y-0.5 px-2">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path, item.exact);

                  const linkContent = (
                    <Link
                      href={item.path}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
                        collapsed && "justify-center px-0 py-2",
                        active
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-[var(--muted-foreground)]"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          <span className="text-xs">{item.label}</span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return <div key={item.path}>{linkContent}</div>;
                })}
              </div>
            </div>
          ))}
        </TooltipProvider>
      </nav>

      {/* User + Sign out */}
      <div className="border-t border-[var(--sidebar-border)] p-2 shrink-0">
        <TooltipProvider delayDuration={0}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-medium">
                  {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--sidebar-foreground)] truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] truncate">{user.email}</p>
              </div>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]",
                  "text-[var(--muted-foreground)] transition-colors duration-150",
                  "hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-foreground)]",
                  collapsed && "justify-center px-0 py-2"
                )}
              >
                <LogOut className="size-4 shrink-0" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" sideOffset={8}>
                <span className="text-xs">Sign out</span>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
}
