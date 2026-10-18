import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ActivityClient } from "@/components/shared/ActivityClient";

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const userTeamIds = await getUserTeamIds(session.sub);

  const events = await prisma.activityEvent.findMany({
    where: { workItem: { teamId: { in: userTeamIds } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { id: true, name: true } },
      workItem: {
        select: {
          id: true, title: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  return (
    <ActivityClient
      events={JSON.parse(JSON.stringify(events))}
    />
  );
}