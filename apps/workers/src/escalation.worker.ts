import { Worker, Job, Queue } from "bullmq";
import mongoose from "mongoose";
import { Alert } from "@academic-risk-radar/shared-types";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/academic_risk_radar";

export const ALERT_ESCALATION_QUEUE = "alert-escalation-queue";

/**
 * Lazy helper to import API schemas/models if available at runtime.
 */
let dbModels: any = null;
async function getDbModels(): Promise<any> {
  if (dbModels) return dbModels;
  try {
    // @ts-ignore
    dbModels = await import("../../api/dist/src/db/schemas.js");
  } catch {
    try {
      // @ts-ignore
      dbModels = await import("../../../api/dist/src/db/schemas.js");
    } catch {
      dbModels = null;
    }
  }
  return dbModels;
}

export interface EscalationResult {
  status: "completed" | "skipped";
  checkedAt: string;
  escalatedCount: number;
  escalatedAlerts: Array<{ alertId: string; studentId: string; mentorId: string }>;
}

/**
 * Pure / Service logic: Checks for open alerts past their SLA deadline,
 * marks them as 'escalated', updates escalatedAt, and emits HoD notification / audit trail.
 */
export async function checkAndEscalateAlerts(
  referenceTime: Date = new Date(),
  injectedModels?: any
): Promise<EscalationResult> {
  const models = injectedModels || (await getDbModels());
  const AlertModel = models?.AlertModel || mongoose.models.Alert;
  const AuditEntryModel = models?.AuditEntryModel || mongoose.models.AuditEntry;

  const nowIso = referenceTime.toISOString();

  if (!AlertModel || mongoose.connection.readyState !== 1) {
    return {
      status: "skipped",
      checkedAt: nowIso,
      escalatedCount: 0,
      escalatedAlerts: [],
    };
  }

  // Find all open alerts whose slaDeadline is at or before referenceTime
  const breachedAlerts = await AlertModel.find({
    status: "open",
    slaDeadline: { $lte: nowIso },
  });

  const escalatedList: Array<{ alertId: string; studentId: string; mentorId: string }> = [];

  for (const alert of breachedAlerts) {
    const prevStatus = alert.status;
    alert.status = "escalated";
    alert.escalatedAt = nowIso;
    await alert.save();

    // Emit HoD Notification (Console log notification banner)
    console.warn(
      `🚨 [HoD Escalation Notification] Alert ${alert._id} for Student ${alert.studentId} (Mentor: ${alert.mentorId}) has breached SLA deadline (${alert.slaDeadline}). Escalated to Head of Department.`
    );

    // Record immutable audit entry if AuditEntryModel exists
    if (AuditEntryModel) {
      try {
        await AuditEntryModel.create({
          actorId: "system:sla-escalation-worker",
          action: "ALERT_ESCALATED_SLA_BREACH",
          entityType: "Alert",
          entityId: alert._id,
          before: { status: prevStatus, slaDeadline: alert.slaDeadline },
          after: { status: "escalated", escalatedAt: nowIso },
          timestamp: nowIso,
        });
      } catch (err: any) {
        console.warn(`[Escalation Worker] Could not write audit entry for alert ${alert._id}:`, err.message);
      }
    }

    escalatedList.push({
      alertId: alert._id,
      studentId: alert.studentId,
      mentorId: alert.mentorId,
    });
  }

  return {
    status: "completed",
    checkedAt: nowIso,
    escalatedCount: escalatedList.length,
    escalatedAlerts: escalatedList,
  };
}

/**
 * Helper to enqueue an SLA escalation check job into BullMQ.
 */
let escalationQueue: Queue | null = null;
export function getEscalationQueue(): Queue {
  if (!escalationQueue) {
    escalationQueue = new Queue(ALERT_ESCALATION_QUEUE, {
      connection: { host: REDIS_HOST, port: REDIS_PORT },
    });
  }
  return escalationQueue;
}

export async function enqueueAlertEscalationJob(data: { checkTime?: string } = {}) {
  const queue = getEscalationQueue();
  const job = await queue.add("check-sla-escalations", {
    checkTime: data.checkTime || new Date().toISOString(),
    enqueuedAt: new Date().toISOString(),
  });
  return { jobId: job.id };
}

/**
 * BullMQ Worker checking for alerts that breached SLA deadlines and escalating them to Head of Department (HoD).
 * Owned by Team Member 2 (Module M5).
 */
export const escalationWorker = new Worker(
  ALERT_ESCALATION_QUEUE,
  async (job: Job) => {
    const checkTime = job.data?.checkTime ? new Date(job.data.checkTime) : new Date();
    console.log(
      `[Escalation Worker] Checking alert SLA deadlines... Job ID: ${job.id} | Reference Time: ${checkTime.toISOString()}`
    );

    const result = await checkAndEscalateAlerts(checkTime);

    console.log(
      `[Escalation Worker] Job ${job.id} completed: ${result.escalatedCount} alert(s) escalated to HoD.`
    );

    return result;
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 2,
  }
);

escalationWorker.on("completed", (job: Job | undefined) => {
  if (job) {
    console.log(`[Escalation Worker] Job ${job.id} finished successfully.`);
  }
});

escalationWorker.on("failed", (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`[Escalation Worker] Job ${job.id} failed:`, err.message);
  }
});

if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(`[Escalation Worker] Connected to MongoDB at ${MONGO_URI}`);
    })
    .catch((err) => {
      console.warn("[Escalation Worker] Mongo connection deferred:", err.message);
    });
}
