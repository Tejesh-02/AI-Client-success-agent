"use client";

import { useEffect, useState } from "react";
import type { CompanyDocumentSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";

interface KnowledgePageProps {
  token: string;
  onSessionExpired: () => void;
}

export const KnowledgePage = ({ token, onSessionExpired }: KnowledgePageProps) => {
  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token);
      setDocuments(data.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add document");
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/internal/v1/documents/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section id="knowledge" className="panel scroll-mt-4">
      <h2>Company knowledge</h2>
      <p className="text-sm text-slate-600 mb-4">
        Documents here are sent to the AI as context so it can answer using your product/company info.
      </p>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <div className="form-card">
        <h4>Add document</h4>
        <div className="form-field">
          <label className="form-label" htmlFor="doc-title">Document title</label>
          <input
            id="doc-title"
            className="form-input"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="e.g. FAQ, Product guide"
            maxLength={200}
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="doc-content">Content</label>
          <textarea
            id="doc-content"
            className="form-textarea"
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste or type content the AI should use when answering customers..."
            rows={4}
            maxLength={100000}
          />
        </div>
        <div className="form-actions">
          <button
            type="button"
            className="btn-form btn-form-primary"
            onClick={() => void addDocument()}
            disabled={saving || !docTitle.trim() || !docContent.trim()}
          >
            {saving ? "Adding…" : "Add document"}
          </button>
        </div>
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {documents.map((doc) => (
          <li
            key={doc.id}
            style={{
              padding: "0.75rem",
              marginBottom: "0.5rem",
              background: "#f5f5f5",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start"
            }}
          >
            <div>
              <strong>{doc.title}</strong>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "#555" }}>
                {doc.content.slice(0, 120)}{doc.content.length > 120 ? "…" : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn-form btn-form-secondary"
              onClick={() => void deleteDocument(doc.id)}
              disabled={deletingId === doc.id}
              style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}
            >
              {deletingId === doc.id ? "Deleting…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
      {documents.length === 0 && !loading ? (
        <p style={{ fontSize: "0.9rem", color: "#666" }}>No documents yet. Add one above so the AI knows your product.</p>
      ) : null}
    </section>
  );
};
