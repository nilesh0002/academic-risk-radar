export interface Student {
  _id: string;
  name: string;
  enrolmentId: string;
  sectionIds: string[];
  programme: string;
}

export interface AttendanceRecord {
  studentId: string;
  sectionId: string;
  date: string;       // ISO date
  status: "present" | "absent" | "late";
  sourceRef: string;
}

export interface AssessmentRecord {
  studentId: string;
  courseId: string;
  type: string;
  score: number;
  maxScore: number;
  date: string;
  sourceRef: string;
}

export interface AssignmentSubmission {
  studentId: string;
  courseId: string;
  assignmentId: string;
  submittedAt: string | null;
  status: "submitted" | "missing" | "late";
}

export interface LmsActivity {
  studentId: string;
  courseId: string;
  date: string;
  activityType: string;
  durationSec: number;
}

export interface QuarantineRecord {
  originalCollection: string;
  rawRecord: unknown;
  reason: string;
  ingestedAt: string;
}

export type RiskBand = "low" | "moderate" | "high" | "critical";

export interface RiskFactor {
  name: string;
  weight: number;
  contribution: number;
  value: number;
}

export interface RiskSnapshot {
  _id: string;
  studentId: string;
  computedAt: string;
  modelVersion: string;
  band: RiskBand;
  factors: RiskFactor[];
}

export interface RiskModelVersion {
  version: string;
  effectiveFrom: string;
  weights: Record<string, number>;
  thresholds: Record<RiskBand, number>;
  createdBy: string;
  previousVersion: string | null;
}

export type AlertStatus = "open" | "acknowledged" | "escalated" | "closed";

export interface Alert {
  _id: string;
  studentId: string;
  mentorId: string;
  riskSnapshotId: string;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  escalatedAt: string | null;
  slaDeadline: string;
}

export interface Intervention {
  _id: string;
  alertId: string;
  mentorId: string;
  action: string;
  notes: string;
  createdAt: string;
  followUpDate: string | null;
  outcome: string | null;
  outcomeRecordedAt: string | null;
}

export interface MentorAssignment {
  studentId: string;
  mentorId: string;
  assignedFrom: string;
  assignedTo: string | null;
}

export type UserRole = "student" | "instructor" | "mentor" | "hod" | "dean" | "admin";

export interface User {
  _id: string;
  role: UserRole;
  name: string;
  email: string;
  passwordHash?: string;
  departmentId?: string;
  sectionIds?: string[];
  identityId?: string;
}

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  timestamp: string;
}
