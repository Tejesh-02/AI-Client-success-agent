"use client";

import { useEffect, useState } from "react";
import type { CompanyDocumentSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";

interface GapsPageProps {
  token: string;
  onSessionExpired: () => void;
}

type KnowledgeGap = {
  conversationId: string;
  messageId: string;
  contentPreview: string;
  confidence: number | null;
  kbArticleIds: string[];
  createdAt: string;
};

export const GapsPage = ({ token, onSessionExpired }: GapsPageProps) => {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapsData, docsData] = await Promise.all([
        apiFetch<{ items: KnowledgeGap[] }>("/internal/v1/analytics/knowledge-gaps?threshold=0.5", token),
        apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token)
      ]);
      setGaps(gapsData.items);
      setDocuments(docsData.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setGaps([]);
      setError(e instanceof Error ? e.message : "Failed to load knowledge gaps");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <section id="gaps" className="panel scroll-mt-4">
      <h2>Knowledge gaps</h2>
      <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
        AI messages with low confidence in conversations that led to a ticket.
      </p>
      <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} disabled={loading} style={{ marginBottom: "0.5rem" }}>
        {loading ? "Loading…" : "Refresh"}
      </button>
      {error ? (
        <>
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} style={{ marginBottom: "0.5rem" }}>Retry</button>
        </>
      ) : null}

      {gaps.length > 0 ? (
        <table className="table">
          <thead>
            <tr><th>Conversation</th><th>Message preview</th><th>Confidence</th><th>KB articles</th><th>Date</th></tr>
          </thead>
          <tbody>
            {gaps.slice(0, 50).map((row) => (
              <tr key={row.messageId}>
                <td style={{ fontSize: "0.85em" }}>{row.conversationId}</td>
                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.contentPreview}{row.contentPreview.length >= 200 ? "…" : ""}
                </td>
                <td>{row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "—"}</td>
                <td style={{ fontSize: "0.85em" }}>
                  {row.kbArticleIds.length
                    ? row.kbArticleIds.map((id) => documents.find((d) => d.id === id)?.title ?? id).join(", ")
                    : "—"}
                </td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p style={{ fontSize: "0.9rem", color: "#666" }}>No low-confidence messages in escalated conversations. Click Refresh.</p>
      ) : null}
    </section>
  );
};
