"use client";

import { useState } from "react";
import { Users, Crown, Eye, Shield, User, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemberProfileSheet } from "@/components/teams/MemberProfileSheet";
import { cn } from "@/components/ui/utils";
import type { TeamRole } from "@/generated/prisma/enums";

/* ── Role config ─────────────────────────────────────────────────────────── */
const ROLE_CONFIG: Record<TeamRole, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chipClass: string;
}> = {
  VIEWER: { label: "Viewer", icon: Eye,    chipClass: "bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/25" },
  MEMBER: { label: "Member", icon: User,   chipClass: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25" },
  LEAD:   { label: "Lead",   icon: Crown,  chipClass: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25" },
  ADMIN:  { label: "Admin",  icon: Shield, chipClass: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25" },
};

interface TeamMember {
  id: string;
  user: { id: string; name: string; email: string };
  role: TeamRole;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  memberships: TeamMember[];
}

interface Props {
  teams: Team[];
  myRoles: Record<string, TeamRole>;
  currentUserId: string;
}

export function TeamsList({ teams, myRoles, currentUserId }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const myRole = myRoles[team.id];
          const cfg = myRole ? ROLE_CONFIG[myRole] : ROLE_CONFIG.VIEWER;

          return (
            <Card key={team.id} className="border-border/60 admin-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="size-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{team.name}</CardTitle>
                      {team.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                      )}
                    </div>
                  </div>
                  {myRole && (
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium ${cfg.chipClass}`}>
                      <cfg.icon className="size-3" />
                      {cfg.label}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <Separator className="mb-3" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-2.5 flex items-center gap-1.5">
                  <Users className="size-3" />
                  {team.memberships.length} member{team.memberships.length !== 1 ? "s" : ""}
                </p>
                <div className="space-y-1.5">
                  {team.memberships.map((m) => {
                    const roleCfg = ROLE_CONFIG[m.role];
                    const isMe = m.user.id === currentUserId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMemberId(m.user.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors text-left group",
                          "hover:bg-accent/50 active:bg-accent/70",
                          isMe && "ring-1 ring-primary/20 bg-primary/5 hover:bg-primary/10"
                        )}
                      >
                        {/* Avatar */}
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              isMe ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {m.user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name + email */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate leading-tight">
                              {m.user.name}
                            </p>
                            {isMe && (
                              <span className="shrink-0 text-[10px] text-primary/80 font-normal bg-primary/10 px-1.5 py-0.5 rounded">
                                you
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 truncate">
                            {m.user.email}
                          </p>
                        </div>

                        {/* Role badge */}
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${roleCfg.chipClass}`}>
                          <roleCfg.icon className="size-2.5" />
                          {roleCfg.label}
                        </span>

                        {/* Chevron hint */}
                        <ChevronRight className="size-3.5 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Member profile sheet */}
      <MemberProfileSheet
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </>
  );
}
