import React from "react";
import { Shield } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign In · Academic Risk Radar",
  description: "Institutional authentication for Academic Risk Radar",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { returnUrl?: string };
}) {
  const returnUrl = searchParams?.returnUrl;

  return (
    <div
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem 1rem",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "#E4ECE9",
              color: "#3F5E5A",
              padding: "0.35rem 0.75rem",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            <Shield size={14} strokeWidth={2} />
            Institutional Access Control · Week 9
          </div>
          <h1
            style={{
              margin: "0 0 0.5rem",
              fontSize: "2rem",
              fontWeight: 600,
              color: "#FAF7F2",
              fontFamily: "Source Serif 4, Georgia, serif",
              letterSpacing: "-0.01em",
            }}
          >
            Academic Risk Radar
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9375rem",
              color: "#94A3B8",
              lineHeight: 1.5,
            }}
          >
            Sign in with your verified institutional credentials to access your academic role dashboard.
          </p>
        </div>

        {/* Credentials Form Card */}
        <div
          style={{
            background: "#FFFDF9",
            border: "1px solid #E6DFD5",
            borderRadius: "8px",
            padding: "2.25rem 2rem",
            boxShadow: "0 1px 3px rgba(43,38,35,0.06), 0 4px 16px rgba(43,38,35,0.06)",
          }}
        >
          <div style={{ marginBottom: "1.5rem" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#6F665E",
              }}
            >
              Secure Sign In
            </span>
            <h2
              style={{
                margin: "0.25rem 0 0",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#2B2623",
              }}
            >
              Account Credentials
            </h2>
          </div>

          <LoginForm returnUrl={returnUrl} />

          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #EFE8DE",
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "#8C827A",
              lineHeight: 1.4,
            }}
          >
            Protected by cryptographic JSON Web Tokens and role-based access control. Refer to <code>README.md</code> for evaluation credentials.
          </div>
        </div>
      </div>
    </div>
  );
}
