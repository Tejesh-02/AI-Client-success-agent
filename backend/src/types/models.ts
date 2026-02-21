import type { TicketSeverity, TicketStatus } from "@clientpulse/types";

export type Role = "admin" | "manager" | "agent";

export interface Company {
  id: string;
  name: string;
  slug: string;
  supportEmail: string;
  emergencyEmail: string;
  notificationCc: string[];
  isProfileComplete: boolean;
  onboardingStepsDone?: string[];
}

export interface InternalUser {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CustomerSession {
  id: string;
  companyId: string;
  clientId: string;
  tokenHash: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export type ConversationStatus = "active" | "resolved" | "handed_off";
export type ConversationSentiment = "positive" | "neutral" | "negative" | "frustrated";

export interface Conversation {
  id: string;
  companyId: string;
  clientId: string;
  status: ConversationStatus;
  sentiment: ConversationSentiment;
  channel: "hosted_chat";
  startedAt: string;
  lastMessageAt: string;
  endedAt: string | null;
  agentId: string | null;
  prioritySnapshot: TicketSeverity | null;
}

export type MessageRole = "ai" | "client" | "agent";

export interface Message {
  id: string;
  companyId: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  confidenceScore: number | null;
  kbArticleIds: string[];
  modelProvider: string | null;
  modelName: string | null;
  tokenUsage: number | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  companyId: string;
  conversationId: string;
  clientId: string;
  title: string;
  description: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assignedTo: string | null;
  referenceNumber: string;
  createdAt: string;
  updatedAt: string;
  slaDueAt: string | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  mentionedUserIds: string[];
  createdAt: string;
}

export type NotificationEvent = "ticket_created" | "ticket_updated" | "ticket_emergency";

export interface TicketNotification {
  id: string;
  ticketId: string;
  companyId: string;
  event: NotificationEvent;
  to: string;
  cc: string[];
  status: "pending" | "sent" | "failed";
  attempts: number;
  error: string | null;
  createdAt: string;
  lastAttemptedAt: string | null;
}

export type AuditActorType = "internal_user" | "customer_session" | "system";

export interface AuditLog {
  id: string;
  companyId: string;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InternalAuthContext {
  companyId: string;
  userId: string;
  role: Role;
}

export interface CompanyDocument {
  id: string;
  companyId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueType {
  id: string;
  companyId: string;
  code: string;
  label: string;
  primaryEmail: string | null;
  ccEmails: string[];
  slaHours: number;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type EscalationTriggerType = "keyword" | "plan_type" | "frequency" | "sentiment" | "churn";

export interface EscalationRule {
  id: string;
  companyId: string;
  name: string;
  triggerType: EscalationTriggerType;
  triggerConfig: Record<string, unknown>;
  importanceOverride: TicketSeverity | null;
  actionConfig: Record<string, unknown>;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CannedResponse {
  id: string;
  companyId: string;
  issueTypeId: string | null;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookConfig {
  id: string;
  companyId: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  configId: string;
  event: string;
  payload: Record<string, unknown>;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
}
