export const ticketSeverities = [
  "low",
  "moderate",
  "important",
  "critical",
  "emergency"
] as const;

export type TicketSeverity = (typeof ticketSeverities)[number];

export const ticketStatuses = [
  "open",
  "in_progress",
  "awaiting_client",
  "resolved",
  "closed"
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export interface PublicSessionRequest {
  name: string;
  email: string;
}

export interface PublicSessionResponse {
  sessionToken: string;
  clientId: string;
  conversationId: string;
  companyDisplayName: string;
}

export interface PublicChatMessageRequest {
  sessionToken: string;
  content: string;
}

export interface InternalLoginRequest {
  companySlug: string;
  email: string;
  password: string;
}

export interface InternalLoginResponse {
  token: string;
  user: {
    id: string;
    companyId: string;
    email: string;
    name: string;
    role: "admin" | "manager" | "agent";
  };
}

export interface InternalTicketUpdateRequest {
  status?: TicketStatus;
  severity?: TicketSeverity;
  assignedTo?: string | null;
}

export interface ConversationSummary {
  id: string;
  companyId: string;
  clientId: string;
  /** Customer display name when available */
  clientName?: string;
  status: "active" | "resolved" | "handed_off";
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  channel: "hosted_chat";
  lastMessageAt: string;
}

export interface TicketSummary {
  id: string;
  companyId: string;
  conversationId: string;
  clientId: string;
  issueTypeId?: string | null;
  title: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assignedTo: string | null;
  referenceNumber: string;
  createdAt: string;
  updatedAt?: string;
  slaDueAt?: string | null;
}

export interface CompanyDocumentSummary {
  id: string;
  companyId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricDelta {
  current: number;
  previous: number;
  changePct: number;
  direction: "up" | "down" | "flat";
}

export interface DashboardAttentionItem {
  conversationId: string;
  clientId: string;
  clientName?: string;
  status: ConversationSummary["status"];
  sentiment: ConversationSummary["sentiment"];
  priority: TicketSeverity | null;
  hasTicket: boolean;
  ticketId?: string;
  lastMessageAt: string;
}

export interface DashboardSlaRisk {
  overdue: number;
  dueWithin4h: number;
  dueWithin24h: number;
}

export interface IssueTypeDistributionItem {
  issueTypeId: string | null;
  label: string;
  count: number;
  share: number;
}

export interface DashboardOverviewMetrics {
  from: string;
  to: string;
  severityFilter: TicketSeverity | null;
  conversations: MetricDelta;
  ticketsRaised: MetricDelta;
  ticketsResolved: MetricDelta;
  aiResolutionRate: MetricDelta;
  emergencyOpen: number;
  attentionQueue: DashboardAttentionItem[];
  slaRisk: DashboardSlaRisk;
  issueTypeDistribution: IssueTypeDistributionItem[];
}

export interface ConversationContext {
  conversationId: string;
  companyId: string;
  client: {
    id: string;
    name: string;
    email: string;
  };
  relatedTickets: TicketSummary[];
  ai: {
    averageConfidence: number | null;
    lowConfidenceCount: number;
    kbArticleIds: string[];
  };
  lastActivityAt: string;
}

export interface TicketBulkUpdateRequest {
  ticketIds: string[];
  status?: TicketStatus;
  severity?: TicketSeverity;
  assignedTo?: string | null;
}

export interface KnowledgeGapCluster {
  id: string;
  topic: string;
  count: number;
  avgConfidence: number | null;
  highestSeverity: TicketSeverity;
  sampleConversationId: string;
  sampleMessagePreview: string;
  latestAt: string;
  status: "new" | "drafted" | "published" | "ignored";
}

export interface WebhookHealthSummary {
  configId: string;
  url: string;
  enabled: boolean;
  deliveries: number;
  failed: number;
  failureRate: number;
  lastEventAt: string | null;
  lastStatus: "ok" | "degraded" | "down" | "idle";
}

export interface AuditDiff {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  changedKeys: string[];
}
