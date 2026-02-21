import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { WebhookConfig, WebhookEvent } from "../types/models";

interface WebhookConfigRow {
  id: string;
  company_id: string;
  url: string;
  secret: string;
  events: string[] | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookEventRow {
  id: string;
  config_id: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

const mapConfigRow = (row: WebhookConfigRow): WebhookConfig => ({
  id: row.id,
  companyId: row.company_id,
  url: row.url,
  secret: row.secret,
  events: row.events ?? [],
  enabled: row.enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapEventRow = (row: WebhookEventRow): WebhookEvent => ({
  id: row.id,
  configId: row.config_id,
  event: row.event,
  payload: row.payload,
  status: row.status as "pending" | "sent" | "failed",
  attempts: row.attempts,
  lastError: row.last_error,
  createdAt: row.created_at
});

export class WebhookService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async listConfigs(companyId: string): Promise<WebhookConfig[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from("webhook_configs")
      .select("id, company_id, url, secret, events, enabled, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to list webhook configs: ${error.message}`);
    return (data ?? []).map((r) => mapConfigRow(r as WebhookConfigRow));
  }

  async createConfig(companyId: string, input: { url: string; secret: string; events: string[] }): Promise<WebhookConfig> {
    const now = new Date().toISOString();
    const id = makeId("webhook_config");
    if (!this.supabase) {
      return {
        id,
        companyId: companyId,
        url: input.url,
        secret: input.secret,
        events: input.events,
        enabled: true,
        createdAt: now,
        updatedAt: now
      };
    }
    const { data, error } = await this.supabase
      .from("webhook_configs")
      .insert({
        id,
        company_id: companyId,
        url: input.url,
        secret: input.secret,
        events: input.events,
        enabled: true,
        created_at: now,
        updated_at: now
      })
      .select("id, company_id, url, secret, events, enabled, created_at, updated_at")
      .single();
    if (error) throw new Error(`Failed to create webhook config: ${error.message}`);
    return mapConfigRow(data as WebhookConfigRow);
  }

  async deleteConfig(companyId: string, id: string): Promise<boolean> {
    if (!this.supabase) return false;
    const { error } = await this.supabase.from("webhook_configs").delete().eq("company_id", companyId).eq("id", id);
    if (error) throw new Error(`Failed to delete webhook config: ${error.message}`);
    return true;
  }

  async listEvents(companyId: string, configId?: string, limit = 100): Promise<WebhookEvent[]> {
    if (!this.supabase) return [];
    if (configId) {
      const { data, error } = await this.supabase
        .from("webhook_events")
        .select("id, config_id, event, payload, status, attempts, last_error, created_at")
        .eq("config_id", configId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`Failed to list webhook events: ${error.message}`);
      return (data ?? []).map((r) => mapEventRow(r as WebhookEventRow));
    }
    const configs = await this.listConfigs(companyId);
    const configIds = configs.map((c) => c.id);
    if (configIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from("webhook_events")
      .select("id, config_id, event, payload, status, attempts, last_error, created_at")
      .in("config_id", configIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to list webhook events: ${error.message}`);
    return (data ?? []).map((r) => mapEventRow(r as WebhookEventRow));
  }

  async dispatch(companyId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const configs = await this.listConfigs(companyId);
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    for (const config of configs) {
      if (!config.enabled || !config.events.includes(event)) continue;
      const eventId = makeId("webhook_evt");
      const createdAt = new Date().toISOString();
      if (this.supabase) {
        await this.supabase.from("webhook_events").insert({
          id: eventId,
          config_id: config.id,
          event,
          payload,
          status: "pending",
          attempts: 0,
          last_error: null,
          created_at: createdAt
        });
      }
      try {
        const signature = createHmac("sha256", config.secret).update(body).digest("hex");
        const res = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": `sha256=${signature}`
          },
          body
        });
        if (this.supabase && res.ok) {
          await this.supabase.from("webhook_events").update({ status: "sent", attempts: 1 }).eq("id", eventId);
        } else if (this.supabase) {
          await this.supabase
            .from("webhook_events")
            .update({ status: "failed", attempts: 1, last_error: `${res.status} ${await res.text()}` })
            .eq("id", eventId);
        }
      } catch (err) {
        if (this.supabase) {
          await this.supabase
            .from("webhook_events")
            .update({ status: "failed", attempts: 1, last_error: err instanceof Error ? err.message : String(err) })
            .eq("id", eventId);
        }
      }
    }
  }
}
