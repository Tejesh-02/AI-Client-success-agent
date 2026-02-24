"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyDocumentSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Badge, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface KnowledgePageProps {
  token: string;
  onSessionExpired: () => void;
}

type UsageItem = {
  documentId: string;
  title: string;
  hits: number;
  coverage: number;
  freshnessDays: number;
};

type SimulationResponse = {
  query: string;
  simulatedAnswer: string;
  references: { id: string; title: string; score: number; excerpt: string }[];
};

export const KnowledgePage = ({ token, onSessionExpired }: KnowledgePageProps) => {
  const { searchQuery, refreshTick } = useDashboardSignals();
  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [usage, setUsage] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [simulationQuery, setSimulationQuery] = useState("");
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    try {
      const seed = window.localStorage.getItem("kb_draft_seed");
      if (seed) {
        setDocTitle((current) => current || "Draft from Knowledge Gap");
        setDocContent((current) => current || seed);
        window.localStorage.removeItem("kb_draft_seed");
      }
    } catch {
      // Ignore local storage issues.
    }
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docData, usageData] = await Promise.all([
        apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token),
        apiFetch<{ items: UsageItem[] }>("/internal/v1/knowledge/usage", token)
      ]);
      setDocuments(docData.items ?? []);
      setUsage(usageData.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const usageByDoc = useMemo(() => {
    const map = new Map<string, UsageItem>();
    for (const item of usage) map.set(item.documentId, item);
    return map;
  }, [usage]);

  const visibleDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((doc) => doc.title.toLowerCase().includes(term) || doc.content.toLowerCase().includes(term));
  }, [documents, search]);

  const addDocument = async () => {
    if (!docTitle.trim() || !docContent.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/internal/v1/documents", token, {
        method: "POST",
        body: JSON.stringify({ title: docTitle.trim(), content: docContent.trim() })
      });
      setDocTitle("");
      setDocContent("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/internal/v1/documents/${id}`, token, { method: "DELETE" });
      setSelectedDocIds((current) => current.filter((item) => item !== id));
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const runSimulation = async () => {
    if (!simulationQuery.trim()) return;
    setSimulating(true);
    try {
      const data = await apiFetch<SimulationResponse>("/internal/v1/knowledge/simulate", token, {
        method: "POST",
        body: JSON.stringify({
          query: simulationQuery.trim(),
          documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined
        })
      });
      setSimulation(data);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <section id="knowledge" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Knowledge Base Studio"
        subtitle="Searchable docs, usage signals, and answer simulation."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Document Hub">
        <FilterBar>
          <div className="db-field" style={{ flex: "1 1 320px" }}>
            <label htmlFor="doc-search">Search docs</label>
            <input id="doc-search" className="db-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or content" />
          </div>
        </FilterBar>

        {visibleDocuments.length === 0 ? (
          <EmptyState title="No documents yet" subtitle="Add a company guide or FAQ to start improving AI answers." />
        ) : (
          <table className="db-grid">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visibleDocuments.length > 0 && visibleDocuments.every((doc) => selectedDocIds.includes(doc.id))}
                    onChange={(e) => setSelectedDocIds(e.target.checked ? visibleDocuments.map((doc) => doc.id) : [])}
                    aria-label="Select all documents"
                  />
                </th>
                <th>Document</th>
                <th>Usage</th>
                <th>Freshness</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((doc) => {
                const metric = usageByDoc.get(doc.id);
                return (
                  <tr key={doc.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={() =>
                          setSelectedDocIds((current) =>
                            current.includes(doc.id) ? current.filter((id) => id !== doc.id) : [...current, doc.id]
                          )
                        }
                        aria-label={`Select ${doc.title}`}
                      />
                    </td>
                    <td>
                      <p className="m-0 font-medium">{doc.title}</p>
                      <p className="m-0 mt-1 text-xs text-slate-500">
                        {doc.content.slice(0, 160)}
                        {doc.content.length > 160 ? "..." : ""}
                      </p>
                    </td>
                    <td>
                      <p className="m-0 text-sm">{metric?.hits ?? 0} hits</p>
                      <p className="m-0 text-xs text-slate-500">{metric?.coverage ?? 0}% AI coverage</p>
                    </td>
                    <td>
                      <Badge tone={metric && metric.freshnessDays > 30 ? "warning" : "success"}>
                        {metric ? `${metric.freshnessDays}d old` : "new"}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="db-btn db-btn-secondary"
                        disabled={deletingId === doc.id}
                        onClick={() => void deleteDocument(doc.id)}
                      >
                        {deletingId === doc.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="db-kpi-layout">
        <Panel title="Add New Document">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="doc-title">Title</label>
              <input id="doc-title" className="db-input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} maxLength={200} />
            </div>
            <div className="db-field">
              <label htmlFor="doc-content">Content</label>
              <textarea
                id="doc-content"
                className="db-textarea"
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                rows={8}
                maxLength={100000}
              />
            </div>
            <button
              type="button"
              className="db-btn db-btn-primary"
              onClick={() => void addDocument()}
              disabled={saving || !docTitle.trim() || !docContent.trim()}
            >
              {saving ? "Adding..." : "Add Document"}
            </button>
          </div>
        </Panel>

        <Panel title="Answer Simulator">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="sim-query">Question</label>
              <textarea
                id="sim-query"
                className="db-textarea"
                value={simulationQuery}
                onChange={(e) => setSimulationQuery(e.target.value)}
                rows={4}
                placeholder="Ask what a customer might ask..."
              />
            </div>
            <p className="m-0 text-xs text-slate-500">
              Selected docs: {selectedDocIds.length > 0 ? selectedDocIds.length : "Auto top documents"}
            </p>
            <button type="button" className="db-btn db-btn-primary" onClick={() => void runSimulation()} disabled={simulating || !simulationQuery.trim()}>
              {simulating ? "Simulating..." : "Run Simulation"}
            </button>

            {simulation ? (
              <div className="rounded-lg border border-slate-200 p-2">
                <p className="m-0 text-sm">{simulation.simulatedAnswer}</p>
                <ul className="m-0 mt-2 list-none space-y-1 p-0 text-xs text-slate-600">
                  {simulation.references.map((ref) => (
                    <li key={ref.id}>
                      <strong>{ref.title}</strong> ({ref.score}) - {ref.excerpt}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </section>
  );
};
