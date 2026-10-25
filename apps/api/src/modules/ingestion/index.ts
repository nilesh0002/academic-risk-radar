import { Router, Request, Response } from "express";
import {
  AssessmentRecordModel,
  AssignmentSubmissionModel,
  AttendanceRecordModel,
  LmsActivityModel,
  QuarantineModel,
} from "../../db/schemas.js";
import {
  importAssessmentFromCsv,
  importAssignmentFromCsv,
  importAttendanceFromCsv,
  importLmsActivityFromCsv,
} from "./csv-importers.js";
import { getIngestionQueue } from "./queue.js";

// Module M1: Ingestion & Normalisation (Team Member 3 - Nilesh)
const router = Router();

/** Supported connector names for validation */
const SUPPORTED_CONNECTORS = ["attendance", "assessment", "assessments", "assignment", "assignments", "lms", "lms-activity"];

/**
 * GET /api/v1/admin/connectors/status
 * Returns ingestion summary: total imported records across sources and quarantined count.
 */
router.get("/connectors/status", async (req: Request, res: Response) => {
  try {
    const [
      attendanceCount,
      assessmentCount,
      assignmentCount,
      lmsCount,
      quarantineCount,
    ] = await Promise.all([
      AttendanceRecordModel.countDocuments().catch(() => 0),
      AssessmentRecordModel.countDocuments().catch(() => 0),
      AssignmentSubmissionModel.countDocuments().catch(() => 0),
      LmsActivityModel.countDocuments().catch(() => 0),
      QuarantineModel.countDocuments().catch(() => 0),
    ]);

    res.json({
      status: "operational",
      sources: {
        attendance: { count: attendanceCount, health: "active" },
        assessments: { count: assessmentCount, health: "active" },
        assignments: { count: assignmentCount, health: "active" },
        lmsActivity: { count: lmsCount, health: "active" },
      },
      quarantine: {
        totalRecords: quarantineCount,
      },
      lastChecked: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch connector status", details: err.message });
  }
});

/**
 * POST /api/v1/admin/connectors/:name/sync
 * Accepts CSV payload and enqueues an asynchronous ingestion job via BullMQ.
 * Returns immediately with a job ID so the caller can poll for completion.
 *
 * If Redis/BullMQ is unavailable, falls back to synchronous processing
 * to ensure the import pipeline remains functional in all environments.
 */
router.post("/connectors/:name/sync", async (req: Request, res: Response) => {
  const { name } = req.params;
  const csvData: string = req.body.csvData || (typeof req.body === "string" ? req.body : "");

  if (!csvData) {
    return res.status(400).json({
      error: "Missing required 'csvData' in request body",
      example: { csvData: "header1,header2\\nval1,val2" },
    });
  }

  const normalizedName = name.toLowerCase();

  if (!SUPPORTED_CONNECTORS.includes(normalizedName)) {
    return res.status(400).json({
      error: `Unknown connector '${name}'. Supported connectors: attendance, assessment, assignment, lms`,
    });
  }

  try {
    const queue = getIngestionQueue();
    const job = await queue.add("csv-sync", {
      connectorName: normalizedName,
      csvData,
      enqueuedBy: req.user?.id || "unknown",
      enqueuedAt: new Date().toISOString(),
    });

    return res.status(202).json({
      status: "queued",
      jobId: job.id,
      connector: name,
      message: `CSV ingestion job enqueued for connector '${name}'. Use the job ID to track progress.`,
    });
  } catch (err: any) {
    // Fallback: if Redis/BullMQ is unavailable, process synchronously
    console.warn(`[Ingestion] BullMQ enqueue failed, falling back to synchronous processing: ${err.message}`);

    try {
      switch (normalizedName) {
        case "attendance": {
          const result = await importAttendanceFromCsv(csvData);
          return res.json({ status: "success", connector: name, mode: "sync-fallback", ...result });
        }
        case "assessment":
        case "assessments": {
          const result = await importAssessmentFromCsv(csvData);
          return res.json({ status: "success", connector: name, mode: "sync-fallback", ...result });
        }
        case "assignment":
        case "assignments": {
          const result = await importAssignmentFromCsv(csvData);
          return res.json({ status: "success", connector: name, mode: "sync-fallback", ...result });
        }
        case "lms":
        case "lms-activity": {
          const result = await importLmsActivityFromCsv(csvData);
          return res.json({ status: "success", connector: name, mode: "sync-fallback", ...result });
        }
        default:
          return res.status(400).json({
            error: `Unknown connector '${name}'.`,
          });
      }
    } catch (syncErr: any) {
      return res.status(500).json({
        error: `Failed to process sync for connector '${name}'`,
        details: syncErr.message,
      });
    }
  }
});

export default router;
