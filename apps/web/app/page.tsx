import React from "react";

export default function HomePage() {
  return (
    <div style={{ background: "#ffffff", padding: "2rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <h2>Welcome to Academic Risk Radar</h2>
      <p style={{ color: "#475569" }}>
        An early-support intervention system designed to consolidate attendance, assessment, assignment, and LMS engagement signals.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", marginTop: "1.5rem" }}>
        <a href="/risk" style={{ padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "6px", textDecoration: "none", color: "#1e293b" }}>
          <h3 style={{ marginTop: 0 }}>Student Early Support View</h3>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>View academic indicators and contributing risk factors in a clear, supportive interface.</p>
        </a>
        <a href="/connectors" style={{ padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "6px", textDecoration: "none", color: "#1e293b" }}>
          <h3 style={{ marginTop: 0, color: "#0284c7" }}>Data Connectors & Ingestion</h3>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Manage institutional data feeds, trigger CSV imports, and inspect quarantined records (Admin / M1).</p>
        </a>
        <a href="/model-versions" style={{ padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "6px", textDecoration: "none", color: "#1e293b" }}>
          <h3 style={{ marginTop: 0 }}>Scoring Model Management</h3>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Configure weights, preview band-change impact, and manage model versions (Admin).</p>
        </a>
        <a href="/audit" style={{ padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "6px", textDecoration: "none", color: "#1e293b" }}>
          <h3 style={{ marginTop: 0 }}>System Audit Logs</h3>
          <p style={{ color: "#64748b", fontSize: "0.875rem" }}>View immutable audit trail of system configuration and scoring model changes (Admin).</p>
        </a>
      </div>
    </div>
  );
}
