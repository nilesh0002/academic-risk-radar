"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Alert, AlertStatus } from "@academic-risk-radar/shared-types";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldAlert,
  Search,
  RefreshCw,
  ExternalLink,
  Bell,
  ArrowRight,
} from "lucide-react";

/**
 * Module M5: Alert Routing & Mentor Inbox (Team Member 2 — Vani Bhardwaj)
 * Stage 2 & 3: Mentor Alert Inbox with real-time status tabs, SLA countdown badges,
 * one-click acknowledgement, and seamless intervention logging handover.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const STATUS_CONFIG: Record<
  AlertStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  open: {
    label: "Open / Pending",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.3)",
    icon: <Clock size={14} />,
  },
  acknowledged: {
    label: "Acknowledged",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.3)",
    icon: <CheckCircle size={14} />,
  },
  escalated: {
    label: "Escalated to HoD",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.35)",
    icon: <ShieldAlert size={14} />,
  },
  closed: {
    label: "Resolved / Closed",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.25)",
    icon: <CheckCircle size={14} />,
  },
};

export default function MentorInboxPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_BASE}/alerts`);
      if (statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }

      const res = await fetch(url.toString(), {
        headers: {
          "x-user-id": "MTR-001",
          "x-user-role": "mentor",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load alerts: HTTP ${res.status}`);
      }

      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err: any) {
      setError(err.message || "Failed to load mentor alerts");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledgingId(alertId);
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "MTR-001",
          "x-user-role": "mentor",
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const updatedData = await res.json();
      const updatedAlert: Alert = updatedData.alert;

      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, ...updatedAlert } : a))
      );

      setSuccessToast(`Alert for ${updatedAlert.studentId || alertId} acknowledged.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      alert(`Could not acknowledge alert: ${err.message}`);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const getSlaBadge = (deadlineStr: string, status: AlertStatus) => {
    if (status === "acknowledged" || status === "closed") {
      return (
        <span
          style={{
            fontSize: "0.75rem",
            padding: "2px 8px",
            borderRadius: "6px",
            background: "rgba(16, 185, 129, 0.1)",
            color: "#10b981",
          }}
        >
          SLA Met
        </span>
      );
    }

    const diffMs = new Date(deadlineStr).getTime() - Date.now();
    const isBreached = diffMs <= 0;

    if (isBreached || status === "escalated") {
      return (
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "6px",
            background: "rgba(239, 68, 68, 0.18)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <AlertTriangle size={12} />
          SLA Breached
        </span>
      );
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return (
      <span
        style={{
          fontSize: "0.75rem",
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: "6px",
          background: hours < 12 ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.12)",
          color: hours < 12 ? "#fbbf24" : "#60a5fa",
          border: `1px solid ${hours < 12 ? "rgba(245, 158, 11, 0.3)" : "rgba(59, 130, 246, 0.25)"}`,
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <Clock size={12} />
        {hours}h remaining
      </span>
    );
  };

  const filteredAlerts = alerts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      a.studentId.toLowerCase().includes(query) ||
      a._id.toLowerCase().includes(query) ||
      a.riskSnapshotId.toLowerCase().includes(query)
    );
  });

  const counts = {
    all: alerts.length,
    open: alerts.filter((a) => a.status === "open").length,
    escalated: alerts.filter((a) => a.status === "escalated").length,
    acknowledged: alerts.filter((a) => a.status === "acknowledged").length,
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            background: "#065f46",
            color: "#d1fae5",
            padding: "0.75rem 1.25rem",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle size={16} />
          {successToast}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
              Mentor Alert Inbox
            </h1>
          </div>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.925rem" }}>
            Module M5: Real-time risk alert routing, SLA breach tracking, and rapid intervention dispatch.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#1e293b",
            color: "#cbd5e1",
            border: "1px solid #334155",
            borderRadius: "8px",
            padding: "0.6rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh Inbox
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div
          style={{
            background: "#0f172a",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8", fontSize: "0.85rem" }}>
            <span>Total Mentees with Alerts</span>
            <Bell size={16} />
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#f8fafc", marginTop: "0.5rem" }}>
            {counts.all}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid rgba(245, 158, 11, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#f59e0b", fontSize: "0.85rem" }}>
            <span>Open & Actionable</span>
            <Clock size={16} />
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#fbbf24", marginTop: "0.5rem" }}>
            {counts.open}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#ef4444", fontSize: "0.85rem" }}>
            <span>Escalated to HoD</span>
            <ShieldAlert size={16} />
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#f87171", marginTop: "0.5rem" }}>
            {counts.escalated}
          </div>
        </div>

        <div
          style={{
            background: "#0f172a",
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", color: "#10b981", fontSize: "0.85rem" }}>
            <span>Acknowledged</span>
            <CheckCircle size={16} />
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 700, color: "#34d399", marginTop: "0.5rem" }}>
            {counts.acknowledged}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", background: "#0f172a", padding: "4px", borderRadius: "8px", border: "1px solid #1e293b" }}>
          {[
            { key: "all", label: "All Alerts", count: counts.all },
            { key: "open", label: "Open", count: counts.open },
            { key: "escalated", label: "Escalated", count: counts.escalated },
            { key: "acknowledged", label: "Acknowledged", count: counts.acknowledged },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                background: statusFilter === tab.key ? "#1e293b" : "transparent",
                color: statusFilter === tab.key ? "#f8fafc" : "#94a3b8",
                border: "none",
                borderRadius: "6px",
                padding: "0.45rem 0.85rem",
                fontSize: "0.85rem",
                cursor: "pointer",
                fontWeight: statusFilter === tab.key ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: "0.75rem",
                  background: statusFilter === tab.key ? "#334155" : "#1e293b",
                  padding: "1px 6px",
                  borderRadius: "10px",
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: "260px" }}>
          <Search
            size={16}
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
          />
          <input
            type="text"
            placeholder="Search student or alert ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "0.5rem 1rem 0.5rem 2.25rem",
              color: "#f8fafc",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button
            onClick={fetchAlerts}
            style={{
              background: "#ef4444",
              color: "#ffffff",
              border: "none",
              padding: "0.35rem 0.75rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "4rem 0", textAlign: "center", color: "#94a3b8" }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 1rem" }} />
          <p style={{ margin: 0 }}>Fetching assigned mentee alerts from radar...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredAlerts.length === 0 && (
        <div
          style={{
            background: "#0f172a",
            border: "1px dashed #334155",
            borderRadius: "12px",
            padding: "4rem 2rem",
            textAlign: "center",
          }}
        >
          <CheckCircle size={40} style={{ color: "#10b981", margin: "0 auto 1rem" }} />
          <h3 style={{ margin: "0 0 0.5rem", color: "#f8fafc" }}>No Alerts In Queue</h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.875rem", maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
            {statusFilter !== "all"
              ? `There are currently no alerts matching status '${statusFilter}'.`
              : "All student academic risk alerts are currently cleared or in normal standing."}
          </p>
        </div>
      )}

      {/* Alert Card List */}
      {!loading && !error && filteredAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredAlerts.map((alert) => {
            const conf = STATUS_CONFIG[alert.status] || STATUS_CONFIG.open;
            const isAcknowledging = acknowledgingId === alert._id;
            const isOpenOrEscalated = alert.status === "open" || alert.status === "escalated";

            return (
              <div
                key={alert._id}
                style={{
                  background: "#0f172a",
                  border: `1px solid ${alert.status === "escalated" ? "rgba(239, 68, 68, 0.4)" : "#1e293b"}`,
                  borderRadius: "12px",
                  padding: "1.25rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                  transition: "border-color 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        background: conf.bg,
                        color: conf.color,
                        border: `1px solid ${conf.border}`,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                      }}
                    >
                      {conf.icon}
                      {conf.label}
                    </div>

                    <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#f8fafc" }}>
                      Student ID: <span style={{ color: "#38bdf8" }}>{alert.studentId}</span>
                    </h3>

                    {getSlaBadge(alert.slaDeadline, alert.status)}
                  </div>

                  <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                    Alert ID: <code style={{ color: "#94a3b8" }}>{alert._id}</code>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "0.75rem",
                    background: "#0b1120",
                    padding: "0.875rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    color: "#94a3b8",
                  }}
                >
                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Trigger Snapshot</span>
                    <Link
                      href={`/risk?studentId=${alert.studentId}`}
                      style={{ color: "#38bdf8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      {alert.riskSnapshotId}
                      <ExternalLink size={12} />
                    </Link>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Created On</span>
                    <span style={{ color: "#cbd5e1" }}>{new Date(alert.createdAt).toLocaleString()}</span>
                  </div>

                  <div>
                    <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>SLA Deadline</span>
                    <span style={{ color: "#cbd5e1" }}>{new Date(alert.slaDeadline).toLocaleString()}</span>
                  </div>

                  {alert.acknowledgedAt && (
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Acknowledged At</span>
                      <span style={{ color: "#10b981" }}>{new Date(alert.acknowledgedAt).toLocaleString()}</span>
                    </div>
                  )}

                  {alert.escalatedAt && (
                    <div>
                      <span style={{ color: "#64748b", display: "block", fontSize: "0.75rem" }}>Escalated At</span>
                      <span style={{ color: "#ef4444" }}>{new Date(alert.escalatedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  {isOpenOrEscalated && (
                    <button
                      onClick={() => handleAcknowledge(alert._id)}
                      disabled={isAcknowledging}
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#34d399",
                        border: "1px solid rgba(16, 185, 129, 0.35)",
                        padding: "0.5rem 1rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: isAcknowledging ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <CheckCircle size={15} />
                      {isAcknowledging ? "Acknowledging..." : "Acknowledge Alert"}
                    </button>
                  )}

                  <Link
                    href={`/interventions?alertId=${alert._id}`}
                    style={{
                      background: "#3b82f6",
                      color: "#ffffff",
                      textDecoration: "none",
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "background 0.15s ease",
                    }}
                  >
                    Log Mentoring Action
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
