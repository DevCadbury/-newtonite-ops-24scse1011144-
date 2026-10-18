import { describe, it, expect } from "vitest";
import { testPrisma, getFixtures } from "./setup";
import { getUserTeamRole, requireTeamRole, getUserTeamIds, ROLE_HIERARCHY } from "../lib/permissions";

const fx = getFixtures();

describe("Resource-Level Authorization — Critical Behavior 5", () => {
  it("returns null for user not in team", async () => expect(await getUserTeamRole(fx.otherMemberId, fx.teamId)).toBeNull());
  it("returns MEMBER role", async () => expect(await getUserTeamRole(fx.memberUserId, fx.teamId)).toBe("MEMBER"));
  it("returns LEAD role", async () => expect(await getUserTeamRole(fx.leadUserId, fx.teamId)).toBe("LEAD"));
  it("throws on insufficient role", async () => await expect(requireTeamRole(fx.viewerUserId, fx.teamId, "MEMBER")).rejects.toThrow());
  it("passes for sufficient role", async () => expect(await requireTeamRole(fx.leadUserId, fx.teamId, "MEMBER")).toBe("LEAD"));
  it("getUserTeamIds returns only user's teams", async () => {
    const ids = await getUserTeamIds(fx.memberUserId);
    expect(ids).toContain(fx.teamId);
    expect(ids).not.toContain(fx.otherTeamId);
  });
  it("cross-team item not visible to outside user", async () => {
    const item = await testPrisma.workItem.create({
      data: { title: "TEST cross-team item", type: "TASK", priority: "MEDIUM", status: "OPEN", teamId: fx.teamId, createdById: fx.memberUserId },
    });
    const otherTeamIds = await getUserTeamIds(fx.otherMemberId);
    expect(await testPrisma.workItem.findFirst({ where: { id: item.id, teamId: { in: otherTeamIds } } })).toBeNull();
  });
  it("VIEWER cannot claim (role check)", async () => {
    const role = await getUserTeamRole(fx.viewerUserId, fx.teamId);
    expect(ROLE_HIERARCHY[role!] >= ROLE_HIERARCHY["MEMBER"]).toBe(false);
  });
});
