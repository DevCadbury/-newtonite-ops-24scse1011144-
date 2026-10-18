import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds, requireTeamRole } from "@/lib/permissions";
import { isTransitionAllowed, transitionRequiresLead } from "@/lib/transitions";
import { TeamRole, WorkItemStatus } from "@/generated/prisma/client";

const schema = z.object({
  toStatus: z.nativeEnum(WorkItemStatus),
  version: z.number().int().positive(),
});

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { toStatus, version } = parsed.data;

  // Scope to user's teams (404 prevents enumeration)
  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    select: { id: true, teamId: true, status: true, version: true },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Validate state machine transition
  if (!isTransitionAllowed(item.status, toStatus)) {
    return NextResponse.json(
      {
        error: "INVALID_TRANSITION",
        from: item.status,
        to: toStatus,
        message: `Cannot transition from ${item.status} to ${toStatus}`,
      },
      { status: 422 }
    );
  }

  // Check role requirements
  const requiredRole = transitionRequiresLead(item.status, toStatus)
    ? TeamRole.LEAD
    : TeamRole.MEMBER;

  try {
    await requireTeamRole(session.sub, item.teamId, requiredRole);
  } catch {
    return NextResponse.json(
      {
        error: "INSUFFICIENT_ROLE",
        required: requiredRole,
        message: `This transition requires ${requiredRole} role or higher`,
      },
      { status: 403 }
    );
  }

  const result = await prisma.$transaction(async (tx: any) => {
    // Optimistic-lock update with status transition
    const rowsUpdated = await tx.$executeRaw`
      UPDATE "work_items"
      SET status     = ${toStatus}::"WorkItemStatus",
          version    = version + 1,
          updated_at = NOW()
      WHERE id      = ${id}
        AND version = ${version}
        AND team_id = ANY(${userTeamIds}::text[])
    `;

    if (rowsUpdated === 0) {
      const current = await tx.workItem.findFirst({ where: { id }, include: ITEM_INCLUDE });
      return { conflict: true, current };
    }

    const eventDescriptions: Record<string, string> = {
      IN_PROGRESS: "Started work on item",
      AWAITING_APPROVAL: "Submitted for approval",
      RESOLVED: `Approved and resolved by ${session.name}`,
      CLOSED: "Item closed",
      OPEN: "Returned to open",
    };

    await tx.activityEvent.create({
      data: {
        workItemId: id,
        actorId: session.sub,
        type: "STATUS_CHANGED",
        description: eventDescriptions[toStatus] ?? `Status changed to ${toStatus}`,
        metadata: { fromStatus: item.status, toStatus },
      },
    });

    await tx.outboxJob.create({
      data: {
        workItemId: id,
        type: "ITEM_STATUS_CHANGED",
        payload: {
          workItemId: id,
          fromStatus: item.status,
          toStatus,
          actorId: session.sub,
          actorName: session.name,
        },
      },
    });

    const updated = await tx.workItem.findFirst({ where: { id }, include: ITEM_INCLUDE });
    return { conflict: false, item: updated };
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: "VERSION_CONFLICT", currentItem: result.current },
      { status: 409 }
    );
  }

  return NextResponse.json(result.item);
}
