process.env.NODE_ENV = "test";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkAndEscalateAlerts } from "../src/modules/alerts/alerts.service.js";

describe("M5: BullMQ SLA Escalation Worker (Stage 2)", () => {
  it("should escalate open alerts past their SLA deadline and set escalatedAt", async () => {
    const referenceTime = new Date("2026-10-26T12:00:00.000Z");

    const savedAlerts: any[] = [];
    const auditEntries: any[] = [];

    // Mock alert documents
    const mockAlertDocs = [
      {
        _id: "alert-overdue-1",
        studentId: "STD-1001",
        mentorId: "MTR-001",
        status: "open",
        slaDeadline: "2026-10-26T10:00:00.000Z", // 2 hours overdue
        escalatedAt: null,
        save: async function () {
          savedAlerts.push(this);
        },
      },
      {
        _id: "alert-overdue-2",
        studentId: "STD-1002",
        mentorId: "MTR-002",
        status: "open",
        slaDeadline: "2026-10-26T11:59:59.000Z", // 1 second overdue
        escalatedAt: null,
        save: async function () {
          savedAlerts.push(this);
        },
      },
    ];

    const mockAlertModel = {
      find: async (query: any) => {
        return mockAlertDocs.filter(
          (a) => a.status === query.status && a.slaDeadline <= query.slaDeadline.$lte
        );
      },
    };

    const mockAuditModel = {
      create: async (entry: any) => {
        auditEntries.push(entry);
        return entry;
      },
    };

    const result = await checkAndEscalateAlerts(referenceTime, {
      AlertModel: mockAlertModel,
      AuditEntryModel: mockAuditModel,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.escalatedCount, 2);
    assert.equal(result.escalatedAlerts.length, 2);
    assert.equal(mockAlertDocs[0].status, "escalated");
    assert.equal(mockAlertDocs[0].escalatedAt, referenceTime.toISOString());
    assert.equal(mockAlertDocs[1].status, "escalated");
    assert.equal(mockAlertDocs[1].escalatedAt, referenceTime.toISOString());

    // Verify Audit Trail Entries were generated
    assert.equal(auditEntries.length, 2);
    assert.equal(auditEntries[0].entityType, "Alert");
    assert.equal(auditEntries[0].action, "ALERT_ESCALATED_SLA_BREACH");
    assert.equal(auditEntries[0].entityId, "alert-overdue-1");
    assert.equal(auditEntries[0].before.status, "open");
    assert.equal(auditEntries[0].after.status, "escalated");
  });

  it("should NOT escalate alerts that have not breached their SLA deadline", async () => {
    const referenceTime = new Date("2026-10-26T12:00:00.000Z");

    const futureAlert = {
      _id: "alert-future-1",
      studentId: "STD-1003",
      mentorId: "MTR-001",
      status: "open",
      slaDeadline: "2026-10-27T12:00:00.000Z", // 24 hours in future
      escalatedAt: null,
      save: async function () {},
    };

    const mockAlertModel = {
      find: async (query: any) => {
        const matches = [futureAlert].filter(
          (a) => a.status === query.status && a.slaDeadline <= query.slaDeadline.$lte
        );
        return matches;
      },
    };

    const result = await checkAndEscalateAlerts(referenceTime, {
      AlertModel: mockAlertModel,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.escalatedCount, 0);
    assert.equal(futureAlert.status, "open");
    assert.equal(futureAlert.escalatedAt, null);
  });
});
