"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * Module M6: Mentor Intervention UI (Team Member 4 — Piyush Kumar Singh)
 *
 * Stage 2: Full intervention logging form + outcome tracking with DB persistence.
 *
 * Allows mentors to:
 * - View their existing interventions with status and outcomes
 * - Record a new intervention action linked to an alertId
 * - Update the outcome of an existing intervention
 *
 * Connects to:
 *   POST  /api/v1/interventions
 *   PATCH /api/v1/interventions/:id/outcome
 *   GET   /api/v1/interventions
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

interface Intervention {
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

const OUTCOME_OPTIONS = ["improved", "no_change", "deteriorated", "inconclusive"] as const;

const OUTCOME_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  improved: { label: "Improved", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)" },
  no_change: { label: "No Change", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
  deteriorated: { label: "Deteriorated", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
  inconclusive: { label: "Inconclusive", color: "#64748b", bg: "rgba(100,116,139,0.12)", border: "rgba(100,116,139,0.25)" },
};

const ACTION_PRESETS = [
  "Phone call with student",
  "In-person meeting",
  "Email follow-up",
  "Referred to academic counselor",
  "Arranged peer tutoring",
  "Parent/guardian contacted",
];

export default function MentorInterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New intervention form state
  const [showForm, setShowForm] = useState(false);
  const [formAlertId, setFormAlertId] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formFollowUp, setFormFollowUp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Outcome update state
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");

  // Filter state
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "recorded">("all");

  const fetchInterventions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/interventions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setInterventions(data.interventions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load interventions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterventions();
  }, [fetchInterventions]);

  // Auto-dismiss success messages after 4s
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  const handleCreateIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          alertId: formAlertId.trim(),
          action: formAction.trim(),
          notes: formNotes.trim(),
          followUpDate: formFollowUp || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSuccessMsg("Intervention recorded successfully!");
      setShowForm(false);
      setFormAlertId("");
      setFormAction("");
      setFormNotes("");
      setFormFollowUp("");
      fetchInterventions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOutcome = async (interventionId: string) => {
    if (!selectedOutcome) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`${API_BASE}/interventions/${interventionId}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ outcome: selectedOutcome }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSuccessMsg("Outcome updated successfully!");
      setUpdatingId(null);
      setSelectedOutcome("");
      fetchInterventions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Compute summary stats
  const totalCount = interventions.length;
  const pendingCount = interventions.filter((iv) => !iv.outcome).length;
  const improvedCount = interventions.filter((iv) => iv.outcome === "improved").length;
  const upcomingFollowUps = interventions.filter(
    (iv) => iv.followUpDate && !iv.outcome && new Date(iv.followUpDate) >= new Date()
  ).length;

  // Filter interventions
  const filteredInterventions = interventions.filter((iv) => {
    if (filterStatus === "pending") return !iv.outcome;
    if (filterStatus === "recorded") return !!iv.outcome;
    return true;
  });

  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        color: "#e2e8f0",
        minHeight: "calc(100vh - 60px)",
        background: "#090e1a",
        margin: "-2rem",
        padding: "1.5rem",
      }}
    >
      {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.65rem", color: "#f97316", fontWeight: 800 }}>■</span>
            <span style={{ fontSize: "0.65rem", color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
              Module M6
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#f1f5f9" }}>
            Intervention Log
          </h1>
          <p style={{ margin: "0.35rem 0 0", color: "#475569", fontSize: "0.8125rem" }}>
            Record and track mentoring actions taken in response to risk alerts.
          </p>
        </div>
        <button
          id="btn-new-intervention"
          onClick={() => setShowForm(!showForm)}
          style={{
            background: showForm
              ? "rgba(100,116,139,0.15)"
              : "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: showForm ? "#94a3b8" : "#fff",
            border: showForm ? "1px solid #334155" : "none",
            borderRadius: "10px",
            padding: "0.625rem 1.25rem",
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontWeight: 600,
            transition: "all 0.2s ease",
            boxShadow: showForm ? "none" : "0 4px 12px rgba(59,130,246,0.25)",
          }}
        >
          {showForm ? "✕ Cancel" : "+ New Intervention"}
        </button>
      </div>

      {/* ── SUMMARY CARDS ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total Interventions", value: totalCount, color: "#38bdf8", icon: "📋" },
          { label: "Pending Outcome", value: pendingCount, color: "#f59e0b", icon: "⏳" },
          { label: "Improved", value: improvedCount, color: "#22c55e", icon: "📈" },
          { label: "Upcoming Follow-ups", value: upcomingFollowUps, color: "#a78bfa", icon: "📅" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#0f172a",
              borderRadius: "12px",
              padding: "1.125rem 1.25rem",
              border: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{stat.icon}</span>
            <div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "#475569",
                  marginTop: "0.2rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── STATUS MESSAGES ─────────────────────────────────────────────── */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            color: "#f87171",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            marginBottom: "1rem",
            fontSize: "0.8125rem",
            border: "1px solid rgba(239,68,68,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>⚠️</span> {error}
        </div>
      )}
      {successMsg && (
        <div
          style={{
            background: "rgba(34,197,94,0.1)",
            color: "#4ade80",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            marginBottom: "1rem",
            fontSize: "0.8125rem",
            border: "1px solid rgba(34,197,94,0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* ── NEW INTERVENTION FORM ───────────────────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreateIntervention}
          id="form-new-intervention"
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "1.75rem",
            marginBottom: "1.5rem",
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "1rem" }}>📝</span>
            <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: "1rem", fontWeight: 700 }}>
              Record New Intervention
            </h3>
          </div>

          <div style={{ display: "grid", gap: "1.125rem" }}>
            {/* Alert ID */}
            <div>
              <label
                htmlFor="alertId"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Alert ID *
              </label>
              <input
                id="alertId"
                type="text"
                value={formAlertId}
                onChange={(e) => setFormAlertId(e.target.value)}
                required
                placeholder="e.g. alert-001"
                style={{
                  width: "100%",
                  padding: "0.6rem 0.875rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  boxSizing: "border-box",
                  background: "#0b1222",
                  color: "#e2e8f0",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#334155")}
              />
            </div>

            {/* Action Taken */}
            <div>
              <label
                htmlFor="action"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Action Taken *
              </label>
              <input
                id="action"
                type="text"
                value={formAction}
                onChange={(e) => setFormAction(e.target.value)}
                required
                placeholder="Describe the mentoring action taken..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.875rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  boxSizing: "border-box",
                  background: "#0b1222",
                  color: "#e2e8f0",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#334155")}
              />
              {/* Quick-fill presets */}
              <div style={{ display: "flex", gap: "0.375rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                {ACTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setFormAction(preset)}
                    style={{
                      background: formAction === preset ? "rgba(59,130,246,0.15)" : "rgba(30,41,59,0.5)",
                      color: formAction === preset ? "#38bdf8" : "#64748b",
                      border: `1px solid ${formAction === preset ? "rgba(59,130,246,0.3)" : "#1e293b"}`,
                      borderRadius: "6px",
                      padding: "0.2rem 0.5rem",
                      cursor: "pointer",
                      fontSize: "0.6875rem",
                      transition: "all 0.15s",
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Notes *
              </label>
              <textarea
                id="notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                required
                rows={3}
                placeholder="Detailed notes about the intervention..."
                style={{
                  width: "100%",
                  padding: "0.6rem 0.875rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  resize: "vertical",
                  boxSizing: "border-box",
                  background: "#0b1222",
                  color: "#e2e8f0",
                  outline: "none",
                  transition: "border-color 0.2s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#334155")}
              />
            </div>

            {/* Follow-up Date */}
            <div>
              <label
                htmlFor="followUpDate"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  fontSize: "0.75rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Follow-Up Date (optional)
              </label>
              <input
                id="followUpDate"
                type="date"
                value={formFollowUp}
                onChange={(e) => setFormFollowUp(e.target.value)}
                style={{
                  padding: "0.6rem 0.875rem",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  fontSize: "0.875rem",
                  background: "#0b1222",
                  color: "#e2e8f0",
                  outline: "none",
                  transition: "border-color 0.2s",
                  colorScheme: "dark",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.target.style.borderColor = "#334155")}
              />
            </div>
          </div>

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
            <button
              id="btn-save-intervention"
              type="submit"
              disabled={submitting}
              style={{
                background: submitting
                  ? "rgba(100,116,139,0.2)"
                  : "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.6rem 1.5rem",
                cursor: submitting ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
                transition: "all 0.2s",
                boxShadow: submitting ? "none" : "0 2px 8px rgba(59,130,246,0.3)",
              }}
            >
              {submitting ? "Saving..." : "Save Intervention"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: "transparent",
                color: "#64748b",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "0.6rem 1.25rem",
                cursor: "pointer",
                fontSize: "0.875rem",
                transition: "all 0.2s",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── FILTER TABS ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          marginBottom: "1.25rem",
          background: "#0f172a",
          borderRadius: "10px",
          padding: "0.25rem",
          border: "1px solid #1e293b",
          width: "fit-content",
        }}
      >
        {(
          [
            { key: "all", label: "All", count: totalCount },
            { key: "pending", label: "Pending", count: pendingCount },
            { key: "recorded", label: "Recorded", count: totalCount - pendingCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            id={`filter-${tab.key}`}
            onClick={() => setFilterStatus(tab.key)}
            style={{
              background: filterStatus === tab.key ? "rgba(59,130,246,0.15)" : "transparent",
              color: filterStatus === tab.key ? "#38bdf8" : "#64748b",
              border: "none",
              borderRadius: "8px",
              padding: "0.4rem 0.875rem",
              cursor: "pointer",
              fontSize: "0.78rem",
              fontWeight: filterStatus === tab.key ? 600 : 400,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            {tab.label}
            <span
              style={{
                fontSize: "0.65rem",
                background: filterStatus === tab.key ? "rgba(59,130,246,0.2)" : "#1e293b",
                color: filterStatus === tab.key ? "#38bdf8" : "#475569",
                padding: "0.1rem 0.35rem",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── INTERVENTIONS LIST ──────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "#475569",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
          Loading interventions...
        </div>
      ) : filteredInterventions.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem",
            background: "#0f172a",
            borderRadius: "14px",
            border: "1px solid #1e293b",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
          <p style={{ color: "#475569", fontSize: "0.9375rem", margin: 0, fontWeight: 500 }}>
            {filterStatus === "all"
              ? "No interventions recorded yet."
              : `No ${filterStatus} interventions found.`}
          </p>
          <p style={{ color: "#334155", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
            Click &quot;+ New Intervention&quot; to record a mentoring action.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.875rem" }}>
          {filteredInterventions.map((iv, idx) => (
            <div
              key={iv._id}
              id={`intervention-${iv._id}`}
              style={{
                background: "#0f172a",
                border: "1px solid #1e293b",
                borderRadius: "14px",
                padding: "1.25rem 1.5rem",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#334155";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#1e293b";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "0.75rem",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        color: "#475569",
                        fontFamily: "monospace",
                        background: "#0b1222",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #1e293b",
                      }}
                    >
                      Alert: {iv.alertId}
                    </span>
                    <span
                      style={{
                        fontSize: "0.625rem",
                        color: "#334155",
                      }}
                    >
                      #{idx + 1}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: "0.9375rem", color: "#f1f5f9", fontWeight: 600 }}>
                    {iv.action}
                  </h3>
                </div>

                {/* Outcome Badge */}
                {iv.outcome ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.71875rem",
                      fontWeight: 600,
                      color: OUTCOME_LABELS[iv.outcome]?.color || "#64748b",
                      background: OUTCOME_LABELS[iv.outcome]?.bg || "rgba(100,116,139,0.12)",
                      border: `1px solid ${OUTCOME_LABELS[iv.outcome]?.border || "rgba(100,116,139,0.25)"}`,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: OUTCOME_LABELS[iv.outcome]?.color || "#64748b", display: "inline-block" }} />
                    {OUTCOME_LABELS[iv.outcome]?.label || iv.outcome}
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.71875rem",
                      fontWeight: 600,
                      color: "#38bdf8",
                      background: "rgba(56,189,248,0.1)",
                      border: "1px solid rgba(56,189,248,0.2)",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#38bdf8", display: "inline-block", animation: "pulse 2s infinite" }} />
                    Pending Outcome
                  </span>
                )}
              </div>

              {/* Notes */}
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: "0.8125rem",
                  lineHeight: 1.6,
                  margin: "0 0 0.875rem",
                  paddingLeft: "0.125rem",
                }}
              >
                {iv.notes}
              </p>

              {/* Meta info row */}
              <div
                style={{
                  display: "flex",
                  gap: "1.25rem",
                  fontSize: "0.71875rem",
                  color: "#475569",
                  flexWrap: "wrap",
                  paddingTop: "0.625rem",
                  borderTop: "1px solid #0d1526",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.75rem" }}>📅</span>
                  Created: {new Date(iv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                {iv.followUpDate && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.75rem" }}>🔔</span>
                    Follow-up: {new Date(iv.followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
                {iv.outcomeRecordedAt && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <span style={{ fontSize: "0.75rem" }}>✅</span>
                    Outcome recorded: {new Date(iv.outcomeRecordedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Closed-Loop Outcome Tracking */}
              {iv.outcome && (
                <div
                  style={{
                    marginTop: "1rem",
                    background: "#090e1a",
                    padding: "0.875rem 1rem",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    border: "1px solid #1e293b",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "#64748b",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      flexShrink: 0,
                    }}
                  >
                    Risk Band Shift:
                  </span>

                  {iv.outcome === "improved" ? (
                    <>
                      <span
                        style={{
                          color: "#ef4444",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(239,68,68,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        High
                      </span>
                      <span style={{ color: "#334155", fontSize: "0.875rem" }}>→</span>
                      <span
                        style={{
                          color: "#22c55e",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(34,197,94,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(34,197,94,0.2)",
                        }}
                      >
                        Moderate
                      </span>
                    </>
                  ) : iv.outcome === "deteriorated" ? (
                    <>
                      <span
                        style={{
                          color: "#f59e0b",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(245,158,11,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        Moderate
                      </span>
                      <span style={{ color: "#334155", fontSize: "0.875rem" }}>→</span>
                      <span
                        style={{
                          color: "#ef4444",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(239,68,68,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(239,68,68,0.2)",
                        }}
                      >
                        High
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          color: "#f59e0b",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(245,158,11,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        Moderate
                      </span>
                      <span style={{ color: "#334155", fontSize: "0.875rem" }}>→</span>
                      <span
                        style={{
                          color: "#f59e0b",
                          fontWeight: 600,
                          padding: "0.15rem 0.5rem",
                          background: "rgba(245,158,11,0.1)",
                          borderRadius: "4px",
                          fontSize: "0.8125rem",
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        Moderate
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Update Outcome Section (only if no outcome yet) */}
              {!iv.outcome && (
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid #0d1526",
                  }}
                >
                  {updatingId === iv._id ? (
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        id={`outcome-select-${iv._id}`}
                        value={selectedOutcome}
                        onChange={(e) => setSelectedOutcome(e.target.value)}
                        style={{
                          padding: "0.45rem 0.75rem",
                          border: "1px solid #334155",
                          borderRadius: "8px",
                          fontSize: "0.8125rem",
                          background: "#0b1222",
                          color: "#e2e8f0",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Select outcome...</option>
                        {OUTCOME_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {OUTCOME_LABELS[opt].label}
                          </option>
                        ))}
                      </select>
                      <button
                        id={`btn-save-outcome-${iv._id}`}
                        onClick={() => handleUpdateOutcome(iv._id)}
                        disabled={!selectedOutcome}
                        style={{
                          background: selectedOutcome
                            ? "linear-gradient(135deg, #059669, #047857)"
                            : "rgba(100,116,139,0.15)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.45rem 1rem",
                          cursor: selectedOutcome ? "pointer" : "not-allowed",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          transition: "all 0.2s",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setUpdatingId(null);
                          setSelectedOutcome("");
                        }}
                        style={{
                          background: "transparent",
                          color: "#64748b",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.78rem",
                          padding: "0.45rem 0.5rem",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      id={`btn-record-outcome-${iv._id}`}
                      onClick={() => setUpdatingId(iv._id)}
                      style={{
                        background: "rgba(59,130,246,0.08)",
                        color: "#38bdf8",
                        border: "1px solid rgba(59,130,246,0.2)",
                        borderRadius: "8px",
                        padding: "0.4rem 1rem",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: 500,
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(59,130,246,0.15)";
                        e.currentTarget.style.borderColor = "rgba(59,130,246,0.35)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(59,130,246,0.08)";
                        e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)";
                      }}
                    >
                      Record Outcome
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pulse animation for pending badges */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
