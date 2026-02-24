import type { SupabaseClient } from "@supabase/supabase-js";
import type { InMemoryStore } from "../store/inMemoryStore";
import { makeId } from "../store/inMemoryStore";
import type { AuditActorType, AuditLog } from "../types/models";

interface AuditRow {
  id: string;
  company_id: string;
  actor_type: AuditActorType;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const mapRowToAudit = (row: AuditRow): AuditLog => ({
  id: row.id,
  companyId: row.company_id,
  actorType: row.actor_type,
  actorId: row.actor_id,
  action: row.action,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  metadata: row.metadata,
  createdAt: row.created_at
});

export class AuditService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async record(input: {
    companyId: string;
    actorType: AuditActorType;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditLog> {
    const log: AuditLog = {
      id: makeId("audit"),
      companyId: input.companyId,
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString()
    };

    if (this.supabase) {
      const payload = {
        id: log.id,
        company_id: log.companyId,
        actor_type: log.actorType,
        actor_id: log.actorId,
        action: log.action,
        resource_type: log.resourceType,
        resource_id: log.resourceId,
        metadata: log.metadata,
        created_at: log.createdAt
      };

      const { data, error } = await this.supabase
        .from("audit_logs")
        .insert(payload)
        .select("id, company_id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at")
        .single();

      if (error) {
        throw new Error(`Failed to write audit log: ${error.message}`);
      }

      return mapRowToAudit(data as AuditRow);
    }

    this.store.auditLogs.push(log);
    return log;
  }

  async list(companyId: string, filters: {
    actorId?: string;
    action?: string;
    resourceType?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    if (this.supabase) {
      let query = this.supabase
        .from("audit_logs")
        .select("id, company_id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (filters.actorId) {
        query = query.eq("actor_id", filters.actorId);
      }
      if (filters.action) {
        query = query.eq("action", filters.action);
      }
      if (filters.resourceType) {
        query = query.eq("resource_type", filters.resourceType);
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      const { data, error, count } = await query;
      if (error) {
        throw new Error(`Failed to list audit logs: ${error.message}`);
      }

      const items = (data ?? []).map((row) => mapRowToAudit(row as AuditRow));
      return { items, total: count ?? items.length };
    }

    let filtered = this.store.auditLogs.filter((log) => log.companyId === companyId);
    if (filters.actorId) {
      filtered = filtered.filter((log) => log.actorId === filters.actorId);
    }
    if (filters.action) {
      filtered = filtered.filter((log) => log.action === filters.action);
    }
    if (filters.resourceType) {
      filtered = filtered.filter((log) => log.resourceType === filters.resourceType);
    }
    if (filters.dateFrom) {
      filtered = filtered.filter((log) => log.createdAt >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      filtered = filtered.filter((log) => log.createdAt <= filters.dateTo!);
    }

    const total = filtered.length;
    const items = filtered
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit)
      .map((log) => ({ ...log }));

    return { items, total };
  }
}
