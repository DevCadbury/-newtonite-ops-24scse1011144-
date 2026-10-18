import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds, requireTeamRole } from "@/lib/permissions";
import { withIdempotency } from "@/lib/idempotency";
import { TeamRole } from "@/generated/prisma/client";

const createSchema = z.object({
  content: z.string().min(1).max(10000),
});

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

  const comments = await prisma.comment.findMany({
    where: { workItemId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ comments });
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    select: { id: true, teamId: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // VIEWER can read, but must be MEMBER+ to comment
  try {
    await requireTeamRole(session.sub, item.teamId, TeamRole.MEMBER);
  } catch {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const doCreate = async () => {
    return prisma.$transaction(async (tx: any) => {
      const comment = await tx.comment.create({
        data: { workItemId: id, authorId: session.sub, content: parsed.data.content },
        include: { author: { select: { id: true, name: true } } },
      });
      await tx.activityEvent.create({
        data: {
          workItemId: id,
          actorId: session.sub,
          type: "COMMENTED",
          description: `${session.name} commented`,
          metadata: { commentId: comment.id, preview: parsed.data.content.slice(0, 100) },
        },
      });
      return comment;
    });
  };

  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const result = await withIdempotency(
      idempotencyKey,
      session.sub,
      { workItemId: id, content: parsed.data.content },
      async () => {
        const comment = await doCreate();
        return { status: 201, body: comment };
      }
    );
    return NextResponse.json(result.body, { status: result.status });
  }

  const comment = await doCreate();
  return NextResponse.json(comment, { status: 201 });
}
