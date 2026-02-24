"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api";

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
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resourceFilter, setResourceFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (resourceFilter) params.set("resourceType", resourceFilter);
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", "100");
      const data = await apiFetch<{ items: AuditLog[]; total: number }>(`/internal/v1/audit-logs?${params.toString()}`, token);
      setLogs(data.items);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setLogs([]);
      setError(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, resourceFilter, actionFilter]);

  return (
    <section id="audit" className="panel scroll-mt-4">
      <h2>Audit log</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Who did what, when. Filter by resource type or action.</p>

      <div className="controls" style={{ marginBottom: "1rem", alignItems: "flex-end", gap: "0.75rem" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="auditResourceFilter">Resource type</label>
          <select id="auditResourceFilter" className="form-select" value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} style={{ minWidth: "140px" }}>
            <option value="">All</option>
            <option value="ticket">ticket</option>
            <option value="ticket_comment">ticket_comment</option>
            <option value="company_document">company_document</option>
            <option value="session">session</option>
            <option value="user">user</option>
          </select>
        </div>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="auditActionFilter">Action</label>
          <select id="auditActionFilter" className="form-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ minWidth: "180px" }}>
            <option value="">All</option>
            <option value="ticket.created.from_ai">ticket.created.from_ai</option>
            <option value="ticket.updated">ticket.updated</option>
            <option value="ticket.comment.created">ticket.comment.created</option>
            <option value="company_document.created">company_document.created</option>
            <option value="user.logged_in">user.logged_in</option>
          </select>
        </div>
        <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} style={{ marginBottom: "1rem" }}>Retry</button>
        </>
      ) : null}

      {loading ? <p>Loading audit log…</p> : (
        <table className="table">
          <thead>
            <tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th><th>ID</th></tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actorType}: {log.actorId}</td>
                <td>{log.action}</td>
                <td>{log.resourceType}</td>
                <td style={{ fontSize: "0.85em" }}>{log.resourceId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && logs.length === 0 ? (
        <p style={{ fontSize: "0.9rem", color: "#666" }}>No audit entries match the filters.</p>
      ) : null}
    </section>
  );
};
