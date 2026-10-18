import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";

/**
 * GET /api/users/:id/summary
 *
 * Returns a user's public profile summary — only if the requesting user
 * shares at least one team with the target user.
 *
 * Returns:
 *   - name, email
 *   - team memberships visible to requester
 *   - active assigned items (not RESOLVED/CLOSED)
 *   - recent activity events (last 8)
 *   - item counts by status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Requester must share at least one team with the target user
  const requesterTeamIds = await getUserTeamIds(session.sub);
  const sharedMembership = await prisma.membership.findFirst({
    where: {
      userId: targetUserId,
      teamId: { in: requesterTeamIds },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!sharedMembership) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetUser = sharedMembership.user;

  // All memberships the requester can see (shared teams only)
  const memberships = await prisma.membership.findMany({
    where: {
      userId: targetUserId,
      teamId: { in: requesterTeamIds },
    },
    include: { team: { select: { id: true, name: true } } },
    orderBy: { role: "desc" },
  });

  // Active assigned items (across shared teams)
  const assignedItems = await prisma.workItem.findMany({
    where: {
      assigneeId: targetUserId,
      teamId: { in: requesterTeamIds },
      status: { notIn: ["RESOLVED", "CLOSED"] },
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 6,
    include: {
      team: { select: { id: true, name: true } },
    },
  });

  // All item counts by status across shared teams
  const statusCounts = await prisma.workItem.groupBy({
    by: ["status"],
    where: {
      assigneeId: targetUserId,
      teamId: { in: requesterTeamIds },
    },
    _count: { id: true },
  });

  // Recent activity events (across shared teams)
  const recentActivity = await prisma.activityEvent.findMany({
    where: {
      actorId: targetUserId,
      workItem: { teamId: { in: requesterTeamIds } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      workItem: { select: { id: true, title: true } },
    },
  });

  const countsMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.id])
  );

  return NextResponse.json({
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
    },
    memberships: memberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      role: m.role,
    })),
    assignedItems: assignedItems.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      priority: i.priority,
      team: i.team,
    })),
    counts: {
      total: Object.values(countsMap).reduce((a, b) => a + b, 0),
      active: (countsMap["OPEN"] ?? 0) + (countsMap["IN_PROGRESS"] ?? 0) + (countsMap["AWAITING_APPROVAL"] ?? 0),
      byStatus: countsMap,
    },
    recentActivity: recentActivity.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      createdAt: e.createdAt.toISOString(),
      workItem: e.workItem,
    })),
  });
}
