import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireRole, enforceStudentAccessControl } from "../../auth/rbac.middleware.js";
import { getStudentTrends, sanitizeStudentId } from "./trends.service.js";

export * from "./rolling-baseline.js";
export * from "./seed-generator.js";
export * from "./trends.service.js";

/**
 * Module M4: Trend & Anomaly Detection (Team Member 2 — Vani Bhardwaj)
 *
 * API Routes:
 *   GET /api/v1/trends/:id          — Fetch trend deterioration signal and baseline progression for a student
 *   GET /api/v1/students/:id/trends — Alias for student academic trend data
 *
 * Stage 2: Full controller logic with MongoDB persistence and real-time anomaly calculation.
 *
 * RBAC Rules:
 *   - Student: Can only view their own trend signals.
 *   - Instructor / Mentor / HoD / Dean / Admin: Can view trend signals for students in their scope.
 */
const router = Router();

const getTrendsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /trends/:id or GET /students/:id/trends
 * Fetch calculated rolling baseline metrics and trend deterioration signals for a given student ID.
 */
export async function getTrendsHandler(req: Request, res: Response) {
  const rawId = req.params.id;
  const studentId = sanitizeStudentId(rawId);

  if (!studentId) {
    return res.status(400).json({ error: "Invalid or missing student ID" });
  }

  try {
    const trendData = await getStudentTrends(studentId);

    if (!trendData) {
      return res.status(404).json({
        error: `No trend data found for student ${studentId}`,
        studentId,
      });
    }

    return res.status(200).json(trendData);
  } catch (err: any) {
    console.error(`[Trends] Error calculating trends for ${studentId}:`, err);
    return res.status(500).json({
      error: `Failed to retrieve student trends: ${err.message}`,
      studentId,
    });
  }
}

router.get(
  "/trends/:id",
  requireRole("student", "instructor", "mentor", "hod", "dean", "admin"),
  enforceStudentAccessControl,
  getTrendsLimiter,
  getTrendsHandler
);

router.get(
  "/students/:id/trends",
  requireRole("student", "instructor", "mentor", "hod", "dean", "admin"),
  enforceStudentAccessControl,
  getTrendsLimiter,
  getTrendsHandler
);

export default router;
