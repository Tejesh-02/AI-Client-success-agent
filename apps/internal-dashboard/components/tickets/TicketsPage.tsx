"use client";

import { useEffect, useMemo, useState } from "react";
import type { TicketSeverity, TicketStatus, TicketSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";

interface TicketsPageProps {
  token: string;
  onSessionExpired: () => void;
}

type Comment = { id: string; ticketId: string; userId: string; content: string; mentionedUserIds: string[]; createdAt: string };
type TeamUser = { id: string; name: string; email: string; role: string };
type CannedResponse = { id: string; title: string; content: string };

const severityOptions: TicketSeverity[] = ["low", "moderate", "important", "critical", "emergency"];
const statusOptions: TicketStatus[] = ["open", "in_progress", "awaiting_client", "resolved", "closed"];
const PAGE_SIZE = 50;

export const TicketsPage = ({ token, onSessionExpired }: TicketsPageProps) => {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; content: string; createdAt: string }[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const selectedTicket = useMemo(
    () => (selectedTicketId ? tickets.find((t) => t.id === selectedTicketId) : null),
    [selectedTicketId, tickets]
  );

  const loadTickets = async (pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: TicketSummary[]; total: number }>(
        `/internal/v1/tickets?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`,
        token
      );
      setTickets(data.items);
      setTotal(data.total);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ items: TeamUser[] }>("/internal/v1/team", token),
      apiFetch<{ items: CannedResponse[] }>("/internal/v1/canned-responses", token)
    ])
      .then(([teamData, cannedData]) => {
        setTeamUsers(teamData.items ?? []);
        setCannedResponses(cannedData.items ?? []);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.message !== "SESSION_EXPIRED") {
          console.warn("Failed to load team/canned responses:", e.message);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateTicket = async (ticket: TicketSummary, patch: { status?: TicketStatus; severity?: TicketSeverity; assignedTo?: string | null }) => {
    try {
      await apiFetch(`/internal/v1/tickets/${ticket.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          status: patch.status ?? ticket.status,
          severity: patch.severity ?? ticket.severity,
          assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : ticket.assignedTo
        })
      });
      await loadTickets(page);
      if (selectedTicketId === ticket.id) void loadComments(ticket.id);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to update ticket");
    }
  };

  const loadComments = async (ticketId: string) => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      const data = await apiFetch<{ items: Comment[] }>(`/internal/v1/tickets/${ticketId}/comments`, token);
      setComments(data.items);
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const loadTranscript = async (conversationId: string) => {
    setTranscriptLoading(true);
    try {
      const data = await apiFetch<{ items: { role: string; content: string; createdAt: string }[] }>(
        `/internal/v1/conversations/${conversationId}/messages`,
        token
      );
      setTranscript(data.items);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setTranscript([]);
      setError(e instanceof Error ? e.message : "Failed to load transcript");
    } finally {
      setTranscriptLoading(false);
    }
  };

  const selectTicket = (ticketId: string | null) => {
    setSelectedTicketId(ticketId);
    setCommentContent("");
    setCommentsError(null);
    if (ticketId) {
      void loadComments(ticketId);
      const t = tickets.find((x) => x.id === ticketId);
      if (t?.conversationId) void loadTranscript(t.conversationId);
      else setTranscript([]);
    } else {
      setComments([]);
      setTranscript([]);
    }
  };

  const addComment = async () => {
    if (!selectedTicketId || !commentContent.trim()) return;
    setCommentSubmitting(true);
    try {
      await apiFetch(`/internal/v1/tickets/${selectedTicketId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ content: commentContent.trim(), mentionedUserIds: [] })
      });
      setCommentContent("");
      await loadComments(selectedTicketId);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to add comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section id="tickets" className="panel scroll-mt-4">
      <h2>Tickets</h2>
      {error ? <p className="text-sm text-red-600 mb-2">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Assignee</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const slaDue = ticket.slaDueAt ? new Date(ticket.slaDueAt).getTime() : null;
            const now = Date.now();
            const slaLabel = slaDue == null ? "—" : slaDue < now ? "Overdue" : `${Math.round((slaDue - now) / (60 * 60 * 1000))}h left`;
            return (
              <tr key={ticket.id} style={{ background: selectedTicketId === ticket.id ? "#f0f4ff" : undefined }}>
                <td>{ticket.referenceNumber}</td>
                <td>{ticket.title}</td>
                <td><span className={`badge ${ticket.severity}`}>{ticket.severity}</span></td>
                <td>{ticket.status}</td>
                <td style={{ fontSize: "0.9rem", color: slaDue != null && slaDue < now ? "#b91c1c" : undefined }}>{slaLabel}</td>
                <td>
                  <select
                    value={ticket.assignedTo ?? ""}
                    onChange={(e) => void updateTicket(ticket, { assignedTo: e.target.value || null })}
                    aria-label="Assign to"
                  >
                    <option value="">Unassigned</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => selectTicket(selectedTicketId === ticket.id ? null : ticket.id)}
                  >
                    {selectedTicketId === ticket.id ? "Hide details" : "View details"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 ? (
        <div className="controls" style={{ marginTop: "0.75rem", gap: "0.5rem" }}>
          <button type="button" className="btn-form btn-form-secondary" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>Previous</button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages} ({total} total)</span>
          <button type="button" className="btn-form btn-form-secondary" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</button>
        </div>
      ) : null}

      {selectedTicketId ? (
        <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>
            Ticket: {selectedTicket?.referenceNumber ?? selectedTicketId}
            {selectedTicket?.title ? (
              <span style={{ display: "block", fontSize: "0.95rem", fontWeight: "normal", color: "#555", marginTop: "0.25rem" }}>
                {selectedTicket.title}
              </span>
            ) : null}
            {selectedTicket?.slaDueAt ? (
              <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem" }}>
                SLA: {new Date(selectedTicket.slaDueAt).getTime() < Date.now()
                  ? "Overdue"
                  : `${Math.round((new Date(selectedTicket.slaDueAt).getTime() - Date.now()) / (60 * 60 * 1000))}h left`}
              </span>
            ) : null}
            <button type="button" className="btn-form btn-form-secondary" onClick={() => selectTicket(null)} style={{ marginLeft: "0.5rem" }}>Close</button>
          </h3>

          {selectedTicket ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", margin: "0.75rem 0 1rem", fontSize: "0.9rem" }}>
              <div>
                <span style={{ fontWeight: 500, marginRight: "0.25rem" }}>Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => void updateTicket(selectedTicket, { status: e.target.value as TicketStatus })}
                  aria-label="Set ticket status"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontWeight: 500, marginRight: "0.25rem" }}>Severity:</span>
                <select
                  value={selectedTicket.severity}
                  onChange={(e) => void updateTicket(selectedTicket, { severity: e.target.value as TicketSeverity })}
                  aria-label="Set ticket severity"
                >
                  {severityOptions.map((sv) => (
                    <option key={sv} value={sv}>{sv}</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontWeight: 500, marginRight: "0.25rem" }}>Assignee:</span>
                <select
                  value={selectedTicket.assignedTo ?? ""}
                  onChange={(e) => void updateTicket(selectedTicket, { assignedTo: e.target.value || null })}
                  aria-label="Assign ticket"
                >
                  <option value="">Unassigned</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <span style={{ fontWeight: 500, marginRight: "0.25rem" }}>Created:</span>
                {new Date(selectedTicket.createdAt).toLocaleString()}
              </div>
            </div>
          ) : null}

          <h4>Conversation transcript</h4>
          {transcriptLoading ? <p>Loading transcript…</p> : (
            <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem", maxHeight: "200px", overflowY: "auto" }}>
              {transcript.map((msg, i) => (
                <li key={i} style={{ padding: "0.25rem 0", borderBottom: "1px solid #eee", fontSize: "0.9rem" }}>
                  <strong>{msg.role}:</strong> {msg.content.slice(0, 120)}{msg.content.length > 120 ? "…" : ""}
                  <span style={{ display: "block", fontSize: "0.8em", color: "#666" }}>{new Date(msg.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}

          <h4>Internal comments</h4>
          {commentsError ? (
            <>
              <p className="text-sm text-red-600 mb-2">{commentsError}</p>
              <button type="button" className="btn-form btn-form-primary" onClick={() => void loadComments(selectedTicketId)}>Retry</button>
            </>
          ) : null}
          {commentsLoading ? <p>Loading comments…</p> : !commentsError ? (
            <>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem" }}>
                {comments.map((c) => (
                  <li key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
                    <strong>{teamUsers.find((u) => u.id === c.userId)?.name ?? c.userId}:</strong> {c.content}
                    <span style={{ display: "block", fontSize: "0.85em", color: "#666" }}>{new Date(c.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              <div className="form-field">
                <label className="form-label" htmlFor="ticket-comment">Add internal comment</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <textarea
                    id="ticket-comment"
                    className="form-textarea"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="Type your comment..."
                    rows={2}
                    style={{ flex: "1 1 200px", minHeight: "60px" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <select
                      className="form-select"
                      aria-label="Insert canned response"
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        e.target.value = "";
                        if (!id) return;
                        const cr = cannedResponses.find((c) => c.id === id);
                        if (cr) setCommentContent((prev) => (prev ? `${prev}\n\n${cr.content}` : cr.content));
                      }}
                      style={{ minWidth: "140px" }}
                    >
                      <option value="">Insert canned…</option>
                      {cannedResponses.map((cr) => <option key={cr.id} value={cr.id}>{cr.title}</option>)}
                    </select>
                    <button
                      type="button"
                      className="btn-form btn-form-primary"
                      onClick={() => void addComment()}
                      disabled={commentSubmitting || !commentContent.trim()}
                    >
                      {commentSubmitting ? "Sending…" : "Add comment"}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};
