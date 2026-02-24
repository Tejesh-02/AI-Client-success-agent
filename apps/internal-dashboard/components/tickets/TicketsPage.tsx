"use client";

import { useEffect, useMemo, useState } from "react";
import type { TicketSeverity, TicketStatus, TicketSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Badge, Drawer, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface TicketsPageProps {
  token: string;
  onSessionExpired: () => void;
}

type Comment = { id: string; ticketId: string; userId: string; content: string; mentionedUserIds: string[]; createdAt: string };
type TeamUser = { id: string; name: string; email: string; role: string };
type CannedResponse = { id: string; title: string; content: string };

const severityOptions: TicketSeverity[] = ["low", "moderate", "important", "critical", "emergency"];
const statusOptions: TicketStatus[] = ["open", "in_progress", "awaiting_client", "resolved", "closed"];
const PAGE_SIZE = 40;

const badgeToneForSeverity = (severity: TicketSeverity) => {
  if (severity === "critical" || severity === "emergency") return "danger" as const;
  if (severity === "important") return "warning" as const;
  if (severity === "moderate") return "info" as const;
  return "success" as const;
};

export const TicketsPage = ({ token, onSessionExpired }: TicketsPageProps) => {
  const { searchQuery, refreshTick } = useDashboardSignals();
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "">("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<TicketStatus | "">("");
  const [bulkSeverity, setBulkSeverity] = useState<TicketSeverity | "">("");
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const [drawerTicketId, setDrawerTicketId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [transcript, setTranscript] = useState<{ role: string; content: string; createdAt: string }[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    if (searchQuery) setSearch(searchQuery);
  }, [searchQuery]);

  const selectedTicket = useMemo(
    () => (drawerTicketId ? tickets.find((ticket) => ticket.id === drawerTicketId) : null),
    [drawerTicketId, tickets]
  );

  const loadTickets = async (pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE)
      });
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (assigneeFilter && assigneeFilter !== "__unassigned__") params.set("assignedTo", assigneeFilter);

      const data = await apiFetch<{ items: TicketSummary[]; total: number }>(`/internal/v1/tickets?${params.toString()}`, token);
      setTickets(data.items);
      setTotal(data.total);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const loadSideData = async () => {
    try {
      const [teamData, cannedData] = await Promise.all([
        apiFetch<{ items: TeamUser[] }>("/internal/v1/team", token),
        apiFetch<{ items: CannedResponse[] }>("/internal/v1/canned-responses", token)
      ]);
      setTeamUsers(teamData.items ?? []);
      setCannedResponses(cannedData.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
    }
  };

  useEffect(() => {
    void loadTickets(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, statusFilter, severityFilter, assigneeFilter, refreshTick]);

  useEffect(() => {
    void loadSideData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (assigneeFilter === "__unassigned__" && ticket.assignedTo) return false;
      if (atRiskOnly) {
        if (!ticket.slaDueAt) return false;
        if (new Date(ticket.slaDueAt).getTime() > Date.now() + 4 * 60 * 60 * 1000) return false;
      }
      if (!term) return true;
      return (
        ticket.referenceNumber.toLowerCase().includes(term) ||
        ticket.title.toLowerCase().includes(term) ||
        ticket.status.toLowerCase().includes(term)
      );
    });
  }, [tickets, search, assigneeFilter, atRiskOnly]);

  const toggleSelected = (ticketId: string) => {
    setSelectedIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId]
    );
  };

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
      if (drawerTicketId === ticket.id) {
        await loadComments(ticket.id);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to update ticket");
    }
  };

  const runBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    if (!bulkStatus && !bulkSeverity && !bulkAssignee) return;
    setBulkUpdating(true);
    try {
      const resolvedAssignee = bulkAssignee === "__clear__" ? null : bulkAssignee || undefined;
      await apiFetch("/internal/v1/tickets/bulk", token, {
        method: "POST",
        body: JSON.stringify({
          ticketIds: selectedIds,
          status: bulkStatus || undefined,
          severity: bulkSeverity || undefined,
          assignedTo: resolvedAssignee
        })
      });
      setSelectedIds([]);
      setBulkStatus("");
      setBulkSeverity("");
      setBulkAssignee("");
      await loadTickets(page);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkUpdating(false);
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
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setTranscript([]);
      setError(e instanceof Error ? e.message : "Failed to load transcript");
    } finally {
      setTranscriptLoading(false);
    }
  };

  const openDrawer = (ticketId: string) => {
    const ticket = tickets.find((item) => item.id === ticketId);
    setDrawerTicketId(ticketId);
    setCommentContent("");
    void loadComments(ticketId);
    if (ticket?.conversationId) void loadTranscript(ticket.conversationId);
  };

  const addComment = async () => {
    if (!drawerTicketId || !commentContent.trim()) return;
    setCommentSubmitting(true);
    try {
      await apiFetch(`/internal/v1/tickets/${drawerTicketId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ content: commentContent.trim(), mentionedUserIds: [] })
      });
      setCommentContent("");
      await loadComments(drawerTicketId);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to add comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section id="tickets" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Tickets Control Center"
        subtitle="Queue + Kanban views, SLA heat, and bulk triage actions."
        actions={
          <>
            <button type="button" className="db-btn db-btn-secondary" onClick={() => setViewMode((mode) => (mode === "table" ? "kanban" : "table"))}>
              {viewMode === "table" ? "Kanban View" : "Table View"}
            </button>
            <button type="button" className="db-btn db-btn-secondary" onClick={() => void loadTickets(page)} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </>
        }
      />

      <Panel>
        <FilterBar>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="ticket-status">Status</label>
            <select id="ticket-status" className="db-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "")}>
              <option value="">All</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="ticket-severity">Severity</label>
            <select
              id="ticket-severity"
              className="db-select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as TicketSeverity | "")}
            >
              <option value="">All</option>
              {severityOptions.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
          <div className="db-field" style={{ minWidth: "180px" }}>
            <label htmlFor="ticket-assignee">Assignee</label>
            <select id="ticket-assignee" className="db-select" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
              <option value="">Anyone</option>
              <option value="__unassigned__">Unassigned only</option>
              {teamUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div className="db-field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="ticket-search">Search</label>
            <input id="ticket-search" className="db-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, title, status" />
          </div>
          <div className="db-field">
            <label>Pinned Views</label>
            <div className="flex gap-2">
              <button type="button" className={`db-btn ${atRiskOnly ? "db-btn-primary" : "db-btn-secondary"}`} onClick={() => setAtRiskOnly((v) => !v)}>
                At Risk
              </button>
              <button
                type="button"
                className="db-btn db-btn-secondary"
                onClick={() => {
                  setAtRiskOnly(false);
                  setAssigneeFilter("__unassigned__");
                }}
              >
                Unassigned
              </button>
            </div>
          </div>
        </FilterBar>

        {selectedIds.length > 0 ? (
          <div className="db-panel" style={{ marginBottom: "0.75rem", background: "#f8fbff" }}>
            <div className="flex flex-wrap items-end gap-2">
              <p className="m-0 text-sm font-semibold">{selectedIds.length} selected</p>
              <div className="db-field" style={{ minWidth: "150px" }}>
                <label>Status</label>
                <select className="db-select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as TicketStatus | "")}>
                  <option value="">No change</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="db-field" style={{ minWidth: "150px" }}>
                <label>Severity</label>
                <select className="db-select" value={bulkSeverity} onChange={(e) => setBulkSeverity(e.target.value as TicketSeverity | "")}>
                  <option value="">No change</option>
                  {severityOptions.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
              <div className="db-field" style={{ minWidth: "190px" }}>
                <label>Assignee</label>
                <select className="db-select" value={bulkAssignee} onChange={(e) => setBulkAssignee(e.target.value)}>
                  <option value="">No change</option>
                  <option value="__clear__">Unassigned</option>
                  {teamUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="db-btn db-btn-primary"
                onClick={() => void runBulkUpdate()}
                disabled={bulkUpdating}
              >
                {bulkUpdating ? "Applying..." : "Apply Bulk Update"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <ErrorState message={error} onRetry={() => void loadTickets(page)} /> : null}

        {viewMode === "table" ? (
          <>
            <table className="db-grid">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={visibleTickets.length > 0 && visibleTickets.every((ticket) => selectedIds.includes(ticket.id))}
                      onChange={(e) => setSelectedIds(e.target.checked ? visibleTickets.map((ticket) => ticket.id) : [])}
                      aria-label="Select all tickets"
                    />
                  </th>
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
                {visibleTickets.map((ticket) => {
                  const slaDue = ticket.slaDueAt ? new Date(ticket.slaDueAt).getTime() : null;
                  const now = Date.now();
                  const slaLabel =
                    slaDue == null ? "--" : slaDue < now ? "Overdue" : `${Math.round((slaDue - now) / (60 * 60 * 1000))}h left`;
                  return (
                    <tr key={ticket.id} aria-selected={drawerTicketId === ticket.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(ticket.id)}
                          onChange={() => toggleSelected(ticket.id)}
                          aria-label={`Select ticket ${ticket.referenceNumber}`}
                        />
                      </td>
                      <td>{ticket.referenceNumber}</td>
                      <td>{ticket.title}</td>
                      <td>
                        <Badge tone={badgeToneForSeverity(ticket.severity)}>{ticket.severity}</Badge>
                      </td>
                      <td>
                        <Badge tone={ticket.status === "closed" ? "success" : "warning"}>{ticket.status}</Badge>
                      </td>
                      <td style={{ color: slaDue != null && slaDue < now ? "#be123c" : undefined }}>{slaLabel}</td>
                      <td>
                        <select
                          className="db-select"
                          value={ticket.assignedTo ?? ""}
                          onChange={(e) => void updateTicket(ticket, { assignedTo: e.target.value || null })}
                          aria-label="Assign ticket"
                        >
                          <option value="">Unassigned</option>
                          {teamUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.role})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="db-btn db-btn-secondary" onClick={() => openDrawer(ticket.id)}>
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(220px, 1fr))", gap: "0.6rem", overflowX: "auto" }}>
            {statusOptions.map((status) => (
              <div key={status} className="db-panel" style={{ boxShadow: "none", minHeight: "320px" }}>
                <h3 className="m-0 mb-2 text-sm font-semibold">{status}</h3>
                <div className="space-y-2">
                  {visibleTickets
                    .filter((ticket) => ticket.status === status)
                    .map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        className="w-full rounded-lg border border-slate-200 p-2 text-left"
                        onClick={() => openDrawer(ticket.id)}
                      >
                        <p className="m-0 text-xs text-slate-500">{ticket.referenceNumber}</p>
                        <p className="m-0 mt-1 text-sm font-medium">{ticket.title}</p>
                        <div className="mt-2 flex gap-2">
                          <Badge tone={badgeToneForSeverity(ticket.severity)}>{ticket.severity}</Badge>
                          {ticket.slaDueAt && new Date(ticket.slaDueAt).getTime() < Date.now() + 4 * 60 * 60 * 1000 ? (
                            <Badge tone="warning">SLA risk</Badge>
                          ) : null}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleTickets.length === 0 ? <EmptyState title="No tickets match these filters" subtitle="Adjust filters or refresh data." /> : null}

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

      <Drawer open={Boolean(drawerTicketId)} title={selectedTicket ? `Ticket ${selectedTicket.referenceNumber}` : "Ticket"} onClose={() => setDrawerTicketId(null)}>
        {selectedTicket ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="db-field">
                <label>Status</label>
                <select
                  className="db-select"
                  value={selectedTicket.status}
                  onChange={(e) => void updateTicket(selectedTicket, { status: e.target.value as TicketStatus })}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="db-field">
                <label>Severity</label>
                <select
                  className="db-select"
                  value={selectedTicket.severity}
                  onChange={(e) => void updateTicket(selectedTicket, { severity: e.target.value as TicketSeverity })}
                >
                  {severityOptions.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Panel title="Conversation Transcript">
              {transcriptLoading ? (
                <p className="text-sm text-slate-500">Loading transcript...</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {transcript.map((message, index) => (
                    <li key={`${message.createdAt}-${index}`} className="rounded-lg border border-slate-200 p-2 text-sm">
                      <strong>{message.role}:</strong> {message.content.slice(0, 180)}
                      {message.content.length > 180 ? "..." : ""}
                      <p className="m-0 mt-1 text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Internal Comments">
              {commentsError ? <ErrorState message={commentsError} onRetry={() => drawerTicketId && void loadComments(drawerTicketId)} /> : null}
              {commentsLoading ? (
                <p className="text-sm text-slate-500">Loading comments...</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {comments.map((comment) => (
                    <li key={comment.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                      <strong>{teamUsers.find((u) => u.id === comment.userId)?.name ?? comment.userId}:</strong> {comment.content}
                      <p className="m-0 mt-1 text-xs text-slate-500">{new Date(comment.createdAt).toLocaleString()}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="db-field" style={{ marginTop: "0.75rem" }}>
                <label htmlFor="drawer-comment">Add comment</label>
                <textarea
                  id="drawer-comment"
                  className="db-textarea"
                  rows={3}
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  className="db-select"
                  style={{ maxWidth: "220px" }}
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    e.target.value = "";
                    if (!id) return;
                    const canned = cannedResponses.find((entry) => entry.id === id);
                    if (canned) setCommentContent((prev) => (prev ? `${prev}\n\n${canned.content}` : canned.content));
                  }}
                >
                  <option value="">Insert canned...</option>
                  {cannedResponses.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
                <button type="button" className="db-btn db-btn-primary" onClick={() => void addComment()} disabled={commentSubmitting || !commentContent.trim()}>
                  {commentSubmitting ? "Sending..." : "Add Comment"}
                </button>
              </div>
            </Panel>
          </div>
        ) : null}
      </Drawer>
    </section>
  );
};
