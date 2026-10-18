import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserTeamMemberships } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { TeamRole } from "@/generated/prisma/enums";
import { TeamsList } from "@/components/teams/TeamsList";

export default async function TeamsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await getUserTeamMemberships(session.sub);
  const teamIds = memberships.map((m) => m.teamId);
  const myRoles = Object.fromEntries(memberships.map((m) => [m.teamId, m.role as TeamRole]));

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { role: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const serialisedTeams = JSON.parse(JSON.stringify(teams));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your team memberships — click any member to view their profile
        </p>
      </div>

      <TeamsList
        teams={serialisedTeams}
        myRoles={myRoles}
        currentUserId={session.sub}
      />
    </div>
  );
}
