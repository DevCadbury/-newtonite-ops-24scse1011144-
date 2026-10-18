import { prisma } from "@/lib/prisma";
import { TeamRole } from "@/generated/prisma/enums";

export const ROLE_HIERARCHY: Record<TeamRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  LEAD: 2,
  ADMIN: 3,
};

export async function getUserTeamRole(
  userId: string,
  teamId: string
): Promise<TeamRole | null> {
  const membership = await prisma.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function requireTeamRole(
  userId: string,
  teamId: string,
  minRole: TeamRole
): Promise<TeamRole> {
  const role = await getUserTeamRole(userId, teamId);
  if (!role || ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
    const err = new Error("Insufficient permissions");
    (err as any).statusCode = 403;
    (err as any).code = "INSUFFICIENT_ROLE";
    throw err;
  }
  return role;
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}

export async function getUserTeamMemberships(
  userId: string
): Promise<{ teamId: string; role: TeamRole }[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { teamId: true, role: true },
  });
  return memberships;
}

/** Returns true when user has at least minRole in the given team */
export function hasRole(role: TeamRole, minRole: TeamRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

