import {
  AssessmentRecord,
  AssignmentSubmission,
  AttendanceRecord,
  LmsActivity,
  QuarantineRecord,
} from "@academic-risk-radar/shared-types";
import {
  AssessmentRecordModel,
  AssignmentSubmissionModel,
  AttendanceRecordModel,
  LmsActivityModel,
  QuarantineModel,
} from "../../db/schemas.js";

export interface ImportResult<T> {
  valid: T[];
  quarantined: QuarantineRecord[];
  totalRows: number;
}

export interface PersistenceResult {
  insertedCount: number;
  quarantinedCount: number;
  totalRows: number;
}

/**
 * Splits a CSV string into rows and trims whitespace.
 * Handles CRLF and LF line endings and ignores empty lines.
 */
export function parseRawCsvRows(csvContent: string): string[][] {
  const lines = csvContent.split(/\r?\n/).map((line) => line.trim());
  const rows: string[][] = [];

  for (const line of lines) {
    if (!line) continue;
    // Basic comma-separated value split with cell trimming
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    rows.push(cells);
  }

  return rows;
}

/**
 * Helper to validate ISO date string
 */
function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const timestamp = Date.parse(dateStr);
  return !Number.isNaN(timestamp);
}

// ----------------------------------------------------------------------
// 1. ATTENDANCE CSV IMPORTER
// ----------------------------------------------------------------------
// Expected Header: studentId,sectionId,date,status,sourceRef
export function parseAttendanceCsv(
  csvContent: string,
  ingestedAt: string = new Date().toISOString()
): ImportResult<AttendanceRecord> {
  const rows = parseRawCsvRows(csvContent);
  const valid: AttendanceRecord[] = [];
  const quarantined: QuarantineRecord[] = [];

  if (rows.length === 0) {
    return { valid, quarantined, totalRows: 0 };
  }

  const [header, ...dataRows] = rows;
  const headerMap = new Map<string, number>();
  header.forEach((col, idx) => headerMap.set(col.toLowerCase(), idx));

  const requiredCols = ["studentid", "sectionid", "date", "status", "sourceref"];
  const missingCols = requiredCols.filter((col) => !headerMap.has(col));

  if (missingCols.length > 0) {
    quarantined.push({
      originalCollection: "attendanceRecords",
      rawRecord: header,
      reason: `Missing required header column(s): ${missingCols.join(", ")}`,
      ingestedAt,
    });
    return { valid, quarantined, totalRows: rows.length };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawObj: Record<string, string> = {
      studentId: row[headerMap.get("studentid")!] || "",
      sectionId: row[headerMap.get("sectionid")!] || "",
      date: row[headerMap.get("date")!] || "",
      status: row[headerMap.get("status")!] || "",
      sourceRef: row[headerMap.get("sourceref")!] || "",
    };

    if (!rawObj.studentId) {
      quarantined.push({
        originalCollection: "attendanceRecords",
        rawRecord: rawObj,
        reason: "studentId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!rawObj.sectionId) {
      quarantined.push({
        originalCollection: "attendanceRecords",
        rawRecord: rawObj,
        reason: "sectionId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!isValidDateString(rawObj.date)) {
      quarantined.push({
        originalCollection: "attendanceRecords",
        rawRecord: rawObj,
        reason: `Invalid ISO date format: '${rawObj.date}'`,
        ingestedAt,
      });
      continue;
    }

    const validStatuses = ["present", "absent", "late"] as const;
    if (!validStatuses.includes(rawObj.status as (typeof validStatuses)[number])) {
      quarantined.push({
        originalCollection: "attendanceRecords",
        rawRecord: rawObj,
        reason: `Invalid status '${rawObj.status}'. Must be one of: present, absent, late`,
        ingestedAt,
      });
      continue;
    }

    valid.push({
      studentId: rawObj.studentId,
      sectionId: rawObj.sectionId,
      date: new Date(rawObj.date).toISOString(),
      status: rawObj.status as "present" | "absent" | "late",
      sourceRef: rawObj.sourceRef || "csv-import",
    });
  }

  return { valid, quarantined, totalRows: dataRows.length };
}

// ----------------------------------------------------------------------
// 2. ASSESSMENT CSV IMPORTER
// ----------------------------------------------------------------------
// Expected Header: studentId,courseId,type,score,maxScore,date,sourceRef
export function parseAssessmentCsv(
  csvContent: string,
  ingestedAt: string = new Date().toISOString()
): ImportResult<AssessmentRecord> {
  const rows = parseRawCsvRows(csvContent);
  const valid: AssessmentRecord[] = [];
  const quarantined: QuarantineRecord[] = [];

  if (rows.length === 0) {
    return { valid, quarantined, totalRows: 0 };
  }

  const [header, ...dataRows] = rows;
  const headerMap = new Map<string, number>();
  header.forEach((col, idx) => headerMap.set(col.toLowerCase(), idx));

  const requiredCols = ["studentid", "courseid", "type", "score", "maxscore", "date", "sourceref"];
  const missingCols = requiredCols.filter((col) => !headerMap.has(col));

  if (missingCols.length > 0) {
    quarantined.push({
      originalCollection: "assessmentRecords",
      rawRecord: header,
      reason: `Missing required header column(s): ${missingCols.join(", ")}`,
      ingestedAt,
    });
    return { valid, quarantined, totalRows: rows.length };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawObj = {
      studentId: row[headerMap.get("studentid")!] || "",
      courseId: row[headerMap.get("courseid")!] || "",
      type: row[headerMap.get("type")!] || "",
      scoreStr: row[headerMap.get("score")!] || "",
      maxScoreStr: row[headerMap.get("maxscore")!] || "",
      date: row[headerMap.get("date")!] || "",
      sourceRef: row[headerMap.get("sourceref")!] || "",
    };

    if (!rawObj.studentId) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: "studentId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!rawObj.courseId) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: "courseId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!isValidDateString(rawObj.date)) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: `Invalid ISO date format: '${rawObj.date}'`,
        ingestedAt,
      });
      continue;
    }

    const score = Number(rawObj.scoreStr);
    const maxScore = Number(rawObj.maxScoreStr);

    if (Number.isNaN(score) || Number.isNaN(maxScore)) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: "Score and maxScore must be valid numbers",
        ingestedAt,
      });
      continue;
    }

    if (maxScore <= 0) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: "maxScore must be strictly greater than 0",
        ingestedAt,
      });
      continue;
    }

    if (score < 0 || score > maxScore) {
      quarantined.push({
        originalCollection: "assessmentRecords",
        rawRecord: rawObj,
        reason: `score (${score}) must be between 0 and maxScore (${maxScore})`,
        ingestedAt,
      });
      continue;
    }

    valid.push({
      studentId: rawObj.studentId,
      courseId: rawObj.courseId,
      type: rawObj.type || "quiz",
      score,
      maxScore,
      date: new Date(rawObj.date).toISOString(),
      sourceRef: rawObj.sourceRef || "csv-import",
    });
  }

  return { valid, quarantined, totalRows: dataRows.length };
}

// ----------------------------------------------------------------------
// 3. ASSIGNMENT SUBMISSION CSV IMPORTER
// ----------------------------------------------------------------------
// Expected Header: studentId,courseId,assignmentId,submittedAt,status
export function parseAssignmentCsv(
  csvContent: string,
  ingestedAt: string = new Date().toISOString()
): ImportResult<AssignmentSubmission> {
  const rows = parseRawCsvRows(csvContent);
  const valid: AssignmentSubmission[] = [];
  const quarantined: QuarantineRecord[] = [];

  if (rows.length === 0) {
    return { valid, quarantined, totalRows: 0 };
  }

  const [header, ...dataRows] = rows;
  const headerMap = new Map<string, number>();
  header.forEach((col, idx) => headerMap.set(col.toLowerCase(), idx));

  const requiredCols = ["studentid", "courseid", "assignmentid", "status"];
  const missingCols = requiredCols.filter((col) => !headerMap.has(col));

  if (missingCols.length > 0) {
    quarantined.push({
      originalCollection: "assignmentSubmissions",
      rawRecord: header,
      reason: `Missing required header column(s): ${missingCols.join(", ")}`,
      ingestedAt,
    });
    return { valid, quarantined, totalRows: rows.length };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawObj = {
      studentId: row[headerMap.get("studentid")!] || "",
      courseId: row[headerMap.get("courseid")!] || "",
      assignmentId: row[headerMap.get("assignmentid")!] || "",
      submittedAtStr: headerMap.has("submittedat") ? row[headerMap.get("submittedat")!] || "" : "",
      status: row[headerMap.get("status")!] || "",
    };

    if (!rawObj.studentId) {
      quarantined.push({
        originalCollection: "assignmentSubmissions",
        rawRecord: rawObj,
        reason: "studentId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!rawObj.courseId || !rawObj.assignmentId) {
      quarantined.push({
        originalCollection: "assignmentSubmissions",
        rawRecord: rawObj,
        reason: "courseId and assignmentId are required",
        ingestedAt,
      });
      continue;
    }

    const validStatuses = ["submitted", "missing", "late"] as const;
    if (!validStatuses.includes(rawObj.status as (typeof validStatuses)[number])) {
      quarantined.push({
        originalCollection: "assignmentSubmissions",
        rawRecord: rawObj,
        reason: `Invalid status '${rawObj.status}'. Must be one of: submitted, missing, late`,
        ingestedAt,
      });
      continue;
    }

    let submittedAt: string | null = null;
    if (rawObj.submittedAtStr && rawObj.submittedAtStr.toLowerCase() !== "null") {
      if (!isValidDateString(rawObj.submittedAtStr)) {
        quarantined.push({
          originalCollection: "assignmentSubmissions",
          rawRecord: rawObj,
          reason: `Invalid ISO date for submittedAt: '${rawObj.submittedAtStr}'`,
          ingestedAt,
        });
        continue;
      }
      submittedAt = new Date(rawObj.submittedAtStr).toISOString();
    }

    valid.push({
      studentId: rawObj.studentId,
      courseId: rawObj.courseId,
      assignmentId: rawObj.assignmentId,
      submittedAt,
      status: rawObj.status as "submitted" | "missing" | "late",
    });
  }

  return { valid, quarantined, totalRows: dataRows.length };
}

// ----------------------------------------------------------------------
// 4. LMS ACTIVITY CSV IMPORTER
// ----------------------------------------------------------------------
// Expected Header: studentId,courseId,date,activityType,durationSec
export function parseLmsActivityCsv(
  csvContent: string,
  ingestedAt: string = new Date().toISOString()
): ImportResult<LmsActivity> {
  const rows = parseRawCsvRows(csvContent);
  const valid: LmsActivity[] = [];
  const quarantined: QuarantineRecord[] = [];

  if (rows.length === 0) {
    return { valid, quarantined, totalRows: 0 };
  }

  const [header, ...dataRows] = rows;
  const headerMap = new Map<string, number>();
  header.forEach((col, idx) => headerMap.set(col.toLowerCase(), idx));

  const requiredCols = ["studentid", "courseid", "date", "activitytype", "durationsec"];
  const missingCols = requiredCols.filter((col) => !headerMap.has(col));

  if (missingCols.length > 0) {
    quarantined.push({
      originalCollection: "lmsActivity",
      rawRecord: header,
      reason: `Missing required header column(s): ${missingCols.join(", ")}`,
      ingestedAt,
    });
    return { valid, quarantined, totalRows: rows.length };
  }

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rawObj = {
      studentId: row[headerMap.get("studentid")!] || "",
      courseId: row[headerMap.get("courseid")!] || "",
      date: row[headerMap.get("date")!] || "",
      activityType: row[headerMap.get("activitytype")!] || "",
      durationSecStr: row[headerMap.get("durationsec")!] || "",
    };

    if (!rawObj.studentId) {
      quarantined.push({
        originalCollection: "lmsActivity",
        rawRecord: rawObj,
        reason: "studentId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!rawObj.courseId) {
      quarantined.push({
        originalCollection: "lmsActivity",
        rawRecord: rawObj,
        reason: "courseId is required and cannot be empty",
        ingestedAt,
      });
      continue;
    }

    if (!isValidDateString(rawObj.date)) {
      quarantined.push({
        originalCollection: "lmsActivity",
        rawRecord: rawObj,
        reason: `Invalid ISO date format: '${rawObj.date}'`,
        ingestedAt,
      });
      continue;
    }

    const durationSec = Number(rawObj.durationSecStr);
    if (Number.isNaN(durationSec) || durationSec < 0) {
      quarantined.push({
        originalCollection: "lmsActivity",
        rawRecord: rawObj,
        reason: `durationSec must be a non-negative number, got '${rawObj.durationSecStr}'`,
        ingestedAt,
      });
      continue;
    }

    valid.push({
      studentId: rawObj.studentId,
      courseId: rawObj.courseId,
      date: new Date(rawObj.date).toISOString(),
      activityType: rawObj.activityType || "page_view",
      durationSec,
    });
  }

  return { valid, quarantined, totalRows: dataRows.length };
}

// ----------------------------------------------------------------------
// PERSISTENCE HELPERS (With Idempotent Upserts)
// ----------------------------------------------------------------------

export async function importAttendanceFromCsv(csvContent: string): Promise<PersistenceResult> {
  const result = parseAttendanceCsv(csvContent);

  if (result.quarantined.length > 0) {
    await QuarantineModel.insertMany(result.quarantined);
  }

  if (result.valid.length > 0) {
    const ops = result.valid.map((record) => ({
      updateOne: {
        filter: { studentId: record.studentId, sectionId: record.sectionId, date: record.date },
        update: { $set: record },
        upsert: true,
      },
    }));
    await AttendanceRecordModel.bulkWrite(ops);
  }

  return {
    insertedCount: result.valid.length,
    quarantinedCount: result.quarantined.length,
    totalRows: result.totalRows,
  };
}

export async function importAssessmentFromCsv(csvContent: string): Promise<PersistenceResult> {
  const result = parseAssessmentCsv(csvContent);

  if (result.quarantined.length > 0) {
    await QuarantineModel.insertMany(result.quarantined);
  }

  if (result.valid.length > 0) {
    const ops = result.valid.map((record) => ({
      updateOne: {
        filter: {
          studentId: record.studentId,
          courseId: record.courseId,
          type: record.type,
          date: record.date,
        },
        update: { $set: record },
        upsert: true,
      },
    }));
    await AssessmentRecordModel.bulkWrite(ops);
  }

  return {
    insertedCount: result.valid.length,
    quarantinedCount: result.quarantined.length,
    totalRows: result.totalRows,
  };
}

export async function importAssignmentFromCsv(csvContent: string): Promise<PersistenceResult> {
  const result = parseAssignmentCsv(csvContent);

  if (result.quarantined.length > 0) {
    await QuarantineModel.insertMany(result.quarantined);
  }

  if (result.valid.length > 0) {
    const ops = result.valid.map((record) => ({
      updateOne: {
        filter: { studentId: record.studentId, assignmentId: record.assignmentId },
        update: { $set: record },
        upsert: true,
      },
    }));
    await AssignmentSubmissionModel.bulkWrite(ops);
  }

  return {
    insertedCount: result.valid.length,
    quarantinedCount: result.quarantined.length,
    totalRows: result.totalRows,
  };
}

export async function importLmsActivityFromCsv(csvContent: string): Promise<PersistenceResult> {
  const result = parseLmsActivityCsv(csvContent);

  if (result.quarantined.length > 0) {
    await QuarantineModel.insertMany(result.quarantined);
  }

  if (result.valid.length > 0) {
    // Idempotent upsert: same student + course + date + activityType -> update instead of duplicate
    const ops = result.valid.map((record) => ({
      updateOne: {
        filter: {
          studentId: record.studentId,
          courseId: record.courseId,
          date: record.date,
          activityType: record.activityType,
        },
        update: { $set: record },
        upsert: true,
      },
    }));
    await LmsActivityModel.bulkWrite(ops);
  }

  return {
    insertedCount: result.valid.length,
    quarantinedCount: result.quarantined.length,
    totalRows: result.totalRows,
  };
}
