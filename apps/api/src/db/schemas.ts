import mongoose, { Schema } from "mongoose";
import {
  Alert,
  AssessmentRecord,
  AssignmentSubmission,
  AttendanceRecord,
  AuditEntry,
  Intervention,
  LmsActivity,
  MentorAssignment,
  QuarantineRecord,
  RiskModelVersion,
  RiskSnapshot,
  Student,
  User,
} from "@academic-risk-radar/shared-types";

// Student Schema
const StudentSchema = new Schema<Student>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  enrolmentId: { type: String, required: true, unique: true },
  sectionIds: [{ type: String }],
  programme: { type: String, required: true },
});
export const StudentModel = mongoose.model<Student>("Student", StudentSchema);

// Risk Snapshot Schema (Append-Only)
const RiskSnapshotSchema = new Schema<RiskSnapshot>({
  _id: { type: String, required: true },
  studentId: { type: String, required: true, index: true },
  computedAt: { type: String, required: true, index: true },
  modelVersion: { type: String, required: true },
  band: { type: String, enum: ["low", "moderate", "high", "critical"], required: true },
  factors: [
    {
      name: { type: String, required: true },
      weight: { type: Number, required: true },
      contribution: { type: Number, required: true },
      value: { type: Number, required: true },
    },
  ],
});
RiskSnapshotSchema.index({ studentId: 1, computedAt: -1 });
export const RiskSnapshotModel = mongoose.model<RiskSnapshot>("RiskSnapshot", RiskSnapshotSchema);

// Risk Model Version Schema
const RiskModelVersionSchema = new Schema<RiskModelVersion>({
  version: { type: String, required: true, unique: true },
  effectiveFrom: { type: String, required: true },
  weights: { type: Map, of: Number, required: true },
  thresholds: {
    low: { type: Number, required: true },
    moderate: { type: Number, required: true },
    high: { type: Number, required: true },
    critical: { type: Number, required: true },
  },
  createdBy: { type: String, required: true },
  previousVersion: { type: String, default: null },
});
export const RiskModelVersionModel = mongoose.model<RiskModelVersion>("RiskModelVersion", RiskModelVersionSchema);

// Audit Entry Schema (Append-Only)
const AuditEntrySchema = new Schema<AuditEntry>({
  actorId: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true },
  before: { type: Schema.Types.Mixed, default: null },
  after: { type: Schema.Types.Mixed, default: null },
  timestamp: { type: String, required: true, index: true },
});
export const AuditEntryModel = mongoose.model<AuditEntry>("AuditEntry", AuditEntrySchema);

// User Schema
const UserSchema = new Schema<User>({
  _id: { type: String, required: true },
  role: { type: String, enum: ["student", "instructor", "mentor", "hod", "dean", "admin"], required: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  departmentId: { type: String },
  sectionIds: [{ type: String }],
});
export const UserModel = mongoose.model<User>("User", UserSchema);

// Attendance Record Schema (M1)
const AttendanceRecordSchema = new Schema<AttendanceRecord>({
  studentId: { type: String, required: true, index: true },
  sectionId: { type: String, required: true },
  date: { type: String, required: true, index: true },
  status: { type: String, enum: ["present", "absent", "late"], required: true },
  sourceRef: { type: String, required: true },
});
AttendanceRecordSchema.index({ studentId: 1, sectionId: 1, date: 1 }, { unique: true });
export const AttendanceRecordModel = mongoose.model<AttendanceRecord>("AttendanceRecord", AttendanceRecordSchema);

// Assessment Record Schema (M1)
const AssessmentRecordSchema = new Schema<AssessmentRecord>({
  studentId: { type: String, required: true, index: true },
  courseId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  score: { type: Number, required: true },
  maxScore: { type: Number, required: true },
  date: { type: String, required: true },
  sourceRef: { type: String, required: true },
});
AssessmentRecordSchema.index({ studentId: 1, courseId: 1, type: 1, date: 1 }, { unique: true });
export const AssessmentRecordModel = mongoose.model<AssessmentRecord>("AssessmentRecord", AssessmentRecordSchema);

// Assignment Submission Schema (M1)
const AssignmentSubmissionSchema = new Schema<AssignmentSubmission>({
  studentId: { type: String, required: true, index: true },
  courseId: { type: String, required: true },
  assignmentId: { type: String, required: true, index: true },
  submittedAt: { type: String, default: null },
  status: { type: String, enum: ["submitted", "missing", "late"], required: true },
});
AssignmentSubmissionSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });
export const AssignmentSubmissionModel = mongoose.model<AssignmentSubmission>("AssignmentSubmission", AssignmentSubmissionSchema);

// LMS Activity Schema (M1)
const LmsActivitySchema = new Schema<LmsActivity>({
  studentId: { type: String, required: true, index: true },
  courseId: { type: String, required: true },
  date: { type: String, required: true, index: true },
  activityType: { type: String, required: true },
  durationSec: { type: Number, required: true },
});
LmsActivitySchema.index({ studentId: 1, courseId: 1, date: 1, activityType: 1 }, { unique: true });
LmsActivitySchema.index({ studentId: 1, date: -1 });
export const LmsActivityModel = mongoose.model<LmsActivity>("LmsActivity", LmsActivitySchema);

// Quarantine Record Schema (M1)
const QuarantineRecordSchema = new Schema<QuarantineRecord>({
  originalCollection: { type: String, required: true, index: true },
  rawRecord: { type: Schema.Types.Mixed, required: true },
  reason: { type: String, required: true },
  ingestedAt: { type: String, required: true, index: true },
});
QuarantineRecordSchema.index({ originalCollection: 1, ingestedAt: -1 });
export const QuarantineModel = mongoose.model<QuarantineRecord>("QuarantineRecord", QuarantineRecordSchema);

// Alert Schema (M5)
const AlertSchema = new Schema<Alert>({
  _id: { type: String, required: true },
  studentId: { type: String, required: true, index: true },
  mentorId: { type: String, required: true, index: true },
  riskSnapshotId: { type: String, required: true },
  status: { type: String, enum: ["open", "acknowledged", "escalated", "closed"], required: true, index: true },
  createdAt: { type: String, required: true },
  acknowledgedAt: { type: String, default: null },
  escalatedAt: { type: String, default: null },
  slaDeadline: { type: String, required: true, index: true },
});
AlertSchema.index({ mentorId: 1, status: 1 });
AlertSchema.index({ slaDeadline: 1, status: 1 });
export const AlertModel = mongoose.model<Alert>("Alert", AlertSchema);

// Mentor Assignment Schema (M5)
const MentorAssignmentSchema = new Schema<MentorAssignment>({
  studentId: { type: String, required: true, index: true },
  mentorId: { type: String, required: true, index: true },
  assignedFrom: { type: String, required: true },
  assignedTo: { type: String, default: null },
});
MentorAssignmentSchema.index({ studentId: 1, mentorId: 1 }, { unique: true });
export const MentorAssignmentModel = mongoose.model<MentorAssignment>("MentorAssignment", MentorAssignmentSchema);

// Intervention Schema (M6 — Team Member 4)
const InterventionSchema = new Schema<Intervention>({
  _id: { type: String, required: true },
  alertId: { type: String, required: true, index: true },
  mentorId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  notes: { type: String, required: true },
  createdAt: { type: String, required: true },
  followUpDate: { type: String, default: null },
  outcome: { type: String, default: null },
  outcomeRecordedAt: { type: String, default: null },
});
InterventionSchema.index({ alertId: 1, mentorId: 1 });
InterventionSchema.index({ mentorId: 1, createdAt: -1 });
export const InterventionModel = mongoose.model<Intervention>("Intervention", InterventionSchema);

