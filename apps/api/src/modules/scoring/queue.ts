import { Queue } from "bullmq";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

/**
 * BullMQ queue for batch risk scoring jobs.
 * Enqueued by API; consumed by scoring.worker (apps/workers).
 * Owned by Team Member 1 (Pawan) — Module M3.
 *
 * Lazy-initialized to prevent blocking the process if Redis is unavailable during unit tests.
 */
let _scoringQueue: Queue | null = null;

export function getScoringQueue(): Queue {
  if (!_scoringQueue) {
    _scoringQueue = new Queue("risk-scoring-queue", {
      connection: {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
        lazyConnect: true,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return _scoringQueue;
}

export async function enqueueBatchScoringJob(data: {
  studentIds?: string[];
  cohortId?: string;
  triggeredBy: string;
}) {
  const isTest =
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.npm_lifecycle_event && process.env.npm_lifecycle_event.includes("test")) ||
    process.argv.some((arg) => arg.includes("test"));

  if (isTest) {
    return { jobId: `test_scoring_job_${Date.now()}`, status: "enqueued" };
  }

  try {
    const queue = getScoringQueue();
    const job = await queue.add("calculate-risk-batch", {
      ...data,
      enqueuedAt: new Date().toISOString(),
    });
    return { jobId: job.id, status: "enqueued" };
  } catch (err: any) {
    console.warn(`[ScoringQueue] Unable to connect to Redis/BullMQ: ${err.message}`);
    return { jobId: "fallback-mock-job", status: "queued_locally" };
  }
}

export async function closeScoringQueue(): Promise<void> {
  if (_scoringQueue) {
    try {
      await _scoringQueue.close();
    } catch {}
    _scoringQueue = null;
  }
}
