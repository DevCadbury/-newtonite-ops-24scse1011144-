import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";

/**
 * GET /api/teams/:id/members
 * Returns all members of a team, but only if the current user
 * is also a member of that team (scoped access).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the requesting user is a member of this team
  const userTeamIds = await getUserTeamIds(session.sub);
  if (!userTeamIds.includes(teamId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const members = await prisma.membership.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: "desc" }, { user: { name: "asc" } }],
  });

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  });
}
