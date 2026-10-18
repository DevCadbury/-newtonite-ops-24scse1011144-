import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { requireTeamRole, getUserTeamIds } from "@/lib/permissions";
import { withIdempotency } from "@/lib/idempotency";
import { TeamRole, WorkItemStatus, WorkItemType, Priority } from "@/generated/prisma/client";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  type: z.nativeEnum(WorkItemType),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
  teamId: z.string().cuid(),
  assigneeId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
});

// GET /api/items
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status     = searchParams.get("status")     as WorkItemStatus | null;
  const priority   = searchParams.get("priority")   as Priority | null;
  const type       = searchParams.get("type")       as WorkItemType | null;
  const teamId     = searchParams.get("teamId");
  const assigneeId = searchParams.get("assigneeId");
  const q          = searchParams.get("q");
  const cursor     = searchParams.get("cursor");
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const myItems    = searchParams.get("me") === "true";
  const unassigned = searchParams.get("unassigned") === "true";
  const awaitingApproval = searchParams.get("awaitingApproval") === "true";

  const userTeamIds = await getUserTeamIds(session.sub);
  if (userTeamIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null, hasMore: false });
  }

  const scopedTeamIds = teamId && userTeamIds.includes(teamId)
    ? [teamId]
    : userTeamIds;

  // Decode cursor
  let cursorCondition: object | undefined;
  if (cursor) {
    try {
      const { createdAt, id } = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
      cursorCondition = {
        OR: [
          { createdAt: { lt: new Date(createdAt) } },
          { AND: [{ createdAt: new Date(createdAt) }, { id: { lt: id } }] },
        ],
      };
    } catch {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
  }

  // Build where using AND array to avoid OR key collisions between
  // full-text search and cursor pagination (Bug 1 fix).
  // awaitingApproval takes priority over explicit status param (Bug 3 fix).
  const baseCondition: any = {
    teamId: { in: scopedTeamIds },
    ...(awaitingApproval
      ? { status: WorkItemStatus.AWAITING_APPROVAL }
      : status
      ? { status }
      : {}),
    ...(priority && { priority }),
    ...(type && { type }),
    ...(myItems && { assigneeId: session.sub }),
    ...(unassigned && { assigneeId: null }),
    ...(assigneeId && assigneeId !== "me" && { assigneeId }),
  };

  const andConditions: any[] = [baseCondition];

  // Search OR pushed separately to avoid collision with cursor OR
  if (q) {
    andConditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Cursor OR pushed separately to avoid collision with search OR
  if (cursorCondition) {
    andConditions.push(cursorCondition);
  }

  const where: any = andConditions.length === 1
    ? andConditions[0]
    : { AND: andConditions };

  const items = await prisma.workItem.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      assignee: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor = hasMore
    ? Buffer.from(
        JSON.stringify({
          createdAt: items[items.length - 1].createdAt.toISOString(),
          id: items[items.length - 1].id,
        })
      ).toString("base64")
    : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}

// POST /api/items
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    await requireTeamRole(session.sub, data.teamId, TeamRole.MEMBER);
  } catch (e: any) {
    if (e.code === "INSUFFICIENT_ROLE") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    throw e;
  }

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const result = await withIdempotency(idempotencyKey, session.sub, data, async () => {
      const item = await createItem(data, session.sub);
      return { status: 201, body: item };
    });
    return NextResponse.json(result.body, { status: result.status });
  }

  const item = await createItem(data, session.sub);
  return NextResponse.json(item, { status: 201 });
}

async function createItem(
  data: z.infer<typeof createSchema>,
  actorId: string
) {
  return prisma.$transaction(async (tx: any) => {
    const item = await tx.workItem.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type,
        priority: data.priority,
        teamId: data.teamId,
        assigneeId: data.assigneeId,
        createdById: actorId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        status: "OPEN",
        version: 1,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await tx.activityEvent.create({
      data: {
        workItemId: item.id,
        actorId,
        type: "CREATED",
        description: "Work item created",
        metadata: { title: item.title, type: item.type, priority: item.priority },
      },
    });

    return item;
  });
}