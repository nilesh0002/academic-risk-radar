import React from "react";
import Link from "next/link";
import { LogOut, UserCircle } from "lucide-react";
import { getSession, ROLE_HOME_ROUTES } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export const metadata = {
  title: "Academic Risk Radar",
  description: "Academic Early-Warning and Mentoring Intervention Platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const homeRoute = session?.role ? ROLE_HOME_ROUTES[session.role] || "/risk" : "/login";

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: 0, background: "#090e1a", color: "#f8fafc" }}>
        <header
          style={{
            background: "#0b1222",
            color: "#ffffff",
            padding: "0.875rem 2rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f97316", marginRight: "0.5rem" }}>■</span>
            <Link href={homeRoute} style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center" }}>
              <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#f1f5f9", letterSpacing: "0.02em" }}>Academic Risk Radar</h1>
              <span style={{ marginLeft: "0.6rem", fontSize: "0.62rem", color: "#64748b", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase" }}>Early Warning Platform</span>
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {session ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "#1e293b",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #334155",
                    fontSize: "0.8125rem",
                  }}
                >
                  <UserCircle size={16} strokeWidth={1.75} style={{ color: "#38bdf8" }} />
                  <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{session.name}</span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      background: "#0f172a",
                      color: "#38bdf8",
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    {session.role}
                  </span>
                </div>

                <Link
                  href="/login"
                  style={{
                    fontSize: "0.8125rem",
                    color: "#94a3b8",
                    textDecoration: "none",
                    padding: "0.35rem 0.6rem",
                    borderRadius: "4px",
                    border: "1px solid #334155",
                  }}
                >
                  Switch Role
                </Link>

                <form action={logoutAction} style={{ margin: 0 }}>
                  <button
                    type="submit"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      background: "transparent",
                      border: "none",
                      color: "#f87171",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      padding: "0.35rem 0.5rem",
                    }}
                  >
                    <LogOut size={14} strokeWidth={1.75} />
                    <span>Sign Out</span>
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                style={{
                  fontSize: "0.8125rem",
                  color: "#f1f5f9",
                  textDecoration: "none",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                }}
              >
                Sign In
              </Link>
            )}
          </div>
        </header>
        <main style={{ padding: "2rem", maxWidth: "1280px", margin: "0 auto" }}>{children}</main>
      </body>
    </html>
  );
}
