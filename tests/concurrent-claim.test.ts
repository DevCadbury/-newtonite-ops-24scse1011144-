import { describe, it, expect } from "vitest";
import { testPrisma, getFixtures } from "./setup";

const fx = getFixtures();

async function createOpenItem() {
  return testPrisma.workItem.create({
    data: { title: "TEST concurrent claim item", type: "TASK", priority: "HIGH", status: "OPEN", teamId: fx.teamId, createdById: fx.memberUserId },
  });
}

async function atomicClaim(itemId: string, claimantId: string, claimantName: string) {
  return testPrisma.$transaction(async (tx: any) => {
    const rows = await tx.$executeRaw`
      UPDATE "work_items"
      SET assignee_id = ${claimantId}, status = 'IN_PROGRESS'::"WorkItemStatus", version = version + 1, updated_at = NOW()
      WHERE id = ${itemId} AND assignee_id IS NULL
    `;
    if (rows === 0) return null;
    await tx.activityEvent.create({
      data: { workItemId: itemId, actorId: claimantId, type: "ASSIGNED", description: `TEST Claimed by ${claimantName}` },
    });
    return tx.workItem.findFirst({ where: { id: itemId } });
  });
}

describe("Concurrent Claim — Critical Behavior 1", () => {
  it("exactly one claim succeeds when two users race simultaneously", async () => {
    const item = await createOpenItem();
    const [r1, r2] = await Promise.all([
      atomicClaim(item.id, fx.memberUserId, "Member"),
      atomicClaim(item.id, fx.leadUserId, "Lead"),
    ]);
    const successes = [r1, r2].filter(Boolean);
    expect(successes).toHaveLength(1);
    expect([r1, r2].filter((r) => r === null)).toHaveLength(1);
    const dbItem = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(dbItem!.assigneeId).not.toBeNull();
    expect(dbItem!.status).toBe("IN_PROGRESS");
    const events = await testPrisma.activityEvent.findMany({ where: { workItemId: item.id, type: "ASSIGNED" } });
    expect(events).toHaveLength(1);
  });

  it("cannot claim an already-assigned item", async () => {
    const item = await testPrisma.workItem.create({
      data: { title: "TEST already-assigned", type: "TASK", priority: "MEDIUM", status: "IN_PROGRESS", teamId: fx.teamId, assigneeId: fx.memberUserId, createdById: fx.memberUserId },
    });
    expect(await atomicClaim(item.id, fx.leadUserId, "Lead")).toBeNull();
    const dbItem = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(dbItem!.assigneeId).toBe(fx.memberUserId);
  });
});
