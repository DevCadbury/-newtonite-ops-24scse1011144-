"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Moon, Sun, Search } from "lucide-react";
import { useTheme } from "@/components/shared/Providers";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "@/components/shared/CommandPalette";
import type { SessionPayload } from "@/lib/auth";

interface AppTopbarProps {
  user: SessionPayload;
}

/** Map pathname segments to breadcrumb labels */
function useBreadcrumbs(pathname: string) {
  const crumbs: Array<{ label: string; href: string; current: boolean }> = [];

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    crumbs.push({ label: "Dashboard", href: "/", current: true });
    return crumbs;
  }

  const segmentLabels: Record<string, string> = {
    items: "Work Items",
    teams: "Teams",
    activity: "Activity",
    new: "New Item",
  };

  // Always start with home
  crumbs.push({ label: "Home", href: "/", current: false });

  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const href = "/" + parts.slice(0, i + 1).join("/");
    const isLast = i === parts.length - 1;

    // Detect cuid-like IDs (item detail)
    const isId = seg.length > 10 && !/^[a-z]+$/.test(seg);
    const label = isId ? `#${seg.slice(-6)}` : (segmentLabels[seg] ?? seg);

    crumbs.push({ label, href, current: isLast });
  }

  return crumbs;
}

export default function AppTopbar({ user }: AppTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  const isDark = mounted ? theme === "dark" : true;
  const crumbs = useBreadcrumbs(pathname);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-4 shrink-0">
      {/* Breadcrumb */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.href}>
                {idx > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.current ? (
                    <BreadcrumbPage className="text-sm font-medium text-foreground">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Command palette trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Simulate Ctrl+K to open the palette
            document.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
            );
          }}
          className="hidden sm:flex gap-2 h-8 px-3 text-xs text-muted-foreground border-border/60 bg-muted/30 hover:bg-muted/60"
        >
          <Search className="size-3.5" />
          <span>Search</span>
          <kbd className="ml-1 inline-flex h-5 items-center rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] text-muted-foreground/70">
            ⌘K
          </kbd>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="size-9 text-muted-foreground hover:text-foreground"
          suppressHydrationWarning
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 h-9 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start text-left">
                <span className="text-xs font-medium leading-tight">{user?.name}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">{user?.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-sm text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Global command palette (renders its own Dialog) */}
      <CommandPalette />
    </header>
  );
}
