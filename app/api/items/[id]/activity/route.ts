import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    select: { id: true },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10),
    100
  );

  const events = await prisma.activityEvent.findMany({
    where: { workItemId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ events });
}
