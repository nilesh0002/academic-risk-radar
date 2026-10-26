import mongoose from "mongoose";
import {
  AssessmentRecord,
  AssignmentSubmission,
  AttendanceRecord,
  LmsActivity,
} from "@academic-risk-radar/shared-types";
import {
  AssessmentRecordModel,
  AssignmentSubmissionModel,
  AttendanceRecordModel,
  LmsActivityModel,
  StudentModel,
} from "../../db/schemas.js";
import {
  AggregatedStudentMetrics,
  calculateRollingBaseline,
  computeTrendDeteriorationSignal,
  StudentRollingBaseline,
  TrendAnalysisResult,
} from "./rolling-baseline.js";

export interface StudentTrendData {
  studentId: string;
  trendDeteriorationSignal: number;
  baseline: StudentRollingBaseline;
  recent: AggregatedStudentMetrics;
  details: TrendAnalysisResult["details"];
  weeklyHistory: AggregatedStudentMetrics[];
}

/**
 * Sanitize student ID to prevent NoSQL injection.
 */
export function sanitizeStudentId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 128) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Pure aggregation function: partitions raw records into weekly buckets,
 * computes rolling baseline, and calculates trend deterioration signal.
 * Fully unit-testable without database dependency.
 */
export function computeStudentTrendsFromRecords(
  studentId: string,
  records: {
    attendance?: AttendanceRecord[];
    assessments?: AssessmentRecord[];
    assignments?: AssignmentSubmission[];
    lms?: LmsActivity[];
  },
  windowWeeks: number = 4
): StudentTrendData {
  const attendanceList = [...(records.attendance ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const assessmentList = [...(records.assessments ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const assignmentList = records.assignments ?? [];
  const lmsList = [...(records.lms ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // If no historical records at all, return safe baseline (0.0 deterioration)
  if (
    attendanceList.length === 0 &&
    assessmentList.length === 0 &&
    assignmentList.length === 0 &&
    lmsList.length === 0
  ) {
    const emptyBaseline: StudentRollingBaseline = {
      studentId,
      windowWeeks,
      avgAttendanceRate: 1.0,
      avgAssessmentAvg: 1.0,
      avgMissingRatio: 0.0,
      avgLmsEngagementSec: 3600,
    };
    const emptyRecent: AggregatedStudentMetrics = {
      studentId,
      attendanceRate: 1.0,
      assessmentAvg: 1.0,
      missingAssignmentsRatio: 0.0,
      lmsEngagementSec: 3600,
    };
    return {
      studentId,
      trendDeteriorationSignal: 0.0,
      baseline: emptyBaseline,
      recent: emptyRecent,
      details: {
        attendanceDrop: 0,
        assessmentDrop: 0,
        missingRatioIncrease: 0,
        lmsDropRatio: 0,
        isSuddenDrop: false,
      },
      weeklyHistory: [emptyRecent],
    };
  }

  // Determine chronological time boundaries
  const allTimestamps: number[] = [];
  attendanceList.forEach((r) => allTimestamps.push(new Date(r.date).getTime()));
  assessmentList.forEach((r) => allTimestamps.push(new Date(r.date).getTime()));
  lmsList.forEach((r) => allTimestamps.push(new Date(r.date).getTime()));

  const minTime = Math.min(...allTimestamps);
  const maxTime = Math.max(...allTimestamps);
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  // Number of 7-day buckets spanning the records (min 1, max 12)
  const totalWeeks = Math.max(1, Math.min(12, Math.ceil((maxTime - minTime + 1) / ONE_WEEK_MS)));

  const weeklyMetrics: AggregatedStudentMetrics[] = [];

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = minTime + w * ONE_WEEK_MS;
    const weekEnd = weekStart + ONE_WEEK_MS;

    // Filter records in current week
    const weekAtt = attendanceList.filter((r) => {
      const t = new Date(r.date).getTime();
      return t >= weekStart && (w === totalWeeks - 1 ? t <= weekEnd : t < weekEnd);
    });

    const weekAssess = assessmentList.filter((r) => {
      const t = new Date(r.date).getTime();
      return t >= weekStart && (w === totalWeeks - 1 ? t <= weekEnd : t < weekEnd);
    });

    const weekLms = lmsList.filter((r) => {
      const t = new Date(r.date).getTime();
      return t >= weekStart && (w === totalWeeks - 1 ? t <= weekEnd : t < weekEnd);
    });

    // 1. Attendance Rate for week
    let attendanceRate = 1.0;
    if (weekAtt.length > 0) {
      const present = weekAtt.filter((a) => a.status === "present").length;
      const late = weekAtt.filter((a) => a.status === "late").length;
      attendanceRate = (present + late * 0.5) / weekAtt.length;
    }

    // 2. Assessment Average for week
    let assessmentAvg = 1.0;
    if (weekAssess.length > 0) {
      const totalRatio = weekAssess.reduce(
        (sum, a) => sum + (a.maxScore > 0 ? a.score / a.maxScore : 0),
        0
      );
      assessmentAvg = totalRatio / weekAssess.length;
    }

    // 3. LMS Engagement for week
    const lmsEngagementSec = weekLms.reduce((sum, l) => sum + (l.durationSec || 0), 0);

    // 4. Missing Assignments Ratio (if assignments have week info, or proportional)
    const missingAssignmentsRatio =
      assignmentList.length > 0
        ? assignmentList.filter((a) => a.status === "missing").length / assignmentList.length
        : 0.0;

    weeklyMetrics.push({
      studentId,
      attendanceRate: Number(attendanceRate.toFixed(4)),
      assessmentAvg: Number(assessmentAvg.toFixed(4)),
      missingAssignmentsRatio: Number(missingAssignmentsRatio.toFixed(4)),
      lmsEngagementSec,
    });
  }

  // Baseline calculation: trailing weeks prior to the most recent week
  let baseline: StudentRollingBaseline;
  let recent: AggregatedStudentMetrics;

  if (weeklyMetrics.length > 1) {
    const historicalWeeks = weeklyMetrics.slice(0, -1);
    recent = weeklyMetrics[weeklyMetrics.length - 1];
    baseline = calculateRollingBaseline(historicalWeeks, Math.min(windowWeeks, historicalWeeks.length));
  } else {
    // Only 1 week of data available
    recent = weeklyMetrics[0];
    baseline = {
      studentId,
      windowWeeks: 1,
      avgAttendanceRate: recent.attendanceRate,
      avgAssessmentAvg: recent.assessmentAvg,
      avgMissingRatio: recent.missingAssignmentsRatio,
      avgLmsEngagementSec: recent.lmsEngagementSec,
    };
  }

  const trendResult = computeTrendDeteriorationSignal(baseline, recent);

  return {
    studentId,
    trendDeteriorationSignal: trendResult.trendDeteriorationSignal,
    baseline,
    recent,
    details: trendResult.details,
    weeklyHistory: weeklyMetrics,
  };
}

/**
 * Fetch records from MongoDB and compute trend deterioration signal.
 */
export async function getStudentTrends(studentId: string): Promise<StudentTrendData | null> {
  const sanitizedId = sanitizeStudentId(studentId);
  if (!sanitizedId) return null;

  // If MongoDB is not connected, return null
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  // Verify student exists or has records
  const studentExists = await StudentModel.findById(sanitizedId).lean();

  const [attendance, assessments, assignments, lms] = await Promise.all([
    AttendanceRecordModel.find({ studentId: sanitizedId }).lean<AttendanceRecord[]>(),
    AssessmentRecordModel.find({ studentId: sanitizedId }).lean<AssessmentRecord[]>(),
    AssignmentSubmissionModel.find({ studentId: sanitizedId }).lean<AssignmentSubmission[]>(),
    LmsActivityModel.find({ studentId: sanitizedId }).lean<LmsActivity[]>(),
  ]);

  if (
    !studentExists &&
    attendance.length === 0 &&
    assessments.length === 0 &&
    assignments.length === 0 &&
    lms.length === 0
  ) {
    return null;
  }

  return computeStudentTrendsFromRecords(sanitizedId, {
    attendance,
    assessments,
    assignments,
    lms,
  });
}

/**
 * Quick helper returning only the trend deterioration signal (0.0 to 1.0)
 * for integration with the M3 scoring engine / BullMQ scoring worker.
 */
export async function getStudentTrendDeteriorationSignal(studentId: string): Promise<number> {
  try {
    const trendData = await getStudentTrends(studentId);
    if (!trendData) return 0.05; // Fallback default safe signal
    return trendData.trendDeteriorationSignal;
  } catch {
    return 0.05;
  }
}
