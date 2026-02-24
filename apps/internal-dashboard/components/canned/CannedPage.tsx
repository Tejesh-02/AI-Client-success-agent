"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../shared/api";
import { Badge, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface CannedPageProps {
  token: string;
  onSessionExpired: () => void;
}

type CannedResponse = { id: string; title: string; content: string; issueTypeId: string | null };

const extractPlaceholders = (content: string): string[] => {
  const matches = content.match(/\{\{[a-z_]+\}\}/gi) ?? [];
  return [...new Set(matches)];
};

const resolvePreview = (content: string, values: Record<string, string>) => {
  let next = content;
  for (const [key, value] of Object.entries(values)) {
    next = next.replaceAll(`{{${key}}}`, value);
  }
  return next;
};

export const CannedPage = ({ token, onSessionExpired }: CannedPageProps) => {
  const { searchQuery, refreshTick } = useDashboardSignals();
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({
    customer_name: "Alex Johnson",
    company_name: "Acme Corp"
  });

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: CannedResponse[] }>("/internal/v1/canned-responses", token);
      setResponses(data.items ?? []);
      if (!selectedId && data.items?.[0]) setSelectedId(data.items[0].id);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load canned responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const folders = useMemo(() => {
    const set = new Set<string>(["General"]);
    for (const response of responses) {
      const folder = response.title.includes("/") ? response.title.split("/")[0].trim() : "General";
      set.add(folder || "General");
    }
    return ["all", ...[...set].sort()];
  }, [responses]);

  const visibleResponses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return responses.filter((response) => {
      const folder = response.title.includes("/") ? response.title.split("/")[0].trim() : "General";
      if (folderFilter !== "all" && folder !== folderFilter) return false;
      if (!term) return true;
      return response.title.toLowerCase().includes(term) || response.content.toLowerCase().includes(term);
    });
  }, [responses, search, folderFilter]);

  const selected = useMemo(() => responses.find((item) => item.id === selectedId) ?? null, [responses, selectedId]);
  const selectedPlaceholders = selected ? extractPlaceholders(selected.content) : [];

  const addResponse = async () => {
    if (!newTitle.trim() || !newContent.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await apiFetch("/internal/v1/canned-responses", token, {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() })
      });
      setNewTitle("");
      setNewContent("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to add canned response");
    } finally {
      setAdding(false);
    }
  };

  const deleteResponse = async (id: string) => {
    try {
      await apiFetch(`/internal/v1/canned-responses/${id}`, token, { method: "DELETE" });
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to delete response");
    }
  };

  return (
    <section id="canned" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Canned Response Library"
        subtitle="Folders, placeholders, and live preview for faster agent replies."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Templates">
        <FilterBar>
          <div className="db-field" style={{ minWidth: "180px" }}>
            <label htmlFor="canned-folder">Folder</label>
            <select id="canned-folder" className="db-select" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}>
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder === "all" ? "All folders" : folder}
                </option>
              ))}
            </select>
          </div>
          <div className="db-field" style={{ flex: "1 1 260px" }}>
            <label htmlFor="canned-search">Search</label>
            <input id="canned-search" className="db-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or content" />
          </div>
        </FilterBar>

        {visibleResponses.length === 0 ? (
          <EmptyState title="No templates found" subtitle="Create your first canned response below." />
        ) : (
          <table className="db-grid">
            <thead>
              <tr>
                <th>Title</th>
                <th>Placeholders</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleResponses.map((response) => {
                const placeholders = extractPlaceholders(response.content);
                return (
                  <tr key={response.id} aria-selected={selectedId === response.id} style={{ cursor: "pointer" }} onClick={() => setSelectedId(response.id)}>
                    <td>
                      <p className="m-0 font-medium">{response.title}</p>
                      <p className="m-0 text-xs text-slate-500">
                        {response.content.slice(0, 120)}
                        {response.content.length > 120 ? "..." : ""}
                      </p>
                    </td>
                    <td>{placeholders.length > 0 ? placeholders.join(", ") : "--"}</td>
                    <td>
                      <Badge tone="info">{response.content.length} chars</Badge>
                    </td>
                    <td>
                      <button type="button" className="db-btn db-btn-secondary" onClick={(e) => { e.stopPropagation(); void deleteResponse(response.id); }}>
                        Delete
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
        <Panel title="Add Template">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="new-canned-title">Title</label>
              <input
                id="new-canned-title"
                className="db-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Folder/Template Name (e.g. Billing/Refund ETA)"
              />
            </div>
            <div className="db-field">
              <label htmlFor="new-canned-content">Content</label>
              <textarea
                id="new-canned-content"
                className="db-textarea"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={8}
                placeholder="Use placeholders like {{customer_name}} or {{company_name}}"
              />
            </div>
            <button type="button" className="db-btn db-btn-primary" onClick={() => void addResponse()} disabled={adding || !newTitle.trim() || !newContent.trim()}>
              {adding ? "Adding..." : "Add Template"}
            </button>
          </div>
        </Panel>

        <Panel title="Live Preview">
          {selected ? (
            <div className="space-y-2">
              <p className="m-0 text-sm font-semibold">{selected.title}</p>
              {selectedPlaceholders.map((placeholder) => {
                const key = placeholder.replace(/[{}]/g, "");
                return (
                  <div key={placeholder} className="db-field">
                    <label>{placeholder}</label>
                    <input
                      className="db-input"
                      value={previewValues[key] ?? ""}
                      onChange={(e) => setPreviewValues((current) => ({ ...current, [key]: e.target.value }))}
                    />
                  </div>
                );
              })}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                {resolvePreview(selected.content, previewValues)}
              </div>
            </div>
          ) : (
            <EmptyState title="Select a template" subtitle="Choose a template from the library to preview." />
          )}
        </Panel>
      </div>
    </section>
  );
};

