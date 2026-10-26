process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import http from "node:http";
import app from "../src/server.js";
import {
  AggregatedStudentMetrics,
  calculateRollingBaseline,
  computeTrendDeteriorationSignal,
} from "../src/modules/trends/rolling-baseline.js";
import {
  computeStudentTrendsFromRecords,
  sanitizeStudentId,
} from "../src/modules/trends/trends.service.js";
import {
  AssessmentRecord,
  AssignmentSubmission,
  AttendanceRecord,
  LmsActivity,
} from "@academic-risk-radar/shared-types";

function makeRequest(
  path: string,
  method: string = "GET",
  headers: Record<string, string> = {}
): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to get server address"));
      }

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => {
            rawData += chunk;
          });
          res.on("end", () => {
            server.close();
            try {
              const data = JSON.parse(rawData);
              resolve({ statusCode: res.statusCode || 500, data });
            } catch {
              resolve({ statusCode: res.statusCode || 500, data: rawData });
            }
          });
        }
      );

      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.end();
    });
  });
}

describe("M4: Trend & Anomaly Detection — Rolling Baseline & Deterioration Engine", () => {
  describe("calculateRollingBaseline", () => {
    it("should accurately compute rolling average across past metric windows", () => {
      const history: AggregatedStudentMetrics[] = [
        { studentId: "STD100", attendanceRate: 0.95, assessmentAvg: 0.90, missingAssignmentsRatio: 0.0, lmsEngagementSec: 3600 },
        { studentId: "STD100", attendanceRate: 0.90, assessmentAvg: 0.85, missingAssignmentsRatio: 0.0, lmsEngagementSec: 3200 },
        { studentId: "STD100", attendanceRate: 0.92, assessmentAvg: 0.88, missingAssignmentsRatio: 0.0, lmsEngagementSec: 3400 },
        { studentId: "STD100", attendanceRate: 0.91, assessmentAvg: 0.89, missingAssignmentsRatio: 0.0, lmsEngagementSec: 3500 },
      ];

      const baseline = calculateRollingBaseline(history, 4);

      assert.equal(baseline.studentId, "STD100");
      assert.equal(baseline.windowWeeks, 4);
      assert.equal(baseline.avgAttendanceRate, 0.92);
      assert.equal(baseline.avgAssessmentAvg, 0.88);
      assert.equal(baseline.avgMissingRatio, 0.0);
      assert.equal(baseline.avgLmsEngagementSec, 3425);
    });

    it("should handle empty or small history arrays gracefully", () => {
      const emptyBaseline = calculateRollingBaseline([]);
      assert.equal(emptyBaseline.avgAttendanceRate, 1.0);
      assert.equal(emptyBaseline.avgAssessmentAvg, 1.0);
      assert.equal(emptyBaseline.avgMissingRatio, 0.0);

      const singleWeekHistory: AggregatedStudentMetrics[] = [
        { studentId: "STD101", attendanceRate: 0.80, assessmentAvg: 0.75, missingAssignmentsRatio: 0.1, lmsEngagementSec: 1800 },
      ];
      const singleBaseline = calculateRollingBaseline(singleWeekHistory, 4);
      assert.equal(singleBaseline.windowWeeks, 1);
      assert.equal(singleBaseline.avgAttendanceRate, 0.80);
    });
  });

  describe("computeTrendDeteriorationSignal", () => {
    it("should return low trend signal (~0.0) for stable or improving academic metrics", () => {
      const baseline = {
        studentId: "STD100",
        windowWeeks: 4,
        avgAttendanceRate: 0.90,
        avgAssessmentAvg: 0.85,
        avgMissingRatio: 0.0,
        avgLmsEngagementSec: 3000,
      };

      const recent: AggregatedStudentMetrics = {
        studentId: "STD100",
        attendanceRate: 0.92,
        assessmentAvg: 0.88,
        missingAssignmentsRatio: 0.0,
        lmsEngagementSec: 3200,
      };

      const result = computeTrendDeteriorationSignal(baseline, recent);

      assert.equal(result.trendDeteriorationSignal, 0.0);
      assert.equal(result.details.isSuddenDrop, false);
      assert.equal(result.details.attendanceDrop, 0.0);
      assert.equal(result.details.assessmentDrop, 0.0);
    });

    it("should detect sudden drop (>20% drop) and return elevated deterioration signal (>= 0.55)", () => {
      const baseline = {
        studentId: "STD102",
        windowWeeks: 4,
        avgAttendanceRate: 0.90,
        avgAssessmentAvg: 0.85,
        avgMissingRatio: 0.0,
        avgLmsEngagementSec: 3600,
      };

      // Attendance drops from 90% -> 50% (40% drop)
      const recent: AggregatedStudentMetrics = {
        studentId: "STD102",
        attendanceRate: 0.50,
        assessmentAvg: 0.80,
        missingAssignmentsRatio: 0.10,
        lmsEngagementSec: 1800,
      };

      const result = computeTrendDeteriorationSignal(baseline, recent);

      assert.equal(result.details.isSuddenDrop, true);
      assert.equal(result.details.attendanceDrop, 0.40);
      assert.ok(result.trendDeteriorationSignal >= 0.55, `Signal should be >= 0.55, got ${result.trendDeteriorationSignal}`);
    });

    it("should detect severe combined deterioration across attendance, assessments, missing assignments, and LMS", () => {
      const baseline = {
        studentId: "STD103",
        windowWeeks: 4,
        avgAttendanceRate: 0.95,
        avgAssessmentAvg: 0.90,
        avgMissingRatio: 0.05,
        avgLmsEngagementSec: 4000,
      };

      const recent: AggregatedStudentMetrics = {
        studentId: "STD103",
        attendanceRate: 0.40,
        assessmentAvg: 0.45,
        missingAssignmentsRatio: 0.60,
        lmsEngagementSec: 400,
      };

      const result = computeTrendDeteriorationSignal(baseline, recent);

      assert.equal(result.details.isSuddenDrop, true);
      assert.ok(result.trendDeteriorationSignal >= 0.95, `Signal should be >= 0.95, got ${result.trendDeteriorationSignal}`);
    });
  });

  describe("computeStudentTrendsFromRecords — Pure Multi-Week Engine", () => {
    it("should handle empty records with safe baseline and zero deterioration", () => {
      const res = computeStudentTrendsFromRecords("STD200", {});
      assert.equal(res.studentId, "STD200");
      assert.equal(res.trendDeteriorationSignal, 0.0);
      assert.equal(res.details.isSuddenDrop, false);
      assert.equal(res.baseline.avgAttendanceRate, 1.0);
    });

    it("should partition records into weeks and detect multi-week deterioration", () => {
      const baseTime = new Date("2026-09-01T09:00:00Z").getTime();
      const ONE_WEEK = 7 * 24 * 3600 * 1000;

      // Week 1: Great attendance & assessments
      const attendance: AttendanceRecord[] = [
        { studentId: "STD201", sectionId: "SEC1", date: new Date(baseTime).toISOString(), status: "present", sourceRef: "ref1" },
        { studentId: "STD201", sectionId: "SEC1", date: new Date(baseTime + 2 * 24 * 3600 * 1000).toISOString(), status: "present", sourceRef: "ref2" },
      ];
      const assessments: AssessmentRecord[] = [
        { studentId: "STD201", courseId: "CS101", type: "quiz", score: 90, maxScore: 100, date: new Date(baseTime).toISOString(), sourceRef: "ref3" },
      ];
      const lms: LmsActivity[] = [
        { studentId: "STD201", courseId: "CS101", date: new Date(baseTime).toISOString(), activityType: "video", durationSec: 3600 },
      ];

      // Week 2: Sudden drop — absent, failed assessment, low LMS
      attendance.push(
        { studentId: "STD201", sectionId: "SEC1", date: new Date(baseTime + ONE_WEEK).toISOString(), status: "absent", sourceRef: "ref4" },
        { studentId: "STD201", sectionId: "SEC1", date: new Date(baseTime + ONE_WEEK + 2 * 24 * 3600 * 1000).toISOString(), status: "absent", sourceRef: "ref5" }
      );
      assessments.push(
        { studentId: "STD201", courseId: "CS101", type: "quiz", score: 30, maxScore: 100, date: new Date(baseTime + ONE_WEEK).toISOString(), sourceRef: "ref6" }
      );
      lms.push(
        { studentId: "STD201", courseId: "CS101", date: new Date(baseTime + ONE_WEEK).toISOString(), activityType: "video", durationSec: 300 }
      );

      const res = computeStudentTrendsFromRecords("STD201", { attendance, assessments, lms });

      assert.equal(res.studentId, "STD201");
      assert.equal(res.weeklyHistory.length, 2);
      assert.equal(res.details.isSuddenDrop, true);
      assert.ok(res.trendDeteriorationSignal >= 0.55, `Expected deterioration signal >= 0.55, got ${res.trendDeteriorationSignal}`);
    });
  });

  describe("sanitizeStudentId", () => {
    it("should allow alphanumeric, underscores, and hyphens", () => {
      assert.equal(sanitizeStudentId("STD-1001"), "STD-1001");
      assert.equal(sanitizeStudentId("student_42"), "student_42");
    });

    it("should reject invalid, empty, or malicious characters", () => {
      assert.equal(sanitizeStudentId(""), null);
      assert.equal(sanitizeStudentId(null), null);
      assert.equal(sanitizeStudentId({ $ne: 1 }), null);
      assert.equal(sanitizeStudentId("STD<script>"), null);
    });
  });

  describe("API Route Integration & Access Control", () => {
    it("Student A cannot query Student B trends (returns 403 Forbidden)", async () => {
      const res = await makeRequest("/api/v1/students/STD_BOB/trends", "GET", {
        "x-user-id": "STD_ALICE",
        "x-user-role": "student",
      });
      assert.equal(res.statusCode, 403);
      assert.match(res.data.error, /Forbidden/i);
    });

    it("Student A CAN query their own trends endpoint (not 403 Forbidden)", async () => {
      const res = await makeRequest("/api/v1/students/STD_ALICE/trends", "GET", {
        "x-user-id": "STD_ALICE",
        "x-user-role": "student",
      });
      assert.notEqual(res.statusCode, 403);
    });

    it("Staff (Instructor, Mentor, Admin) can access student trends", async () => {
      const res = await makeRequest("/api/v1/trends/STD_1001", "GET", {
        "x-user-id": "MTR_001",
        "x-user-role": "mentor",
      });
      // In test mode without DB connection, returns 404 cleanly without 403
      assert.notEqual(res.statusCode, 403);
    });

    it("Invalid student ID returns 400 Bad Request", async () => {
      const res = await makeRequest("/api/v1/trends/invalid%20id%20with%20spaces!", "GET", {
        "x-user-id": "ADMIN_001",
        "x-user-role": "admin",
      });
      assert.equal(res.statusCode, 400);
    });
  });
});
