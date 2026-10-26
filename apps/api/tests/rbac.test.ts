import assert from "node:assert/strict";
import { describe, it } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { UserRole } from "@academic-risk-radar/shared-types";
import {
  authenticateUser,
  requireRole,
  enforceStudentAccessControl,
} from "../src/auth/rbac.middleware.js";
import { signToken } from "../src/auth/jwt.service.js";
import adminRouter from "../src/modules/admin/index.js";
import scoringRouter from "../src/modules/scoring/index.js";

/**
 * Stage 2 Automated RBAC & Negative-Access Security Tests
 * Owned by Team Member 1 (Pawan)
 *
 * Verifies:
 * 1. Zero-Trust Authentication: Caller-controlled x-user-* headers are strictly rejected (HTTP 401).
 * 2. Student Isolation: A student can NEVER access another student's data (asserted by negative-case tests returning 403).
 * 3. Administrative Privacy: An administrator can NEVER access raw attendance or assessment marks (asserted by negative-case tests returning 403).
 * 4. Role Enforcement: Strictly restricts admin routes to authenticated admin users only.
 */
describe("Stage 2 — RBAC & Negative Access Control", () => {
  function createTestServer() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(authenticateUser);

    // Mount routers
    app.use("/api/v1/admin", adminRouter);
    app.use("/api/v1", scoringRouter);

    // Mock raw marks routes to test admin blocking
    app.get(
      "/api/v1/attendance/raw",
      requireRole("instructor", "admin"),
      enforceStudentAccessControl,
      (_req, res) => res.json({ status: "raw_attendance_data" })
    );

    app.get(
      "/api/v1/assessments/raw",
      requireRole("instructor", "admin"),
      enforceStudentAccessControl,
      (_req, res) => res.json({ status: "raw_assessment_data" })
    );

    return app;
  }

  function authHeaders(role: UserRole, id = "USER_1", identityId = id) {
    const token = signToken({
      id,
      name: `Test ${role}`,
      email: `${id.toLowerCase()}@test.edu`,
      role,
      identityId,
    });
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  it("Zero-Trust Security: Caller-controlled x-user-id and x-user-role headers without JWT return HTTP 401 Unauthorized", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      // Caller attempts to spoof admin access via headers without valid JWT
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/admin/model-versions`, {
        headers: {
          "x-user-id": "fake_admin",
          "x-user-role": "admin",
        },
      });

      assert.equal(res.status, 401, "Caller-controlled x-user headers must be ignored and return HTTP 401");
      const body = (await res.json()) as any;
      assert.match(body.error, /Unauthorized/i);
    } finally {
      server.close();
    }
  });

  it("Zero-Trust Security: Tampered / invalid JWT token returns HTTP 401 Unauthorized", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/admin/model-versions`, {
        headers: {
          Authorization: "Bearer invalid.tampered.token.12345",
        },
      });

      assert.equal(res.status, 401, "Tampered token must return HTTP 401");
    } finally {
      server.close();
    }
  });

  it("Negative Test: Student A cannot access Student B risk endpoint (returns 403 Forbidden)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      // User is authenticated as Student STU_ALICE
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/STU_BOB/risk`, {
        headers: authHeaders("student", "USER_ALICE", "STU_ALICE"),
      });

      assert.equal(res.status, 403, "Student A querying Student B must return HTTP 403 Forbidden");
      const body = (await res.json()) as any;
      assert.match(body.error, /Forbidden/i);
    } finally {
      server.close();
    }
  });

  it("Student A CAN access their own risk endpoint (does not return 403)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      // User is Student STU_ALICE accessing STU_ALICE
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/STU_ALICE/risk`, {
        headers: authHeaders("student", "USER_ALICE", "STU_ALICE"),
      });

      // Must not be forbidden; 200 (if snapshot exists) or 404 (if no snapshot yet) are both acceptable
      assert.notEqual(res.status, 403, "Student accessing own record must not be forbidden");
    } finally {
      server.close();
    }
  });

  it("Negative Test: Student cannot query another student's ID via query param", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/STU_ALICE/risk?studentId=STU_CHARLIE`, {
        headers: authHeaders("student", "USER_ALICE", "STU_ALICE"),
      });

      assert.equal(res.status, 403, "Mismatched studentId in query must be forbidden");
    } finally {
      server.close();
    }
  });

  it("Negative Test: Administrator CANNOT access raw attendance marks (returns 403 Forbidden)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/attendance/raw`, {
        headers: authHeaders("admin", "ADMIN_001"),
      });

      assert.equal(res.status, 403, "Admin attempting to view raw attendance must return HTTP 403");
      const body = (await res.json()) as any;
      assert.match(body.error, /Administrators are strictly restricted/i);
    } finally {
      server.close();
    }
  });

  it("Negative Test: Administrator CANNOT access raw assessment records (returns 403 Forbidden)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/assessments/raw`, {
        headers: authHeaders("admin", "ADMIN_001"),
      });

      assert.equal(res.status, 403, "Admin attempting to view raw assessments must return HTTP 403");
    } finally {
      server.close();
    }
  });

  it("Instructor CAN access raw marks endpoint (not forbidden)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/attendance/raw`, {
        headers: authHeaders("instructor", "INST_001"),
      });

      assert.equal(res.status, 200, "Instructor should be allowed to view raw attendance");
    } finally {
      server.close();
    }
  });

  it("Negative Test: Student role cannot access admin model-versions (returns 403)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/admin/model-versions`, {
        headers: authHeaders("student", "USER_ALICE"),
      });

      assert.equal(res.status, 403, "Student should not have access to admin routes");
    } finally {
      server.close();
    }
  });

  it("Negative Test: Instructor role cannot access admin audit logs (returns 403)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/admin/audit`, {
        headers: authHeaders("instructor", "INST_001"),
      });

      assert.equal(res.status, 403, "Instructor should not have access to admin audit log");
    } finally {
      server.close();
    }
  });

  it("Admin role CAN access admin model-versions endpoint", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/admin/model-versions`, {
        headers: authHeaders("admin", "ADMIN_001"),
      });

      assert.equal(res.status, 200, "Admin should have access to model-versions");
    } finally {
      server.close();
    }
  });
});
