/**
 * Transactional Outbox Worker
 *
 * Polls the outbox_jobs table and processes jobs reliably:
 * - Atomic job claiming via UPDATE WHERE status='PENDING' FOR UPDATE SKIP LOCKED
 * - Bounded retries (max 5) with exponential backoff
 * - Recovery of jobs stuck in PROCESSING for >5 minutes
 * - Idempotent handlers per job type
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const POLL_INTERVAL_MS    = 5_000;
const STUCK_THRESHOLD_MIN = 5;
const MAX_ATTEMPTS        = 5;

interface OutboxJob {
  id: string;
  workItemId: string | null;
  type: string;
  payload: unknown;
  attempts: number;
}

// ── Job handlers (idempotent) ────────────────────────────────────────────────

async function processJob(job: OutboxJob): Promise<void> {
  switch (job.type) {
    case "ITEM_STATUS_CHANGED": {
      const p = job.payload as any;
      console.log(
        `[worker] STATUS_CHANGED item=${p.workItemId} ` +
        `${p.fromStatus} → ${p.toStatus} by ${p.actorName}`
      );
      // Future: send email/webhook/Slack notification here
      break;
    }
    case "ITEM_ASSIGNED": {
      const p = job.payload as any;
      console.log(
        `[worker] ASSIGNED item=${p.workItemId} → ${p.assigneeName}`
      );
      break;
    }
    default:
      console.log(`[worker] Unknown job type: ${job.type}`, job.payload);
  }
}

// ── Recover stuck jobs ────────────────────────────────────────────────────────

async function recoverStuckJobs(): Promise<void> {
  const stuckBefore = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60 * 1_000);
  const result = await prisma.$executeRaw`
    UPDATE "outbox_jobs"
    SET status       = 'PENDING'::"JobStatus",
        process_after = NOW()
    WHERE status          = 'PROCESSING'::"JobStatus"
      AND last_attempt_at < ${stuckBefore}
      AND attempts        < max_attempts
  `;
  if (result > 0) console.log(`[worker] Recovered ${result} stuck jobs`);
}

// ── Claim and process one batch ───────────────────────────────────────────────

async function pollOnce(): Promise<void> {
  const now = new Date();

  // Atomically claim up to 5 pending jobs using SKIP LOCKED for concurrency safety
  const jobs = await prisma.$queryRaw<OutboxJob[]>`
    UPDATE "outbox_jobs"
    SET status          = 'PROCESSING'::"JobStatus",
        last_attempt_at = NOW(),
        attempts        = attempts + 1
    WHERE id IN (
      SELECT id FROM "outbox_jobs"
      WHERE status       = 'PENDING'::"JobStatus"
        AND process_after <= ${now}
        AND attempts      < max_attempts
      ORDER BY created_at ASC
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, work_item_id AS "workItemId", type, payload, attempts
  `;

  for (const job of jobs) {
    try {
      await processJob(job);
      await prisma.outboxJob.update({
        where: { id: job.id },
        data: { status: "DONE", completedAt: new Date() },
      });
    } catch (err) {
      console.error(`[worker] Job ${job.id} (${job.type}) failed:`, err);
      const isFinal = job.attempts >= MAX_ATTEMPTS;
      const backoffMs = Math.min(1_000 * Math.pow(2, job.attempts), 60_000);
      await prisma.outboxJob.update({
        where: { id: job.id },
        data: {
          status: isFinal ? "FAILED" : "PENDING",
          processAfter: isFinal ? undefined : new Date(Date.now() + backoffMs),
        },
      });
      if (isFinal) {
        console.error(`[worker] Job ${job.id} permanently failed after ${MAX_ATTEMPTS} attempts`);
      }
    }
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[worker] Outbox worker started");
  while (true) {
    try {
      await recoverStuckJobs();
      await pollOnce();
    } catch (err) {
      console.error("[worker] Poll loop error:", err);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
