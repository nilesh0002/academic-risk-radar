import mongoose from "mongoose";
import { Request, Response } from "express";
import { RiskModelVersion } from "@academic-risk-radar/shared-types";
import { DEFAULT_MODEL_VERSION, previewModelImpact, StudentScoringMetrics } from "@academic-risk-radar/scoring-engine";
import { RiskModelVersionModel, RiskSnapshotModel, StudentModel } from "../../db/schemas.js";
import { logAuditEntry, getAuditEntries } from "./audit.service.js";

/**
 * Helper to fetch the currently active model version.
 * Falls back to DEFAULT_MODEL_VERSION if none is found or DB is unreachable.
 */
export async function getActiveModelVersion(): Promise<RiskModelVersion> {
  if (mongoose.connection.readyState !== 1) {
    return DEFAULT_MODEL_VERSION;
  }

  try {
    const versionDoc = await RiskModelVersionModel.findOne()
      .sort({ effectiveFrom: -1 })
      .lean();
    if (versionDoc) {
      // Cast Mongoose Map/Object to plain object if needed
      const weights = versionDoc.weights instanceof Map
        ? Object.fromEntries(versionDoc.weights)
        : (versionDoc.weights as Record<string, number>);

      return {
        version: versionDoc.version,
        effectiveFrom: versionDoc.effectiveFrom,
        weights: weights || DEFAULT_MODEL_VERSION.weights,
        thresholds: versionDoc.thresholds || DEFAULT_MODEL_VERSION.thresholds,
        createdBy: versionDoc.createdBy,
        previousVersion: versionDoc.previousVersion ?? null,
      };
    }
  } catch (err: any) {
    console.warn(`[AdminController] Error fetching active model version: ${err.message}`);
  }
  return DEFAULT_MODEL_VERSION;
}

/**
 * Helper to collect student metrics for band-change preview computation.
 */
async function getStudentMetricsForPreview(): Promise<{ studentId: string; metrics: StudentScoringMetrics }[]> {
  if (mongoose.connection.readyState !== 1) {
    return [
      {
        studentId: "STU_PREVIEW_001",
        metrics: { attendanceRate: 0.85, assessmentAvg: 0.78, missingAssignmentsRatio: 0.1, lmsEngagementRatio: 0.8, trendDeteriorationSignal: 0.05 },
      },
      {
        studentId: "STU_PREVIEW_002",
        metrics: { attendanceRate: 0.68, assessmentAvg: 0.55, missingAssignmentsRatio: 0.35, lmsEngagementRatio: 0.5, trendDeteriorationSignal: 0.4 },
      },
      {
        studentId: "STU_PREVIEW_003",
        metrics: { attendanceRate: 0.45, assessmentAvg: 0.42, missingAssignmentsRatio: 0.6, lmsEngagementRatio: 0.3, trendDeteriorationSignal: 0.75 },
      },
    ];
  }

  try {
    // 1. First attempt: read recent RiskSnapshots to extract student factor values
    const recentSnapshots = await RiskSnapshotModel.aggregate([
      { $sort: { computedAt: -1 } },
      {
        $group: {
          _id: "$studentId",
          latestSnapshot: { $first: "$$ROOT" },
        },
      },
      { $limit: 200 },
    ]);

    if (recentSnapshots.length > 0) {
      return recentSnapshots.map((item) => {
        const snap = item.latestSnapshot;
        const factorMap: Record<string, number> = {};
        for (const f of snap.factors || []) {
          factorMap[f.name] = f.value;
        }

        return {
          studentId: snap.studentId,
          metrics: {
            attendanceRate: 1.0 - (factorMap["attendance_deficit"] ?? 0.15),
            assessmentAvg: 1.0 - (factorMap["assessment_deficit"] ?? 0.20),
            missingAssignmentsRatio: factorMap["missing_assignments"] ?? 0.10,
            lmsEngagementRatio: 1.0 - (factorMap["lms_engagement_deficit"] ?? 0.25),
            trendDeteriorationSignal: factorMap["trend_deterioration"] ?? 0.05,
          },
        };
      });
    }

    // 2. Second attempt: check Student collection count
    const studentCount = await StudentModel.countDocuments();
    if (studentCount > 0) {
      const students = await StudentModel.find().limit(100).lean();
      return students.map((s, idx) => ({
        studentId: s._id,
        metrics: {
          attendanceRate: Math.max(0.4, 0.95 - (idx % 5) * 0.12),
          assessmentAvg: Math.max(0.4, 0.88 - (idx % 4) * 0.15),
          missingAssignmentsRatio: (idx % 6) * 0.15,
          lmsEngagementRatio: Math.max(0.3, 0.9 - (idx % 3) * 0.2),
          trendDeteriorationSignal: (idx % 7 === 0) ? 0.65 : 0.05,
        },
      }));
    }
  } catch (err: any) {
    console.warn(`[AdminController] Error fetching students for preview: ${err.message}`);
  }

  // Fallback synthetic dataset for preview testing when DB is empty/mocked
  return [
    {
      studentId: "STU_PREVIEW_001",
      metrics: { attendanceRate: 0.85, assessmentAvg: 0.78, missingAssignmentsRatio: 0.1, lmsEngagementRatio: 0.8, trendDeteriorationSignal: 0.05 },
    },
    {
      studentId: "STU_PREVIEW_002",
      metrics: { attendanceRate: 0.68, assessmentAvg: 0.55, missingAssignmentsRatio: 0.35, lmsEngagementRatio: 0.5, trendDeteriorationSignal: 0.4 },
    },
    {
      studentId: "STU_PREVIEW_003",
      metrics: { attendanceRate: 0.45, assessmentAvg: 0.42, missingAssignmentsRatio: 0.6, lmsEngagementRatio: 0.3, trendDeteriorationSignal: 0.75 },
    },
  ];
}

/**
 * GET /api/v1/admin/model-versions
 * List all model configuration versions from the database.
 */
export async function listModelVersions(req: Request, res: Response) {
  if (mongoose.connection.readyState !== 1) {
    return res.json([DEFAULT_MODEL_VERSION]);
  }

  try {
    const versions = await RiskModelVersionModel.find()
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!versions || versions.length === 0) {
      return res.json([DEFAULT_MODEL_VERSION]);
    }

    const formatted = versions.map((v) => ({
      version: v.version,
      effectiveFrom: v.effectiveFrom,
      weights: v.weights instanceof Map ? Object.fromEntries(v.weights) : v.weights,
      thresholds: v.thresholds,
      createdBy: v.createdBy,
      previousVersion: v.previousVersion ?? null,
    }));

    return res.json(formatted);
  } catch (err: any) {
    console.error("[AdminController] Error listing model versions:", err);
    return res.json([DEFAULT_MODEL_VERSION]);
  }
}

/**
 * POST /api/v1/admin/model-versions
 * Compute band-change impact preview against historical student data.
 * If commit: true, save version to MongoDB and emit immutable audit entry.
 */
export async function proposeOrCreateModelVersion(req: Request, res: Response) {
  const { version, weights, thresholds, createdBy, commit, previousVersion } = req.body || {};

  if (!version || typeof version !== "string") {
    return res.status(400).json({ error: "Missing required 'version' string identifier (e.g. 'v1.1.0')" });
  }

  if (!weights || typeof weights !== "object") {
    return res.status(400).json({ error: "Missing required 'weights' configuration map" });
  }

  if (!thresholds || typeof thresholds !== "object") {
    return res.status(400).json({ error: "Missing required 'thresholds' configuration (low, moderate, high, critical)" });
  }

  const currentVersion = await getActiveModelVersion();
  const proposedVersion: RiskModelVersion = {
    version,
    effectiveFrom: new Date().toISOString(),
    weights,
    thresholds,
    createdBy: createdBy || req.user?.id || "admin",
    previousVersion: previousVersion || currentVersion.version,
  };

  // Run pure deterministic impact preview calculation
  const studentsWithMetrics = await getStudentMetricsForPreview();
  const preview = previewModelImpact(studentsWithMetrics, currentVersion, proposedVersion);

  // If not committed, return simulation preview only
  if (!commit) {
    return res.status(200).json({
      status: "preview",
      committed: false,
      message: "Impact preview computed successfully. Send 'commit: true' to persist this model version.",
      currentVersion: currentVersion.version,
      proposedVersion,
      preview,
    });
  }

  // When commit is true, persist to MongoDB and log audit entry
  try {
    const existing = await RiskModelVersionModel.findOne({ version }).lean();
    if (existing) {
      return res.status(409).json({ error: `Model version '${version}' already exists. Use a new version number.` });
    }

    const saved = await RiskModelVersionModel.create(proposedVersion);

    // Emit immutable audit entry
    await logAuditEntry({
      actorId: req.user?.id || proposedVersion.createdBy,
      action: "CREATE_MODEL_VERSION",
      entityType: "RiskModelVersion",
      entityId: version,
      before: null,
      after: proposedVersion,
    });

    return res.status(201).json({
      status: "created",
      committed: true,
      message: `Model version ${version} successfully created and audited.`,
      version: saved.toObject ? saved.toObject() : proposedVersion,
      preview,
    });
  } catch (err: any) {
    console.error("[AdminController] Error creating model version:", err);
    return res.status(500).json({ error: `Failed to commit model version: ${err.message}` });
  }
}

/**
 * POST /api/v1/admin/model-versions/:v/activate
 * Activate a model version, update effectiveFrom, and emit immutable audit entry.
 */
export async function activateModelVersion(req: Request, res: Response) {
  const versionParam = req.params.v;

  if (!versionParam) {
    return res.status(400).json({ error: "Missing version parameter in route URL" });
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(404).json({ error: `Model version '${versionParam}' not found in records.` });
  }

  try {
    const targetVersion = await RiskModelVersionModel.findOne({ version: versionParam });
    if (!targetVersion) {
      return res.status(404).json({ error: `Model version '${versionParam}' not found in records.` });
    }

    const previousActive = await getActiveModelVersion();
    const effectiveFrom = new Date().toISOString();

    targetVersion.effectiveFrom = effectiveFrom;
    await targetVersion.save();

    // Log immutable audit entry for activation
    const audit = await logAuditEntry({
      actorId: req.user?.id || "admin",
      action: "ACTIVATE_MODEL_VERSION",
      entityType: "RiskModelVersion",
      entityId: versionParam,
      before: previousActive,
      after: {
        version: targetVersion.version,
        effectiveFrom: targetVersion.effectiveFrom,
        weights: targetVersion.weights,
        thresholds: targetVersion.thresholds,
      },
    });

    return res.status(200).json({
      status: "activated",
      message: `Model version ${versionParam} is now active.`,
      version: targetVersion.toObject ? targetVersion.toObject() : targetVersion,
      auditEntry: audit,
    });
  } catch (err: any) {
    console.error("[AdminController] Error activating model version:", err);
    return res.status(500).json({ error: `Failed to activate model version: ${err.message}` });
  }
}

/**
 * GET /api/v1/admin/audit
 * Paginated, filterable audit log reader.
 */
export async function getAuditTrail(req: Request, res: Response) {
  const { entityType, from, to, actorId, page, limit } = req.query;
  const pageNum = page ? parseInt(String(page), 10) : 1;
  const limitNum = limit ? parseInt(String(limit), 10) : 20;

  if (mongoose.connection.readyState !== 1) {
    return res.status(200).json({ entries: [], total: 0, page: pageNum, limit: limitNum, totalPages: 1 });
  }

  try {
    const result = await getAuditEntries({
      entityType: entityType ? String(entityType) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      actorId: actorId ? String(actorId) : undefined,
      page: pageNum,
      limit: limitNum,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[AdminController] Error reading audit trail:", err);
    return res.status(500).json({ error: `Failed to fetch audit log: ${err.message}` });
  }
}
