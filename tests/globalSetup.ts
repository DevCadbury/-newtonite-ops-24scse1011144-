/**
 * Vitest global setup — runs once before all test files and once after.
 * This is different from setupFiles: runs outside the test context.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

export async function setup() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // Clean up test data from any previous run
    await prisma.$executeRaw`
      DELETE FROM "outbox_jobs"
      WHERE work_item_id IN (
        SELECT id FROM "work_items" WHERE title LIKE 'TEST%'
        UNION
        SELECT wi.id FROM "work_items" wi
          JOIN "users" u ON u.id = wi.created_by_id
         WHERE u.email LIKE 'test-%@example.com'
      )
    `;
    await prisma.$executeRaw`
      DELETE FROM "activity_events"
      WHERE work_item_id IN (
        SELECT id FROM "work_items" WHERE title LIKE 'TEST%'
        UNION
        SELECT wi.id FROM "work_items" wi
          JOIN "users" u ON u.id = wi.created_by_id
         WHERE u.email LIKE 'test-%@example.com'
      )
    `;
    await prisma.$executeRaw`
      DELETE FROM "comments"
      WHERE work_item_id IN (
        SELECT id FROM "work_items" WHERE title LIKE 'TEST%'
        UNION
        SELECT wi.id FROM "work_items" wi
          JOIN "users" u ON u.id = wi.created_by_id
         WHERE u.email LIKE 'test-%@example.com'
      )
    `;
    await prisma.$executeRaw`DELETE FROM "work_items" WHERE title LIKE 'TEST%'`;
    await prisma.$executeRaw`
      DELETE FROM "work_items"
      WHERE created_by_id IN (SELECT id FROM "users" WHERE email LIKE 'test-%@example.com')
    `;
    await prisma.$executeRaw`DELETE FROM "idempotency_keys" WHERE key LIKE 'test-%'`;
    await prisma.$executeRaw`
      DELETE FROM "memberships"
      WHERE team_id IN (SELECT id FROM "teams" WHERE name IN ('TEST_Alpha','TEST_Beta'))
    `;
    await prisma.$executeRaw`DELETE FROM "users" WHERE email LIKE 'test-%@example.com'`;
    await prisma.$executeRaw`DELETE FROM "teams" WHERE name IN ('TEST_Alpha','TEST_Beta')`;

    // Create fresh test fixtures
    const hash = await bcrypt.hash("password123", 10);
    const team      = await prisma.team.create({ data: { name: "TEST_Alpha" } });
    const otherTeam = await prisma.team.create({ data: { name: "TEST_Beta" } });
    const lead        = await prisma.user.create({ data: { name: "Test Lead",   email: "test-lead@example.com",   passwordHash: hash } });
    const member      = await prisma.user.create({ data: { name: "Test Member", email: "test-member@example.com", passwordHash: hash } });
    const viewer      = await prisma.user.create({ data: { name: "Test Viewer", email: "test-viewer@example.com", passwordHash: hash } });
    const otherMember = await prisma.user.create({ data: { name: "Test Other",  email: "test-other@example.com",  passwordHash: hash } });

    await prisma.membership.create({ data: { userId: lead.id,        teamId: team.id,      role: "LEAD"   } });
    await prisma.membership.create({ data: { userId: member.id,      teamId: team.id,      role: "MEMBER" } });
    await prisma.membership.create({ data: { userId: viewer.id,      teamId: team.id,      role: "VIEWER" } });
    await prisma.membership.create({ data: { userId: otherMember.id, teamId: otherTeam.id, role: "MEMBER" } });

    // Store fixture IDs in environment variables so test files can read them
    process.env.TEST_TEAM_ID        = team.id;
    process.env.TEST_LEAD_ID        = lead.id;
    process.env.TEST_MEMBER_ID      = member.id;
    process.env.TEST_VIEWER_ID      = viewer.id;
    process.env.TEST_OTHER_TEAM_ID  = otherTeam.id;
    process.env.TEST_OTHER_MEMBER_ID = otherMember.id;

    console.log("[globalSetup] Test fixtures created");
  } finally {
    await prisma.$disconnect();
  }
}

export async function teardown() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter } as any);
  try {
    await prisma.$executeRaw`DELETE FROM "work_items" WHERE title LIKE 'TEST%'`;
    await prisma.$executeRaw`
      DELETE FROM "work_items"
      WHERE created_by_id IN (SELECT id FROM "users" WHERE email LIKE 'test-%@example.com')
    `;
    await prisma.$executeRaw`DELETE FROM "idempotency_keys" WHERE key LIKE 'test-%'`;
    await prisma.$executeRaw`
      DELETE FROM "memberships"
      WHERE team_id IN (SELECT id FROM "teams" WHERE name IN ('TEST_Alpha','TEST_Beta'))
    `;
    await prisma.$executeRaw`DELETE FROM "users" WHERE email LIKE 'test-%@example.com'`;
    await prisma.$executeRaw`DELETE FROM "teams" WHERE name IN ('TEST_Alpha','TEST_Beta')`;
    console.log("[globalSetup] Test fixtures cleaned up");
  } finally {
    await prisma.$disconnect();
  }
}
