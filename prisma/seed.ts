import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, WorkItemStatus, WorkItemType, Priority, TeamRole } from "../generated/prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const SEED_USERS = [
  // Ops team
  { name: "Alice Ops",    email: "alice.ops@newtonite.dev",    password: "password123", team: "Ops",         role: TeamRole.LEAD },
  { name: "Bob Ops",      email: "bob.ops@newtonite.dev",      password: "password123", team: "Ops",         role: TeamRole.MEMBER },
  { name: "Carol Ops",    email: "carol.ops@newtonite.dev",    password: "password123", team: "Ops",         role: TeamRole.VIEWER },
  // Payments team
  { name: "Dan Pay",      email: "dan.pay@newtonite.dev",      password: "password123", team: "Payments",    role: TeamRole.LEAD },
  { name: "Eve Pay",      email: "eve.pay@newtonite.dev",      password: "password123", team: "Payments",    role: TeamRole.MEMBER },
  { name: "Frank Pay",    email: "frank.pay@newtonite.dev",    password: "password123", team: "Payments",    role: TeamRole.VIEWER },
  // Compliance team
  { name: "Grace Comp",   email: "grace.comp@newtonite.dev",   password: "password123", team: "Compliance",  role: TeamRole.ADMIN },
  { name: "Henry Comp",   email: "henry.comp@newtonite.dev",   password: "password123", team: "Compliance",  role: TeamRole.LEAD },
  { name: "Iris Comp",    email: "iris.comp@newtonite.dev",    password: "password123", team: "Compliance",  role: TeamRole.MEMBER },
  // Engineering team
  { name: "Jack Eng",     email: "jack.eng@newtonite.dev",     password: "password123", team: "Engineering", role: TeamRole.ADMIN },
  { name: "Kate Eng",     email: "kate.eng@newtonite.dev",     password: "password123", team: "Engineering", role: TeamRole.LEAD },
  { name: "Leo Eng",      email: "leo.eng@newtonite.dev",      password: "password123", team: "Engineering", role: TeamRole.MEMBER },
];

const TEAMS = [
  { name: "Ops",         description: "Operations team handling incidents and general tasks" },
  { name: "Payments",    description: "Payments team for financial and transaction issues" },
  { name: "Compliance",  description: "Compliance and regulatory work items" },
  { name: "Engineering", description: "Engineering team for technical tasks and bugs" },
];

const ITEM_TITLES = [
  "Fix payment gateway timeout", "Investigate customer login failures", "Review compliance audit",
  "Deploy hotfix for checkout bug", "Update API rate limits", "Customer refund processing delay",
  "Database performance degradation", "SSL certificate renewal", "PCI-DSS audit preparation",
  "Incident: API 500 errors", "Security patch deployment", "Onboard new payment provider",
  "Quarterly compliance review", "Load test production environment", "Fix data export feature",
  "Customer escalation: billing issue", "Urgent: Data breach investigation", "Setup monitoring alerts",
  "Review access permissions", "Performance optimization sprint", "Vendor contract renewal",
  "Regulatory filing Q3", "System backup verification", "Incident post-mortem",
  "Feature flag cleanup", "Migrate legacy database tables", "Update privacy policy",
];

const DESCRIPTIONS = [
  "This requires immediate attention from the team. Please investigate the root cause and provide a fix.",
  "Customer has been waiting for 3 days. Escalated from support team.",
  "Part of the quarterly compliance requirement. Deadline is end of month.",
  "Performance issue affecting user experience. SLA breach imminent.",
  "Routine maintenance task. Can be scheduled during off-peak hours.",
  null,
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysAgo: number, daysAhead: number): Date {
  const now = Date.now();
  const from = now - daysAgo * 86400000;
  const to = now + daysAhead * 86400000;
  return new Date(from + Math.random() * (to - from));
}

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database already seeded. Skipping.");
    return;
  }

  console.log("Seeding teams...");
  const teamMap: Record<string, string> = {};
  for (const t of TEAMS) {
    const team = await prisma.team.create({ data: t });
    teamMap[t.name] = team.id;
  }

  console.log("Seeding users and memberships...");
  const userMap: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: { name: u.name, email: u.email, passwordHash },
    });
    userMap[u.email] = user.id;
    await prisma.membership.create({
      data: { userId: user.id, teamId: teamMap[u.team], role: u.role },
    });
  }

  console.log("Seeding work items...");
  const types = Object.values(WorkItemType);
  const statuses = Object.values(WorkItemStatus);
  const priorities = Object.values(Priority);
  const allUserIds = Object.values(userMap);
  const allTeamIds = Object.values(teamMap);

  // Status distribution weights: more OPEN items (realistic)
  const statusWeights = [
    { status: WorkItemStatus.OPEN, weight: 35 },
    { status: WorkItemStatus.IN_PROGRESS, weight: 25 },
    { status: WorkItemStatus.AWAITING_APPROVAL, weight: 15 },
    { status: WorkItemStatus.RESOLVED, weight: 15 },
    { status: WorkItemStatus.CLOSED, weight: 10 },
  ];

  function weightedStatus(): WorkItemStatus {
    const total = statusWeights.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total;
    for (const { status, weight } of statusWeights) {
      r -= weight;
      if (r <= 0) return status;
    }
    return WorkItemStatus.OPEN;
  }

  const BATCH_SIZE = 50;
  const TOTAL_ITEMS = 500; // reduced from 2000 to keep seed fast but enough for pagination tests

  for (let i = 0; i < TOTAL_ITEMS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = 0; j < Math.min(BATCH_SIZE, TOTAL_ITEMS - i); j++) {
      const teamId = randomFrom(allTeamIds);
      const createdById = randomFrom(allUserIds);
      const status = weightedStatus();
      const isAssigned = status !== WorkItemStatus.OPEN || Math.random() > 0.4;
      batch.push({
        title: `${randomFrom(ITEM_TITLES)} #${i + j + 1}`,
        description: randomFrom(DESCRIPTIONS),
        type: randomFrom(types),
        priority: randomFrom(priorities),
        status,
        version: Math.floor(Math.random() * 3) + 1,
        teamId,
        assigneeId: isAssigned ? randomFrom(allUserIds) : null,
        createdById,
        dueDate: Math.random() > 0.3 ? randomDate(7, 30) : null,
        createdAt: randomDate(90, 0),
      });
    }
    await prisma.workItem.createMany({ data: batch });

    if ((i + BATCH_SIZE) % 100 === 0) {
      process.stdout.write(`  ${Math.min(i + BATCH_SIZE, TOTAL_ITEMS)}/${TOTAL_ITEMS} items...\r`);
    }
  }

  // Add activity events for a subset of items
  console.log("\nSeeding activity events for recent items...");
  const recentItems = await prisma.workItem.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  for (const item of recentItems) {
    await prisma.activityEvent.create({
      data: {
        workItemId: item.id,
        actorId: item.createdById,
        type: "CREATED",
        description: `Work item created`,
        metadata: { title: item.title },
        createdAt: item.createdAt,
      },
    });
    if (item.assigneeId) {
      await prisma.activityEvent.create({
        data: {
          workItemId: item.id,
          actorId: item.createdById,
          type: "ASSIGNED",
          description: `Item assigned`,
          metadata: { assigneeId: item.assigneeId },
          createdAt: new Date(item.createdAt.getTime() + 60000),
        },
      });
    }
  }

  const counts = {
    teams: await prisma.team.count(),
    users: await prisma.user.count(),
    items: await prisma.workItem.count(),
    events: await prisma.activityEvent.count(),
  };
  console.log(`\nSeed complete:`, counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
