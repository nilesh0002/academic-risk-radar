process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import http from "node:http";
import express from "express";
import { authenticateUser } from "../src/auth/rbac.middleware.js";
import { signToken } from "../src/auth/jwt.service.js";
import analyticsRouter from "../src/modules/analytics/index.js";

/**
 * Tests for Module M7: Dashboards & Reporting
 *
 * Uses the same raw http + fetch test pattern as the rest of the codebase.
 * Covers RBAC enforcement for department and institution analytics endpoints.
 */

function createTestApp(departmentId?: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (!req.headers.authorization && (req.headers["x-user-id"] || req.headers["x-user-role"])) {
      const userId = (req.headers["x-user-id"] as string) || "user-test";
      const role = (req.headers["x-user-role"] as any) || "student";
      req.headers.authorization = `Bearer ${signToken({
        id: userId,
        name: userId,
        email: `${userId.toLowerCase()}@radar.edu`,
        role,
        departmentId: (req.headers["x-user-dept"] as string) || undefined,
        identityId: userId,
      })}`;
    }
    next();
  });
  app.use(authenticateUser);
  // Inject departmentId into user after authenticateUser sets req.user
  if (departmentId) {
    app.use((req, _res, next) => {
      if (req.user) {
        req.user.departmentId = departmentId;
      }
      next();
    });
  }
  app.use("/api/v1", analyticsRouter);
  return app;
}

function startServer(app: express.Express): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to get server address"));
      }
      resolve({ port: address.port, close: () => server.close() });
    });
  });
}

describe("M7: Section Analytics — RBAC Tests", () => {
  it("GET /analytics/section/:id should return 403 for student role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/section/CS101`, {
        headers: {
          "x-user-id": "student-001",
          "x-user-role": "student",
        },
      });
      assert.equal(res.status, 403, "Student should not access section analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/section/:id should return 403 for mentor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/section/CS101`, {
        headers: {
          "x-user-id": "mentor-001",
          "x-user-role": "mentor",
        },
      });
      assert.equal(res.status, 403, "Mentor should not access section analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/section/:id should NOT return 403 for instructor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/section/CS101`, {
        headers: {
          "x-user-id": "instructor-001",
          "x-user-role": "instructor",
        },
      });
      assert.notEqual(res.status, 403, "Instructor should be allowed to access section analytics");
    } finally {
      close();
    }
  });
});

describe("M7: Department Analytics — RBAC Tests", () => {
  it("GET /analytics/department/:id should return 403 for student role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "student-001",
          "x-user-role": "student",
        },
      });
      assert.equal(res.status, 403, "Student should not access department analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should return 403 for mentor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "mentor-001",
          "x-user-role": "mentor",
        },
      });
      assert.equal(res.status, 403, "Mentor should not access department analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should return 403 for instructor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "instructor-001",
          "x-user-role": "instructor",
        },
      });
      assert.equal(res.status, 403, "Instructor should not access department analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should return 403 when HoD accesses another department", async () => {
    const app = createTestApp("CS");
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/EE`, {
        headers: {
          "x-user-id": "hod-001",
          "x-user-role": "hod",
        },
      });
      assert.equal(res.status, 403, "HoD should not access another department's analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should NOT return 403 for HoD accessing own department", async () => {
    const app = createTestApp("CS");
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "hod-001",
          "x-user-role": "hod",
        },
      });
      // May be 200 or 500 (no DB), but should NOT be 403
      assert.notEqual(res.status, 403, "HoD should be allowed to access own department");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should NOT return 403 for dean role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "dean-001",
          "x-user-role": "dean",
        },
      });
      assert.notEqual(res.status, 403, "Dean should be allowed to access any department analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/department/:id should NOT return 403 for admin role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/department/CS`, {
        headers: {
          "x-user-id": "admin-001",
          "x-user-role": "admin",
        },
      });
      assert.notEqual(res.status, 403, "Admin should be allowed to access any department analytics");
    } finally {
      close();
    }
  });
});

describe("M7: Institution Analytics — RBAC Tests", () => {
  it("GET /analytics/institution should return 403 for student role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "student-001",
          "x-user-role": "student",
        },
      });
      assert.equal(res.status, 403, "Student should not access institution analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/institution should return 403 for mentor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "mentor-001",
          "x-user-role": "mentor",
        },
      });
      assert.equal(res.status, 403, "Mentor should not access institution analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/institution should return 403 for instructor role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "instructor-001",
          "x-user-role": "instructor",
        },
      });
      assert.equal(res.status, 403, "Instructor should not access institution analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/institution should return 403 for hod role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "hod-001",
          "x-user-role": "hod",
        },
      });
      assert.equal(res.status, 403, "HoD should not access institution analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/institution should NOT return 403 for dean role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "dean-001",
          "x-user-role": "dean",
        },
      });
      assert.notEqual(res.status, 403, "Dean should be allowed to access institution analytics");
    } finally {
      close();
    }
  });

  it("GET /analytics/institution should NOT return 403 for admin role", async () => {
    const app = createTestApp();
    const { port, close } = await startServer(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/analytics/institution`, {
        headers: {
          "x-user-id": "admin-001",
          "x-user-role": "admin",
        },
      });
      assert.notEqual(res.status, 403, "Admin should be allowed to access institution analytics");
    } finally {
      close();
    }
  });
});
