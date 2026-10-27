process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import http from "node:http";
import app from "../src/server.js";
import { simulateAlertDeduplication, sanitizeId } from "../src/modules/alerts/alerts.service.js";
import { Alert, RiskSnapshot } from "@academic-risk-radar/shared-types";
import { signToken } from "../src/auth/jwt.service.js";

function makeRequest(
  path: string,
  method: string = "GET",
  headers: Record<string, string> = {},
  body?: object
): Promise<{ statusCode: number; data: any }> {
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!reqHeaders.Authorization && (headers["x-user-id"] || headers["x-user-role"])) {
    const userId = headers["x-user-id"] || "user-test";
    const role = (headers["x-user-role"] as any) || "student";
    reqHeaders.Authorization = `Bearer ${signToken({
      id: userId,
      name: userId,
      email: `${userId.toLowerCase()}@radar.edu`,
      role,
      identityId: userId,
    })}`;
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        return reject(new Error("Failed to get server address"));
      }

      const postData = body ? JSON.stringify(body) : "";
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path,
          method,
          headers: {
            ...reqHeaders,
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        (res) => {
          let rawData = "";
          res.on("data", (chunk) => {
            rawData += chunk;
          });
          res.on("end", () => {
            server.close();
            try {
              const data = JSON.parse(rawData);
              resolve({ statusCode: res.statusCode || 500, data });
            } catch {
              resolve({ statusCode: res.statusCode || 500, data: rawData });
            }
          });
        }
      );

      req.on("error", (err) => {
        server.close();
        reject(err);
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  });
}

describe("M5: Alert Routing, Deduplication & Mentor Inbox (Stage 2)", () => {
  describe("Alert Generation & Deduplication Logic", () => {
    const baseSnapshot: RiskSnapshot = {
      _id: "snap-001",
      studentId: "STD-1001",
      computedAt: new Date().toISOString(),
      modelVersion: "v1.0.0",
      band: "high",
      factors: [
        { name: "attendance_deficit", weight: 0.35, contribution: 0.28, value: 0.8 },
      ],
    };

    it("should generate a new open alert for high-risk snapshot with 48h SLA deadline", () => {
      const { alerts, result } = simulateAlertDeduplication([], baseSnapshot, "MTR-001");

      assert.equal(result.action, "created");
      assert.equal(alerts.length, 1);
      assert.equal(alerts[0].studentId, "STD-1001");
      assert.equal(alerts[0].mentorId, "MTR-001");
      assert.equal(alerts[0].status, "open");
      assert.equal(alerts[0].riskSnapshotId, "snap-001");
      assert.ok(alerts[0].slaDeadline, "SLA deadline must be defined");
    });

    it("should generate a new open alert for critical-risk snapshot", () => {
      const criticalSnapshot: RiskSnapshot = {
        ...baseSnapshot,
        _id: "snap-crit-1",
        band: "critical",
      };

      const { alerts, result } = simulateAlertDeduplication([], criticalSnapshot, "MTR-002");
      assert.equal(result.action, "created");
      assert.equal(alerts[0].mentorId, "MTR-002");
    });

    it("should NOT generate alert for low or moderate risk snapshot", () => {
      const lowSnapshot: RiskSnapshot = { ...baseSnapshot, band: "low" };
      const modSnapshot: RiskSnapshot = { ...baseSnapshot, band: "moderate" };

      const resLow = simulateAlertDeduplication([], lowSnapshot);
      assert.equal(resLow.result.action, "ignored");
      assert.equal(resLow.alerts.length, 0);

      const resMod = simulateAlertDeduplication([], modSnapshot);
      assert.equal(resMod.result.action, "ignored");
      assert.equal(resMod.alerts.length, 0);
    });

    it("DEDUPLICATION RULE: should update existing open alert riskSnapshotId without creating duplicate open alert", () => {
      // First high-risk run creates alert
      const firstRun = simulateAlertDeduplication([], baseSnapshot, "MTR-001");
      assert.equal(firstRun.alerts.length, 1);
      assert.equal(firstRun.alerts[0].riskSnapshotId, "snap-001");

      // Second high-risk run for the same student with a newer snapshot
      const newerSnapshot: RiskSnapshot = {
        ...baseSnapshot,
        _id: "snap-002",
        computedAt: new Date(Date.now() + 3600000).toISOString(),
      };

      const secondRun = simulateAlertDeduplication(firstRun.alerts, newerSnapshot, "MTR-001");
      assert.equal(secondRun.result.action, "updated");
      // Must NOT create a duplicate open alert; length remains 1
      assert.equal(secondRun.alerts.length, 1, "Alert count must remain 1 after deduplication");
      assert.equal(secondRun.alerts[0].riskSnapshotId, "snap-002", "Snapshot ID must be updated");
      assert.equal(secondRun.alerts[0].status, "open");
    });

    it("should create new alert if existing alert for student is already closed/acknowledged", () => {
      const existingAlerts: Alert[] = [
        {
          _id: "alert-prev",
          studentId: "STD-1001",
          mentorId: "MTR-001",
          riskSnapshotId: "snap-old",
          status: "acknowledged", // not open
          createdAt: new Date().toISOString(),
          acknowledgedAt: new Date().toISOString(),
          escalatedAt: null,
          slaDeadline: new Date().toISOString(),
        },
      ];

      const res = simulateAlertDeduplication(existingAlerts, baseSnapshot, "MTR-001");
      assert.equal(res.result.action, "created");
      assert.equal(res.alerts.length, 2);
    });
  });

  describe("sanitizeId Helper", () => {
    it("should sanitize valid alphanumeric identifiers", () => {
      assert.equal(sanitizeId("alert_123-abc"), "alert_123-abc");
    });

    it("should reject malicious or invalid ID strings", () => {
      assert.equal(sanitizeId(""), null);
      assert.equal(sanitizeId(null), null);
      assert.equal(sanitizeId("123; DROP TABLE"), null);
      assert.equal(sanitizeId({ $gt: "" }), null);
    });
  });

  describe("Mentor Inbox API & RBAC Security", () => {
    it("GET /api/v1/alerts: Mentor can fetch their own inbox (returns 200)", async () => {
      const res = await makeRequest("/api/v1/alerts", "GET", {
        "x-user-id": "MTR-001",
        "x-user-role": "mentor",
      });
      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.data.alerts));
    });

    it("Negative RBAC Test: Mentor A CANNOT view Mentor B inbox (returns 403 Forbidden)", async () => {
      const res = await makeRequest("/api/v1/alerts?mentorId=MTR-002", "GET", {
        "x-user-id": "MTR-001",
        "x-user-role": "mentor",
      });
      assert.equal(res.statusCode, 403);
      assert.match(res.data.error, /Forbidden/i);
    });

    it("Negative RBAC Test: Student cannot access mentor alert inbox (returns 403 Forbidden)", async () => {
      const res = await makeRequest("/api/v1/alerts", "GET", {
        "x-user-id": "STD-1001",
        "x-user-role": "student",
      });
      assert.equal(res.statusCode, 403);
    });

    it("HoD and Admin CAN view alerts with any mentor filter", async () => {
      const resHod = await makeRequest("/api/v1/alerts?mentorId=MTR-002", "GET", {
        "x-user-id": "HOD-001",
        "x-user-role": "hod",
      });
      assert.equal(resHod.statusCode, 200);

      const resAdmin = await makeRequest("/api/v1/alerts?mentorId=MTR-002", "GET", {
        "x-user-id": "ADMIN-001",
        "x-user-role": "admin",
      });
      assert.equal(resAdmin.statusCode, 200);
    });

    it("POST /api/v1/alerts/:id/acknowledge with invalid ID format returns 400 Bad Request", async () => {
      const res = await makeRequest("/api/v1/alerts/invalid%20id%20!/acknowledge", "POST", {
        "x-user-id": "MTR-001",
        "x-user-role": "mentor",
      });
      assert.equal(res.statusCode, 400);
    });

    it("Negative RBAC Test: Student role cannot acknowledge alerts (returns 403 Forbidden)", async () => {
      const res = await makeRequest("/api/v1/alerts/alert-123/acknowledge", "POST", {
        "x-user-id": "STD-1001",
        "x-user-role": "student",
      });
      assert.equal(res.statusCode, 403);
    });
  });
});
