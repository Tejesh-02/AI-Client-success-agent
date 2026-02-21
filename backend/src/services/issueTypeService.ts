import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { IssueType } from "../types/models";

interface IssueTypeRow {
  id: string;
  company_id: string;
  code: string;
  label: string;
  primary_email: string | null;
  cc_emails: string[] | null;
  sla_hours: number;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: IssueTypeRow): IssueType => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  label: row.label,
  primaryEmail: row.primary_email,
  ccEmails: row.cc_emails ?? [],
  slaHours: row.sla_hours,
  enabled: row.enabled,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const DEFAULT_ISSUE_TYPES: { code: string; label: string; sortOrder: number }[] = [
  { code: "technical", label: "Technical", sortOrder: 0 },
  { code: "billing", label: "Billing", sortOrder: 1 },
  { code: "legal", label: "Legal", sortOrder: 2 },
  { code: "onboarding", label: "Onboarding", sortOrder: 3 },
  { code: "feature", label: "Feature", sortOrder: 4 },
  { code: "access", label: "Access", sortOrder: 5 },
  { code: "other", label: "Other", sortOrder: 6 }
];

export class IssueTypeService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async listByCompany(companyId: string): Promise<IssueType[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("issue_types")
        .select("id, company_id, code, label, primary_email, cc_emails, sla_hours, enabled, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });

      if (error) {
        throw new Error(`Failed to list issue types: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRow(row as IssueTypeRow));
    }

    return this.store.issueTypes
      .filter((t) => t.companyId === companyId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findById(companyId: string, id: string): Promise<IssueType | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("issue_types")
        .select("id, company_id, code, label, primary_email, cc_emails, sla_hours, enabled, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get issue type: ${error.message}`);
      }

      return data ? mapRow(data as IssueTypeRow) : null;
    }

    return this.store.issueTypes.find((t) => t.companyId === companyId && t.id === id) ?? null;
  }

  async create(companyId: string, input: {
    code: string;
    label: string;
    primaryEmail?: string | null;
    ccEmails?: string[];
    slaHours?: number;
    enabled?: boolean;
    sortOrder?: number;
  }): Promise<IssueType> {
    const now = new Date().toISOString();
    const code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
    const issueType: IssueType = {
      id: makeId("issue_type"),
      companyId,
      code,
      label: input.label.trim() || code,
      primaryEmail: input.primaryEmail ?? null,
      ccEmails: input.ccEmails ?? [],
      slaHours: input.slaHours ?? 24,
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("issue_types")
        .insert({
          id: issueType.id,
          company_id: issueType.companyId,
          code: issueType.code,
          label: issueType.label,
          primary_email: issueType.primaryEmail,
          cc_emails: issueType.ccEmails,
          sla_hours: issueType.slaHours,
          enabled: issueType.enabled,
          sort_order: issueType.sortOrder,
          created_at: issueType.createdAt,
          updated_at: issueType.updatedAt
        })
        .select("id, company_id, code, label, primary_email, cc_emails, sla_hours, enabled, sort_order, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(`Failed to create issue type: ${error.message}`);
      }

      return mapRow(data as IssueTypeRow);
    }

    this.store.issueTypes.push(issueType);
    return issueType;
  }

  async update(companyId: string, id: string, input: Partial<{
    code: string;
    label: string;
    primaryEmail: string | null;
    ccEmails: string[];
    slaHours: number;
    enabled: boolean;
    sortOrder: number;
  }>): Promise<IssueType | null> {
    const existing = await this.findById(companyId, id);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();

    if (this.supabase) {
      const payload: Record<string, unknown> = { updated_at: updatedAt };
      if (input.code !== undefined) payload.code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
      if (input.label !== undefined) payload.label = input.label.trim();
      if (input.primaryEmail !== undefined) payload.primary_email = input.primaryEmail;
      if (input.ccEmails !== undefined) payload.cc_emails = input.ccEmails;
      if (input.slaHours !== undefined) payload.sla_hours = input.slaHours;
      if (input.enabled !== undefined) payload.enabled = input.enabled;
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

      const { data, error } = await this.supabase
        .from("issue_types")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", id)
        .select("id, company_id, code, label, primary_email, cc_emails, sla_hours, enabled, sort_order, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update issue type: ${error.message}`);
      }

      return data ? mapRow(data as IssueTypeRow) : null;
    }

    if (input.code !== undefined) existing.code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
    if (input.label !== undefined) existing.label = input.label.trim();
    if (input.primaryEmail !== undefined) existing.primaryEmail = input.primaryEmail;
    if (input.ccEmails !== undefined) existing.ccEmails = input.ccEmails;
    if (input.slaHours !== undefined) existing.slaHours = input.slaHours;
    if (input.enabled !== undefined) existing.enabled = input.enabled;
    if (input.sortOrder !== undefined) existing.sortOrder = input.sortOrder;
    existing.updatedAt = updatedAt;
    return existing;
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const existing = await this.findById(companyId, id);
    if (!existing) {
      return false;
    }

    if (this.supabase) {
      const { error } = await this.supabase
        .from("issue_types")
        .delete()
        .eq("company_id", companyId)
        .eq("id", id);

      if (error) {
        throw new Error(`Failed to delete issue type: ${error.message}`);
      }

      return true;
    }

    const index = this.store.issueTypes.findIndex((t) => t.companyId === companyId && t.id === id);
    if (index >= 0) {
      this.store.issueTypes.splice(index, 1);
      return true;
    }

    return false;
  }

  /** Ensure default issue types exist for a company (e.g. on first load or seed). */
  async ensureDefaults(companyId: string): Promise<IssueType[]> {
    const existing = await this.listByCompany(companyId);
    if (existing.length > 0) {
      return existing;
    }

    const created: IssueType[] = [];
    for (const def of DEFAULT_ISSUE_TYPES) {
      const it = await this.create(companyId, {
        code: def.code,
        label: def.label,
        sortOrder: def.sortOrder,
        slaHours: 24,
        enabled: true
      });
      created.push(it);
    }
    return created;
  }
}
