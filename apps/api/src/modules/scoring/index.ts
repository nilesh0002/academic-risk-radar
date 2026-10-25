import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireRole, enforceStudentAccessControl } from "../../auth/rbac.middleware.js";
import { getStudentRisk, triggerBatchScoring } from "./scoring.controller.js";

// Module M3: Risk Scoring Engine Router (Team Member 1 - Pawan)
const router = Router();

const getStudentRiskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

const triggerBatchScoringLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Stricter limit for expensive batch trigger
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /api/v1/students/:id/risk
 * Returns the latest RiskSnapshot for the given student.
 * Guarded by role verification and enforceStudentAccessControl.
 */
router.get(
  "/students/:id/risk",
  requireRole("student", "instructor", "mentor", "hod", "dean", "admin"),
  enforceStudentAccessControl,
  getStudentRiskLimiter,
  getStudentRisk
);

/**
 * POST /api/v1/scoring/batch
 * Enqueue batch risk calculations for all or specified students.
 */
router.post(
  "/scoring/batch",
  requireRole("admin", "instructor", "hod", "dean"),
  triggerBatchScoringLimiter,
  triggerBatchScoring
);

export default router;
