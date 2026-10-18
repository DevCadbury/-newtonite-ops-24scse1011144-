import { describe, it, expect } from "vitest";
import { testPrisma, getFixtures } from "./setup";
import { isTransitionAllowed, transitionRequiresLead } from "../lib/transitions";
import { ROLE_HIERARCHY } from "../lib/permissions";

const fx = getFixtures();

describe("Workflow Enforcement — Critical Behavior 4", () => {
  it("OPEN→CLOSED is forbidden", () => expect(isTransitionAllowed("OPEN", "CLOSED")).toBe(false));
  it("OPEN→RESOLVED is forbidden", () => expect(isTransitionAllowed("OPEN", "RESOLVED")).toBe(false));
  it("OPEN→IN_PROGRESS is allowed", () => expect(isTransitionAllowed("OPEN", "IN_PROGRESS")).toBe(true));
  it("IN_PROGRESS→AWAITING_APPROVAL is allowed", () => expect(isTransitionAllowed("IN_PROGRESS", "AWAITING_APPROVAL")).toBe(true));
  it("AWAITING_APPROVAL→RESOLVED requires Lead", () => expect(transitionRequiresLead("AWAITING_APPROVAL", "RESOLVED")).toBe(true));
  it("AWAITING_APPROVAL→IN_PROGRESS requires Lead", () => expect(transitionRequiresLead("AWAITING_APPROVAL", "IN_PROGRESS")).toBe(true));
  it("MEMBER cannot approve", () => expect(ROLE_HIERARCHY["MEMBER"] >= ROLE_HIERARCHY["LEAD"]).toBe(false));
  it("LEAD can approve", () => expect(ROLE_HIERARCHY["LEAD"] >= ROLE_HIERARCHY["LEAD"]).toBe(true));
  it("ADMIN can approve (≥ Lead)", () => expect(ROLE_HIERARCHY["ADMIN"] >= ROLE_HIERARCHY["LEAD"]).toBe(true));

  it("full workflow lifecycle", async () => {
    const item = await testPrisma.workItem.create({
      data: { title: "TEST workflow lifecycle", type: "TASK", priority: "MEDIUM", status: "OPEN", version: 1, teamId: fx.teamId, createdById: fx.memberUserId },
    });
    await testPrisma.$executeRaw`UPDATE "work_items" SET status='IN_PROGRESS'::"WorkItemStatus", version=2 WHERE id=${item.id} AND version=1`;
    let u = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(u!.status).toBe("IN_PROGRESS");
    await testPrisma.$executeRaw`UPDATE "work_items" SET status='AWAITING_APPROVAL'::"WorkItemStatus", version=3 WHERE id=${item.id} AND version=2`;
    u = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(u!.status).toBe("AWAITING_APPROVAL");
    await testPrisma.$executeRaw`UPDATE "work_items" SET status='RESOLVED'::"WorkItemStatus", version=4 WHERE id=${item.id} AND version=3`;
    u = await testPrisma.workItem.findFirst({ where: { id: item.id } });
    expect(u!.status).toBe("RESOLVED");
    expect(u!.version).toBe(4);
  });
});
