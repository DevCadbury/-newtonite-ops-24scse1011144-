import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";
import { getUserTeamIds } from "@/lib/permissions";

// DELETE /api/items/:id/comments/:commentId
// Only the comment author can delete their own comment.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userTeamIds = await getUserTeamIds(session.sub);
  const item = await prisma.workItem.findFirst({
    where: { id, teamId: { in: userTeamIds } },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await prisma.comment.findFirst({
    where: { id: commentId, workItemId: id },
    select: { id: true, authorId: true },
  });
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (comment.authorId !== session.sub) {
    return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}