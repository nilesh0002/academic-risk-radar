import { Worker, Job } from "bullmq";
import mongoose from "mongoose";
import {
  computeRiskSnapshot,
  DEFAULT_MODEL_VERSION,
  StudentScoringMetrics,
} from "@academic-risk-radar/scoring-engine";
import { RiskModelVersion, RiskSnapshot } from "@academic-risk-radar/shared-types";

let resolvedRedisHost = process.env.REDIS_HOST || "127.0.0.1";
let resolvedRedisPort = parseInt(process.env.REDIS_PORT || "6379", 10);
if (process.env.REDIS_URL) {
  try {
    const parsedRedis = new URL(process.env.REDIS_URL);
    resolvedRedisHost = parsedRedis.hostname || resolvedRedisHost;
    resolvedRedisPort = parseInt(parsedRedis.port || "6379", 10);
  } catch {}
}
const REDIS_HOST = resolvedRedisHost;
const REDIS_PORT = resolvedRedisPort;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/academic_risk_radar";

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
    dbModels = null;
  }
  return dbModels;
}

/**
 * Fetch or compute student scoring metrics from database records or fallback defaults.
 */
export async function gatherStudentMetrics(
  studentId: string,
  models: any
): Promise<StudentScoringMetrics> {
  if (!models) {
    return {
      attendanceRate: 0.85,
      assessmentAvg: 0.75,
      missingAssignmentsRatio: 0.1,
      lmsEngagementRatio: 0.8,
      trendDeteriorationSignal: 0.05,
    };
  }

  try {
    const {
      AttendanceRecordModel,
      AssessmentRecordModel,
      AssignmentSubmissionModel,
      LmsActivityModel,
    } = models;

    // Attendance calculation
    let attendanceRate = 0.85;
    if (AttendanceRecordModel) {
      const attendance = await AttendanceRecordModel.find({ studentId }).lean();
      if (attendance.length > 0) {
        const presentCount = attendance.filter((a: any) => a.status === "present").length;
        const lateCount = attendance.filter((a: any) => a.status === "late").length;
        attendanceRate = (presentCount + lateCount * 0.5) / attendance.length;
      }
    }

    // Assessment calculation
    let assessmentAvg = 0.75;
    if (AssessmentRecordModel) {
      const assessments = await AssessmentRecordModel.find({ studentId }).lean();
      if (assessments.length > 0) {
        const totalPct = assessments.reduce(
          (acc: number, cur: any) => acc + (cur.score / Math.max(1, cur.maxScore)),
          0
        );
        assessmentAvg = totalPct / assessments.length;
      }
    }

    // Missing assignments calculation
    let missingAssignmentsRatio = 0.1;
    if (AssignmentSubmissionModel) {
      const submissions = await AssignmentSubmissionModel.find({ studentId }).lean();
      if (submissions.length > 0) {
        const missingCount = submissions.filter((s: any) => s.status === "missing").length;
        missingAssignmentsRatio = missingCount / submissions.length;
      }
    }

    // LMS engagement calculation
    let lmsEngagementRatio = 0.8;
    if (LmsActivityModel) {
      const lmsActivities = await LmsActivityModel.find({ studentId }).lean();
      if (lmsActivities.length > 0) {
        const totalSec = lmsActivities.reduce((acc: number, cur: any) => acc + (cur.durationSec || 0), 0);
        // Target: 7200 seconds (2 hours) per week
        lmsEngagementRatio = Math.min(1.0, totalSec / 7200);
      }
    }

    // Trend deterioration signal: compute using M4 trends engine if available
    let trendDeteriorationSignal = 0.05;
    try {
      // @ts-ignore
      const trendsModule: any = await import("../../api/dist/src/modules/trends/index.js");
      if (trendsModule?.computeStudentTrendsFromRecords) {
        const attendance = AttendanceRecordModel ? await AttendanceRecordModel.find({ studentId }).lean() : [];
        const assessments = AssessmentRecordModel ? await AssessmentRecordModel.find({ studentId }).lean() : [];
        const assignments = AssignmentSubmissionModel ? await AssignmentSubmissionModel.find({ studentId }).lean() : [];
        const lms = LmsActivityModel ? await LmsActivityModel.find({ studentId }).lean() : [];

        const trendResult = trendsModule.computeStudentTrendsFromRecords(studentId, {
          attendance,
          assessments,
          assignments,
          lms,
        });
        trendDeteriorationSignal = trendResult.trendDeteriorationSignal;
      }
    } catch {
      trendDeteriorationSignal = 0.05;
    }

    return {
      attendanceRate: Math.max(0, Math.min(1, attendanceRate)),
      assessmentAvg: Math.max(0, Math.min(1, assessmentAvg)),
      missingAssignmentsRatio: Math.max(0, Math.min(1, missingAssignmentsRatio)),
      lmsEngagementRatio: Math.max(0, Math.min(1, lmsEngagementRatio)),
      trendDeteriorationSignal: Math.max(0, Math.min(1, trendDeteriorationSignal)),
    };
  } catch (err: any) {
    console.warn(`[Scoring Worker] Error aggregating metrics for ${studentId}:`, err.message);
    return {
      attendanceRate: 0.85,
      assessmentAvg: 0.75,
      missingAssignmentsRatio: 0.1,
      lmsEngagementRatio: 0.8,
      trendDeteriorationSignal: 0.05,
    };
  }
}

/**
 * BullMQ Worker for batch risk scoring queue processing.
 * Owned by Team Member 1 (Pawan) (Module M3).
 *
 * Each job payload contains:
 *   - studentIds?: string[]  — optional list of student IDs to score
 *   - cohortId?: string      — optional section/cohort filter
 *   - triggeredBy?: string   — actor ID who initiated the scoring
 *   - enqueuedAt?: string    — ISO timestamp
 */
export const scoringWorker = new Worker(
  "risk-scoring-queue",
  async (job: Job) => {
    const startTime = Date.now();
    const { studentIds, cohortId, triggeredBy, enqueuedAt } = job.data || {};

    console.log(
      `[Scoring Worker] Processing risk calculation job ${job.id} | triggeredBy: ${triggeredBy || "system"} | enqueuedAt: ${enqueuedAt}`
    );

    const models = await getDbModels();
    let targetStudents: string[] = studentIds || [];

    // If no specific student IDs provided, discover from StudentModel or fallback
    if (targetStudents.length === 0 && models?.StudentModel) {
      try {
        const query: any = {};
        if (cohortId) {
          query.sectionIds = cohortId;
        }
        const studentDocs = await models.StudentModel.find(query).select("_id").lean();
        targetStudents = studentDocs.map((s: any) => s._id);
      } catch (err: any) {
        console.warn(`[Scoring Worker] Could not fetch students: ${err.message}`);
      }
    }

    // Fallback if still empty
    if (targetStudents.length === 0) {
      targetStudents = ["STU_DEMO_001", "STU_DEMO_002", "STU_DEMO_003"];
    }

    // Fetch active model version
    let activeVersion: RiskModelVersion = DEFAULT_MODEL_VERSION;
    if (models?.RiskModelVersionModel) {
      try {
        const versionDoc = await models.RiskModelVersionModel.findOne().sort({ effectiveFrom: -1 }).lean();
        if (versionDoc) {
          const weights = versionDoc.weights instanceof Map
            ? Object.fromEntries(versionDoc.weights)
            : versionDoc.weights;
          activeVersion = {
            version: versionDoc.version,
            effectiveFrom: versionDoc.effectiveFrom,
            weights: weights || DEFAULT_MODEL_VERSION.weights,
            thresholds: versionDoc.thresholds || DEFAULT_MODEL_VERSION.thresholds,
            createdBy: versionDoc.createdBy,
            previousVersion: versionDoc.previousVersion ?? null,
          };
        }
      } catch (err: any) {
        console.warn(`[Scoring Worker] Could not fetch active model version: ${err.message}`);
      }
    }

    const computedAt = new Date().toISOString();
    const createdSnapshots: RiskSnapshot[] = [];

    // Score each student deterministically
    for (const studentId of targetStudents) {
      const metrics = await gatherStudentMetrics(studentId, models);
      const snapshot = computeRiskSnapshot(studentId, metrics, activeVersion, computedAt);

      // Append snapshot to MongoDB (never overwrite)
      if (models?.RiskSnapshotModel) {
        try {
          await models.RiskSnapshotModel.create(snapshot);
        } catch (err: any) {
          console.warn(`[Scoring Worker] Error saving snapshot for ${studentId}: ${err.message}`);
        }
      }

      // Stage 2 M5 Hook: Automatically generate/deduplicate alert for high/critical students
      if (["high", "critical"].includes(snapshot.band) && models?.AlertModel) {
        try {
          const assignment = models.MentorAssignmentModel
            ? await models.MentorAssignmentModel.findOne({ studentId, assignedTo: null }).lean()
            : null;
          const mentorId = assignment?.mentorId || "MTR-DEFAULT";

          const existingAlert = await models.AlertModel.findOne({ studentId, status: "open" });
          if (existingAlert) {
            existingAlert.riskSnapshotId = snapshot._id;
            await existingAlert.save();
          } else {
            const crypto = await import("crypto");
            const slaDeadline = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
            await models.AlertModel.create({
              _id: crypto.randomUUID(),
              studentId,
              mentorId,
              riskSnapshotId: snapshot._id,
              status: "open",
              createdAt: computedAt,
              acknowledgedAt: null,
              escalatedAt: null,
              slaDeadline,
            });
          }
        } catch (err: any) {
          console.warn(`[Scoring Worker] Error generating/deduplicating alert for ${studentId}: ${err.message}`);
        }
      }

      createdSnapshots.push(snapshot);
    }

    const durationMs = Date.now() - startTime;
    console.log(
      `[Scoring Worker] Job ${job.id} completed: scored ${createdSnapshots.length} students under version ${activeVersion.version} in ${durationMs}ms`
    );

    return {
      status: "completed",
      jobId: job.id,
      modelVersion: activeVersion.version,
      studentsScored: createdSnapshots.length,
      durationMs,
      computedAt,
    };
  },
  {
    connection: { host: REDIS_HOST, port: REDIS_PORT },
    concurrency: 2,
  }
);

// Worker Lifecycle event handlers
scoringWorker.on("completed", (job: Job | undefined) => {
  if (job) {
    console.log(`[Scoring Worker] Job ${job.id} finished successfully.`);
  }
});

scoringWorker.on("failed", (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`[Scoring Worker] Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);
  }
});

// Connect to MongoDB when the worker starts (non-test environment)
if (process.env.NODE_ENV !== "test") {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(`[Scoring Worker] Connected to MongoDB at ${MONGO_URI}`);
    })
    .catch((err) => {
      console.error("[Scoring Worker] MongoDB Connection Error:", err.message);
    });
}
