import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserTeamMemberships, ROLE_HIERARCHY } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import NewItemForm from "@/components/items/NewItemForm";

export default async function NewItemPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await getUserTeamMemberships(session.sub);
  const memberTeams = memberships
    .filter((m) => ROLE_HIERARCHY[m.role] >= ROLE_HIERARCHY.MEMBER)
    .map((m) => m.teamId);

  if (memberTeams.length === 0) {
    redirect("/items");
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: memberTeams } },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl tracking-tight">New Work Item</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Create a new operational work item</p>
      </div>
      <NewItemForm teams={teams} userId={session.sub} />
    </div>
  );
}
