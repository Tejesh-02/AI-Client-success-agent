"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api";

interface RoutingPageProps {
  token: string;
  onSessionExpired: () => void;
}

type IssueType = {
  id: string;
  code: string;
  label: string;
  primaryEmail: string | null;
  ccEmails: string[];
  slaHours: number;
  enabled: boolean;
  sortOrder: number;
};

function IssueTypeEditForm({
  issueType,
  token,
  onSaved,
  onCancel
}: {
  issueType: IssueType;
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [primaryEmail, setPrimaryEmail] = useState(issueType.primaryEmail ?? "");
  const [ccEmails, setCcEmails] = useState(issueType.ccEmails.join(", "));
  const [slaHours, setSlaHours] = useState(String(issueType.slaHours));
  const [enabled, setEnabled] = useState(issueType.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/internal/v1/issue-types/${issueType.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          primaryEmail: primaryEmail.trim() || null,
          ccEmails: ccEmails.split(",").map((e) => e.trim()).filter(Boolean),
          slaHours: parseInt(slaHours, 10) || 24,
          enabled
        })
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="form-card" style={{ maxWidth: "420px" }}>
      <h4>Edit: {issueType.label}</h4>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      <div className="form-field">
        <label className="form-label" htmlFor="edit-primary-email">Primary email</label>
        <input id="edit-primary-email" className="form-input" value={primaryEmail} onChange={(e) => setPrimaryEmail(e.target.value)} type="email" />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="edit-cc">CC (comma-separated)</label>
        <input id="edit-cc" className="form-input" value={ccEmails} onChange={(e) => setCcEmails(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="edit-sla">SLA (hours)</label>
        <input id="edit-sla" className="form-input" type="number" min={0} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
      </div>
      <div className="form-checkbox-wrap">
        <input id="edit-enabled" type="checkbox" className="form-checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <label className="form-label" htmlFor="edit-enabled" style={{ marginBottom: 0 }}>Enabled</label>
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

export const RoutingPage = ({ token, onSessionExpired }: RoutingPageProps) => {
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: IssueType[] }>("/internal/v1/issue-types", token);
      setIssueTypes(data.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load issue types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const deleteIssueType = async (id: string) => {
    if (!confirm("Delete this issue type? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/internal/v1/issue-types/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to delete issue type");
    } finally {
      setDeletingId(null);
    }
  };

  const addIssueType = async () => {
    if (!newCode.trim() || !newLabel.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch("/internal/v1/issue-types", token, {
        method: "POST",
        body: JSON.stringify({ code: newCode.trim(), label: newLabel.trim() })
      });
      setNewCode("");
      setNewLabel("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add issue type");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section id="routing" className="panel scroll-mt-4">
      <h2>Routing (issue types)</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
        Configure primary email, CC, and SLA per issue type. Used when tickets are created.
      </p>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Label</th><th>Code</th><th>Primary email</th><th>SLA (hours)</th><th>Enabled</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {issueTypes.map((it) => (
            <tr key={it.id}>
              <td>{it.label}</td>
              <td>{it.code}</td>
              <td>{it.primaryEmail ?? "—"}</td>
              <td>{it.slaHours}</td>
              <td>{it.enabled ? "Yes" : "No"}</td>
              <td style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" onClick={() => setEditingId(editingId === it.id ? null : it.id)}>
                  {editingId === it.id ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  style={{ color: "#dc2626" }}
                  disabled={deletingId === it.id}
                  onClick={() => void deleteIssueType(it.id)}
                >
                  {deletingId === it.id ? "Deleting…" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId ? (
        <IssueTypeEditForm
          issueType={issueTypes.find((x) => x.id === editingId)!}
          token={token}
          onSaved={() => { setEditingId(null); void load(); }}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      <div className="form-card">
        <h4>Add custom issue type</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ flex: "1 1 180px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-issue-code">Code</label>
            <input id="new-issue-code" className="form-input" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. custom_support" />
          </div>
          <div className="form-field" style={{ flex: "1 1 180px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-issue-label">Label</label>
            <input id="new-issue-label" className="form-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Display name" />
          </div>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void addIssueType()} disabled={adding || !newCode.trim() || !newLabel.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </section>
  );
};
