import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserTeamIds, getUserTeamRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import WorkItemDetailClient from "@/components/items/WorkItemDetailClient";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    include: {
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!item) notFound();

  const userRole = await getUserTeamRole(session.sub, item.teamId);

  const [activityEvents, comments] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.comment.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <WorkItemDetailClient
      initialItem={JSON.parse(JSON.stringify(item))}
      initialActivity={JSON.parse(JSON.stringify(activityEvents))}
      initialComments={JSON.parse(JSON.stringify(comments))}
      userId={session.sub}
      userName={session.name}
      userRole={userRole!}
    />
  );
}
