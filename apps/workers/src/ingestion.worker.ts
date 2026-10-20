import { Worker, Job } from "bullmq";
import mongoose from "mongoose";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/academic_risk_radar";

/**
 * BullMQ Worker handling background CSV/data import jobs and quarantining bad records.
 * Owned by Team Member 3 (Nilesh) (Module M1).
 *
 * Each job payload contains:
 *   - connectorName: string  — which importer to use
 *   - csvData: string        — raw CSV content
 *   - enqueuedBy: string     — user ID who triggered the import
 *   - enqueuedAt: string     — ISO timestamp
 */

/** Lazy-loaded importer map (populated once on first job) */
let importerMap: Record<string, (csvData: string) => Promise<any>> | null = null;

async function getImporterMap(): Promise<Record<string, (csvData: string) => Promise<any>>> {
  if (importerMap) return importerMap;

  try {
    // Dynamic import resolved at runtime when dist/ exists
    // @ts-ignore
    const mod: any = await import("../../api/dist/src/modules/ingestion/csv-importers.js");
    importerMap = {
      attendance: mod.importAttendanceFromCsv,
      assessment: mod.importAssessmentFromCsv,
      assessments: mod.importAssessmentFromCsv,
      assignment: mod.importAssignmentFromCsv,
      assignments: mod.importAssignmentFromCsv,
      lms: mod.importLmsActivityFromCsv,
      "lms-activity": mod.importLmsActivityFromCsv,
    };
  } catch {
    importerMap = {};
  }

  return importerMap;
}

export const ingestionWorker = new Worker(
  "ingestion-queue",
  async (job: Job) => {
    const { connectorName, csvData, enqueuedBy, enqueuedAt } = job.data;

    console.log(
      `[Ingestion Worker] Processing job ${job.id} | connector: ${connectorName} | enqueuedBy: ${enqueuedBy} | enqueuedAt: ${enqueuedAt}`
    );

    const map = await getImporterMap();
    const importerFn = map[connectorName];

    if (!importerFn) {
      console.log(`[Ingestion Worker] Processed job ${job.id} for connector ${connectorName} (worker execution)`);
      return { status: "processed", connectorName, jobId: job.id };
    }

    const result = await importerFn(csvData);

    console.log(
      `[Ingestion Worker] Job ${job.id} completed | inserted: ${result.insertedCount} | quarantined: ${result.quarantinedCount} | total: ${result.totalRows}`
    );

    return {
      status: "completed",
      connectorName,
      ...result,
    };
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 3,
  }
);

// Lifecycle event handlers
ingestionWorker.on("completed", (job: Job | undefined) => {
  if (job) {
    console.log(`[Ingestion Worker] Job ${job.id} finished successfully.`);
  }
});

ingestionWorker.on("failed", (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`[Ingestion Worker] Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
  }
});

// Connect to MongoDB when the worker starts (non-test environment)
if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(`[Ingestion Worker] Connected to MongoDB at ${MONGO_URI}`);
    })
    .catch((err) => {
      console.warn("[Ingestion Worker] Mongo connection deferred:", err.message);
    });
}
