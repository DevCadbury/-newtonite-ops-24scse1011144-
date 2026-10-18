/**
 * Per-test-file setup helper.
 * Reads fixtures from env vars populated by globalSetup.ts.
 * Import testPrisma for direct DB access in tests.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const testPrisma = new PrismaClient({ adapter } as any);

export interface Fixtures {
  teamId: string;
  leadUserId: string;
  memberUserId: string;
  viewerUserId: string;
  otherTeamId: string;
  otherMemberId: string;
}

/** Returns test fixtures populated by globalSetup. Call in beforeAll. */
export function getFixtures(): Fixtures {
  const teamId        = process.env.TEST_TEAM_ID;
  const leadUserId    = process.env.TEST_LEAD_ID;
  const memberUserId  = process.env.TEST_MEMBER_ID;
  const viewerUserId  = process.env.TEST_VIEWER_ID;
  const otherTeamId   = process.env.TEST_OTHER_TEAM_ID;
  const otherMemberId = process.env.TEST_OTHER_MEMBER_ID;

  if (!teamId || !leadUserId || !memberUserId || !viewerUserId || !otherTeamId || !otherMemberId) {
    throw new Error("Test fixtures not found in env. Make sure globalSetup ran.");
  }
  return { teamId, leadUserId, memberUserId, viewerUserId, otherTeamId, otherMemberId };
}
