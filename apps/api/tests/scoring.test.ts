import assert from "node:assert/strict";
import { describe, it, after } from "node:test";
import express from "express";
import { authenticateUser } from "../src/auth/rbac.middleware.js";
import scoringRouter from "../src/modules/scoring/index.js";
import { closeScoringQueue } from "../src/modules/scoring/queue.js";

/**
 * Module M3: Risk Scoring Router Tests (Stage 2)
 * Owned by Team Member 1 (Pawan)
 */
describe("Module M3 — Risk Scoring Endpoints (Stage 2)", () => {
  function createTestServer() {
    const app = express();
    app.use(express.json());
    app.use(authenticateUser);
    app.use("/api/v1", scoringRouter);
    return app;
  }

  after(async () => {
    await closeScoringQueue();
  });

  it("GET /api/v1/students/:id/risk returns 404 when no snapshot exists for student", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/NON_EXISTENT_STU/risk`, {
        headers: {
          "x-user-id": "ADMIN_01",
          "x-user-role": "admin",
        },
      });

      assert.equal(res.status, 404, "Should return HTTP 404 when no snapshot exists");
      const body = (await res.json()) as any;
      assert.match(body.error, /No risk snapshot found/i);
    } finally {
      server.close();
    }
  });

  it("GET /api/v1/students/:id/risk rejects unauthorized student querying another student (HTTP 403)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/STU_BOB/risk`, {
        headers: {
          "x-user-id": "STU_ALICE",
          "x-user-role": "student",
        },
      });

      assert.equal(res.status, 403, "Student accessing another student must return 403");
    } finally {
      server.close();
    }
  });

  it("POST /api/v1/scoring/batch enqueues batch calculation job (HTTP 202 Accepted)", async () => {
    const app = createTestServer();
    const server = app.listen(0);
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/scoring/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "ADMIN_01",
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          studentIds: ["STU_001", "STU_002"],
        }),
      });

      assert.equal(res.status, 202, "Should return HTTP 202 Accepted for background job enqueue");
      const body = (await res.json()) as any;
      assert.equal(body.status, "queued");
      assert.ok(body.jobId, "Should return a jobId");
    } finally {
      server.close();
    }
  });
});
