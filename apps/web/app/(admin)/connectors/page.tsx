"use client";

import React, { useState, useEffect } from "react";

interface ConnectorSource {
  count: number;
  health: "active" | "degraded" | "inactive";
}

interface ConnectorStatus {
  status: string;
  sources: {
    attendance: ConnectorSource;
    assessments: ConnectorSource;
    assignments: ConnectorSource;
    lmsActivity: ConnectorSource;
  };
  quarantine: {
    totalRecords: number;
  };
  lastChecked: string;
}

interface QuarantineItem {
  _id?: string;
  originalCollection: string;
  rawRecord: any;
  reason: string;
  ingestedAt: string;
}

const SAMPLE_DATA: Record<string, string> = {
  attendance: `studentId,sectionId,date,status,sourceRef
STD001,SEC_A,2026-03-01T09:00:00Z,present,RFID_GATE_1
STD002,SEC_A,2026-03-01T09:00:00Z,absent,RFID_GATE_1
STD003,SEC_A,2026-03-01T09:00:00Z,late,RFID_GATE_1
,SEC_A,2026-03-01T09:00:00Z,present,RFID_GATE_1`, // 4th row intentionally invalid for quarantine demo
  assessment: `studentId,courseId,type,score,maxScore,date,sourceRef
STD001,CSE101,Midterm,85,100,2026-03-15T10:00:00Z,ERP_SYSTEM
STD002,CSE101,Midterm,72,100,2026-03-15T10:00:00Z,ERP_SYSTEM
STD003,CSE101,Midterm,110,100,2026-03-15T10:00:00Z,ERP_SYSTEM`, // 3rd row score > maxScore for quarantine demo
  assignment: `studentId,courseId,assignmentId,submittedAt,status
STD001,CSE101,HW1,2026-02-10T18:00:00Z,submitted
STD002,CSE101,HW1,null,missing
STD003,CSE101,HW1,2026-02-11T02:00:00Z,late`,
  lms: `studentId,courseId,date,activityType,durationSec
STD001,CSE101,2026-02-15T14:30:00Z,video_lecture,1800
STD002,CSE101,2026-02-15T15:00:00Z,quiz_attempt,600
STD003,CSE101,2026-02-15T16:00:00Z,forum_post,300`,
};

export default function ConnectorsPage() {
  const [status, setStatus] = useState<ConnectorStatus | null>(null);
  const [quarantined, setQuarantined] = useState<QuarantineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConnector, setSelectedConnector] = useState<string>("attendance");
  const [csvContent, setCsvContent] = useState<string>(SAMPLE_DATA.attendance);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: "success" | "queued" | "error";
    message: string;
    jobId?: string;
    stats?: any;
  } | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

  // Fetch connector stats & quarantine table
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/connectors/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }

      const qRes = await fetch(`${API_BASE}/admin/connectors/quarantine?limit=15`);
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuarantined(qData.quarantined || []);
      }
    } catch {
      // Mock fallback for UI preview if API is not running locally
      setStatus({
        status: "operational",
        sources: {
          attendance: { count: 1240, health: "active" },
          assessments: { count: 350, health: "active" },
          assignments: { count: 820, health: "active" },
          lmsActivity: { count: 2150, health: "active" },
        },
        quarantine: { totalRecords: 12 },
        lastChecked: new Date().toISOString(),
      });
      setQuarantined([
        {
          originalCollection: "attendanceRecords",
          rawRecord: { studentId: "", sectionId: "SEC_A", date: "2026-03-01T09:00:00Z" },
          reason: "studentId is required and cannot be empty",
          ingestedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          originalCollection: "assessmentRecords",
          rawRecord: { studentId: "STD003", score: 110, maxScore: 100 },
          reason: "score (110) must be between 0 and maxScore (100)",
          ingestedAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectorChange = (conn: string) => {
    setSelectedConnector(conn);
    setCsvContent(SAMPLE_DATA[conn] || "");
    setSyncFeedback(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(String(event.target?.result || ""));
      };
      reader.readAsText(file);
    }
  };

  const handleSyncSubmit = async () => {
    if (!csvContent.trim()) {
      alert("Please provide CSV data to sync.");
      return;
    }

    setIsSubmitting(true);
    setSyncFeedback(null);

    try {
      const res = await fetch(`${API_BASE}/admin/connectors/${selectedConnector}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: csvContent }),
      });

      const data = await res.json();

      if (res.status === 202) {
        setSyncFeedback({
          type: "queued",
          message: `Sync job enqueued to BullMQ background worker!`,
          jobId: data.jobId,
        });
      } else if (res.ok) {
        setSyncFeedback({
          type: "success",
          message: `Successfully processed! Inserted: ${data.insertedCount}, Quarantined: ${data.quarantinedCount}`,
          stats: data,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: data.error || "Failed to process import sync",
        });
      }

      // Refresh overview
      setTimeout(() => fetchStatus(), 1500);
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        message: `Network error or API unreachable: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ color: "#f1f5f9" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
              Institutional Data Connectors & Ingestion (Module M1)
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.95rem" }}>
              Normalisation pipeline, asynchronous BullMQ workers, and duplicate-proof idempotent storage.
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              background: "#1e293b",
              color: "#38bdf8",
              border: "1px solid #334155",
              borderRadius: "6px",
              padding: "0.6rem 1.2rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {loading ? "Refreshing..." : "↻ Refresh Status"}
          </button>
        </div>
      </div>

      {/* 1. Connector Status Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {/* Attendance */}
        <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Attendance</span>
            <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "0.15rem 0.5rem", borderRadius: "12px", border: "1px solid rgba(34,197,94,0.3)" }}>
              {status?.sources.attendance.health || "active"}
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
            {status?.sources.attendance.count.toLocaleString() ?? "0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>records in attendanceRecords</div>
        </div>

        {/* Assessments */}
        <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Assessments</span>
            <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "0.15rem 0.5rem", borderRadius: "12px", border: "1px solid rgba(34,197,94,0.3)" }}>
              {status?.sources.assessments.health || "active"}
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
            {status?.sources.assessments.count.toLocaleString() ?? "0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>records in assessmentRecords</div>
        </div>

        {/* Assignments */}
        <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Assignments</span>
            <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "0.15rem 0.5rem", borderRadius: "12px", border: "1px solid rgba(34,197,94,0.3)" }}>
              {status?.sources.assignments.health || "active"}
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
            {status?.sources.assignments.count.toLocaleString() ?? "0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>records in assignmentSubmissions</div>
        </div>

        {/* LMS Activity */}
        <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>LMS Activity</span>
            <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "0.15rem 0.5rem", borderRadius: "12px", border: "1px solid rgba(34,197,94,0.3)" }}>
              {status?.sources.lmsActivity.health || "active"}
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
            {status?.sources.lmsActivity.count.toLocaleString() ?? "0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>records in lmsActivity</div>
        </div>

        {/* Quarantine */}
        <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#ef4444", textTransform: "uppercase" }}>Quarantine</span>
            <span style={{ fontSize: "0.7rem", background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "0.15rem 0.5rem", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.3)" }}>
              Fault-Isolated
            </span>
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ef4444" }}>
            {status?.quarantine.totalRecords.toLocaleString() ?? "0"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.3rem" }}>records isolated with error reasons</div>
        </div>
      </div>

      {/* 2. Interactive Ingestion & Sync Workspace */}
      <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 1rem 0", color: "#f8fafc" }}>
          Trigger Connector Ingestion / File Sync
        </h2>

        {/* Connector Selection Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
          {[
            { id: "attendance", label: "Attendance (RFID/ERP)" },
            { id: "assessment", label: "Assessments (Exams/Marks)" },
            { id: "assignment", label: "Assignment Submissions" },
            { id: "lms", label: "LMS Engagement (Moodle/Canvas)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleConnectorChange(tab.id)}
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: selectedConnector === tab.id ? "#38bdf8" : "#1e293b",
                background: selectedConnector === tab.id ? "rgba(56,189,248,0.12)" : "#090e1a",
                color: selectedConnector === tab.id ? "#38bdf8" : "#94a3b8",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controls Bar: File Upload or Sample Data Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <label style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Upload CSV:</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileUpload}
              style={{ fontSize: "0.8rem", color: "#94a3b8" }}
            />
          </div>
          <button
            type="button"
            onClick={() => setCsvContent(SAMPLE_DATA[selectedConnector] || "")}
            style={{
              background: "transparent",
              border: "1px dashed #475569",
              color: "#94a3b8",
              borderRadius: "4px",
              padding: "0.3rem 0.75rem",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            Load Sample CSV
          </button>
        </div>

        {/* CSV Textarea */}
        <textarea
          rows={7}
          value={csvContent}
          onChange={(e) => setCsvContent(e.target.value)}
          placeholder="Paste CSV rows here (first line must be header)..."
          style={{
            width: "100%",
            background: "#090e1a",
            color: "#e2e8f0",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            padding: "0.75rem",
            borderRadius: "6px",
            border: "1px solid #1e293b",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />

        {/* Sync Trigger Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
            • Uses BullMQ queue & idempotency upserts • Malformed rows are safely quarantined
          </span>
          <button
            onClick={handleSyncSubmit}
            disabled={isSubmitting}
            style={{
              background: "#0284c7",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "0.7rem 1.5rem",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Syncing..." : `Sync ${selectedConnector.toUpperCase()} CSV`}
          </button>
        </div>

        {/* Feedback Message */}
        {syncFeedback && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.875rem 1rem",
              borderRadius: "6px",
              border: "1px solid",
              background:
                syncFeedback.type === "queued"
                  ? "rgba(14,165,233,0.12)"
                  : syncFeedback.type === "success"
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(239,68,68,0.12)",
              borderColor:
                syncFeedback.type === "queued"
                  ? "rgba(14,165,233,0.4)"
                  : syncFeedback.type === "success"
                  ? "rgba(34,197,94,0.4)"
                  : "rgba(239,68,68,0.4)",
              color:
                syncFeedback.type === "queued"
                  ? "#38bdf8"
                  : syncFeedback.type === "success"
                  ? "#4ade80"
                  : "#f87171",
              fontSize: "0.9rem",
            }}
          >
            <strong>{syncFeedback.type.toUpperCase()}: </strong>
            {syncFeedback.message}
            {syncFeedback.jobId && <div style={{ fontSize: "0.8rem", marginTop: "0.25rem", color: "#cbd5e1" }}>BullMQ Job ID: {syncFeedback.jobId}</div>}
          </div>
        )}
      </div>

      {/* 3. Quarantine Records Table */}
      <div style={{ background: "#0b1222", border: "1px solid #1e293b", borderRadius: "8px", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, color: "#f8fafc" }}>
              Quarantine Audit Registry
            </h2>
            <p style={{ margin: "0.25rem 0 0 0", color: "#64748b", fontSize: "0.85rem" }}>
              Malformed rows preserved for audit without breaking ingestion runs.
            </p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Showing recent {quarantined.length} records</span>
        </div>

        {quarantined.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            No quarantined records found. All ingestion batches clean!
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1e293b", color: "#94a3b8" }}>
                  <th style={{ padding: "0.75rem" }}>Collection</th>
                  <th style={{ padding: "0.75rem" }}>Ingested At</th>
                  <th style={{ padding: "0.75rem" }}>Failure Reason</th>
                  <th style={{ padding: "0.75rem" }}>Raw Record Preview</th>
                </tr>
              </thead>
              <tbody>
                {quarantined.map((item, idx) => (
                  <tr key={item._id || idx} style={{ borderBottom: "1px solid #152238" }}>
                    <td style={{ padding: "0.75rem", color: "#38bdf8", fontWeight: 500 }}>
                      {item.originalCollection}
                    </td>
                    <td style={{ padding: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                      {new Date(item.ingestedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem", color: "#f87171" }}>
                      {item.reason}
                    </td>
                    <td style={{ padding: "0.75rem", fontFamily: "monospace", color: "#cbd5e1", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {typeof item.rawRecord === "object" ? JSON.stringify(item.rawRecord) : String(item.rawRecord)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
