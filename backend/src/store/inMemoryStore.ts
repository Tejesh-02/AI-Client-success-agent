import { randomUUID, createHash } from "node:crypto";
import type {
  AuditLog,
  CannedResponse,
  Client,
  Company,
  CompanyDocument,
  Conversation,
  CustomerSession,
  EscalationRule,
  InternalUser,
  IssueType,
  Message,
  Ticket,
  TicketComment,
  TicketNotification,
  WebhookConfig,
  WebhookEvent
} from "../types/models";

export interface ConversationFeedbackRecord {
  id: string;
  companyId: string;
  conversationId: string;
  rating: "up" | "down";
  comment: string | null;
  createdAt: string;
}

export interface InMemoryStore {
  companies: Company[];
  internalUsers: InternalUser[];
  clients: Client[];
  customerSessions: CustomerSession[];
  conversations: Conversation[];
  messages: Message[];
  tickets: Ticket[];
  ticketComments: TicketComment[];
  ticketNotifications: TicketNotification[];
  auditLogs: AuditLog[];
  companyDocuments: CompanyDocument[];
  issueTypes: IssueType[];
  escalationRules: EscalationRule[];
  cannedResponses: CannedResponse[];
  webhookConfigs: WebhookConfig[];
  webhookEvents: WebhookEvent[];
  conversationFeedback: ConversationFeedbackRecord[];
}

const now = () => new Date().toISOString();

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

export const createSeedStore = (): InMemoryStore => {
  const companyId = "company_acme";
  const managerId = "user_manager_1";
  const agentId = "user_agent_1";
  const clientId = "client_1";
  const conversationId = "conversation_1";
  const started = now();

  return {
    companies: [
      {
        id: companyId,
        name: "Acme Corp",
        slug: "acme",
        supportEmail: "support@acme.test",
        emergencyEmail: "emergency@acme.test",
        notificationCc: ["manager@acme.test"],
        isProfileComplete: true
      }
    ],
    internalUsers: [
      {
        id: managerId,
        companyId,
        email: "manager@acme.test",
        name: "Acme Manager",
        role: "manager",
        passwordHash: "$2b$10$iCTrIuRSR7ir.nwfQ3yDs.c93Yszg7S.ezmqPRGXSif8ir7W.vIMy",
        isActive: true
      },
      {
        id: agentId,
        companyId,
        email: "agent@acme.test",
        name: "Acme Agent",
        role: "agent",
        passwordHash: "$2b$10$iCTrIuRSR7ir.nwfQ3yDs.c93Yszg7S.ezmqPRGXSif8ir7W.vIMy",
        isActive: true
      }
    ],
    clients: [
      {
        id: clientId,
        companyId,
        name: "Alice Client",
        email: "alice@example.com",
        createdAt: started
      }
    ],
    customerSessions: [
      {
        id: "session_seed_1",
        companyId,
        clientId,
        tokenHash: hashToken("seed-token"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ip: "127.0.0.1",
        userAgent: "seed",
        createdAt: started
      }
    ],
    conversations: [
      {
        id: conversationId,
        companyId,
        clientId,
        status: "active",
        sentiment: "neutral",
        channel: "hosted_chat",
        startedAt: started,
        lastMessageAt: started,
        endedAt: null,
        agentId,
        prioritySnapshot: null
      }
    ],
    messages: [
      {
        id: "message_seed_1",
        companyId,
        conversationId,
        role: "client",
        content: "Need help with onboarding",
        confidenceScore: null,
        kbArticleIds: [],
        modelProvider: null,
        modelName: null,
        tokenUsage: null,
        latencyMs: null,
        createdAt: started
      }
    ],
    tickets: [
      {
        id: "ticket_seed_1",
        companyId,
        conversationId,
        clientId,
        issueTypeId: null,
        title: "Onboarding assistance",
        description: "Customer needs onboarding help",
        status: "open",
        severity: "moderate",
        assignedTo: agentId,
        referenceNumber: "CP-1001",
        createdAt: started,
        updatedAt: started,
        slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    ticketComments: [],
    ticketNotifications: [],
    auditLogs: [],
    companyDocuments: [],
    issueTypes: [],
    escalationRules: [],
    cannedResponses: [],
    webhookConfigs: [],
    webhookEvents: [],
    conversationFeedback: []
  };
};

export const makeId = (prefix: string): string => `${prefix}_${randomUUID().replace(/-/g, "")}`;

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
