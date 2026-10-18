import { describe, it, expect, beforeAll } from "vitest";
import { testPrisma, getFixtures } from "./setup";

const fx = getFixtures();
const PAGE_SIZE = 5;

beforeAll(async () => {
  await testPrisma.workItem.createMany({
    data: Array.from({ length: 12 }, (_, i) => ({
      title: `TEST pagination item ${String(i + 1).padStart(2, "0")}`,
      type: "TASK" as const,
      priority: "MEDIUM" as const,
      status: "OPEN" as const,
      teamId: fx.teamId,
      createdById: fx.memberUserId,
    })),
  });
}, 15000);

async function fetchPage(cursor?: string) {
  const cursorClause = cursor
    ? (() => {
        const { createdAt, id } = JSON.parse(Buffer.from(cursor, "base64").toString());
        return { OR: [{ createdAt: { lt: new Date(createdAt) } }, { AND: [{ createdAt: new Date(createdAt) }, { id: { lt: id } }] }] };
      })()
    : {};
  const items = await testPrisma.workItem.findMany({
    where: { teamId: fx.teamId, title: { startsWith: "TEST pagination" }, ...cursorClause },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
  });
  const hasMore = items.length > PAGE_SIZE;
  if (hasMore) items.pop();
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ createdAt: items.at(-1)!.createdAt.toISOString(), id: items.at(-1)!.id })).toString("base64")
    : null;
  return { items, nextCursor, hasMore };
}

describe("Cursor Pagination — Critical Behavior 7", () => {
  it("first page returns PAGE_SIZE items with a next cursor", async () => {
    const p = await fetchPage();
    expect(p.items).toHaveLength(PAGE_SIZE);
    expect(p.hasMore).toBe(true);
    expect(p.nextCursor).not.toBeNull();
  });

  it("pages have no duplicates or gaps", async () => {
    const p1 = await fetchPage();
    const p2 = await fetchPage(p1.nextCursor!);
    const p3 = await fetchPage(p2.nextCursor ?? undefined);
    const ids = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(12);
  });

  it("last page has hasMore=false", async () => {
    const p1 = await fetchPage();
    const p2 = await fetchPage(p1.nextCursor!);
    const p3 = await fetchPage(p2.nextCursor ?? undefined);
    expect(p3.hasMore).toBe(false);
  });
});
