import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds, getUserTeamMemberships } from "@/lib/permissions";
import { ROLE_HIERARCHY } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [userTeamIds, memberships] = await Promise.all([
    getUserTeamIds(session.sub),
    getUserTeamMemberships(session.sub),
  ]);

  if (userTeamIds.length === 0) {
    return NextResponse.json({
      stats: { openItems: 0, assignedToMe: 0, awaitingApproval: 0, overdue: 0 },
      assignedToMe: [],
      unassignedUrgent: [],
      awaitingApproval: [],
      recentActivity: [],
    });
  }

  const leadTeamIds = memberships
    .filter((m) => ROLE_HIERARCHY[m.role] >= ROLE_HIERARCHY.LEAD)
    .map((m) => m.teamId);

  const now = new Date();

  const [
    openCount,
    assignedCount,
    awaitingCount,
    overdueCount,
    assignedToMe,
    unassignedUrgent,
    awaitingApproval,
    recentActivity,
  ] = await Promise.all([
    prisma.workItem.count({ where: { status: "OPEN", teamId: { in: userTeamIds } } }),
    prisma.workItem.count({ where: { assigneeId: session.sub, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    leadTeamIds.length > 0
      ? prisma.workItem.count({ where: { status: "AWAITING_APPROVAL", teamId: { in: leadTeamIds } } })
      : Promise.resolve(0),
    prisma.workItem.count({
      where: {
        teamId: { in: userTeamIds },
        dueDate: { lt: now },
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
    }),
    prisma.workItem.findMany({
      where: { assigneeId: session.sub, status: { notIn: ["RESOLVED", "CLOSED"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { team: { select: { id: true, name: true } } },
    }),
    prisma.workItem.findMany({
      where: {
        teamId: { in: userTeamIds },
        assigneeId: null,
        priority: { in: ["HIGH", "CRITICAL"] },
        status: "OPEN",
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 5,
      include: { team: { select: { id: true, name: true } } },
    }),
    leadTeamIds.length > 0
      ? prisma.workItem.findMany({
          where: { status: "AWAITING_APPROVAL", teamId: { in: leadTeamIds } },
          orderBy: { updatedAt: "asc" },
          take: 5,
          include: {
            team: { select: { id: true, name: true } },
            assignee: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.activityEvent.findMany({
      where: { workItem: { teamId: { in: userTeamIds } } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        actor: { select: { id: true, name: true } },
        workItem: { select: { id: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    stats: {
      openItems: openCount,
      assignedToMe: assignedCount,
      awaitingApproval: awaitingCount,
      overdue: overdueCount,
    },
    assignedToMe,
    unassignedUrgent,
    awaitingApproval,
    recentActivity,
  });
}
