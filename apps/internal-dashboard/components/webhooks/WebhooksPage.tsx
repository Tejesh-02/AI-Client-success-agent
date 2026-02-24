"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api";

interface WebhooksPageProps {
  token: string;
  onSessionExpired: () => void;
}

type WebhookConfig = { id: string; url: string; events: string[]; enabled: boolean };
type WebhookEvent = { id: string; configId: string; event: string; status: string; lastError: string | null; createdAt: string };

const ALL_EVENTS = ["ticket.created", "ticket.updated"] as const;

function WebhookEditForm({
  config,
  token,
  onSaved,
  onCancel
}: {
  config: WebhookConfig;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(config.url);
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(config.events);
  const [enabled, setEnabled] = useState(config.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (evt: string) => {
    setEvents((prev) => prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { url: url.trim(), events, enabled };
      if (secret.trim()) body.secret = secret.trim();
      await apiFetch(`/internal/v1/webhook-configs/${config.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card" style={{ maxWidth: "480px" }}>
      <h4>Edit webhook</h4>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      <div className="form-field">
        <label className="form-label" htmlFor="edit-webhook-url">URL</label>
        <input id="edit-webhook-url" className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} type="url" />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="edit-webhook-secret">New secret (leave blank to keep existing)</label>
        <input id="edit-webhook-secret" className="form-input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Leave blank to keep existing" />
      </div>
      <div className="form-field">
        <p className="form-label">Events</p>
        {ALL_EVENTS.map((evt) => (
          <div key={evt} className="form-checkbox-wrap">
            <input
              id={`edit-evt-${evt}`}
              type="checkbox"
              className="form-checkbox"
              checked={events.includes(evt)}
              onChange={() => toggleEvent(evt)}
            />
            <label className="form-label" htmlFor={`edit-evt-${evt}`} style={{ marginBottom: 0 }}>{evt}</label>
          </div>
        ))}
      </div>
      <div className="form-checkbox-wrap">
        <input id="edit-webhook-enabled" type="checkbox" className="form-checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <label className="form-label" htmlFor="edit-webhook-enabled" style={{ marginBottom: 0 }}>Enabled</label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-form btn-form-primary" onClick={() => void handleSave()} disabled={saving || !url.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-form btn-form-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export const WebhooksPage = ({ token, onSessionExpired }: WebhooksPageProps) => {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [eventsList] = useState<string[]>([...ALL_EVENTS]);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configsRes, eventsRes] = await Promise.all([
        apiFetch<{ items: WebhookConfig[] }>("/internal/v1/webhook-configs", token),
        apiFetch<{ items: WebhookEvent[] }>("/internal/v1/webhook-events?limit=50", token)
      ]);
      setConfigs(configsRes.items ?? []);
      setEvents(eventsRes.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add webhook");
    } finally {
      setAdding(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Delete this webhook?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/internal/v1/webhook-configs/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to delete webhook");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="webhooks" className="panel scroll-mt-4">
      <h2>Webhooks (admin)</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
        Configure a URL and subscribe to events. Payloads are signed with HMAC (X-Webhook-Signature: sha256=...).
      </p>
      {error ? (
        <>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} style={{ marginBottom: "1rem" }}>Retry</button>
        </>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <div className="form-card">
        <h4>Add webhook</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ flex: "1 1 280px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="webhook-url">URL</label>
            <input id="webhook-url" className="form-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.com/webhook" />
          </div>
          <div className="form-field" style={{ flex: "0 1 160px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="webhook-secret">Secret</label>
            <input id="webhook-secret" className="form-input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Signing secret" />
          </div>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void addWebhook()} disabled={adding || !url.trim() || !secret.trim()}>
            {adding ? "Adding…" : "Add webhook"}
          </button>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {configs.map((c) => (
          <li key={c.id} style={{ marginBottom: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ flex: 1, fontWeight: 500, wordBreak: "break-all" }}>{c.url}</span>
              <span style={{ fontSize: "0.85em", color: "#666" }}>{c.events.join(", ")}</span>
              <span style={{ fontSize: "0.85em", color: c.enabled ? "#16a34a" : "#dc2626" }}>{c.enabled ? "Active" : "Disabled"}</span>
              <button type="button" className="btn-form btn-form-secondary" onClick={() => setEditingId(editingId === c.id ? null : c.id)}>
                {editingId === c.id ? "Cancel" : "Edit"}
              </button>
              <button
                type="button"
                className="btn-form btn-form-secondary"
                style={{ color: "#dc2626" }}
                disabled={deletingId === c.id}
                onClick={() => void deleteWebhook(c.id)}
              >
                {deletingId === c.id ? "Deleting…" : "Delete"}
              </button>
            </div>
            {editingId === c.id ? (
              <div style={{ marginTop: "0.75rem" }}>
                <WebhookEditForm
                  config={c}
                  token={token}
                  onSaved={() => { setEditingId(null); void load(); }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <h4>Event log</h4>
      <table className="table">
        <thead>
          <tr><th>Event</th><th>Status</th><th>Error</th><th>Time</th></tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.event}</td>
              <td>{e.status}</td>
              <td style={{ fontSize: "0.85em" }}>{e.lastError ?? "—"}</td>
              <td>{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
