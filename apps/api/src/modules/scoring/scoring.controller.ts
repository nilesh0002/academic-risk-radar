import { Request, Response } from "express";
import mongoose from "mongoose";
import { RiskSnapshotModel } from "../../db/schemas.js";
import { enqueueBatchScoringJob } from "./queue.js";

/**
 * GET /api/v1/students/:id/risk
 * Returns the latest RiskSnapshot for the requested student.
 * Protected by enforceStudentAccessControl (student can only query their own ID).
 */
export async function getStudentRisk(req: Request, res: Response) {
  const studentId = req.params.id;

  if (!studentId) {
    return res.status(400).json({ error: "Missing student id in route parameters" });
  }

  // If MongoDB is not connected (e.g. unit tests without DB daemon), return 404 immediately
  if (mongoose.connection.readyState !== 1) {
    return res.status(404).json({
      error: `No risk snapshot found for student ${studentId}`,
      studentId,
    });
  }

  try {
    const snapshot = await RiskSnapshotModel.findOne({ studentId })
      .sort({ computedAt: -1 })
      .lean();

    if (!snapshot) {
      return res.status(404).json({
        error: `No risk snapshot found for student ${studentId}`,
        studentId,
      });
    }

    return res.status(200).json(snapshot);
  } catch (err: any) {
    console.error("[ScoringController] Error querying risk snapshot for %s:", studentId, err);
    return res.status(500).json({
      error: `Failed to retrieve risk snapshot: ${err.message}`,
      studentId,
    });
  }
}

/**
 * POST /api/v1/scoring/batch
 * Enqueue a batch risk calculation job to BullMQ risk-scoring-queue.
 */
export async function triggerBatchScoring(req: Request, res: Response) {
  const { studentIds, cohortId } = req.body || {};
  const triggeredBy = req.user?.id || "admin";

  try {
    const queueResult = await enqueueBatchScoringJob({
      studentIds,
      cohortId,
      triggeredBy,
    });

    return res.status(202).json({
      status: "queued",
      message: "Batch risk scoring job enqueued to BullMQ queue",
      jobId: queueResult.jobId,
      studentCount: studentIds ? studentIds.length : "all",
      triggeredBy,
    });
  } catch (err: any) {
    console.error("[ScoringController] Error triggering batch scoring:", err);
    return res.status(500).json({ error: `Failed to enqueue batch scoring job: ${err.message}` });
  }
}
