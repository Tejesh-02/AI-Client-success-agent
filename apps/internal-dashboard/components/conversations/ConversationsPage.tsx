"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyDocumentSummary, ConversationSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";

interface ConversationsPageProps {
  token: string;
  onSessionExpired: () => void;
}

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  confidenceScore?: number;
  kbArticleIds?: string[];
};

const PAGE_SIZE = 50;

export const ConversationsPage = ({ token, onSessionExpired }: ConversationsPageProps) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [agentReply, setAgentReply] = useState("");
  const [agentReplySending, setAgentReplySending] = useState(false);

  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((c) => c.id === selectedId) : null),
    [selectedId, conversations]
  );

  const load = async (pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: ConversationSummary[]; total: number }>(
        `/internal/v1/conversations?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`,
        token
      );
      setConversations(data.items);
      setTotal(data.total);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  // Poll for conversation list updates every 10s so agents see new messages without refreshing.
  useEffect(() => {
    const id = setInterval(() => void load(page), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  // Poll selected conversation messages every 5s so agents see live customer messages.
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => void loadMessages(selectedId, true), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedId]);

  useEffect(() => {
    apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token)
      .then((d) => setDocuments(d.items ?? []))
      .catch((e: unknown) => {
        if (e instanceof Error && e.message !== "SESSION_EXPIRED") {
          console.warn("Failed to load KB documents for reference:", e.message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadMessages = async (conversationId: string, silent = false) => {
    setSelectedId(conversationId);
    if (!silent) {
      setMessagesLoading(true);
      setMessagesError(null);
      setMessages([]);
    }
    try {
      const data = await apiFetch<{ items: Message[] }>(`/internal/v1/conversations/${conversationId}/messages`, token);
      setMessages(data.items);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      if (!silent) setMessagesError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  const sendAgentReply = async () => {
    if (!selectedId || !agentReply.trim()) return;
    setAgentReplySending(true);
    try {
      await apiFetch(`/internal/v1/conversations/${selectedId}/agent-messages`, token, {
        method: "POST",
        body: JSON.stringify({ content: agentReply.trim() })
      });
      setAgentReply("");
      await loadMessages(selectedId, false);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setMessagesError(e instanceof Error ? e.message : "Failed to send reply");
    } finally {
      setAgentReplySending(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section id="conversations" className="panel scroll-mt-4">
      <h2>Conversations</h2>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Status</th>
            <th>Sentiment</th>
            <th>Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((c) => (
            <tr
              key={c.id}
              onClick={() => void loadMessages(c.id)}
              style={{ cursor: "pointer", background: selectedId === c.id ? "#f0f4ff" : undefined }}
              title="View conversation"
            >
              <td>{c.clientName ?? c.clientId}</td>
              <td>{c.status}</td>
              <td>{c.sentiment}</td>
              <td>{new Date(c.lastMessageAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className="controls" style={{ marginTop: "0.75rem", gap: "0.5rem" }}>
          <button
            type="button"
            className="btn-form btn-form-secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages} ({total} total)</span>
          <button
            type="button"
            className="btn-form btn-form-secondary"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      ) : null}

      {selectedId ? (
        <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>
            Conversation with {selectedConversation?.clientName ?? selectedConversation?.clientId ?? "—"}
            <button
              type="button"
              className="btn-form btn-form-secondary"
              onClick={() => setSelectedId(null)}
              style={{ marginLeft: "0.5rem" }}
              aria-label="Close conversation panel"
            >
              Close
            </button>
          </h3>

          {selectedConversation?.status === "handed_off" ? (
            <div className="form-field">
              <label className="form-label" htmlFor="agent-reply">Reply as agent</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                <textarea
                  id="agent-reply"
                  className="form-textarea"
                  value={agentReply}
                  onChange={(e) => setAgentReply(e.target.value)}
                  placeholder="Type your reply..."
                  rows={2}
                  style={{ flex: 1, minHeight: "60px" }}
                />
                <button
                  type="button"
                  className="btn-form btn-form-primary"
                  disabled={agentReplySending || !agentReply.trim()}
                  onClick={() => void sendAgentReply()}
                >
                  {agentReplySending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          ) : selectedConversation ? (
            <button
              type="button"
              className="btn-form btn-form-secondary"
              onClick={async () => {
                if (!selectedId) return;
                await apiFetch(`/internal/v1/conversations/${selectedId}/take-over`, token, { method: "POST" });
                await loadMessages(selectedId, false);
                void load(page);
              }}
              style={{ marginBottom: "0.5rem" }}
            >
              Take over conversation
            </button>
          ) : null}

          {messagesError ? (
            <>
              <p className="text-sm text-red-600 mb-2">{messagesError}</p>
              <button type="button" className="btn-form btn-form-primary" onClick={() => void loadMessages(selectedId, false)}>Retry</button>
            </>
          ) : null}

          {messagesLoading ? (
            <p>Loading…</p>
          ) : !messagesError ? (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  style={{
                    marginBottom: "0.75rem",
                    padding: "0.5rem",
                    background: msg.role === "ai" ? "#f0f4ff" : msg.role === "agent" ? "#f0fff4" : "#e8f4ea",
                    borderRadius: "6px",
                    textAlign: msg.role === "client" ? "right" : "left"
                  }}
                >
                  <strong>{msg.role === "ai" ? "AI" : msg.role === "agent" ? "Agent" : "Customer"}:</strong>{" "}
                  {msg.content}
                  <span style={{ display: "block", fontSize: "0.85em", opacity: 0.8 }}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                  {msg.role === "ai" && (msg.confidenceScore != null || (msg.kbArticleIds?.length ?? 0) > 0) ? (
                    <span style={{ display: "block", fontSize: "0.8em", marginTop: "0.25rem", color: "#555" }}>
                      Confidence: {msg.confidenceScore != null ? `${(msg.confidenceScore * 100).toFixed(0)}%` : "—"}
                      {(msg.kbArticleIds?.length ?? 0) > 0
                        ? ` · KB: ${(msg.kbArticleIds ?? []).map((id) => documents.find((d) => d.id === id)?.title ?? id).join(", ")}`
                        : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
