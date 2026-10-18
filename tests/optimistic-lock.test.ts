import { describe, it, expect } from "vitest";
import { testPrisma, getFixtures } from "./setup";

const fx = getFixtures();

async function updateWithVersion(itemId: string, ver: number, title: string, userId: string) {
  return testPrisma.$transaction(async (tx: any) => {
    const rows = await tx.$executeRaw`
      UPDATE "work_items" SET title=${title}, version=version+1, updated_at=NOW()
      WHERE id=${itemId} AND version=${ver} AND team_id=${fx.teamId}
    `;
    if (rows === 0) return { success: false };
    await tx.activityEvent.create({ data: { workItemId: itemId, actorId: userId, type: "TITLE_UPDATED", description: "TEST title changed" } });
    return { success: true, item: await tx.workItem.findFirst({ where: { id: itemId } }) };
  });
}

describe("Optimistic Locking — Critical Behavior 2", () => {
  it("stale version rejected; DB state preserved; no spurious activity event", async () => {
    const item = await testPrisma.workItem.create({
      data: { title: "TEST original", type: "TASK", priority: "MEDIUM", status: "OPEN", version: 1, teamId: fx.teamId, createdById: fx.memberUserId },
    });
    const r1 = await updateWithVersion(item.id, 1, "TEST updated by lead", fx.leadUserId);
    expect(r1.success).toBe(true);
    expect(r1.item!.version).toBe(2);

    const r2 = await updateWithVersion(item.id, 1, "TEST stale update", fx.memberUserId);
    expect(r2.success).toBe(false);

    const final = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(final!.version).toBe(2);
    expect(final!.title).toBe("TEST updated by lead");

    const events = await testPrisma.activityEvent.findMany({ where: { workItemId: item.id, type: "TITLE_UPDATED" } });
    expect(events).toHaveLength(1);
  });

  it("concurrent updates to different items both succeed", async () => {
    const [i1, i2] = await Promise.all([
      testPrisma.workItem.create({ data: { title: "TEST item-A", type: "TASK", priority: "LOW", status: "OPEN", version: 1, teamId: fx.teamId, createdById: fx.memberUserId } }),
      testPrisma.workItem.create({ data: { title: "TEST item-B", type: "TASK", priority: "LOW", status: "OPEN", version: 1, teamId: fx.teamId, createdById: fx.memberUserId } }),
    ]);
    const [r1, r2] = await Promise.all([
      updateWithVersion(i1.id, 1, "TEST A updated", fx.memberUserId),
      updateWithVersion(i2.id, 1, "TEST B updated", fx.memberUserId),
    ]);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});
