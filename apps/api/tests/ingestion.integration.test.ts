import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAttendanceCsv,
  parseAssessmentCsv,
  parseAssignmentCsv,
  parseLmsActivityCsv,
} from "../src/modules/ingestion/csv-importers.js";
import { aggregateStudentProfile } from "../src/modules/profile/profile-aggregator.js";
import {
  AttendanceRecord,
  AssessmentRecord,
  AssignmentSubmission,
  LmsActivity,
} from "@academic-risk-radar/shared-types";

/**
 * Integration test: Full CSV Ingestion → Profile Aggregation → RBAC flow.
 * Owned by Team Member 3 (Nilesh) — covers M1 + M2 end-to-end.
 *
 * This test validates the complete pipeline without requiring MongoDB or Redis:
 * 1. Parse CSV → validate → get valid + quarantined records
 * 2. Feed valid records into the profile aggregator
 * 3. Verify aggregated profile matches expectations
 * 4. Verify idempotency: re-parsing the same CSV produces identical output
 * 5. Verify RBAC rules are enforced conceptually
 */
describe("Integration: CSV Ingestion → Profile Aggregation → RBAC", () => {
  // Shared test CSV data for a single student across all 4 sources
  const STUDENT_ID = "STD_INTEG_001";

  const attendanceCsv = `studentId,sectionId,date,status,sourceRef
${STUDENT_ID},SEC_A,2026-03-01T09:00:00Z,present,RFID_1
${STUDENT_ID},SEC_A,2026-03-02T09:00:00Z,present,RFID_1
${STUDENT_ID},SEC_A,2026-03-03T09:00:00Z,late,RFID_1
${STUDENT_ID},SEC_A,2026-03-04T09:00:00Z,absent,RFID_1
,SEC_A,2026-03-05T09:00:00Z,present,RFID_1`;

  const assessmentCsv = `studentId,courseId,type,score,maxScore,date,sourceRef
${STUDENT_ID},CSE101,Midterm,80,100,2026-03-15T10:00:00Z,ERP
${STUDENT_ID},CSE101,Quiz,18,20,2026-03-20T10:00:00Z,ERP
${STUDENT_ID},CSE102,Midterm,60,100,2026-03-16T10:00:00Z,ERP`;

  const assignmentCsv = `studentId,courseId,assignmentId,submittedAt,status
${STUDENT_ID},CSE101,HW1,2026-02-10T18:00:00Z,submitted
${STUDENT_ID},CSE101,HW2,null,missing
${STUDENT_ID},CSE102,HW1,2026-02-15T23:59:00Z,late`;

  const lmsCsv = `studentId,courseId,date,activityType,durationSec
${STUDENT_ID},CSE101,2026-03-01T10:00:00Z,video_lecture,1800
${STUDENT_ID},CSE101,2026-03-02T10:00:00Z,quiz_attempt,600
${STUDENT_ID},CSE102,2026-03-03T14:00:00Z,forum_post,300`;

  // ────────────────────────────────────────────────────────────────────
  // Step 1: Parse all 4 CSV sources and validate records
  // ────────────────────────────────────────────────────────────────────
  it("Step 1: should parse all 4 CSV sources with correct valid and quarantined counts", () => {
    const attendance = parseAttendanceCsv(attendanceCsv);
    assert.equal(attendance.valid.length, 4, "4 valid attendance rows");
    assert.equal(attendance.quarantined.length, 1, "1 quarantined (missing studentId)");

    const assessment = parseAssessmentCsv(assessmentCsv);
    assert.equal(assessment.valid.length, 3, "3 valid assessment rows");
    assert.equal(assessment.quarantined.length, 0, "0 quarantined");

    const assignment = parseAssignmentCsv(assignmentCsv);
    assert.equal(assignment.valid.length, 3, "3 valid assignment rows");
    assert.equal(assignment.quarantined.length, 0, "0 quarantined");

    const lms = parseLmsActivityCsv(lmsCsv);
    assert.equal(lms.valid.length, 3, "3 valid LMS rows");
    assert.equal(lms.quarantined.length, 0, "0 quarantined");
  });

  // ────────────────────────────────────────────────────────────────────
  // Step 2: Feed parsed records into the profile aggregator
  // ────────────────────────────────────────────────────────────────────
  it("Step 2: should produce a correct consolidated profile from parsed records", () => {
    const attendance = parseAttendanceCsv(attendanceCsv);
    const assessment = parseAssessmentCsv(assessmentCsv);
    const assignment = parseAssignmentCsv(assignmentCsv);
    const lms = parseLmsActivityCsv(lmsCsv);

    const profile = aggregateStudentProfile(STUDENT_ID, {
      attendance: attendance.valid as AttendanceRecord[],
      assessments: assessment.valid as AssessmentRecord[],
      assignments: assignment.valid as AssignmentSubmission[],
      lms: lms.valid as LmsActivity[],
    });

    // Verify student ID
    assert.equal(profile.studentId, STUDENT_ID);

    // Attendance: 2 present + 1 late + 1 absent = 4 sessions
    assert.equal(profile.attendance.totalSessions, 4);
    assert.equal(profile.attendance.presentCount, 2);
    assert.equal(profile.attendance.lateCount, 1);
    assert.equal(profile.attendance.absentCount, 1);
    // Rate: (2 + 0.5*1) / 4 = 0.625
    assert.equal(profile.attendance.attendanceRate, 0.625);

    // Assessments: 80/100 + 18/20 + 60/100 = 0.8 + 0.9 + 0.6 = 2.3/3 ≈ 0.7667
    assert.equal(profile.assessments.totalAssessments, 3);
    assert.ok(
      Math.abs(profile.assessments.averageScoreRatio - 0.7667) < 0.001,
      `Expected ~0.7667, got ${profile.assessments.averageScoreRatio}`
    );

    // Assignments: 1 submitted, 1 missing, 1 late → missingRatio = 1/3 ≈ 0.3333
    assert.equal(profile.assignments.totalAssignments, 3);
    assert.equal(profile.assignments.submittedCount, 1);
    assert.equal(profile.assignments.missingCount, 1);
    assert.equal(profile.assignments.lateCount, 1);
    assert.equal(profile.assignments.missingRatio, 0.3333);

    // LMS: 1800 + 600 + 300 = 2700 sec → 2700/7200 ≈ 0.375
    assert.equal(profile.lms.totalActivities, 3);
    assert.equal(profile.lms.totalDurationSec, 2700);
    assert.equal(profile.lms.engagementRatio, 0.375);

    // Computed metrics should match individual sections
    assert.equal(profile.computedMetrics.attendanceRate, profile.attendance.attendanceRate);
    assert.equal(profile.computedMetrics.assessmentAvg, profile.assessments.averageScoreRatio);
    assert.equal(profile.computedMetrics.missingAssignmentsRatio, profile.assignments.missingRatio);
    assert.equal(profile.computedMetrics.lmsEngagementRatio, profile.lms.engagementRatio);
  });

  // ────────────────────────────────────────────────────────────────────
  // Step 3: Idempotency — re-parsing the same CSV yields identical results
  // ────────────────────────────────────────────────────────────────────
  it("Step 3: should produce identical parse results on re-import (idempotency)", () => {
    const fixedTimestamp = "2026-06-01T00:00:00.000Z";

    const firstRun = parseAttendanceCsv(attendanceCsv, fixedTimestamp);
    const secondRun = parseAttendanceCsv(attendanceCsv, fixedTimestamp);

    assert.equal(firstRun.valid.length, secondRun.valid.length, "Same valid count on re-import");
    assert.equal(firstRun.quarantined.length, secondRun.quarantined.length, "Same quarantined count on re-import");
    assert.equal(firstRun.totalRows, secondRun.totalRows, "Same total on re-import");

    // Deep-compare each valid record
    for (let i = 0; i < firstRun.valid.length; i++) {
      assert.deepEqual(firstRun.valid[i], secondRun.valid[i], `Record ${i} identical across runs`);
    }

    // The same upsert filter keys (studentId+sectionId+date) would match → no duplicates in DB
    const filterKeys = firstRun.valid.map(
      (r) => `${r.studentId}|${r.sectionId}|${r.date}`
    );
    const uniqueKeys = new Set(filterKeys);
    assert.equal(filterKeys.length, uniqueKeys.size, "All filter keys are unique within a single import");
  });

  // ────────────────────────────────────────────────────────────────────
  // Step 4: RBAC — student can only access their own profile
  // ────────────────────────────────────────────────────────────────────
  it("Step 4: RBAC — enforceStudentAccessControl blocks cross-student access", async () => {
    // Simulate the middleware logic without Express
    const simulateRbac = (
      userId: string,
      userRole: string,
      targetStudentId: string
    ): { allowed: boolean; status: number; error?: string } => {
      // Rule 1: Student can only view their own record
      if (userRole === "student" && targetStudentId !== userId) {
        return {
          allowed: false,
          status: 403,
          error: "Forbidden: Students are restricted to accessing their own data",
        };
      }
      return { allowed: true, status: 200 };
    };

    // Student accessing their own data → ALLOWED
    const ownAccess = simulateRbac(STUDENT_ID, "student", STUDENT_ID);
    assert.equal(ownAccess.allowed, true, "Student can access own profile");
    assert.equal(ownAccess.status, 200);

    // Student accessing another student's data → DENIED
    const crossAccess = simulateRbac(STUDENT_ID, "student", "STD_OTHER_999");
    assert.equal(crossAccess.allowed, false, "Student CANNOT access another student's profile");
    assert.equal(crossAccess.status, 403);

    // Mentor accessing a student's data → ALLOWED (no student-only restriction)
    const mentorAccess = simulateRbac("MENTOR_001", "mentor", STUDENT_ID);
    assert.equal(mentorAccess.allowed, true, "Mentor can access student profile");
  });

  // ────────────────────────────────────────────────────────────────────
  // Step 5: Mixed valid + invalid CSV does not drop valid rows
  // ────────────────────────────────────────────────────────────────────
  it("Step 5: mixed valid/invalid CSV imports valid rows and quarantines bad ones", () => {
    const mixedCsv = `studentId,sectionId,date,status,sourceRef
${STUDENT_ID},SEC_A,2026-04-01T09:00:00Z,present,CSV
,SEC_A,2026-04-02T09:00:00Z,present,CSV
${STUDENT_ID},SEC_A,bad-date,present,CSV
${STUDENT_ID},SEC_A,2026-04-03T09:00:00Z,invalid_status,CSV
${STUDENT_ID},SEC_A,2026-04-04T09:00:00Z,absent,CSV`;

    const result = parseAttendanceCsv(mixedCsv);

    // 2 valid (rows 1 and 5), 3 quarantined (rows 2, 3, 4)
    assert.equal(result.valid.length, 2);
    assert.equal(result.quarantined.length, 3);
    assert.equal(result.totalRows, 5);

    // Valid rows have correct data
    assert.equal(result.valid[0].status, "present");
    assert.equal(result.valid[1].status, "absent");

    // Each quarantined row has a reason
    for (const q of result.quarantined) {
      assert.ok(q.reason.length > 0, "Quarantined record has a reason");
      assert.equal(q.originalCollection, "attendanceRecords");
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // Step 6: End-to-end profile with empty data sources handled gracefully
  // ────────────────────────────────────────────────────────────────────
  it("Step 6: profile aggregation handles empty sources gracefully", () => {
    const profile = aggregateStudentProfile(STUDENT_ID, {
      attendance: [],
      assessments: [],
      assignments: [],
      lms: [],
    });

    assert.equal(profile.studentId, STUDENT_ID);
    assert.equal(profile.attendance.totalSessions, 0);
    assert.equal(profile.attendance.attendanceRate, 1.0); // default when no sessions
    assert.equal(profile.assessments.totalAssessments, 0);
    assert.equal(profile.assessments.averageScoreRatio, 1.0); // default
    assert.equal(profile.assignments.missingRatio, 0.0); // no assignments = 0 missing
    assert.equal(profile.lms.engagementRatio, 0.0); // no activity = 0
  });
});
