"use client";

import { useEffect, useMemo, useState } from "react";
import type { WebhookHealthSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Badge, Drawer, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface WebhooksPageProps {
  token: string;
  onSessionExpired: () => void;
}

type WebhookConfig = { id: string; url: string; events: string[]; enabled: boolean };
type WebhookEvent = {
  id: string;
  configId: string;
  event: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
};

const ALL_EVENTS = ["ticket.created", "ticket.updated"] as const;

const statusTone = (status: string) => {
  if (status === "sent") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "degraded") return "warning" as const;
  if (status === "down") return "danger" as const;
  if (status === "ok") return "success" as const;
  return "neutral" as const;
};

export const WebhooksPage = ({ token, onSessionExpired }: WebhooksPageProps) => {
  const { refreshTick } = useDashboardSignals();
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [health, setHealth] = useState<WebhookHealthSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [eventsList, setEventsList] = useState<string[]>([...ALL_EVENTS]);
  const [adding, setAdding] = useState(false);

  const [editUrl, setEditUrl] = useState("");
  const [editSecret, setEditSecret] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [editEnabled, setEditEnabled] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const selectedEvent = useMemo(() => events.find((item) => item.id === selectedEventId) ?? null, [events, selectedEventId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configsRes, eventsRes, healthRes] = await Promise.all([
        apiFetch<{ items: WebhookConfig[] }>("/internal/v1/webhook-configs", token),
        apiFetch<{ items: WebhookEvent[] }>("/internal/v1/webhook-events?limit=80", token),
        apiFetch<{ items: WebhookHealthSummary[] }>("/internal/v1/webhook-health", token)
      ]);
      setConfigs(configsRes.items ?? []);
      setEvents(eventsRes.items ?? []);
      setHealth(healthRes.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const addWebhook = async () => {
    if (!url.trim() || !secret.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch("/internal/v1/webhook-configs", token, {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), secret: secret.trim(), events: eventsList })
      });
      setUrl("");
      setSecret("");
      setEventsList([...ALL_EVENTS]);
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to add webhook");
    } finally {
      setAdding(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook config?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/internal/v1/webhook-configs/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to delete webhook");
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (config: WebhookConfig) => {
    setEditingId(config.id);
    setEditUrl(config.url);
    setEditSecret("");
    setEditEvents([...config.events]);
    setEditEnabled(config.enabled);
  };

  const saveEditConfig = async () => {
    if (!editingId || !editUrl.trim()) return;
    setSavingEdit(true);
    try {
      await apiFetch(`/internal/v1/webhook-configs/${editingId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          url: editUrl.trim(),
          events: editEvents,
          enabled: editEnabled,
          secret: editSecret.trim() || undefined
        })
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update webhook");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <section id="webhooks" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Webhook Operations"
        subtitle="Health, delivery inspection, replay, and secret rotation."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Endpoint Health">
        {health.length === 0 ? (
          <EmptyState title="No webhook endpoints yet" subtitle="Add a webhook to start receiving ticket events." />
        ) : (
          <div className="db-metric-grid">
            {health.map((item) => (
              <article key={item.configId} className="db-metric-card">
                <p className="db-metric-label">{item.url}</p>
                <p className="db-metric-value">{item.deliveries}</p>
                <p className="db-metric-trend">{item.failed} failed · {item.failureRate}% failure rate</p>
                <div className="mt-1">
                  <Badge tone={statusTone(item.lastStatus)}>{item.lastStatus}</Badge>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      <div className="db-kpi-layout">
        <Panel title="Webhook Configs">
          <ul className="m-0 list-none space-y-2 p-0">
            {configs.map((config) => (
              <li key={config.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="m-0 flex-1 break-all text-sm font-medium">{config.url}</p>
                  <Badge tone={config.enabled ? "success" : "neutral"}>{config.enabled ? "active" : "disabled"}</Badge>
                </div>
                <p className="m-0 mt-1 text-xs text-slate-500">{config.events.join(", ")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="db-btn db-btn-secondary" onClick={() => startEdit(config)}>
                    Edit
                  </button>
                  <button type="button" className="db-btn db-btn-secondary" onClick={() => void deleteWebhook(config.id)} disabled={deletingId === config.id}>
                    {deletingId === config.id ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    type="button"
                    className="db-btn db-btn-secondary"
                    onClick={async () => {
                      setTestingId(config.id);
                      try {
                        await apiFetch(`/internal/v1/webhook-configs/${config.id}/test`, token, { method: "POST" });
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Test failed");
                      } finally {
                        setTestingId(null);
                      }
                    }}
                    disabled={testingId === config.id}
                  >
                    {testingId === config.id ? "Testing..." : "Test"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {editingId ? (
            <div className="db-panel" style={{ marginTop: "0.75rem", boxShadow: "none" }}>
              <h3 className="m-0 mb-2 text-sm font-semibold">Edit Webhook</h3>
              <div className="space-y-2">
                <div className="db-field">
                  <label>URL</label>
                  <input className="db-input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                </div>
                <div className="db-field">
                  <label>Rotate secret (optional)</label>
                  <input className="db-input" type="password" value={editSecret} onChange={(e) => setEditSecret(e.target.value)} placeholder="Leave blank to keep current secret" />
                </div>
                <div className="db-field">
                  <label>Events</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_EVENTS.map((eventName) => (
                      <label key={eventName} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={editEvents.includes(eventName)}
                          onChange={() =>
                            setEditEvents((current) =>
                              current.includes(eventName) ? current.filter((evt) => evt !== eventName) : [...current, eventName]
                            )
                          }
                        />
                        {eventName}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
                  Enabled
                </label>
                <div className="flex gap-2">
                  <button type="button" className="db-btn db-btn-primary" onClick={() => void saveEditConfig()} disabled={savingEdit}>
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                  <button type="button" className="db-btn db-btn-secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Add Webhook">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="new-hook-url">URL</label>
              <input id="new-hook-url" className="db-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/clientpulse" />
            </div>
            <div className="db-field">
              <label htmlFor="new-hook-secret">Secret</label>
              <input id="new-hook-secret" className="db-input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
            <div className="db-field">
              <label>Events</label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((eventName) => (
                  <label key={eventName} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={eventsList.includes(eventName)}
                      onChange={() =>
                        setEventsList((current) =>
                          current.includes(eventName) ? current.filter((evt) => evt !== eventName) : [...current, eventName]
                        )
                      }
                    />
                    {eventName}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className="db-btn db-btn-primary" onClick={() => void addWebhook()} disabled={adding || !url.trim() || !secret.trim()}>
              {adding ? "Adding..." : "Add Webhook"}
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Delivery Log">
        <FilterBar>
          <div className="db-field" style={{ minWidth: "180px" }}>
            <label htmlFor="event-filter">Status filter</label>
            <select
              id="event-filter"
              className="db-select"
              value="all"
              onChange={() => {
                // Reserved for future filtering without changing current request shape.
              }}
            >
              <option value="all">All statuses</option>
            </select>
          </div>
        </FilterBar>
        <table className="db-grid">
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Last Error</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} aria-selected={selectedEventId === event.id}>
                <td>{event.event}</td>
                <td>
                  <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                </td>
                <td>{event.attempts}</td>
                <td>{event.lastError ?? "--"}</td>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" className="db-btn db-btn-secondary" onClick={() => setSelectedEventId(event.id)}>
                      Inspect
                    </button>
                    <button
                      type="button"
                      className="db-btn db-btn-secondary"
                      onClick={async () => {
                        setRetryingId(event.id);
                        try {
                          await apiFetch(`/internal/v1/webhook-events/${event.id}/retry`, token, { method: "POST" });
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Retry failed");
                        } finally {
                          setRetryingId(null);
                        }
                      }}
                      disabled={retryingId === event.id}
                    >
                      {retryingId === event.id ? "Retrying..." : "Retry"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Drawer open={Boolean(selectedEvent)} title="Delivery Inspector" onClose={() => setSelectedEventId(null)}>
        {selectedEvent ? (
          <div className="space-y-2 text-sm">
            <p className="m-0">
              <strong>Event:</strong> {selectedEvent.event}
            </p>
            <p className="m-0">
              <strong>Status:</strong> {selectedEvent.status}
            </p>
            <p className="m-0">
              <strong>Attempts:</strong> {selectedEvent.attempts}
            </p>
            <p className="m-0">
              <strong>Last error:</strong> {selectedEvent.lastError ?? "--"}
            </p>
            <div>
              <p className="m-0 mb-1 font-semibold">Payload</p>
              <pre
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  borderRadius: "10px",
                  overflow: "auto",
                  fontSize: "0.75rem"
                }}
              >
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
};

