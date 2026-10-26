import crypto from "crypto";
import mongoose from "mongoose";
import { Alert, RiskSnapshot } from "@academic-risk-radar/shared-types";
import {
  AlertModel,
  AuditEntryModel,
  MentorAssignmentModel,
  RiskSnapshotModel,
} from "../../db/schemas.js";

export interface AlertGenerationResult {
  alert: Alert | null;
  action: "created" | "updated" | "ignored" | "no_mentor";
  reason?: string;
}

export interface EscalationResult {
  status: "completed" | "skipped";
  checkedAt: string;
  escalatedCount: number;
  escalatedAlerts: Array<{ alertId: string; studentId: string; mentorId: string }>;
}

/**
 * Sanitize ID parameter to prevent NoSQL injection.
 */
export function sanitizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Generate or deduplicate an Alert for a given RiskSnapshot.
 *
 * Requirements:
 * 1. Only snapshots with band "high" or "critical" trigger an alert.
 * 2. Lookup mentorId via MentorAssignment.
 * 3. Deduplication rule: If an open alert exists for the student, update riskSnapshotId instead of creating a duplicate.
 * 4. Default SLA: 48 hours from creation.
 */
export async function generateOrUpdateAlertForSnapshot(
  snapshot: RiskSnapshot
): Promise<AlertGenerationResult> {
  // If MongoDB is not connected, return graceful stub
  if (mongoose.connection.readyState !== 1) {
    return {
      alert: null,
      action: "ignored",
      reason: "MongoDB not connected",
    };
  }

  // 1. Check if band qualifies for alerting
  if (snapshot.band !== "high" && snapshot.band !== "critical") {
    return {
      alert: null,
      action: "ignored",
      reason: `Snapshot band '${snapshot.band}' is not high or critical`,
    };
  }

  // Sanitize user-controlled studentId before any DB query (prevents NoSQL injection)
  const studentId = sanitizeId(snapshot.studentId);
  if (!studentId) {
    return {
      alert: null,
      action: "ignored",
      reason: "Invalid or missing studentId on snapshot",
    };
  }

  // 2. Lookup assigned mentor
  const assignment = await MentorAssignmentModel.findOne({
    studentId: { $eq: studentId },
    assignedTo: null,
  }).lean();

  let mentorId = assignment?.mentorId;
  if (!mentorId) {
    // Check any past assignment or fallback mentor
    const anyAssignment = await MentorAssignmentModel.findOne({ studentId: { $eq: studentId } }).lean();
    mentorId = anyAssignment?.mentorId || "MTR-DEFAULT";
  }

  // 3. Deduplication: Check for existing open alert for the student
  const existingOpenAlert = await AlertModel.findOne({
    studentId: { $eq: studentId },
    status: "open",
  });

  if (existingOpenAlert) {
    // Update existing open alert with newest snapshot reference
    existingOpenAlert.riskSnapshotId = snapshot._id;
    await existingOpenAlert.save();

    return {
      alert: existingOpenAlert.toObject ? existingOpenAlert.toObject() : existingOpenAlert,
      action: "updated",
      reason: "Existing open alert updated with new risk snapshot (deduplication applied)",
    };
  }

  // 4. Create new Alert with 48h SLA deadline
  const now = new Date();
  const SLA_HOURS = 48;
  const slaDeadline = new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000).toISOString();

  const newAlertDoc = new AlertModel({
    _id: crypto.randomUUID(),
    studentId,
    mentorId,
    riskSnapshotId: snapshot._id,
    status: "open",
    createdAt: now.toISOString(),
    acknowledgedAt: null,
    escalatedAt: null,
    slaDeadline,
  });

  await newAlertDoc.save();

  return {
    alert: newAlertDoc.toObject ? newAlertDoc.toObject() : newAlertDoc,
    action: "created",
  };
}

/**
 * Pure deduplication logic helper for unit tests (in-memory simulation).
 */
export function simulateAlertDeduplication(
  existingAlerts: Alert[],
  snapshot: RiskSnapshot,
  mentorId: string = "MTR-001"
): { alerts: Alert[]; result: AlertGenerationResult } {
  if (snapshot.band !== "high" && snapshot.band !== "critical") {
    return {
      alerts: existingAlerts,
      result: { alert: null, action: "ignored", reason: "Band not high or critical" },
    };
  }

  const openIndex = existingAlerts.findIndex(
    (a) => a.studentId === snapshot.studentId && a.status === "open"
  );

  if (openIndex !== -1) {
    const updated = {
      ...existingAlerts[openIndex],
      riskSnapshotId: snapshot._id,
    };
    const newAlerts = [...existingAlerts];
    newAlerts[openIndex] = updated;
    return {
      alerts: newAlerts,
      result: {
        alert: updated,
        action: "updated",
        reason: "Deduplicated against open alert",
      },
    };
  }

  const now = new Date();
  const slaDeadline = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const created: Alert = {
    _id: `alert-${Date.now()}`,
    studentId: snapshot.studentId,
    mentorId,
    riskSnapshotId: snapshot._id,
    status: "open",
    createdAt: now.toISOString(),
    acknowledgedAt: null,
    escalatedAt: null,
    slaDeadline,
  };

  return {
    alerts: [...existingAlerts, created],
    result: { alert: created, action: "created" },
  };
}

/**
 * SLA Escalation logic: Checks for open alerts past their SLA deadline,
 * marks them as 'escalated', updates escalatedAt, and emits HoD notification / audit trail.
 */
export async function checkAndEscalateAlerts(
  referenceTime: Date = new Date(),
  injectedModels?: any
): Promise<EscalationResult> {
  const models = injectedModels;
  const ActiveAlertModel = models?.AlertModel || AlertModel;
  const ActiveAuditModel = models?.AuditEntryModel || AuditEntryModel;

  const nowIso = referenceTime.toISOString();

  if (!ActiveAlertModel || (!injectedModels && mongoose.connection.readyState !== 1)) {
    return {
      status: "skipped",
      checkedAt: nowIso,
      escalatedCount: 0,
      escalatedAlerts: [],
    };
  }

  const breachedAlerts = await ActiveAlertModel.find({
    status: "open",
    slaDeadline: { $lte: nowIso },
  });

  const escalatedList: Array<{ alertId: string; studentId: string; mentorId: string }> = [];

  for (const alert of breachedAlerts) {
    const prevStatus = alert.status;
    alert.status = "escalated";
    alert.escalatedAt = nowIso;
    await alert.save();

    // Emit HoD Notification
    console.warn(
      `🚨 [HoD Escalation Notification] Alert ${alert._id} for Student ${alert.studentId} (Mentor: ${alert.mentorId}) has breached SLA deadline (${alert.slaDeadline}). Escalated to Head of Department.`
    );

    // Record immutable audit entry if AuditEntryModel exists
    if (ActiveAuditModel) {
      try {
        await ActiveAuditModel.create({
          actorId: "system:sla-escalation-worker",
          action: "ALERT_ESCALATED_SLA_BREACH",
          entityType: "Alert",
          entityId: alert._id,
          before: { status: prevStatus, slaDeadline: alert.slaDeadline },
          after: { status: "escalated", escalatedAt: nowIso },
          timestamp: nowIso,
        });
      } catch (err: any) {
        console.warn(`[Escalation Service] Could not write audit entry for alert ${alert._id}:`, err.message);
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
