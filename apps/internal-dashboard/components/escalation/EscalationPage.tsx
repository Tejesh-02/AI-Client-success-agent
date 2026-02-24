"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api";

interface EscalationPageProps {
  token: string;
  onSessionExpired: () => void;
}

type EscalationRule = {
  id: string;
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  importanceOverride: string | null;
  enabled: boolean;
};

const severityOptions = ["low", "moderate", "important", "critical", "emergency"] as const;

function EscalationEditForm({
  rule,
  token,
  onSaved,
  onCancel
}: {
  rule: EscalationRule;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(rule.name);
  const [trigger, setTrigger] = useState(rule.triggerType);
  const [keywords, setKeywords] = useState(
    Array.isArray((rule.triggerConfig as { keywords?: string[] }).keywords)
      ? ((rule.triggerConfig as { keywords?: string[] }).keywords ?? []).join(", ")
      : ""
  );
  const [importance, setImportance] = useState(rule.importanceOverride ?? "critical");
  const [enabled, setEnabled] = useState(rule.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        triggerType: trigger,
        importanceOverride: importance,
        enabled
      };
      if (trigger === "keyword" && keywords.trim()) {
        body.triggerConfig = { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
      } else {
        body.triggerConfig = {};
      }
      await apiFetch(`/internal/v1/escalation-rules/${rule.id}`, token, {
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
      <h4>Edit: {rule.name}</h4>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      <div className="form-field">
        <label className="form-label" htmlFor="edit-rule-name">Rule name</label>
        <input id="edit-rule-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="edit-rule-trigger">Trigger</label>
        <select id="edit-rule-trigger" className="form-select" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="keyword">Keyword</option>
          <option value="sentiment">Sentiment</option>
          <option value="churn">Churn</option>
          <option value="frequency">Frequency</option>
          <option value="plan_type">Plan type</option>
        </select>
      </div>
      {trigger === "keyword" ? (
        <div className="form-field">
          <label className="form-label" htmlFor="edit-rule-keywords">Keywords (comma-separated)</label>
          <input id="edit-rule-keywords" className="form-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
      ) : null}
      <div className="form-field">
        <label className="form-label" htmlFor="edit-rule-importance">Importance override</label>
        <select id="edit-rule-importance" className="form-select" value={importance} onChange={(e) => setImportance(e.target.value)}>
          {severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-checkbox-wrap">
        <input id="edit-rule-enabled" type="checkbox" className="form-checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <label className="form-label" htmlFor="edit-rule-enabled" style={{ marginBottom: 0 }}>Enabled</label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-form btn-form-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-form btn-form-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export const EscalationPage = ({ token, onSessionExpired }: EscalationPageProps) => {
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("keyword");
  const [keywords, setKeywords] = useState("");
  const [importance, setImportance] = useState("critical");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: EscalationRule[] }>("/internal/v1/escalation-rules", token);
      setRules(data.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load escalation rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addRule = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        triggerType: trigger,
        importanceOverride: importance,
        enabled: true
      };
      if (trigger === "keyword" && keywords.trim()) {
        body.triggerConfig = { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
      }
      await apiFetch("/internal/v1/escalation-rules", token, { method: "POST", body: JSON.stringify(body) });
      setName("");
      setKeywords("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add rule");
    } finally {
      setAdding(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this escalation rule?")) return;
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/internal/v1/escalation-rules/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to delete rule");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="escalation" className="panel scroll-mt-4">
      <h2>Escalation rules</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
        When a rule matches (e.g. keyword, sentiment), ticket severity or assignee can be overridden.
      </p>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Trigger</th><th>Importance override</th><th>Enabled</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.triggerType}</td>
              <td>{r.importanceOverride ?? "—"}</td>
              <td>{r.enabled ? "Yes" : "No"}</td>
              <td style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => setEditingId(editingId === r.id ? null : r.id)}>
                  {editingId === r.id ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  style={{ color: "#dc2626" }}
                  disabled={deletingId === r.id}
                  onClick={() => void deleteRule(r.id)}
                >
                  {deletingId === r.id ? "Deleting…" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId ? (
        <EscalationEditForm
          rule={rules.find((r) => r.id === editingId)!}
          token={token}
          onSaved={() => { setEditingId(null); void load(); }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      <div className="form-card">
        <h4>Add rule</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ flex: "1 1 160px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-rule-name">Rule name</label>
            <input id="new-rule-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
          </div>
          <div className="form-field" style={{ flex: "0 1 auto", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-rule-trigger">Trigger</label>
            <select id="new-rule-trigger" className="form-select" value={trigger} onChange={(e) => setTrigger(e.target.value)} style={{ minWidth: "120px" }}>
              <option value="keyword">Keyword</option>
              <option value="sentiment">Sentiment</option>
              <option value="churn">Churn (auto-detects)</option>
              <option value="frequency">Frequency</option>
              <option value="plan_type">Plan type</option>
            </select>
          </div>
          {trigger === "keyword" ? (
            <div className="form-field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
              <label className="form-label" htmlFor="new-rule-keywords">Keywords (comma-separated)</label>
              <input id="new-rule-keywords" className="form-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. urgent, asap" />
            </div>
          ) : null}
          <div className="form-field" style={{ flex: "0 1 auto", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-rule-importance">Importance</label>
            <select id="new-rule-importance" className="form-select" value={importance} onChange={(e) => setImportance(e.target.value)} style={{ minWidth: "100px" }}>
              {severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void addRule()} disabled={adding || !name.trim()}>
            {adding ? "Adding…" : "Add rule"}
          </button>
        </div>
      </div>
    </section>
  );
};
