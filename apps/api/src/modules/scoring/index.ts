import { Router } from "express";
import { requireRole, enforceStudentAccessControl } from "../../auth/rbac.middleware.js";
import { getStudentRisk, triggerBatchScoring } from "./scoring.controller.js";

// Module M3: Risk Scoring Engine Router (Team Member 1 - Pawan)
const router = Router();

/**
 * GET /api/v1/students/:id/risk
 * Returns the latest RiskSnapshot for the given student.
 * Guarded by role verification and enforceStudentAccessControl.
 */
router.get(
  "/students/:id/risk",
  requireRole("student", "instructor", "mentor", "hod", "dean", "admin"),
  enforceStudentAccessControl,
  getStudentRisk
);

/**
 * POST /api/v1/scoring/batch
 * Enqueue batch risk calculations for all or specified students.
 */
router.post(
  "/scoring/batch",
  requireRole("admin", "instructor", "hod", "dean"),
  triggerBatchScoring
);

export default router;
