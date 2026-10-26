import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireRole } from "../../auth/rbac.middleware.js";
import {
  acknowledgeAlert,
  getAlertById,
  listAlerts,
  triggerAlertGeneration,
} from "./alerts.controller.js";

export * from "./alerts.service.js";
export * from "./alerts.controller.js";

/**
 * Module M5: Alert Routing & Mentor Inbox (Team Member 2 — Vani Bhardwaj)
 *
 * API Routes (from docs/api-contract.md):
 *   GET  /api/v1/alerts?mentorId=&status=   — Fetch mentor alert inbox
 *   POST /api/v1/alerts/:id/acknowledge     — Acknowledge an open risk alert
 *   GET  /api/v1/alerts/:id                 — Retrieve single alert details
 *   POST /api/v1/alerts/generate            — Automated/Internal alert generator
 *
 * Stage 2: Full controller logic, MongoDB persistence, and BullMQ SLA worker.
 *
 * RBAC Rules:
 *   - Mentor: Can access and acknowledge alerts for assigned mentees only.
 *   - HoD / Dean / Admin: Can view department/institution alert statistics.
 */
const router = Router();

const listAlertsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const acknowledgeAlertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const getAlertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const generateAlertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/v1/alerts?mentorId=&status=
router.get(
  "/alerts",
  requireRole("mentor", "instructor", "hod", "dean", "admin"),
  listAlertsLimiter,
  listAlerts
);

// GET /api/v1/alerts/:id
router.get(
  "/alerts/:id",
  requireRole("mentor", "instructor", "hod", "dean", "admin"),
  getAlertLimiter,
  getAlertById
);

// POST /api/v1/alerts/:id/acknowledge
router.post(
  "/alerts/:id/acknowledge",
  requireRole("mentor", "hod", "dean", "admin"),
  acknowledgeAlertLimiter,
  acknowledgeAlert
);

// POST /api/v1/alerts/generate
router.post(
  "/alerts/generate",
  requireRole("admin", "mentor", "instructor", "hod", "dean"),
  generateAlertLimiter,
  triggerAlertGeneration
);

export default router;
