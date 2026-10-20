import { Worker, Job } from "bullmq";
import mongoose from "mongoose";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/academic_risk_radar";

/**
 * BullMQ Worker handling background CSV/data import jobs and quarantining bad records.
 * Owned by Team Member 3 (Nilesh) (Module M1).
 *
 * This worker dynamically imports the CSV importers from the API package at runtime.
 * At build time the two workspaces are independent; the import happens only when
 * the compiled JS is executed from the monorepo root where both `dist/` trees coexist.
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

  // Dynamic import avoids compile-time rootDir issues across workspaces
  const mod = await import(
    /* webpackIgnore: true */
    "../../api/dist/src/modules/ingestion/csv-importers.js"
  );

  importerMap = {
    attendance: mod.importAttendanceFromCsv,
    assessment: mod.importAssessmentFromCsv,
    assessments: mod.importAssessmentFromCsv,
    assignment: mod.importAssignmentFromCsv,
    assignments: mod.importAssignmentFromCsv,
    lms: mod.importLmsActivityFromCsv,
    "lms-activity": mod.importLmsActivityFromCsv,
  };

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
      const errorMsg = `Unknown connector name: '${connectorName}'`;
      console.error(`[Ingestion Worker] ${errorMsg}`);
      throw new Error(errorMsg);
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

// Connect to MongoDB when the worker starts
async function startWorker() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Ingestion Worker] Connected to MongoDB at ${MONGO_URI}`);
    console.log("[Ingestion Worker] Listening for ingestion-queue jobs...");
  } catch (err) {
    console.error("[Ingestion Worker] Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

startWorker();
