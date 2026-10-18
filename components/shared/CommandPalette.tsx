"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, ListChecks, Users, Activity, Plus,
  Hash, ArrowRight, Loader2, Keyboard,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { StatusBadge } from "@/components/items/StatusBadge";
import { PriorityBadge } from "@/components/items/PriorityBadge";
import { shortId } from "@/lib/shortId";
import { cn } from "@/components/ui/utils";
import type { WorkItemStatus, Priority } from "@/generated/prisma/enums";

interface SearchResult {
  id: string;
  title: string;
  status: WorkItemStatus;
  priority: Priority;
  team: { name: string };
}

const STATIC_PAGES = [
  { label: "Dashboard",    href: "/",          icon: LayoutDashboard, kbd: "D" },
  { label: "Work Items",   href: "/items",     icon: ListChecks,      kbd: "I" },
  { label: "Teams",        href: "/teams",     icon: Users,           kbd: "T" },
  { label: "Activity Log", href: "/activity",  icon: Activity,        kbd: "L" },
  { label: "New Item",     href: "/items/new", icon: Plus,            kbd: "N" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  /* Open on Cmd+K / Ctrl+K */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  /* Debounced item search */
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/items?q=${encodeURIComponent(query)}&limit=7`);
        if (res.ok) setResults((await res.json()).items ?? []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  }, [router]);

  const handleClose = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      {/* Overlay */}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />

        {/* 
          Command palette content — positioned at top-center like VS Code / Linear.
          Uses top-[8vh] instead of top-[50%] so it never gets clipped at the top.
          translate-y-0 instead of translate-y-[-50%] removes the upward shift.
        */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 z-50 -translate-x-1/2",
            "top-[8vh]",             // ← top-anchored, not center
            "translate-y-0",         // ← no upward shift
            "w-full max-w-2xl",
            "overflow-hidden rounded-xl border border-border/60",
            "bg-popover shadow-2xl shadow-black/40",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=open]:slide-in-from-top-4",
            "duration-150"
          )}
        >
          {/* Visually hidden title for accessibility */}
          <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search for items or navigate pages. Press Escape to close.
          </DialogPrimitive.Description>

          <Command className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
            {/* Search input */}
            <div className="flex items-center gap-2 px-4 border-b border-border/50 h-14">
              <CommandInput
                placeholder="Search items or jump to a page…"
                value={query}
                onValueChange={setQuery}
                className="flex-1 h-full bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0"
              />
              <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border border-border/40 bg-muted/40 px-2 font-mono text-[11px] text-muted-foreground/60">
                Esc
              </kbd>
            </div>

            {/* Results list — max-height ensures it doesn't go off screen */}
            <CommandList className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
              <CommandEmpty>
                {searching ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Searching…
                  </div>
                ) : query.length > 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">No items match "{query}"</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">Try a different search term</p>
                  </div>
                ) : null}
              </CommandEmpty>

              {/* Page navigation — shown when no query */}
              {!query && (
                <CommandGroup heading="Navigate">
                  {STATIC_PAGES.map((page) => {
                    const Icon = page.icon;
                    return (
                      <CommandItem
                        key={page.href}
                        value={page.label}
                        onSelect={() => navigate(page.href)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                      >
                        <div className="flex size-7 items-center justify-center rounded-md bg-muted/50">
                          <Icon className="size-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium">{page.label}</span>
                        <CommandShortcut className="ml-auto opacity-60">{page.kbd}</CommandShortcut>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Work item search results */}
              {results.length > 0 && (
                <>
                  {!query && <CommandSeparator className="my-1" />}
                  <CommandGroup heading={query ? "Work Items" : "Recent Items"}>
                    {results.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.title + item.id}
                        onSelect={() => navigate(`/items/${item.id}`)}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer"
                      >
                        {/* Short ID badge */}
                        <div className="shrink-0 mt-0.5">
                          <span className="inline-flex items-center rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground tracking-wider">
                            {shortId(item.id)}
                          </span>
                        </div>

                        {/* Title + team */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{item.title}</span>
                          <span className="text-[11px] text-muted-foreground/60">{item.team.name}</span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                          <PriorityBadge priority={item.priority} size="sm" />
                          <StatusBadge status={item.status} size="sm" />
                        </div>
                        <ArrowRight className="size-3.5 text-muted-foreground/30 shrink-0 mt-0.5" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>

            {/* Footer hint */}
            <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-2.5 bg-muted/10">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-5 items-center rounded border border-border/40 bg-muted/40 px-1.5 font-mono text-[10px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-5 items-center rounded border border-border/40 bg-muted/40 px-1.5 font-mono text-[10px]">↵</kbd>
                  open
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="inline-flex h-5 items-center rounded border border-border/40 bg-muted/40 px-1.5 font-mono text-[10px]">Esc</kbd>
                  close
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
                <Keyboard className="size-3" />
                <span>Ctrl+K</span>
              </div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
