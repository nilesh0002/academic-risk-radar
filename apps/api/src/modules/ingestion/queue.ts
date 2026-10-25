import { Queue } from "bullmq";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);

/**
 * BullMQ queue for CSV ingestion jobs.
 * The API enqueues jobs here; the ingestion worker (apps/workers) consumes them.
 * Owned by Team Member 3 (Nilesh) — Module M1.
 *
 * Lazy-initialized to avoid blocking the process when Redis is unavailable
 * (e.g. during unit tests that don't require the queue).
 */
let _queue: Queue | null = null;

export function getIngestionQueue(): Queue {
  if (!_queue) {
    _queue = new Queue("ingestion-queue", {
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
  return _queue;
}
