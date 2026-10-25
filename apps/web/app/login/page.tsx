import React from "react";
import { Shield, Users, GraduationCap, Building2, Award, Settings, LucideIcon } from "lucide-react";
import { UserRole } from "@academic-risk-radar/shared-types";
import { DEFAULT_USERS_BY_ROLE, ROLE_HOME_ROUTES } from "@/lib/auth";
import { switchRoleAction } from "@/actions/auth";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Sign In · Academic Risk Radar",
  description: "Institutional authentication and role switching for Academic Risk Radar",
};

interface RoleCardMeta {
  role: UserRole;
  label: string;
  description: string;
  homeName: string;
  icon: LucideIcon;
}

const ROLE_METAS: RoleCardMeta[] = [
  {
    role: "student",
    label: "Student",
    description: "Personal risk factors, non-alarming guidance, action plan",
    homeName: "Student View (/risk)",
    icon: GraduationCap,
  },
  {
    role: "mentor",
    label: "Mentor",
    description: "Mentee roster, intervention logging, attendance monitoring",
    homeName: "Interventions (/interventions)",
    icon: Users,
  },
  {
    role: "instructor",
    label: "Instructor",
    description: "Class section performance, attendance entry, marks upload",
    homeName: "Section Analytics (/sections)",
    icon: Building2,
  },
  {
    role: "hod",
    label: "Head of Department",
    description: "Department-wide metrics, cohort risk distribution, section flags",
    homeName: "HoD Dashboard (/hod-dashboard)",
    icon: Award,
  },
  {
    role: "dean",
    label: "Dean",
    description: "Institution-wide academic health, cross-department trends",
    homeName: "Executive Dashboard (/dean-dashboard)",
    icon: Award,
  },
  {
    role: "admin",
    label: "System Admin",
    description: "Model versions, deterministic scoring replay, audit log",
    homeName: "Model Governance (/model-versions)",
    icon: Settings,
  },
];

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
        padding: "1.5rem 0",
      }}
    >
      <div
        style={{
          maxWidth: "1020px",
          width: "100%",
          margin: "0 auto",
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
            Institutional Access Control · Week 9 Gate
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
              maxWidth: "540px",
              marginLeft: "auto",
              marginRight: "auto",
              lineHeight: 1.5,
            }}
          >
            Sign in with your academic credentials or use the rapid role switcher to evaluate role-isolated workflows.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.75rem",
            alignItems: "start",
          }}
        >
          {/* Column 1: Credentials Form */}
          <div
            style={{
              background: "#FFFDF9",
              border: "1px solid #E6DFD5",
              borderRadius: "8px",
              padding: "2rem 1.75rem",
              boxShadow: "0 1px 3px rgba(43,38,35,0.06), 0 4px 12px rgba(43,38,35,0.04)",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6F665E",
                }}
              >
                Sign In
              </span>
              <h2
                style={{
                  margin: "0.25rem 0 0",
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "#2B2623",
                }}
              >
                Institutional Credentials
              </h2>
            </div>

            <LoginForm returnUrl={returnUrl} />

            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid #E6DFD5",
                fontSize: "0.8125rem",
                color: "#6F665E",
                lineHeight: 1.45,
              }}
            >
              <strong>Evaluator Note:</strong> Test accounts are pre-seeded with email addresses like <code>mentor@academic.edu</code>, <code>student@academic.edu</code>, or <code>admin@academic.edu</code> and password <code>password123</code>.
            </div>
          </div>

          {/* Column 2: Role Switcher for Viva Evaluation */}
          <div
            style={{
              background: "#0F172A",
              border: "1px solid #1E293B",
              borderRadius: "8px",
              padding: "1.75rem",
              color: "#F8FAFC",
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#38BDF8",
                  }}
                >
                  Quick Switcher
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    background: "#1E293B",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "4px",
                    color: "#94A3B8",
                  }}
                >
                  Viva Mode
                </span>
              </div>
              <h2
                style={{
                  margin: "0.25rem 0 0.25rem",
                  fontSize: "1.125rem",
                  fontWeight: 600,
                  color: "#F1F5F9",
                }}
              >
                Evaluate by Persona
              </h2>
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#94A3B8" }}>
                Click any role to simulate an authenticated session and test privacy boundaries.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {ROLE_METAS.map((item) => {
                const user = DEFAULT_USERS_BY_ROLE[item.role];
                const IconComponent = item.icon;
                const switchWithRole = switchRoleAction.bind(null, item.role, returnUrl);

                return (
                  <form key={item.role} action={switchWithRole} style={{ margin: 0 }}>
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.625rem 0.875rem",
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        color: "#F8FAFC",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "4px",
                            background: "#0F172A",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#38BDF8",
                            flexShrink: 0,
                          }}
                        >
                          <IconComponent size={16} strokeWidth={1.75} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{item.label}</span>
                            <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>· {user.name}</span>
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            {item.homeName}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#38BDF8",
                          fontWeight: 500,
                        }}
                      >
                        Enter →
                      </span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
