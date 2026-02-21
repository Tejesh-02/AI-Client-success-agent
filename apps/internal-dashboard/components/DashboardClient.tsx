"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CompanyDocumentSummary,
  ConversationSummary,
  InternalLoginRequest,
  InternalLoginResponse,
  TicketSeverity,
  TicketStatus,
  TicketSummary
} from "@clientpulse/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const defaultCompanySlug = process.env.NEXT_PUBLIC_COMPANY_SLUG ?? "acme";

const severityOptions: TicketSeverity[] = ["low", "moderate", "important", "critical", "emergency"];
const statusOptions: TicketStatus[] = ["open", "in_progress", "awaiting_client", "resolved", "closed"];

const getToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("internal_access_token");
};

const setToken = (token: string | null): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (token) {
    window.localStorage.setItem("internal_access_token", token);
  } else {
    window.localStorage.removeItem("internal_access_token");
  }
};

const getStoredUser = (): { id: string; role: string } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("internal_user");
    if (!raw) return null;
    return JSON.parse(raw) as { id: string; role: string };
  } catch {
    return null;
  }
};

const setStoredUser = (user: { id: string; role: string } | null): void => {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem("internal_user", JSON.stringify(user));
  } else {
    window.localStorage.removeItem("internal_user");
  }
};

const fetchJson = async <T,>(path: string, token: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

function IssueTypeEditForm({
  issueType,
  token,
  onSaved,
  onCancel
}: {
  issueType: { id: string; code: string; label: string; primaryEmail: string | null; ccEmails: string[]; slaHours: number; enabled: boolean };
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [primaryEmail, setPrimaryEmail] = useState(issueType.primaryEmail ?? "");
  const [ccEmails, setCcEmails] = useState(issueType.ccEmails.join(", "));
  const [slaHours, setSlaHours] = useState(String(issueType.slaHours));
  const [enabled, setEnabled] = useState(issueType.enabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchJson(`/internal/v1/issue-types/${issueType.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          primaryEmail: primaryEmail.trim() || null,
          ccEmails: ccEmails.split(",").map((e) => e.trim()).filter(Boolean),
          slaHours: parseInt(slaHours, 10) || 24,
          enabled
        })
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h4>Edit: {issueType.label}</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "400px" }}>
        <label>
          Primary email
          <input
            value={primaryEmail}
            onChange={(e) => setPrimaryEmail(e.target.value)}
            placeholder="support@company.com"
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          CC (comma-separated)
          <input
            value={ccEmails}
            onChange={(e) => setCcEmails(e.target.value)}
            placeholder="manager@company.com, team@company.com"
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label>
          SLA (hours)
          <input
            type="number"
            min={0}
            value={slaHours}
            onChange={(e) => setSlaHours(e.target.value)}
            style={{ display: "block", width: "100%", padding: "0.5rem" }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export const DashboardClient = () => {
  const [token, setTokenState] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [companySlug, setCompanySlug] = useState(defaultCompanySlug);
  const [email, setEmail] = useState("manager@acme.test");
  const [password, setPassword] = useState("password123");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [agentReplyContent, setAgentReplyContent] = useState("");
  const [agentReplySending, setAgentReplySending] = useState(false);
  const [conversationMessages, setConversationMessages] = useState<
    { id: string; role: string; content: string; createdAt: string; confidenceScore?: number; kbArticleIds?: string[] }[]
  >([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docSaving, setDocSaving] = useState(false);

  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketComments, setTicketComments] = useState<
    { id: string; ticketId: string; userId: string; content: string; mentionedUserIds: string[]; createdAt: string }[]
  >([]);
  const [ticketCommentContent, setTicketCommentContent] = useState("");
  const [ticketCommentsLoading, setTicketCommentsLoading] = useState(false);
  const [ticketCommentSubmitting, setTicketCommentSubmitting] = useState(false);
  const [ticketTranscript, setTicketTranscript] = useState<{ role: string; content: string; createdAt: string }[]>([]);
  const [ticketTranscriptLoading, setTicketTranscriptLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<
    { id: string; actorType: string; actorId: string; action: string; resourceType: string; resourceId: string; createdAt: string }[]
  >([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogResourceFilter, setAuditLogResourceFilter] = useState("");
  const [auditLogActionFilter, setAuditLogActionFilter] = useState("");

  const [issueTypes, setIssueTypes] = useState<
    { id: string; code: string; label: string; primaryEmail: string | null; ccEmails: string[]; slaHours: number; enabled: boolean; sortOrder: number }[]
  >([]);
  const [editingIssueTypeId, setEditingIssueTypeId] = useState<string | null>(null);
  const [newIssueTypeCode, setNewIssueTypeCode] = useState("");
  const [newIssueTypeLabel, setNewIssueTypeLabel] = useState("");

  const [escalationRules, setEscalationRules] = useState<
    { id: string; name: string; triggerType: string; importanceOverride: string | null; enabled: boolean }[]
  >([]);
  const [newEscalationName, setNewEscalationName] = useState("");
  const [newEscalationTrigger, setNewEscalationTrigger] = useState("keyword");
  const [newEscalationKeywords, setNewEscalationKeywords] = useState("");
  const [newEscalationImportance, setNewEscalationImportance] = useState("critical");

  const [cannedResponses, setCannedResponses] = useState<{ id: string; title: string; content: string; issueTypeId: string | null }[]>([]);
  const [newCannedTitle, setNewCannedTitle] = useState("");
  const [newCannedContent, setNewCannedContent] = useState("");

  const [knowledgeGaps, setKnowledgeGaps] = useState<
    { conversationId: string; messageId: string; contentPreview: string; confidence: number | null; kbArticleIds: string[]; createdAt: string }[]
  >([]);
  const [knowledgeGapsLoading, setKnowledgeGapsLoading] = useState(false);

  const canViewWebhooks = currentUser?.role === "admin" || getStoredUser()?.role === "admin";
  const [webhookConfigs, setWebhookConfigs] = useState<{ id: string; url: string; events: string[]; enabled: boolean }[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<{ id: string; configId: string; event: string; status: string; lastError: string | null; createdAt: string }[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEventsList, setWebhookEventsList] = useState<string[]>(["ticket.created", "ticket.updated"]);

  const [analyticsSummary, setAnalyticsSummary] = useState<{ conversationsCount: number; ticketsRaised: number; ticketsResolved: number; aiResolutionRate: number } | null>(null);

  const [onboarding, setOnboarding] = useState<{ stepsDone: string[]; isProfileComplete: boolean; canGoLive: boolean } | null>(null);

  useEffect(() => {
    setTokenState(getToken());
    setCurrentUser(getStoredUser());
  }, []);

  const login = async () => {
    setAuthBusy(true);
    setAuthError(null);

    try {
      const payload: InternalLoginRequest = {
        companySlug,
        email,
        password
      };

      const response = await fetch(`${API_URL}/internal/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Login failed" }));
        throw new Error(data.error ?? "Login failed");
      }

      const data = (await response.json()) as InternalLoginResponse;
      setToken(data.token);
      setTokenState(data.token);
      const user = { id: data.user.id, role: data.user.role };
      setCurrentUser(user);
      setStoredUser(user);
      setError(null);
    } catch (loginError) {
      setAuthError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    setToken(null);
    setTokenState(null);
    setCurrentUser(null);
    setStoredUser(null);
    setTickets([]);
    setConversations([]);
  };

  const load = async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    const role = currentUser?.role ?? getStoredUser()?.role;
    const canManageKb = role === "admin" || role === "manager";

    try {
      const [ticketPayload, conversationPayload, teamPayload, cannedPayload, onboardingPayload] = await Promise.all([
        fetchJson<{ items: TicketSummary[] }>(
          `/internal/v1/tickets${severityFilter ? `?severity=${encodeURIComponent(severityFilter)}` : ""}`,
          token
        ),
        fetchJson<{ items: ConversationSummary[] }>("/internal/v1/conversations", token),
        fetchJson<{ items: { id: string; name: string; email: string; role: string }[] }>("/internal/v1/team", token),
        fetchJson<{ items: { id: string; title: string; content: string; issueTypeId: string | null }[] }>("/internal/v1/canned-responses", token),
        fetchJson<{ stepsDone: string[]; isProfileComplete: boolean; canGoLive: boolean }>("/internal/v1/onboarding", token)
      ]);

      setTickets(ticketPayload.items);
      setConversations(conversationPayload.items);
      setTeamUsers(teamPayload.items);
      setCannedResponses(cannedPayload.items ?? []);
      setOnboarding(onboardingPayload);

      if (canManageKb) {
        try {
          const [documentsPayload, issueTypesPayload, escalationPayload, summaryPayload] = await Promise.all([
            fetchJson<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token),
            fetchJson<{ items: { id: string; code: string; label: string; primaryEmail: string | null; ccEmails: string[]; slaHours: number; enabled: boolean; sortOrder: number }[] }>("/internal/v1/issue-types", token),
            fetchJson<{ items: { id: string; name: string; triggerType: string; importanceOverride: string | null; enabled: boolean }[] }>("/internal/v1/escalation-rules", token),
            fetchJson<{ conversationsCount: number; ticketsRaised: number; ticketsResolved: number; aiResolutionRate: number }>("/internal/v1/analytics/summary", token)
          ]);
          setDocuments(documentsPayload.items ?? []);
          setIssueTypes(issueTypesPayload.items ?? []);
          setEscalationRules(escalationPayload.items ?? []);
          setAnalyticsSummary(summaryPayload);
        } catch {
          setDocuments([]);
          setIssueTypes([]);
          setEscalationRules([]);
          setAnalyticsSummary(null);
        }
      } else {
        setDocuments([]);
        setIssueTypes([]);
        setEscalationRules([]);
        setAnalyticsSummary(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to fetch dashboard data");
      if (requestError instanceof Error && requestError.message.toLowerCase().includes("token")) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    void load();
  }, [token, severityFilter, currentUser?.role]);

  const loadAuditLogs = async () => {
    if (!token) return;
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditLogResourceFilter) params.set("resourceType", auditLogResourceFilter);
      if (auditLogActionFilter) params.set("action", auditLogActionFilter);
      params.set("limit", "100");
      const data = await fetchJson<{
        items: { id: string; actorType: string; actorId: string; action: string; resourceType: string; resourceId: string; createdAt: string }[];
        total: number;
      }>(`/internal/v1/audit-logs?${params.toString()}`, token);
      setAuditLogs(data.items);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  const canViewAuditLog = currentUser?.role === "admin" || currentUser?.role === "manager" || getStoredUser()?.role === "admin" || getStoredUser()?.role === "manager";

  const loadWebhooks = async () => {
    if (!token || !canViewWebhooks) return;
    try {
      const [configsRes, eventsRes] = await Promise.all([
        fetchJson<{ items: { id: string; url: string; events: string[]; enabled: boolean }[] }>("/internal/v1/webhook-configs", token),
        fetchJson<{ items: { id: string; configId: string; event: string; status: string; lastError: string | null; createdAt: string }[] }>("/internal/v1/webhook-events?limit=50", token)
      ]);
      setWebhookConfigs(configsRes.items ?? []);
      setWebhookEvents(eventsRes.items ?? []);
    } catch {
      setWebhookConfigs([]);
      setWebhookEvents([]);
    }
  };

  useEffect(() => {
    if (token && canViewWebhooks) void loadWebhooks();
  }, [token, canViewWebhooks]);

  const loadKnowledgeGaps = async () => {
    if (!token || !canManageKbSection) return;
    setKnowledgeGapsLoading(true);
    try {
      const data = await fetchJson<{
        items: { conversationId: string; messageId: string; contentPreview: string; confidence: number | null; kbArticleIds: string[]; createdAt: string }[];
      }>("/internal/v1/analytics/knowledge-gaps?threshold=0.5", token);
      setKnowledgeGaps(data.items);
    } catch {
      setKnowledgeGaps([]);
    } finally {
      setKnowledgeGapsLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !canViewAuditLog) return;
    void loadAuditLogs();
  }, [token, auditLogResourceFilter, auditLogActionFilter, canViewAuditLog]);

  const emergencyCount = useMemo(() => tickets.filter((ticket) => ticket.severity === "emergency").length, [tickets]);

  const canManageKbSection =
    currentUser?.role === "admin" ||
    currentUser?.role === "manager" ||
    getStoredUser()?.role === "admin" ||
    getStoredUser()?.role === "manager";

  const selectedConversation = useMemo(
    () => (selectedConversationId ? conversations.find((c) => c.id === selectedConversationId) : null),
    [selectedConversationId, conversations]
  );

  const loadConversationMessages = async (conversationId: string) => {
    if (!token) return;
    setSelectedConversationId(conversationId);
    setMessagesLoading(true);
    setConversationMessages([]);
    try {
      const data = await fetchJson<{
        items: { id: string; role: string; content: string; createdAt: string; confidenceScore?: number; kbArticleIds?: string[] }[];
      }>(`/internal/v1/conversations/${conversationId}/messages`, token);
      setConversationMessages(data.items);
    } catch {
      setConversationMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  const addDocument = async () => {
    if (!token || !docTitle.trim() || !docContent.trim()) return;
    setDocSaving(true);
    try {
      await fetchJson("/internal/v1/documents", token, {
        method: "POST",
        body: JSON.stringify({ title: docTitle.trim(), content: docContent.trim() })
      });
      setDocTitle("");
      setDocContent("");
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add document");
    } finally {
      setDocSaving(false);
    }
  };

  const deleteDocument = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/internal/v1/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error ?? `Request failed: ${response.status}`);
      }
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete document");
    }
  };

  const updateTicket = async (
    ticket: TicketSummary,
    patch: { status?: TicketStatus; severity?: TicketSeverity; assignedTo?: string | null }
  ) => {
    if (!token) {
      return;
    }

    try {
      await fetchJson(
        `/internal/v1/tickets/${ticket.id}`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: patch.status ?? ticket.status,
            severity: patch.severity ?? ticket.severity,
            assignedTo: patch.assignedTo !== undefined ? patch.assignedTo : ticket.assignedTo
          })
        }
      );
      await load();
      if (selectedTicketId === ticket.id) {
        loadTicketComments(ticket.id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update ticket");
    }
  };

  const loadTicketComments = async (ticketId: string) => {
    if (!token) return;
    setTicketCommentsLoading(true);
    try {
      const data = await fetchJson<{
        items: { id: string; ticketId: string; userId: string; content: string; mentionedUserIds: string[]; createdAt: string }[];
      }>(`/internal/v1/tickets/${ticketId}/comments`, token);
      setTicketComments(data.items);
    } catch {
      setTicketComments([]);
    } finally {
      setTicketCommentsLoading(false);
    }
  };

  const selectedTicket = useMemo(
    () => (selectedTicketId ? tickets.find((t) => t.id === selectedTicketId) : null),
    [selectedTicketId, tickets]
  );

  const loadTicketTranscript = async (conversationId: string) => {
    if (!token) return;
    setTicketTranscriptLoading(true);
    try {
      const data = await fetchJson<{ items: { role: string; content: string; createdAt: string }[] }>(
        `/internal/v1/conversations/${conversationId}/messages`,
        token
      );
      setTicketTranscript(data.items);
    } catch {
      setTicketTranscript([]);
    } finally {
      setTicketTranscriptLoading(false);
    }
  };

  const selectTicket = (ticketId: string | null) => {
    setSelectedTicketId(ticketId);
    setTicketCommentContent("");
    if (ticketId) {
      void loadTicketComments(ticketId);
      const t = tickets.find((x) => x.id === ticketId);
      if (t?.conversationId) void loadTicketTranscript(t.conversationId);
      else setTicketTranscript([]);
    } else {
      setTicketComments([]);
      setTicketTranscript([]);
    }
  };

  const addTicketComment = async () => {
    if (!token || !selectedTicketId || !ticketCommentContent.trim()) return;
    setTicketCommentSubmitting(true);
    try {
      await fetchJson(`/internal/v1/tickets/${selectedTicketId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ content: ticketCommentContent.trim(), mentionedUserIds: [] })
      });
      setTicketCommentContent("");
      await loadTicketComments(selectedTicketId);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add comment");
    } finally {
      setTicketCommentSubmitting(false);
    }
  };

  if (!token) {
    return (
      <section className="panel">
        <h2>Internal Login</h2>
        <p>Use email and password to access the dashboard.</p>
        <div className="controls" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <input
            value={companySlug}
            onChange={(event) => setCompanySlug(event.target.value)}
            placeholder="company slug"
            aria-label="company slug"
          />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email"
            aria-label="email"
            type="email"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="password"
            aria-label="password"
            type="password"
          />
          <button onClick={() => void login()} disabled={authBusy}>
            {authBusy ? "Signing in..." : "Sign in"}
          </button>
          {authError ? <p>{authError}</p> : null}
        </div>
      </section>
    );
  }

  const ONBOARDING_STEPS = [
    { key: "profile", label: "Company Profile" },
    { key: "knowledge_base", label: "Knowledge Base" },
    { key: "routing", label: "Routing Config" },
    { key: "team_invite", label: "Team Invite" },
    { key: "test_chat", label: "Test Chat" }
  ];

  return (
    <div className="grid">
      {onboarding && !onboarding.isProfileComplete ? (
      <section className="panel" style={{ gridColumn: "1 / -1", background: "#f0f9ff", border: "1px solid #0ea5e9" }}>
        <h2>Onboarding</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Complete these steps to go live. Minimum: Company Profile and Knowledge Base.
        </p>
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {ONBOARDING_STEPS.map((s) => (
            <li key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <span style={{ textDecoration: onboarding.stepsDone.includes(s.key) ? "line-through" : undefined }}>{s.label}</span>
              {!onboarding.stepsDone.includes(s.key) ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    await fetchJson("/internal/v1/onboarding", token, { method: "PATCH", body: JSON.stringify({ completeStep: s.key }) });
                    const next = await fetchJson<{ stepsDone: string[]; isProfileComplete: boolean; canGoLive: boolean }>("/internal/v1/onboarding", token);
                    setOnboarding(next);
                  }}
                >
                  Mark done
                </button>
              ) : (
                <span style={{ color: "green" }}>Done</span>
              )}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "0.5rem" }}>
          <button
            type="button"
            disabled={!onboarding.canGoLive}
            onClick={async () => {
              if (!token || !onboarding.canGoLive) return;
              try {
                await fetchJson("/internal/v1/onboarding", token, { method: "PATCH", body: JSON.stringify({ goLive: true }) });
                const next = await fetchJson<{ stepsDone: string[]; isProfileComplete: boolean; canGoLive: boolean }>("/internal/v1/onboarding", token);
                setOnboarding(next);
                void load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Go live failed");
              }
            }}
          >
            Go Live
          </button>
          {!onboarding.canGoLive ? <span style={{ marginLeft: "0.5rem", fontSize: "0.9rem", color: "#666" }}>Complete Profile and Knowledge Base first.</span> : null}
        </div>
      </section>
      ) : null}

      <section className="panel">
        <h2>Operational Summary</h2>
        <p>Conversations: {conversations.length}</p>
        <p>Tickets: {tickets.length}</p>
        <p>Emergency Tickets: {emergencyCount}</p>
        {analyticsSummary ? (
          <>
            <p>Tickets resolved: {analyticsSummary.ticketsResolved}</p>
            <p>AI resolution rate: {analyticsSummary.aiResolutionRate}% (no ticket raised)</p>
          </>
        ) : null}

        <div className="controls">
          <label htmlFor="severityFilter">Severity Filter</label>
          <select
            id="severityFilter"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="">All</option>
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
          <button onClick={() => void load()}>Refresh</button>
          <button onClick={logout}>Logout</button>
        </div>

        {loading ? <p>Loading...</p> : null}
        {error ? <p>{error}</p> : null}
      </section>

      {canManageKbSection ? (
      <section className="panel">
        <h2>Company knowledge</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
          Documents here are sent to the AI as context so it can answer using your product/company info.
        </p>
        <div style={{ marginBottom: "1rem" }}>
          <input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            placeholder="Document title (e.g. FAQ, Product guide)"
            style={{ width: "100%", marginBottom: "0.5rem", padding: "0.5rem" }}
            aria-label="Document title"
          />
          <textarea
            value={docContent}
            onChange={(e) => setDocContent(e.target.value)}
            placeholder="Paste or type content the AI should use when answering customers..."
            rows={4}
            style={{ width: "100%", padding: "0.5rem", resize: "vertical" }}
            aria-label="Document content"
          />
          <button
            type="button"
            onClick={() => void addDocument()}
            disabled={docSaving || !docTitle.trim() || !docContent.trim()}
            style={{ marginTop: "0.5rem" }}
          >
            {docSaving ? "Adding…" : "Add document"}
          </button>
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
                  {doc.content.slice(0, 120)}
                  {doc.content.length > 120 ? "…" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void deleteDocument(doc.id)}
                style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        {documents.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#666" }}>No documents yet. Add one above so the AI knows your product.</p>
        ) : null}
      </section>
      ) : null}

      {canManageKbSection ? (
      <section className="panel">
        <h2>Routing (issue types)</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Configure primary email, CC, and SLA per issue type. Used when tickets are created.
        </p>
        <>
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Code</th>
                  <th>Primary email</th>
                  <th>SLA (hours)</th>
                  <th>Enabled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issueTypes.map((it) => (
                  <tr key={it.id}>
                    <td>{it.label}</td>
                    <td>{it.code}</td>
                    <td>{it.primaryEmail ?? "—"}</td>
                    <td>{it.slaHours}</td>
                    <td>{it.enabled ? "Yes" : "No"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setEditingIssueTypeId(editingIssueTypeId === it.id ? null : it.id)}
                      >
                        {editingIssueTypeId === it.id ? "Cancel" : "Edit"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editingIssueTypeId ? (
              <IssueTypeEditForm
                issueType={issueTypes.find((x) => x.id === editingIssueTypeId)!}
                token={token!}
                onSaved={() => {
                  setEditingIssueTypeId(null);
                  void load();
                }}
                onCancel={() => setEditingIssueTypeId(null)}
              />
            ) : null}
            <div style={{ marginTop: "1rem" }}>
              <h4>Add custom issue type</h4>
              <input
                value={newIssueTypeCode}
                onChange={(e) => setNewIssueTypeCode(e.target.value)}
                placeholder="Code (e.g. custom_support)"
                style={{ marginRight: "0.5rem", padding: "0.5rem" }}
              />
              <input
                value={newIssueTypeLabel}
                onChange={(e) => setNewIssueTypeLabel(e.target.value)}
                placeholder="Label"
                style={{ marginRight: "0.5rem", padding: "0.5rem" }}
              />
              <button
                type="button"
                onClick={async () => {
                  if (!token || !newIssueTypeCode.trim() || !newIssueTypeLabel.trim()) return;
                  try {
                    await fetchJson("/internal/v1/issue-types", token, {
                      method: "POST",
                      body: JSON.stringify({ code: newIssueTypeCode.trim(), label: newIssueTypeLabel.trim() })
                    });
                    setNewIssueTypeCode("");
                    setNewIssueTypeLabel("");
                    void load();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to add issue type");
                  }
                }}
              >
                Add
              </button>
            </div>
          </>
      </section>
      ) : null}

      {canManageKbSection ? (
      <section className="panel">
        <h2>Escalation rules</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          When a rule matches (e.g. keyword, sentiment), ticket severity or assignee can be overridden.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trigger</th>
              <th>Importance override</th>
              <th>Enabled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {escalationRules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.triggerType}</td>
                <td>{r.importanceOverride ?? "—"}</td>
                <td>{r.enabled ? "Yes" : "No"}</td>
                <td>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await fetchJson(`/internal/v1/escalation-rules/${r.id}`, token, { method: "DELETE" });
                        void load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed to delete rule");
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "1rem" }}>
          <h4>Add rule</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <input
              value={newEscalationName}
              onChange={(e) => setNewEscalationName(e.target.value)}
              placeholder="Rule name"
              style={{ padding: "0.5rem" }}
            />
            <select
              value={newEscalationTrigger}
              onChange={(e) => setNewEscalationTrigger(e.target.value)}
              style={{ padding: "0.5rem" }}
            >
              <option value="keyword">Keyword</option>
              <option value="sentiment">Sentiment</option>
              <option value="churn">Churn (always Critical)</option>
            </select>
            {newEscalationTrigger === "keyword" ? (
              <input
                value={newEscalationKeywords}
                onChange={(e) => setNewEscalationKeywords(e.target.value)}
                placeholder="Keywords (comma-separated)"
                style={{ padding: "0.5rem", minWidth: "200px" }}
              />
            ) : null}
            <select
              value={newEscalationImportance}
              onChange={(e) => setNewEscalationImportance(e.target.value)}
              style={{ padding: "0.5rem" }}
            >
              {severityOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                if (!token || !newEscalationName.trim()) return;
                try {
                  const body: Record<string, unknown> = {
                    name: newEscalationName.trim(),
                    triggerType: newEscalationTrigger,
                    importanceOverride: newEscalationImportance,
                    enabled: true
                  };
                  if (newEscalationTrigger === "keyword" && newEscalationKeywords.trim()) {
                    body.triggerConfig = { keywords: newEscalationKeywords.split(",").map((k) => k.trim()).filter(Boolean) };
                  }
                  await fetchJson("/internal/v1/escalation-rules", token, { method: "POST", body: JSON.stringify(body) });
                  setNewEscalationName("");
                  setNewEscalationKeywords("");
                  void load();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to add rule");
                }
              }}
            >
              Add rule
            </button>
          </div>
        </div>
      </section>
      ) : null}

      {canManageKbSection ? (
      <section className="panel">
        <h2>Canned responses</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Reusable reply templates. Use &quot;Insert canned…&quot; in ticket comments to paste one.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Content</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cannedResponses.map((cr) => (
              <tr key={cr.id}>
                <td>{cr.title}</td>
                <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cr.content.slice(0, 80)}{cr.content.length > 80 ? "…" : ""}</td>
                <td>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      try {
                        await fetchJson(`/internal/v1/canned-responses/${cr.id}`, token, { method: "DELETE" });
                        void load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed to delete");
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: "1rem" }}>
          <input
            value={newCannedTitle}
            onChange={(e) => setNewCannedTitle(e.target.value)}
            placeholder="Title"
            style={{ marginRight: "0.5rem", padding: "0.5rem" }}
          />
          <textarea
            value={newCannedContent}
            onChange={(e) => setNewCannedContent(e.target.value)}
            placeholder="Content"
            rows={2}
            style={{ marginRight: "0.5rem", padding: "0.5rem", verticalAlign: "top", minWidth: "200px" }}
          />
          <button
            type="button"
            onClick={async () => {
              if (!token || !newCannedTitle.trim() || !newCannedContent.trim()) return;
              try {
                await fetchJson("/internal/v1/canned-responses", token, {
                  method: "POST",
                  body: JSON.stringify({ title: newCannedTitle.trim(), content: newCannedContent.trim() })
                });
                setNewCannedTitle("");
                setNewCannedContent("");
                void load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to add");
              }
            }}
          >
            Add
          </button>
        </div>
      </section>
      ) : null}

      <section className="panel">
        <h2>Conversations</h2>
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
            {conversations.map((conversation) => (
              <tr
                key={conversation.id}
                onClick={() => void loadConversationMessages(conversation.id)}
                style={{ cursor: "pointer" }}
                title="View conversation"
              >
                <td>{conversation.clientName ?? conversation.clientId}</td>
                <td>{conversation.status}</td>
                <td>{conversation.sentiment}</td>
                <td>{new Date(conversation.lastMessageAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedConversationId ? (
          <div style={{ marginTop: "1rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
            <h3>
              Conversation with {selectedConversation?.clientName ?? selectedConversation?.clientId ?? "—"}
              <button
                type="button"
                onClick={() => setSelectedConversationId(null)}
                style={{ marginLeft: "0.5rem", fontSize: "0.9rem" }}
              >
                Close
              </button>
            </h3>
            {selectedConversation?.status === "handed_off" ? (
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="agent-reply">Reply as agent (customer will see on next refresh)</label>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <textarea
                    id="agent-reply"
                    value={agentReplyContent}
                    onChange={(e) => setAgentReplyContent(e.target.value)}
                    placeholder="Type your reply..."
                    rows={2}
                    style={{ flex: 1, padding: "0.5rem" }}
                  />
                  <button
                    type="button"
                    disabled={agentReplySending || !agentReplyContent.trim()}
                    onClick={async () => {
                      if (!token || !selectedConversationId || !agentReplyContent.trim()) return;
                      setAgentReplySending(true);
                      try {
                        await fetchJson(`/internal/v1/conversations/${selectedConversationId}/agent-messages`, token, {
                          method: "POST",
                          body: JSON.stringify({ content: agentReplyContent.trim() })
                        });
                        setAgentReplyContent("");
                        await loadConversationMessages(selectedConversationId);
                        void load();
                      } finally {
                        setAgentReplySending(false);
                      }
                    }}
                  >
                    {agentReplySending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            ) : selectedConversationId ? (
              <button
                type="button"
                onClick={async () => {
                  if (!token || !selectedConversationId) return;
                  await fetchJson(`/internal/v1/conversations/${selectedConversationId}/take-over`, token, { method: "POST" });
                  void load();
                  await loadConversationMessages(selectedConversationId);
                }}
                style={{ marginBottom: "0.5rem" }}
              >
                Take over conversation
              </button>
            ) : null}
            {messagesLoading ? (
              <p>Loading…</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {conversationMessages.map((msg) => (
                  <li
                    key={msg.id}
                    style={{
                      marginBottom: "0.75rem",
                      padding: "0.5rem",
                      background: msg.role === "ai" ? "#f0f4ff" : "#e8f4ea",
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
                          ? ` · KB: ${(msg.kbArticleIds ?? [])
                              .map((id) => documents.find((d) => d.id === id)?.title ?? id)
                              .join(", ")}`
                          : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {canManageKbSection ? (
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Knowledge gaps</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          AI messages with low confidence in conversations that led to a ticket.
        </p>
        <button type="button" onClick={() => void loadKnowledgeGaps()} disabled={knowledgeGapsLoading} style={{ marginBottom: "0.5rem" }}>
          {knowledgeGapsLoading ? "Loading…" : "Refresh"}
        </button>
        {knowledgeGaps.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Conversation</th>
                <th>Message preview</th>
                <th>Confidence</th>
                <th>KB articles</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {knowledgeGaps.slice(0, 50).map((row) => (
                <tr key={row.messageId}>
                  <td style={{ fontSize: "0.85em" }}>{row.conversationId}</td>
                  <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{row.contentPreview}{row.contentPreview.length >= 200 ? "…" : ""}</td>
                  <td>{row.confidence != null ? `${(row.confidence * 100).toFixed(0)}%` : "—"}</td>
                  <td style={{ fontSize: "0.85em" }}>{row.kbArticleIds.length ? row.kbArticleIds.map((id) => documents.find((d) => d.id === id)?.title ?? id).join(", ") : "—"}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !knowledgeGapsLoading ? (
          <p style={{ fontSize: "0.9rem", color: "#666" }}>No low-confidence messages in escalated conversations. Click Refresh.</p>
        ) : null}
      </section>
      ) : null}

      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Tickets</h2>
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
              <tr key={ticket.id}>
                <td>{ticket.referenceNumber}</td>
                <td>{ticket.title}</td>
                <td>
                  <span className={`badge ${ticket.severity}`}>{ticket.severity}</span>
                </td>
                <td>{ticket.status}</td>
                <td style={{ fontSize: "0.9rem" }}>{slaLabel}</td>
                <td>
                  <select
                    value={ticket.assignedTo ?? ""}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      void updateTicket(ticket, { assignedTo: value as string | null });
                    }}
                    aria-label="Assign to"
                  >
                    <option value="">Unassigned</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="controls">
                    <button
                      type="button"
                      onClick={() => selectTicket(selectedTicketId === ticket.id ? null : ticket.id)}
                      style={{ marginRight: "0.5rem" }}
                    >
                      {selectedTicketId === ticket.id ? "Hide comments" : "Comments"}
                    </button>
                    {statusOptions.map((status) => (
                      <button key={`${ticket.id}-status-${status}`} onClick={() => void updateTicket(ticket, { status })}>
                        {status}
                      </button>
                    ))}
                    {severityOptions.map((severity) => (
                      <button
                        key={`${ticket.id}-severity-${severity}`}
                        onClick={() => void updateTicket(ticket, { severity })}
                      >
                        {severity}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
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
                  SLA: {new Date(selectedTicket.slaDueAt).getTime() < Date.now() ? "Overdue" : `${Math.round((new Date(selectedTicket.slaDueAt).getTime() - Date.now()) / (60 * 60 * 1000))}h left`}
                </span>
              ) : null}
              <button type="button" onClick={() => selectTicket(null)} style={{ marginLeft: "0.5rem", fontSize: "0.9rem" }}>
                Close
              </button>
            </h3>
            <h4>Conversation transcript</h4>
            {ticketTranscriptLoading ? (
              <p>Loading transcript…</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem", maxHeight: "200px", overflowY: "auto" }}>
                {ticketTranscript.map((msg, i) => (
                  <li key={i} style={{ padding: "0.25rem 0", borderBottom: "1px solid #eee", fontSize: "0.9rem" }}>
                    <strong>{msg.role}:</strong> {msg.content.slice(0, 120)}{msg.content.length > 120 ? "…" : ""}
                    <span style={{ display: "block", fontSize: "0.8em", color: "#666" }}>{new Date(msg.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <h4>Internal comments</h4>
            {ticketCommentsLoading ? (
              <p>Loading comments…</p>
            ) : (
              <>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem" }}>
                  {ticketComments.map((c) => (
                    <li key={c.id} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
                      <strong>{teamUsers.find((u) => u.id === c.userId)?.name ?? c.userId}:</strong> {c.content}
                      <span style={{ display: "block", fontSize: "0.85em", color: "#666" }}>
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <textarea
                    value={ticketCommentContent}
                    onChange={(e) => setTicketCommentContent(e.target.value)}
                    placeholder="Add internal comment (hidden from client)"
                    rows={2}
                    style={{ flex: 1, padding: "0.5rem" }}
                    aria-label="Comment"
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <select
                      aria-label="Insert canned response"
                      style={{ padding: "0.35rem", fontSize: "0.9rem" }}
                      value=""
                      onChange={(e) => {
                        const id = e.target.value;
                        e.target.value = "";
                        if (!id) return;
                        const cr = cannedResponses.find((c) => c.id === id);
                        if (cr) setTicketCommentContent((prev) => (prev ? `${prev}\n\n${cr.content}` : cr.content));
                      }}
                    >
                      <option value="">Insert canned…</option>
                      {cannedResponses.map((cr) => (
                        <option key={cr.id} value={cr.id}>{cr.title}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void addTicketComment()}
                      disabled={ticketCommentSubmitting || !ticketCommentContent.trim()}
                    >
                      {ticketCommentSubmitting ? "Sending…" : "Add comment"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>

      {canViewWebhooks ? (
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Webhooks (admin)</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Configure a URL and subscribe to events. Payloads are signed with HMAC (X-Webhook-Signature: sha256=...).
        </p>
        <div style={{ marginBottom: "1rem" }}>
          <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook" style={{ marginRight: "0.5rem", padding: "0.5rem", minWidth: "280px" }} />
          <input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="Secret" style={{ marginRight: "0.5rem", padding: "0.5rem" }} />
          <button
            type="button"
            onClick={async () => {
              if (!token || !webhookUrl.trim() || !webhookSecret.trim()) return;
              try {
                await fetchJson("/internal/v1/webhook-configs", token, {
                  method: "POST",
                  body: JSON.stringify({ url: webhookUrl.trim(), secret: webhookSecret.trim(), events: webhookEventsList })
                });
                setWebhookUrl("");
                setWebhookSecret("");
                void loadWebhooks();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to add webhook");
              }
            }}
          >
            Add webhook
          </button>
        </div>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {webhookConfigs.map((c) => (
            <li key={c.id} style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{c.url}</span>
              <span style={{ fontSize: "0.85em", color: "#666" }}>{c.events.join(", ")}</span>
              <button type="button" onClick={async () => { if (token) { await fetchJson(`/internal/v1/webhook-configs/${c.id}`, token, { method: "DELETE" }); void loadWebhooks(); } }}>Delete</button>
            </li>
          ))}
        </ul>
        <h4>Event log</h4>
        <table className="table">
          <thead>
            <tr><th>Event</th><th>Status</th><th>Error</th><th>Time</th></tr>
          </thead>
          <tbody>
            {webhookEvents.map((e) => (
              <tr key={e.id}>
                <td>{e.event}</td>
                <td>{e.status}</td>
                <td style={{ fontSize: "0.85em" }}>{e.lastError ?? "—"}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      ) : null}

      {canViewAuditLog ? (
      <section className="panel" style={{ gridColumn: "1 / -1" }}>
        <h2>Audit log</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          Who did what, when. Filter by resource type or action.
        </p>
        <div className="controls" style={{ marginBottom: "1rem" }}>
          <label htmlFor="auditResourceFilter">Resource type</label>
          <select
            id="auditResourceFilter"
            value={auditLogResourceFilter}
            onChange={(e) => setAuditLogResourceFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="ticket">ticket</option>
            <option value="ticket_comment">ticket_comment</option>
            <option value="company_document">company_document</option>
            <option value="session">session</option>
            <option value="user">user</option>
          </select>
          <label htmlFor="auditActionFilter">Action</label>
          <select
            id="auditActionFilter"
            value={auditLogActionFilter}
            onChange={(e) => setAuditLogActionFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="ticket.created.from_ai">ticket.created.from_ai</option>
            <option value="ticket.updated">ticket.updated</option>
            <option value="ticket.comment.created">ticket.comment.created</option>
            <option value="company_document.created">company_document.created</option>
            <option value="user.logged_in">user.logged_in</option>
          </select>
          <button type="button" onClick={() => void loadAuditLogs()} disabled={auditLogsLoading}>
            {auditLogsLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {auditLogsLoading ? (
          <p>Loading audit log…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Resource</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
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
        {!auditLogsLoading && auditLogs.length === 0 ? (
          <p style={{ fontSize: "0.9rem", color: "#666" }}>No audit entries match the filters.</p>
        ) : null}
      </section>
      ) : null}
    </div>
  );
};
