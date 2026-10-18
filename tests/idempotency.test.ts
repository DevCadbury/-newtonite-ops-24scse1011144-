import { describe, it, expect } from "vitest";
import { getFixtures } from "./setup";
import { withIdempotency } from "../lib/idempotency";

const fx = getFixtures();

describe("Idempotency Keys — Critical Behavior 3", () => {
  it("same key+payload → one handler call, same response", async () => {
    let callCount = 0;
    const handler = async () => { callCount++; return { status: 201, body: { n: callCount } }; };
    const r1 = await withIdempotency("test-idem-001", fx.memberUserId, { a: 1 }, handler);
    const r2 = await withIdempotency("test-idem-001", fx.memberUserId, { a: 1 }, handler);
    expect(callCount).toBe(1);
    expect(r1.wasReplayed).toBe(false);
    expect(r2.wasReplayed).toBe(true);
    expect(r1.body).toEqual(r2.body);
  });

  it("same key+different payload → 422", async () => {
    await withIdempotency("test-idem-002", fx.memberUserId, { v: 1 }, async () => ({ status: 201, body: {} }));
    const r2 = await withIdempotency("test-idem-002", fx.memberUserId, { v: 2 }, async () => ({ status: 201, body: {} }));
    expect(r2.status).toBe(422);
  });

  it("different users can share the same key", async () => {
    const [r1, r2] = await Promise.all([
      withIdempotency("test-idem-003", fx.memberUserId, { x: 1 }, async () => ({ status: 201, body: { u: "m" } })),
      withIdempotency("test-idem-003", fx.leadUserId,   { x: 1 }, async () => ({ status: 201, body: { u: "l" } })),
    ]);
    expect(r1.body).toEqual({ u: "m" });
    expect(r2.body).toEqual({ u: "l" });
  });
});
