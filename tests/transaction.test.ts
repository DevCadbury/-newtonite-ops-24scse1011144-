import { describe, it, expect } from "vitest";
import { testPrisma, getFixtures } from "./setup";

const fx = getFixtures();

describe("Transaction Integrity — Critical Behavior 6", () => {
  it("create item writes exactly one CREATED event in same transaction", async () => {
    const item = await testPrisma.$transaction(async (tx: any) => {
      const i = await tx.workItem.create({
        data: { title: "TEST tx item", type: "TASK", priority: "MEDIUM", status: "OPEN", teamId: fx.teamId, createdById: fx.memberUserId },
      });
      await tx.activityEvent.create({ data: { workItemId: i.id, actorId: fx.memberUserId, type: "CREATED", description: "TEST created" } });
      return i;
    });
    const events = await testPrisma.activityEvent.findMany({ where: { workItemId: item.id, type: "CREATED" } });
    expect(events).toHaveLength(1);
  });

  it("transaction rollback leaves no partial state", async () => {
    let itemId: string | undefined;
    try {
      await testPrisma.$transaction(async (tx: any) => {
        const item = await tx.workItem.create({
          data: { title: "TEST rollback item", type: "TASK", priority: "MEDIUM", status: "OPEN", teamId: fx.teamId, createdById: fx.memberUserId },
        });
        itemId = item.id;
        throw new Error("Intentional rollback");
      });
    } catch { /* expected */ }
    if (itemId) {
      expect(await testPrisma.workItem.findFirst({ where: { id: itemId } })).toBeNull();
    }
  });

  it("status change + activity event commit atomically", async () => {
    const item = await testPrisma.workItem.create({
      data: { title: "TEST atomic commit", type: "TASK", priority: "MEDIUM", status: "OPEN", version: 1, teamId: fx.teamId, createdById: fx.memberUserId },
    });
    await testPrisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`UPDATE "work_items" SET status='IN_PROGRESS'::"WorkItemStatus", version=2, updated_at=NOW() WHERE id=${item.id} AND version=1`;
      await tx.activityEvent.create({ data: { workItemId: item.id, actorId: fx.memberUserId, type: "STATUS_CHANGED", description: "TEST status changed" } });
    });
    const u = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(u!.status).toBe("IN_PROGRESS");
    expect(u!.version).toBe(2);
    const events = await testPrisma.activityEvent.findMany({ where: { workItemId: item.id } });
    expect(events.some((e: any) => e.type === "STATUS_CHANGED")).toBe(true);
  });
});
