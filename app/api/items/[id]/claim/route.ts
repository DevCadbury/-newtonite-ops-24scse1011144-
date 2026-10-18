import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds, requireTeamRole } from "@/lib/permissions";
import { withIdempotency } from "@/lib/idempotency";
import { TeamRole } from "@/generated/prisma/client";

const ITEM_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify item exists in one of the user's teams (404 prevents team enumeration)
  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    select: { id: true, teamId: true, assigneeId: true, status: true },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must be MEMBER+ to claim
  try {
    await requireTeamRole(session.sub, item.teamId, TeamRole.MEMBER);
  } catch {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  if (item.status !== "OPEN" && item.status !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "Item cannot be claimed in its current status" },
      { status: 422 }
    );
  }

  const doClaim = async () => {
    const result = await prisma.$transaction(async (tx: any) => {
      // ATOMIC conditional update — the only correct way to handle racing claims
      const rowsUpdated = await tx.$executeRaw`
        UPDATE "work_items"
        SET assignee_id = ${session.sub},
            status      = 'IN_PROGRESS'::"WorkItemStatus",
            version     = version + 1,
            updated_at  = NOW()
        WHERE id          = ${id}
          AND assignee_id IS NULL
          AND team_id     = ${item.teamId}
      `;

      if (rowsUpdated === 0) return null; // already claimed

      await tx.activityEvent.create({
        data: {
          workItemId: id,
          actorId: session.sub,
          type: "ASSIGNED",
          description: `Claimed by ${session.name}`,
          metadata: { assigneeId: session.sub, assigneeName: session.name },
        },
      });

      // Write outbox job in same transaction
      await tx.outboxJob.create({
        data: {
          workItemId: id,
          type: "ITEM_ASSIGNED",
          payload: {
            workItemId: id,
            assigneeId: session.sub,
            assigneeName: session.name,
          },
        },
      });

      return tx.workItem.findFirst({ where: { id }, include: ITEM_INCLUDE });
    });

    return result;
  };

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const idem = await withIdempotency(idempotencyKey, session.sub, { id }, async () => {
      const claimed = await doClaim();
      if (claimed === null) {
        const current = await prisma.workItem.findFirst({ where: { id }, include: ITEM_INCLUDE });
        return { status: 409, body: { error: "ALREADY_CLAIMED", currentItem: current } };
      }
      return { status: 200, body: claimed };
    });
    return NextResponse.json(idem.body, { status: idem.status });
  }

  const claimed = await doClaim();

  if (claimed === null) {
    const current = await prisma.workItem.findFirst({ where: { id }, include: ITEM_INCLUDE });
    return NextResponse.json(
      { error: "ALREADY_CLAIMED", currentItem: current },
      { status: 409 }
    );
  }

  return NextResponse.json(claimed);
}

