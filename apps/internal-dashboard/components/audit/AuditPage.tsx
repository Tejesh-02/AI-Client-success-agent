"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AuditDiff } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Drawer, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface AuditPageProps {
  token: string;
  onSessionExpired: () => void;
}

type AuditLog = {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
};

export const AuditPage = ({ token, onSessionExpired }: AuditPageProps) => {
  const { searchQuery, refreshTick } = useDashboardSignals();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedDiff, setSelectedDiff] = useState<AuditDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (resourceFilter) params.set("resourceType", resourceFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (actorFilter) params.set("actorId", actorFilter);
      params.set("limit", "120");
      const data = await apiFetch<{ items: AuditLog[]; total: number }>(`/internal/v1/audit-logs?${params.toString()}`, token);
      setLogs(data.items);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setLogs([]);
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  const loadDiff = async (logId: string) => {
    setSelectedLogId(logId);
    setDiffLoading(true);
    try {
      const diff = await apiFetch<AuditDiff>(`/internal/v1/audit-logs/diff/${logId}`, token);
      setSelectedDiff(diff);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit diff");
      setSelectedDiff(null);
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, resourceFilter, actionFilter, actorFilter, refreshTick]);

  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(term) ||
        log.resourceType.toLowerCase().includes(term) ||
        log.resourceId.toLowerCase().includes(term) ||
        log.actorId.toLowerCase().includes(term)
      );
    });
  }, [logs, search]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(visibleLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="audit" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Audit Command Log"
        subtitle="Faceted filters, diff inspection, and deep links."
        actions={
          <div className="flex gap-2">
            <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button type="button" className="db-btn db-btn-secondary" onClick={exportJson}>
              Export JSON
            </button>
          </div>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Events">
        <FilterBar>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="audit-resource">Resource</label>
            <select id="audit-resource" className="db-select" value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
              <option value="">All</option>
              <option value="ticket">ticket</option>
              <option value="ticket_comment">ticket_comment</option>
              <option value="company_document">company_document</option>
              <option value="issue_type">issue_type</option>
              <option value="escalation_rule">escalation_rule</option>
              <option value="canned_response">canned_response</option>
            </select>
          </div>
          <div className="db-field" style={{ minWidth: "220px" }}>
            <label htmlFor="audit-action">Action</label>
            <input id="audit-action" className="db-input" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder="e.g. ticket.updated" />
          </div>
          <div className="db-field" style={{ minWidth: "220px" }}>
            <label htmlFor="audit-actor">Actor ID</label>
            <input id="audit-actor" className="db-input" value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} placeholder="Filter actor id" />
          </div>
          <div className="db-field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="audit-search">Search</label>
            <input id="audit-search" className="db-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search any visible field" />
          </div>
        </FilterBar>

        <table className="db-grid">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Resource ID</th>
              <th>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {visibleLogs.map((log) => (
              <tr key={log.id} aria-selected={selectedLogId === log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actorType}:{log.actorId}</td>
                <td>{log.action}</td>
                <td>{log.resourceType}</td>
                <td className="text-xs">{log.resourceId}</td>
                <td>
                  <button type="button" className="db-btn db-btn-secondary" onClick={() => void loadDiff(log.id)}>
                    Diff
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Drawer open={Boolean(selectedLogId)} title="Audit Diff Inspector" onClose={() => { setSelectedLogId(null); setSelectedDiff(null); }}>
        {diffLoading ? (
          <p className="text-sm text-slate-500">Loading diff...</p>
        ) : selectedDiff ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="m-0">
                <strong>Action:</strong> {selectedDiff.action}
              </p>
              <p className="m-0">
                <strong>Actor:</strong> {selectedDiff.actorType}:{selectedDiff.actorId}
              </p>
              <p className="m-0">
                <strong>Resource:</strong> {selectedDiff.resourceType}:{selectedDiff.resourceId}
              </p>
            </div>

            <div>
              <p className="m-0 mb-1 font-semibold">Changed Keys</p>
              <p className="m-0 text-slate-600">{selectedDiff.changedKeys.length ? selectedDiff.changedKeys.join(", ") : "No field-level diff captured."}</p>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <p className="m-0 mb-1 font-semibold">Before</p>
                <pre
                  style={{
                    margin: 0,
                    padding: "0.7rem",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    borderRadius: "10px",
                    overflow: "auto",
                    fontSize: "0.74rem"
                  }}
                >
                  {JSON.stringify(selectedDiff.before, null, 2)}
                </pre>
              </div>
              <div>
                <p className="m-0 mb-1 font-semibold">After</p>
                <pre
                  style={{
                    margin: 0,
                    padding: "0.7rem",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    borderRadius: "10px",
                    overflow: "auto",
                    fontSize: "0.74rem"
                  }}
                >
                  {JSON.stringify(selectedDiff.after, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex gap-2">
              {selectedDiff.resourceType === "ticket" ? (
                <Link href="/tickets" className="db-btn db-btn-secondary">
                  Open Ticket Board
                </Link>
              ) : null}
              {selectedDiff.resourceType === "company_document" ? (
                <Link href="/knowledge" className="db-btn db-btn-secondary">
                  Open Knowledge Base
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select an audit row to inspect diff.</p>
        )}
      </Drawer>
    </section>
  );
};

