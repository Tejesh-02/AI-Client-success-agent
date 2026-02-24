"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CompanyDocumentSummary, ConversationContext, ConversationSummary } from "@clientpulse/types";
import { API_URL, apiFetch } from "../shared/api";
import { Badge, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

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

const PAGE_SIZE = 40;

export const ConversationsPage = ({ token, onSessionExpired }: ConversationsPageProps) => {
  const { searchQuery, liveEnabled, refreshTick } = useDashboardSignals();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "resolved" | "handed_off">("");
  const [sentimentFilter, setSentimentFilter] = useState<"" | "positive" | "neutral" | "negative" | "frustrated">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [agentReply, setAgentReply] = useState("");
  const [agentReplySending, setAgentReplySending] = useState(false);

  const selectedConversation = useMemo(
    () => (selectedId ? conversations.find((item) => item.id === selectedId) : null),
    [conversations, selectedId]
  );

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  const loadConversations = async (pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
        sortBy: "lastMessageAt",
        sortDir: "desc"
      });
      if (statusFilter) params.set("status", statusFilter);
      if (sentimentFilter) params.set("sentiment", sentimentFilter);
      if (search.trim()) params.set("search", search.trim());

      const data = await apiFetch<{ items: ConversationSummary[]; total: number }>(
        `/internal/v1/conversations?${params.toString()}`,
        token
      );
      setConversations(data.items);
      setTotal(data.total);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const loadConversationDetails = async (conversationId: string, silent = false) => {
    if (!silent) {
      setMessagesLoading(true);
      setMessagesError(null);
      setContextLoading(true);
    }
    setSelectedId(conversationId);
    try {
      const [messagesData, contextData] = await Promise.all([
        apiFetch<{ items: Message[] }>(`/internal/v1/conversations/${conversationId}/messages`, token),
        apiFetch<ConversationContext>(`/internal/v1/conversations/${conversationId}/context`, token)
      ]);
      setMessages(messagesData.items);
      setContext(contextData);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      if (!silent) setMessagesError(e instanceof Error ? e.message : "Failed to load conversation details");
    } finally {
      if (!silent) {
        setMessagesLoading(false);
        setContextLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadConversations(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, statusFilter, sentimentFilter, search, refreshTick]);

  useEffect(() => {
    apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token)
      .then((data) => setDocuments(data.items ?? []))
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "SESSION_EXPIRED") {
          onSessionExpired();
        }
      });
  }, [token, onSessionExpired]);

  useEffect(() => {
    if (!selectedId || !liveEnabled) return;
    const interval = setInterval(() => {
      void loadConversationDetails(selectedId, true);
    }, 7000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, liveEnabled]);

  useEffect(() => {
    if (!liveEnabled) return;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${API_URL}/internal/v1/conversations/stream`, { withCredentials: true });
      source.addEventListener("snapshot", () => {
        void loadConversations(page);
      });
      source.onerror = () => {
        source?.close();
        source = null;
        fallbackInterval = setInterval(() => {
          void loadConversations(page);
        }, 10000);
      };
    } catch {
      fallbackInterval = setInterval(() => {
        void loadConversations(page);
      }, 10000);
    }

    return () => {
      source?.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEnabled, page]);

  const sendAgentReply = async () => {
    if (!selectedId || !agentReply.trim()) return;
    setAgentReplySending(true);
    try {
      await apiFetch(`/internal/v1/conversations/${selectedId}/agent-messages`, token, {
        method: "POST",
        body: JSON.stringify({ content: agentReply.trim() })
      });
      setAgentReply("");
      await loadConversationDetails(selectedId);
      await loadConversations(page);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setMessagesError(e instanceof Error ? e.message : "Failed to send reply");
    } finally {
      setAgentReplySending(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section id="conversations" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Conversations Workspace"
        subtitle="Queue, transcript, and context in one triage view."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void loadConversations(page)} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      <Panel>
        <FilterBar>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="conv-status">Status</label>
            <select id="conv-status" className="db-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">All</option>
              <option value="active">active</option>
              <option value="handed_off">handed_off</option>
              <option value="resolved">resolved</option>
            </select>
          </div>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="conv-sentiment">Sentiment</label>
            <select
              id="conv-sentiment"
              className="db-select"
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value as typeof sentimentFilter)}
            >
              <option value="">All</option>
              <option value="positive">positive</option>
              <option value="neutral">neutral</option>
              <option value="negative">negative</option>
              <option value="frustrated">frustrated</option>
            </select>
          </div>
          <div className="db-field" style={{ flex: "1 1 280px" }}>
            <label htmlFor="conv-search">Search</label>
            <input
              id="conv-search"
              className="db-input"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder="Search client name or id"
            />
          </div>
          <div className="db-field">
            <label>Saved Views</label>
            <div className="flex gap-2">
              <button type="button" className="db-btn db-btn-secondary" onClick={() => { setStatusFilter("handed_off"); setSentimentFilter(""); }}>
                Handoffs
              </button>
              <button type="button" className="db-btn db-btn-secondary" onClick={() => { setStatusFilter(""); setSentimentFilter("frustrated"); }}>
                Frustrated
              </button>
            </div>
          </div>
        </FilterBar>

        {error ? <ErrorState message={error} onRetry={() => void loadConversations(page)} /> : null}

        <div className="db-three-pane">
          <Panel title={`Queue (${total})`} className="db-pane-scroll">
            <table className="db-grid">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Sentiment</th>
                  <th>Last</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conversation) => (
                  <tr
                    key={conversation.id}
                    aria-selected={conversation.id === selectedId}
                    onClick={() => void loadConversationDetails(conversation.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{conversation.clientName ?? conversation.clientId}</td>
                    <td>
                      <Badge tone={conversation.status === "handed_off" ? "warning" : "info"}>{conversation.status}</Badge>
                    </td>
                    <td>{conversation.sentiment}</td>
                    <td>{new Date(conversation.lastMessageAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between">
              <button type="button" className="db-btn db-btn-secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </button>
              <p className="text-xs text-slate-500">
                Page {page + 1} / {totalPages}
              </p>
              <button
                type="button"
                className="db-btn db-btn-secondary"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
              </button>
            </div>
          </Panel>

          <Panel
            title={selectedConversation ? `Transcript · ${selectedConversation.clientName ?? selectedConversation.clientId}` : "Transcript"}
            className="db-pane-scroll"
            right={
              selectedConversation?.status === "active" ? (
                <button
                  type="button"
                  className="db-btn db-btn-secondary"
                  onClick={async () => {
                    if (!selectedId) return;
                    await apiFetch(`/internal/v1/conversations/${selectedId}/take-over`, token, { method: "POST" });
                    await loadConversationDetails(selectedId);
                    await loadConversations(page);
                  }}
                >
                  Take Over
                </button>
              ) : null
            }
          >
            {!selectedId ? (
              <EmptyState title="Select a conversation" subtitle="Choose a row from the queue to inspect transcript and context." />
            ) : messagesLoading ? (
              <p className="text-sm text-slate-500">Loading conversation...</p>
            ) : messagesError ? (
              <ErrorState message={messagesError} onRetry={() => selectedId && void loadConversationDetails(selectedId)} />
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      border: "1px solid #e5edf7",
                      borderRadius: "10px",
                      padding: "0.55rem",
                      background: message.role === "client" ? "#edf8f3" : message.role === "agent" ? "#f5f3ff" : "#f8fafc"
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong style={{ fontSize: "0.8rem", textTransform: "uppercase" }}>{message.role}</strong>
                      <span className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="m-0 mt-1 whitespace-pre-wrap text-sm">{message.content}</p>
                    {message.role === "ai" ? (
                      <p className="m-0 mt-1 text-xs text-slate-500">
                        Confidence: {message.confidenceScore != null ? `${Math.round(message.confidenceScore * 100)}%` : "--"}
                        {message.kbArticleIds?.length
                          ? ` · KB: ${message.kbArticleIds.map((id) => documents.find((doc) => doc.id === id)?.title ?? id).join(", ")}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                ))}

                {selectedConversation?.status === "handed_off" ? (
                  <div className="db-field" style={{ marginTop: "0.8rem" }}>
                    <label htmlFor="agent-reply">Reply as agent</label>
                    <div className="flex gap-2">
                      <textarea
                        id="agent-reply"
                        className="db-textarea"
                        rows={2}
                        value={agentReply}
                        onChange={(e) => setAgentReply(e.target.value)}
                        placeholder="Type your response..."
                      />
                      <button
                        type="button"
                        className="db-btn db-btn-primary"
                        onClick={() => void sendAgentReply()}
                        disabled={agentReplySending || !agentReply.trim()}
                      >
                        {agentReplySending ? "Sending..." : "Send"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Panel>

          <Panel title="Context & Action Rail" className="db-pane-scroll">
            {!selectedId ? (
              <EmptyState title="No conversation selected" subtitle="Select a queue item to view customer context and related tickets." />
            ) : contextLoading ? (
              <p className="text-sm text-slate-500">Loading context...</p>
            ) : context ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="m-0 font-semibold">{context.client.name}</p>
                  <p className="m-0 text-slate-500">{context.client.email}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="db-panel" style={{ padding: "0.5rem", boxShadow: "none" }}>
                    <p className="m-0 text-xs text-slate-500">AI Avg Confidence</p>
                    <p className="m-0 mt-1 font-semibold">
                      {context.ai.averageConfidence != null ? `${Math.round(context.ai.averageConfidence * 100)}%` : "--"}
                    </p>
                  </div>
                  <div className="db-panel" style={{ padding: "0.5rem", boxShadow: "none" }}>
                    <p className="m-0 text-xs text-slate-500">Low Confidence</p>
                    <p className="m-0 mt-1 font-semibold">{context.ai.lowConfidenceCount}</p>
                  </div>
                </div>

                <div>
                  <h4 className="m-0 text-sm font-semibold">Related Tickets</h4>
                  {context.relatedTickets.length === 0 ? (
                    <p className="m-0 mt-1 text-xs text-slate-500">No tickets linked to this conversation.</p>
                  ) : (
                    <ul className="m-0 mt-2 list-none space-y-2 p-0">
                      {context.relatedTickets.map((ticket) => (
                        <li key={ticket.id} className="rounded-lg border border-slate-200 p-2">
                          <p className="m-0 text-xs text-slate-500">{ticket.referenceNumber}</p>
                          <p className="m-0 mt-1 font-medium">{ticket.title}</p>
                          <div className="mt-1 flex gap-2">
                            <Badge tone={ticket.status === "closed" ? "success" : "warning"}>{ticket.status}</Badge>
                            <Badge tone={ticket.severity === "critical" || ticket.severity === "emergency" ? "danger" : "info"}>
                              {ticket.severity}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/tickets" className="db-btn db-btn-secondary">
                    Open Tickets Board
                  </Link>
                  <Link href="/gaps" className="db-btn db-btn-secondary">
                    View Knowledge Gaps
                  </Link>
                </div>
              </div>
            ) : (
              <ErrorState message="Failed to load context" onRetry={() => selectedId && void loadConversationDetails(selectedId)} />
            )}
          </Panel>
        </div>
      </Panel>
    </section>
  );
};

