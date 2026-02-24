import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketSeverity } from "@clientpulse/types";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { EscalationRule, EscalationTriggerType } from "../types/models";

interface EscalationRuleRow {
  id: string;
  company_id: string;
  name: string;
  trigger_type: EscalationTriggerType;
  trigger_config: Record<string, unknown> | null;
  importance_override: TicketSeverity | null;
  action_config: Record<string, unknown> | null;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: EscalationRuleRow): EscalationRule => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  triggerType: row.trigger_type,
  triggerConfig: row.trigger_config ?? {},
  importanceOverride: row.importance_override,
  actionConfig: row.action_config ?? {},
  enabled: row.enabled,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface EscalationContext {
  messageContent: string;
  sentiment: string;
  confidence: number;
  /** Customer's plan/tier, e.g. "enterprise", "pro", "free". Optional — rules using plan_type won't match if omitted. */
  planType?: string;
  /** Number of tickets already raised by this client (used for frequency trigger). */
  clientTicketCount?: number;
}

export interface EscalationOverrides {
  severity?: TicketSeverity;
  assigneeId?: string | null;
  primaryEmail?: string | null;
  ccEmails?: string[];
}

export class EscalationRuleService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async listByCompany(companyId: string): Promise<EscalationRule[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("escalation_rules")
        .select("id, company_id, name, trigger_type, trigger_config, importance_override, action_config, enabled, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true });

      if (error) {
        throw new Error(`Failed to list escalation rules: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRow(row as EscalationRuleRow));
    }

    return this.store.escalationRules
      .filter((r) => r.companyId === companyId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findById(companyId: string, id: string): Promise<EscalationRule | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("escalation_rules")
        .select("id, company_id, name, trigger_type, trigger_config, importance_override, action_config, enabled, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get escalation rule: ${error.message}`);
      }

      return data ? mapRow(data as EscalationRuleRow) : null;
    }

    return this.store.escalationRules.find((r) => r.companyId === companyId && r.id === id) ?? null;
  }

  async create(companyId: string, input: {
    name: string;
    triggerType: EscalationTriggerType;
    triggerConfig?: Record<string, unknown>;
    importanceOverride?: TicketSeverity | null;
    actionConfig?: Record<string, unknown>;
    enabled?: boolean;
    sortOrder?: number;
  }): Promise<EscalationRule> {
    const now = new Date().toISOString();
    const rule: EscalationRule = {
      id: makeId("escalation_rule"),
      companyId,
      name: input.name.trim(),
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? {},
      importanceOverride: input.importanceOverride ?? null,
      actionConfig: input.actionConfig ?? {},
      enabled: input.enabled ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("escalation_rules")
        .insert({
          id: rule.id,
          company_id: rule.companyId,
          name: rule.name,
          trigger_type: rule.triggerType,
          trigger_config: rule.triggerConfig,
          importance_override: rule.importanceOverride,
          action_config: rule.actionConfig,
          enabled: rule.enabled,
          sort_order: rule.sortOrder,
          created_at: rule.createdAt,
          updated_at: rule.updatedAt
        })
        .select("id, company_id, name, trigger_type, trigger_config, importance_override, action_config, enabled, sort_order, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(`Failed to create escalation rule: ${error.message}`);
      }

      return mapRow(data as EscalationRuleRow);
    }

    this.store.escalationRules.push(rule);
    return rule;
  }

  async update(companyId: string, id: string, input: Partial<{
    name: string;
    triggerType: EscalationTriggerType;
    triggerConfig: Record<string, unknown>;
    importanceOverride: TicketSeverity | null;
    actionConfig: Record<string, unknown>;
    enabled: boolean;
    sortOrder: number;
  }>): Promise<EscalationRule | null> {
    const existing = await this.findById(companyId, id);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();

    if (this.supabase) {
      const payload: Record<string, unknown> = { updated_at: updatedAt };
      if (input.name !== undefined) payload.name = input.name.trim();
      if (input.triggerType !== undefined) payload.trigger_type = input.triggerType;
      if (input.triggerConfig !== undefined) payload.trigger_config = input.triggerConfig;
      if (input.importanceOverride !== undefined) payload.importance_override = input.importanceOverride;
      if (input.actionConfig !== undefined) payload.action_config = input.actionConfig;
      if (input.enabled !== undefined) payload.enabled = input.enabled;
      if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

      const { data, error } = await this.supabase
        .from("escalation_rules")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", id)
        .select("id, company_id, name, trigger_type, trigger_config, importance_override, action_config, enabled, sort_order, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update escalation rule: ${error.message}`);
      }

      return data ? mapRow(data as EscalationRuleRow) : null;
    }

    if (input.name !== undefined) existing.name = input.name.trim();
    if (input.triggerType !== undefined) existing.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) existing.triggerConfig = input.triggerConfig;
    if (input.importanceOverride !== undefined) existing.importanceOverride = input.importanceOverride;
    if (input.actionConfig !== undefined) existing.actionConfig = input.actionConfig;
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
        .from("escalation_rules")
        .delete()
        .eq("company_id", companyId)
        .eq("id", id);

      if (error) {
        throw new Error(`Failed to delete escalation rule: ${error.message}`);
      }

      return true;
    }

    const index = this.store.escalationRules.findIndex((r) => r.companyId === companyId && r.id === id);
    if (index >= 0) {
      this.store.escalationRules.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Evaluate all enabled rules and return merged overrides (first matching rule wins for each override type).
   */
  async evaluate(companyId: string, ctx: EscalationContext): Promise<EscalationOverrides> {
    const rules = await this.listByCompany(companyId);
    const overrides: EscalationOverrides = {};

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const matches = this.matchesRule(rule, ctx);
      if (!matches) continue;

      if (rule.importanceOverride && overrides.severity === undefined) {
        overrides.severity = rule.importanceOverride;
      }
      const ac = rule.actionConfig as { assigneeId?: string; primaryEmail?: string; ccEmails?: string[] };
      if (ac.assigneeId !== undefined && overrides.assigneeId === undefined) {
        overrides.assigneeId = ac.assigneeId;
      }
      if (ac.primaryEmail !== undefined && overrides.primaryEmail === undefined) {
        overrides.primaryEmail = ac.primaryEmail;
      }
      if (ac.ccEmails !== undefined && overrides.ccEmails === undefined) {
        overrides.ccEmails = ac.ccEmails;
      }
    }

    return overrides;
  }

  private matchesRule(rule: EscalationRule, ctx: EscalationContext): boolean {
    const content = ctx.messageContent.toLowerCase();
    const tc = rule.triggerConfig as {
      keywords?: string[];
      sentiment?: string;
      planType?: string;
      /** Minimum number of tickets to trigger the frequency rule. */
      threshold?: number;
    };

    switch (rule.triggerType) {
      case "keyword":
        if (Array.isArray(tc.keywords) && tc.keywords.length) {
          return tc.keywords.some((k: string) => content.includes(k.toLowerCase()));
        }
        return false;

      case "sentiment":
        if (tc.sentiment && ctx.sentiment) {
          return ctx.sentiment === tc.sentiment;
        }
        return false;

      case "churn":
        // Churn rule matches when the message contains typical churn signals
        return (
          content.includes("cancel") ||
          content.includes("leaving") ||
          content.includes("unsubscribe") ||
          content.includes("switch") ||
          content.includes("competitor") ||
          content.includes("disappointed") ||
          content.includes("not happy") ||
          content.includes("stop using") ||
          ctx.sentiment === "frustrated"
        );

      case "plan_type":
        // planType is populated from the client's metadata (passed in context).
        // If not provided, the rule cannot match.
        if (tc.planType && ctx.planType) {
          return ctx.planType.toLowerCase() === tc.planType.toLowerCase();
        }
        return false;

      case "frequency":
        // Match when the client has raised >= threshold tickets.
        // clientTicketCount is provided by chatService when creating tickets.
        if (typeof tc.threshold === "number" && typeof ctx.clientTicketCount === "number") {
          return ctx.clientTicketCount >= tc.threshold;
        }
        return false;

      default:
        return false;
    }
  }
}
