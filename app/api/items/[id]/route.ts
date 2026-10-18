import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds, requireTeamRole } from "@/lib/permissions";
import { TeamRole, WorkItemType, Priority } from "@/generated/prisma/client";

const patchSchema = z.object({
  version: z.number().int().positive("version is required"),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.nativeEnum(Priority).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  type: z.nativeEnum(WorkItemType).optional(),
});

const ITEM_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true, activityEvents: true } },
};

// ── GET /api/items/:id ──────────────────────────────────────────────────────
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
    include: ITEM_INCLUDE,
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

// ── PATCH /api/items/:id ─────────────────────────────────────────────────────
export async function PATCH(
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { version, ...updates } = parsed.data;

  // Fetch item and verify team membership (404 for cross-team access)
  const userTeamIds = await getUserTeamIds(session.sub);
  const existing = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must be MEMBER+ to edit
  try {
    await requireTeamRole(session.sub, existing.teamId, TeamRole.MEMBER);
  } catch {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Build change metadata for activity event
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (updates.title !== undefined && updates.title !== existing.title) {
    changes.title = { from: existing.title, to: updates.title };
  }
  if (updates.priority !== undefined && updates.priority !== existing.priority) {
    changes.priority = { from: existing.priority, to: updates.priority };
  }
  if (updates.assigneeId !== undefined && updates.assigneeId !== existing.assigneeId) {
    changes.assigneeId = { from: existing.assigneeId, to: updates.assigneeId };
  }
  if (updates.description !== undefined && updates.description !== existing.description) {
    changes.description = { from: "previous", to: "updated" };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    // Atomic optimistic-lock update
    const updated = await tx.$executeRaw`
      UPDATE "work_items"
      SET title        = COALESCE(${updates.title ?? null}::text,    title),
          description  = CASE WHEN ${updates.description !== undefined}::boolean
                              THEN ${updates.description ?? null}::text
                              ELSE description END,
          priority     = COALESCE(${updates.priority ?? null}::"Priority", priority),
          assignee_id  = CASE WHEN ${updates.assigneeId !== undefined}::boolean
                              THEN ${updates.assigneeId ?? null}::text
                              ELSE assignee_id END,
          due_date     = CASE WHEN ${updates.dueDate !== undefined}::boolean
                              THEN ${updates.dueDate ? new Date(updates.dueDate) : null}
                              ELSE due_date END,
          version      = version + 1,
          updated_at   = NOW()
      WHERE id = ${id}
        AND version = ${version}
        AND team_id = ANY(${userTeamIds}::text[])
    `;

    if (updated === 0) {
      // Version conflict — fetch current state
      const current = await tx.workItem.findFirst({
        where: { id },
        include: ITEM_INCLUDE,
      });
      return { conflict: true, current };
    }

    // Write activity events for each changed field
    if (Object.keys(changes).length > 0) {
      const eventType = changes.priority
        ? "PRIORITY_CHANGED"
        : changes.title
        ? "TITLE_UPDATED"
        : changes.assigneeId
        ? (changes.assigneeId.to ? "ASSIGNED" : "UNASSIGNED")
        : "DESCRIPTION_UPDATED";

      const description = Object.entries(changes)
        .map(([k, v]) => `${k} changed`)
        .join(", ");

      await tx.activityEvent.create({
        data: {
          workItemId: id,
          actorId: session.sub,
          type: eventType,
          description,
          metadata: changes,
        },
      });
    }

    const refreshed = await tx.workItem.findFirst({
      where: { id },
      include: ITEM_INCLUDE,
    });
    return { conflict: false, item: refreshed };
  });

  if (result.conflict) {
    return NextResponse.json(
      { error: "VERSION_CONFLICT", currentItem: result.current },
      { status: 409 }
    );
  }

  return NextResponse.json(result.item);
}
