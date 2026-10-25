import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { getSession, ROLE_HOME_ROUTES } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export const metadata = {
  title: "Access Restricted · Academic Risk Radar",
};

export default async function ForbiddenPage() {
  const session = await getSession();
  const homeRoute = session?.role ? ROLE_HOME_ROUTES[session.role] || "/risk" : "/login";

  return (
    <div
      style={{
        minHeight: "75vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#FFFDF9",
          border: "1px solid #E6DFD5",
          borderRadius: "10px",
          padding: "2.5rem 2rem",
          maxWidth: "480px",
          width: "100%",
          boxShadow: "0 2px 8px rgba(43, 38, 35, 0.04)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "6px",
            background: "#E4ECE9",
            color: "#3F5E5A",
            marginBottom: "1.25rem",
          }}
        >
          <ShieldAlert size={22} strokeWidth={1.5} />
        </div>

        <span
          style={{
            display: "block",
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            color: "#B5654A",
            marginBottom: "0.35rem",
          }}
        >
          403 · Access Restricted
        </span>

        <h1
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1.375rem",
            fontWeight: 600,
            color: "#2B2623",
            lineHeight: 1.3,
          }}
        >
          Institutional Privacy Boundary
        </h1>

        <p
          style={{
            margin: "0 0 1.25rem",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: "#6F665E",
          }}
        >
          Your active role ({session?.role ? <strong>{session.role}</strong> : "guest"}) is not authorized to access this resource. Under institutional governance rules, individual records, mentor logs, and administrative controls are isolated by role.
        </p>

        <div
          style={{
            background: "#FAF7F2",
            border: "1px solid #E6DFD5",
            borderRadius: "6px",
            padding: "0.875rem 1rem",
            fontSize: "0.8125rem",
            color: "#6F665E",
            marginBottom: "1.75rem",
          }}
        >
          Signed in as <strong>{session?.name || "Unknown"}</strong> ({session?.email || "No email"}).
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link
            href={homeRoute}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#3F5E5A",
              color: "#FFFDF9",
              padding: "0.625rem 1.125rem",
              borderRadius: "6px",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Return to Dashboard
          </Link>

          <form action={logoutAction} style={{ margin: 0 }}>
            <button
              type="submit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "transparent",
                color: "#6F665E",
                border: "1px solid #E6DFD5",
                padding: "0.625rem 1rem",
                borderRadius: "6px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <LogOut size={16} strokeWidth={1.5} />
              Switch Account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
