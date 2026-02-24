"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../shared/api";
import { Badge, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

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

type EditDraft = {
  primaryEmail: string;
  ccEmails: string;
  slaHours: string;
  enabled: boolean;
};

export const RoutingPage = ({ token, onSessionExpired }: RoutingPageProps) => {
  const { searchQuery, refreshTick } = useDashboardSignals();
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [simulationTypeId, setSimulationTypeId] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: IssueType[] }>("/internal/v1/issue-types", token);
      setIssueTypes((data.items ?? []).sort((a, b) => a.sortOrder - b.sortOrder));
      if (!simulationTypeId && data.items?.[0]?.id) setSimulationTypeId(data.items[0].id);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load issue types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const visibleIssueTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return issueTypes;
    return issueTypes.filter((item) => item.label.toLowerCase().includes(term) || item.code.toLowerCase().includes(term));
  }, [issueTypes, search]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    const codeSet = new Set<string>();
    for (const issueType of issueTypes) {
      if (codeSet.has(issueType.code)) list.push(`Duplicate code: ${issueType.code}`);
      codeSet.add(issueType.code);
      if (issueType.enabled && !issueType.primaryEmail) list.push(`${issueType.label} has no primary email`);
    }
    return list;
  }, [issueTypes]);

  const simulation = useMemo(() => issueTypes.find((item) => item.id === simulationTypeId) ?? null, [issueTypes, simulationTypeId]);

  const startEdit = (item: IssueType) => {
    setEditingId(item.id);
    setDraft({
      primaryEmail: item.primaryEmail ?? "",
      ccEmails: item.ccEmails.join(", "),
      slaHours: String(item.slaHours),
      enabled: item.enabled
    });
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    try {
      await apiFetch(`/internal/v1/issue-types/${editingId}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          primaryEmail: draft.primaryEmail.trim() || null,
          ccEmails: draft.ccEmails.split(",").map((v) => v.trim()).filter(Boolean),
          slaHours: Number.parseInt(draft.slaHours, 10) || 24,
          enabled: draft.enabled
        })
      });
      setEditingId(null);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save routing rule");
    }
  };

  const deleteIssueType = async (id: string) => {
    if (!confirm("Delete this issue type?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/internal/v1/issue-types/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to delete issue type");
    } finally {
      setDeletingId(null);
    }
  };

  const addIssueType = async () => {
    if (!newCode.trim() || !newLabel.trim() || adding) return;
    setAdding(true);
    try {
      await apiFetch("/internal/v1/issue-types", token, {
        method: "POST",
        body: JSON.stringify({ code: newCode.trim(), label: newLabel.trim() })
      });
      setNewCode("");
      setNewLabel("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to add issue type");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section id="routing" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Routing Designer"
        subtitle="Priority-ordered issue routes with validation and simulation."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {warnings.length > 0 ? (
        <Panel title="Routing Conflicts">
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-amber-700">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Issue Type Rules">
        <FilterBar>
          <div className="db-field" style={{ flex: "1 1 280px" }}>
            <label htmlFor="routing-search">Search</label>
            <input id="routing-search" className="db-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search routing rules" />
          </div>
        </FilterBar>

        <table className="db-grid">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Issue Type</th>
              <th>Email Route</th>
              <th>SLA</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleIssueTypes.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>
                  <p className="m-0 font-medium">{item.label}</p>
                  <p className="m-0 text-xs text-slate-500">{item.code}</p>
                </td>
                <td>
                  <p className="m-0 text-sm">{item.primaryEmail ?? "--"}</p>
                  {item.ccEmails.length > 0 ? <p className="m-0 text-xs text-slate-500">CC: {item.ccEmails.join(", ")}</p> : null}
                </td>
                <td>{item.slaHours}h</td>
                <td>
                  <Badge tone={item.enabled ? "success" : "neutral"}>{item.enabled ? "enabled" : "disabled"}</Badge>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" className="db-btn db-btn-secondary" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button type="button" className="db-btn db-btn-secondary" onClick={() => void deleteIssueType(item.id)} disabled={deletingId === item.id}>
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editingId && draft ? (
          <div className="db-panel" style={{ marginTop: "0.75rem", boxShadow: "none" }}>
            <h3 className="m-0 mb-2 text-sm font-semibold">Edit Route</h3>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="db-field">
                <label>Primary email</label>
                <input className="db-input" type="email" value={draft.primaryEmail} onChange={(e) => setDraft({ ...draft, primaryEmail: e.target.value })} />
              </div>
              <div className="db-field">
                <label>CC emails (comma separated)</label>
                <input className="db-input" value={draft.ccEmails} onChange={(e) => setDraft({ ...draft, ccEmails: e.target.value })} />
              </div>
              <div className="db-field">
                <label>SLA hours</label>
                <input className="db-input" type="number" min={0} value={draft.slaHours} onChange={(e) => setDraft({ ...draft, slaHours: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
                Enabled
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="db-btn db-btn-primary" onClick={() => void saveEdit()}>
                Save
              </button>
              <button type="button" className="db-btn db-btn-secondary" onClick={() => { setEditingId(null); setDraft(null); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Panel>

      <div className="db-kpi-layout">
        <Panel title="Add Custom Issue Type">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="new-issue-code">Code</label>
              <input id="new-issue-code" className="db-input" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g. product_bug" />
            </div>
            <div className="db-field">
              <label htmlFor="new-issue-label">Label</label>
              <input id="new-issue-label" className="db-input" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Display name" />
            </div>
            <button type="button" className="db-btn db-btn-primary" onClick={() => void addIssueType()} disabled={adding || !newCode.trim() || !newLabel.trim()}>
              {adding ? "Adding..." : "Add Issue Type"}
            </button>
          </div>
        </Panel>

        <Panel title="Route Simulation">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="route-sim">Choose issue type</label>
              <select id="route-sim" className="db-select" value={simulationTypeId} onChange={(e) => setSimulationTypeId(e.target.value)}>
                {issueTypes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            {simulation ? (
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="m-0 font-semibold">{simulation.label}</p>
                <p className="m-0 mt-1 text-slate-500">Primary: {simulation.primaryEmail ?? "--"}</p>
                <p className="m-0 text-slate-500">CC: {simulation.ccEmails.length ? simulation.ccEmails.join(", ") : "--"}</p>
                <p className="m-0 text-slate-500">SLA target: {simulation.slaHours}h</p>
                <p className="m-0 mt-2">
                  <Badge tone={simulation.enabled ? "success" : "warning"}>{simulation.enabled ? "Will route" : "Disabled route"}</Badge>
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
  );
};

