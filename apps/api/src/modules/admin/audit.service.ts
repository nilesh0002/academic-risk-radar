import mongoose from "mongoose";
import { AuditEntry } from "@academic-risk-radar/shared-types";
import { AuditEntryModel } from "../../db/schemas.js";

export interface LogAuditParams {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  timestamp?: string;
}

export interface GetAuditQuery {
  entityType?: string;
  from?: string;
  to?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}

/**
 * Append-only audit logger for Module M8.
 * Records immutable audit entries for configuration changes, model activation, and rollback.
 */
export async function logAuditEntry(params: LogAuditParams): Promise<AuditEntry> {
  const timestamp = params.timestamp || new Date().toISOString();
  const entry: AuditEntry = {
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before !== undefined ? params.before : null,
    after: params.after !== undefined ? params.after : null,
    timestamp,
  };

  if (mongoose.connection.readyState !== 1) {
    return entry;
  }

  try {
    const doc = await AuditEntryModel.create(entry);
    return doc.toObject ? doc.toObject() : entry;
  } catch (err: any) {
    // If DB is not connected (e.g. mock test environment), return in-memory entry
    console.warn(`[AuditService] Could not write audit log to MongoDB: ${err.message}`);
    return entry;
  }
}

/**
 * Retrieve paginated, filterable audit entries.
 */
export async function getAuditEntries(query: GetAuditQuery = {}): Promise<{
  entries: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};

  if (query.entityType) {
    filter.entityType = query.entityType;
  }
  if (query.actorId) {
    filter.actorId = query.actorId;
  }
  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from) {
      filter.timestamp.$gte = query.from;
    }
    if (query.to) {
      filter.timestamp.$lte = query.to;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    return {
      entries: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }

  try {
    const [entries, total] = await Promise.all([
      AuditEntryModel.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditEntryModel.countDocuments(filter),
    ]);

    return {
      entries: entries as AuditEntry[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } catch (err: any) {
    console.warn(`[AuditService] Could not query audit logs from MongoDB: ${err.message}`);
    return {
      entries: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
    };
  }
}
