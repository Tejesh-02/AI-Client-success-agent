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
  title: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assignedTo: string | null;
  referenceNumber: string;
  createdAt: string;
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
