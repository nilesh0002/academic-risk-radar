import { Router, Request, Response } from "express";
import { getStudentConsolidatedProfile } from "./profile-aggregator.js";
import { enforceStudentAccessControl } from "../../auth/rbac.middleware.js";

// Module M2: Student Academic Profile (Team Member 3 - Nilesh)
const router = Router();

/**
 * GET /api/v1/students/:id/profile
 * Returns consolidated academic standing combining attendance, assessments,
 * assignments, and LMS engagement.
 *
 * Access control (enforceStudentAccessControl):
 *   - A student can ONLY view their own profile (student.id must match :id).
 *   - An admin can NEVER see raw marks (redirected to aggregated data only).
 *   - Instructors, mentors, HoDs, and deans can view any student in their scope.
 */
router.get("/students/:id/profile", enforceStudentAccessControl, async (req: Request, res: Response) => {
  const { id: studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  try {
    const profile = await getStudentConsolidatedProfile(studentId);
    return res.json({
      status: "success",
      profile,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Failed to fetch student academic profile",
      details: err.message,
    });
  }
});

export default router;
