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
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("webhook_configs")
        .select("id, company_id, url, secret, events, enabled, created_at, updated_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list webhook configs: ${error.message}`);
      return (data ?? []).map((r) => mapConfigRow(r as WebhookConfigRow));
    }

    return this.store.webhookConfigs
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createConfig(companyId: string, input: { url: string; secret: string; events: string[] }): Promise<WebhookConfig> {
    const now = new Date().toISOString();
    const id = makeId("webhook_config");
    const config: WebhookConfig = {
      id,
      companyId,
      url: input.url,
      secret: input.secret,
      events: input.events,
      enabled: true,
      createdAt: now,
      updatedAt: now
    };

    if (this.supabase) {
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

    this.store.webhookConfigs.push(config);
    return config;
  }

  async updateConfig(companyId: string, id: string, input: Partial<{ url: string; secret: string; events: string[]; enabled: boolean }>): Promise<WebhookConfig | null> {
    const updatedAt = new Date().toISOString();

    if (this.supabase) {
      const payload: Record<string, unknown> = { updated_at: updatedAt };
      if (input.url !== undefined) payload.url = input.url;
      if (input.secret !== undefined) payload.secret = input.secret;
      if (input.events !== undefined) payload.events = input.events;
      if (input.enabled !== undefined) payload.enabled = input.enabled;

      const { data, error } = await this.supabase
        .from("webhook_configs")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", id)
        .select("id, company_id, url, secret, events, enabled, created_at, updated_at")
        .maybeSingle();
      if (error) throw new Error(`Failed to update webhook config: ${error.message}`);
      return data ? mapConfigRow(data as WebhookConfigRow) : null;
    }

    const existing = this.store.webhookConfigs.find((c) => c.companyId === companyId && c.id === id);
    if (!existing) return null;
    if (input.url !== undefined) existing.url = input.url;
    if (input.secret !== undefined) existing.secret = input.secret;
    if (input.events !== undefined) existing.events = input.events;
    if (input.enabled !== undefined) existing.enabled = input.enabled;
    existing.updatedAt = updatedAt;
    return existing;
  }

  async deleteConfig(companyId: string, id: string): Promise<boolean> {
    if (this.supabase) {
      const { error } = await this.supabase.from("webhook_configs").delete().eq("company_id", companyId).eq("id", id);
      if (error) throw new Error(`Failed to delete webhook config: ${error.message}`);
      return true;
    }

    const index = this.store.webhookConfigs.findIndex((c) => c.companyId === companyId && c.id === id);
    if (index === -1) return false;
    this.store.webhookConfigs.splice(index, 1);
    return true;
  }

  async findConfig(companyId: string, id: string): Promise<WebhookConfig | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("webhook_configs")
        .select("id, company_id, url, secret, events, enabled, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`Failed to load webhook config: ${error.message}`);
      return data ? mapConfigRow(data as WebhookConfigRow) : null;
    }

    return this.store.webhookConfigs.find((c) => c.companyId === companyId && c.id === id) ?? null;
  }

  async listEvents(companyId: string, configId?: string, limit = 100): Promise<WebhookEvent[]> {
    if (this.supabase) {
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

    const configIds = configId
      ? [configId]
      : this.store.webhookConfigs.filter((c) => c.companyId === companyId).map((c) => c.id);

    return this.store.webhookEvents
      .filter((e) => configIds.includes(e.configId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async findEvent(companyId: string, eventId: string): Promise<WebhookEvent | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("webhook_events")
        .select("id, config_id, event, payload, status, attempts, last_error, created_at")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load webhook event: ${error.message}`);
      if (!data) return null;

      const config = await this.findConfig(companyId, (data as WebhookEventRow).config_id);
      if (!config) return null;
      return mapEventRow(data as WebhookEventRow);
    }

    const found = this.store.webhookEvents.find((evt) => evt.id === eventId);
    if (!found) return null;
    const config = this.store.webhookConfigs.find((cfg) => cfg.id === found.configId && cfg.companyId === companyId);
    if (!config) return null;
    return found;
  }

  async dispatch(companyId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const configs = await this.listConfigs(companyId);
    for (const config of configs) {
      if (!config.enabled || !config.events.includes(event)) continue;
      await this.deliverEvent(config, event, payload);
    }
  }

  async testConfig(companyId: string, configId: string): Promise<WebhookEvent | null> {
    const config = await this.findConfig(companyId, configId);
    if (!config) return null;
    return this.deliverEvent(config, "webhook.test", {
      message: "ClientPulse webhook test",
      testedAt: new Date().toISOString()
    });
  }

  async retryEvent(companyId: string, eventId: string): Promise<WebhookEvent | null> {
    const existing = await this.findEvent(companyId, eventId);
    if (!existing) return null;
    const config = await this.findConfig(companyId, existing.configId);
    if (!config || !config.enabled) return null;

    return this.deliverEvent(config, existing.event, existing.payload, existing);
  }

  async healthSummary(companyId: string): Promise<{
    configId: string;
    url: string;
    enabled: boolean;
    deliveries: number;
    failed: number;
    failureRate: number;
    lastEventAt: string | null;
    lastStatus: "ok" | "degraded" | "down" | "idle";
  }[]> {
    const configs = await this.listConfigs(companyId);
    const events = await this.listEvents(companyId, undefined, 500);
    const grouped = new Map<string, WebhookEvent[]>();
    for (const evt of events) {
      const arr = grouped.get(evt.configId) ?? [];
      arr.push(evt);
      grouped.set(evt.configId, arr);
    }

    return configs.map((cfg) => {
      const cfgEvents = grouped.get(cfg.id) ?? [];
      const deliveries = cfgEvents.length;
      const failed = cfgEvents.filter((evt) => evt.status === "failed").length;
      const failureRate = deliveries > 0 ? Number(((failed / deliveries) * 100).toFixed(1)) : 0;
      const last = cfgEvents[0];
      const lastStatus = !last
        ? "idle"
        : last.status === "sent"
          ? failureRate <= 5
            ? "ok"
            : "degraded"
          : "down";

      return {
        configId: cfg.id,
        url: cfg.url,
        enabled: cfg.enabled,
        deliveries,
        failed,
        failureRate,
        lastEventAt: last?.createdAt ?? null,
        lastStatus
      };
    });
  }

  private async deliverEvent(
    config: WebhookConfig,
    event: string,
    payload: Record<string, unknown>,
    existing?: WebhookEvent
  ): Promise<WebhookEvent> {
    const eventId = existing?.id ?? makeId("webhook_evt");
    const createdAt = existing?.createdAt ?? new Date().toISOString();
    const previousAttempts = existing?.attempts ?? 0;

    if (this.supabase) {
      if (!existing) {
        await this.supabase.from("webhook_events").insert({
          id: eventId,
          config_id: config.id,
          event,
          payload,
          status: "pending",
          attempts: previousAttempts,
          last_error: null,
          created_at: createdAt
        });
      } else {
        await this.supabase
          .from("webhook_events")
          .update({ status: "pending", last_error: null })
          .eq("id", eventId);
      }
    } else if (!existing) {
      this.store.webhookEvents.push({
        id: eventId,
        configId: config.id,
        event,
        payload,
        status: "pending",
        attempts: previousAttempts,
        lastError: null,
        createdAt
      });
    } else {
      const stored = this.store.webhookEvents.find((item) => item.id === eventId);
      if (stored) {
        stored.status = "pending";
        stored.lastError = null;
      }
    }

    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    let newStatus: "sent" | "failed" = "sent";
    let lastError: string | null = null;
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

      if (!res.ok) {
        newStatus = "failed";
        lastError = `${res.status} ${await res.text()}`;
      }
    } catch (err) {
      newStatus = "failed";
      lastError = err instanceof Error ? err.message : String(err);
    }

    const attempts = previousAttempts + 1;
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("webhook_events")
        .update({ status: newStatus, attempts, last_error: lastError })
        .eq("id", eventId)
        .select("id, config_id, event, payload, status, attempts, last_error, created_at")
        .single();
      if (error) throw new Error(`Failed to update webhook event: ${error.message}`);
      return mapEventRow(data as WebhookEventRow);
    }

    const stored = this.store.webhookEvents.find((item) => item.id === eventId);
    if (stored) {
      stored.status = newStatus;
      stored.attempts = attempts;
      stored.lastError = lastError;
      return stored;
    }

    const fallback: WebhookEvent = {
      id: eventId,
      configId: config.id,
      event,
      payload,
      status: newStatus,
      attempts,
      lastError,
      createdAt
    };
    this.store.webhookEvents.push(fallback);
    return fallback;
  }
}
