"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../shared/api";

interface CannedPageProps {
  token: string;
  onSessionExpired: () => void;
}

type CannedResponse = { id: string; title: string; content: string; issueTypeId: string | null };

export const CannedPage = ({ token, onSessionExpired }: CannedPageProps) => {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: CannedResponse[] }>("/internal/v1/canned-responses", token);
      setResponses(data.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load canned responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add canned response");
    } finally {
      setAdding(false);
    }
  };

  const deleteResponse = async (id: string) => {
    setError(null);
    try {
      await apiFetch(`/internal/v1/canned-responses/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <section id="canned" className="panel scroll-mt-4">
      <h2>Canned responses</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
        Reusable reply templates. Use &quot;Insert canned…&quot; in ticket comments to paste one.
      </p>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <table className="table">
        <thead>
          <tr><th>Title</th><th>Content</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {responses.map((cr) => (
            <tr key={cr.id}>
              <td>{cr.title}</td>
              <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cr.content.slice(0, 80)}{cr.content.length > 80 ? "…" : ""}
              </td>
              <td>
                <button type="button" onClick={() => void deleteResponse(cr.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="form-card">
        <h4>Add canned response</h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
          <div className="form-field" style={{ flex: "1 1 180px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-canned-title">Title</label>
            <input id="new-canned-title" className="form-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Short title" />
          </div>
          <div className="form-field" style={{ flex: "2 1 240px", marginBottom: 0 }}>
            <label className="form-label" htmlFor="new-canned-content">Content</label>
            <textarea
              id="new-canned-content"
              className="form-textarea"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Reply template content..."
              rows={2}
              style={{ minHeight: "60px" }}
            />
          </div>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void addResponse()} disabled={adding || !newTitle.trim() || !newContent.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </section>
  );
};
