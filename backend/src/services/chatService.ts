import type { Ticket } from "../types/models";
import { classifySeverity } from "./severity";
import { sentimentFromContent } from "./sentiment";
import type { ServiceContext } from "./context";

const GENERIC_OPENERS = /^(hi|hello|hey|help|support|hi there|hello there)\s*[!.]?$/i;
const MAX_TITLE_LEN = 80;

function titleFromUserMessage(content: string): string {
  const trimmed = (content || "").trim();
  if (!trimmed) return "Support request";
  const firstLine = trimmed.split(/\n/)[0].trim();
  const candidate = firstLine.slice(0, MAX_TITLE_LEN).trim();
  if (candidate.length < 4) return "Support request";
  if (GENERIC_OPENERS.test(candidate)) return "Support request";
  return candidate;
}

export interface ChatProcessResult {
  clientMessageId: string;
  clientMessageCreatedAt: string;
  aiMessageId: string;
  aiResponseCreatedAt: string;
  aiResponse: string;
  confidence: number;
  ticket: Ticket | null;
}

export const processCustomerMessage = async (
  context: ServiceContext,
  input: {
    companyId: string;
    conversationId: string;
    clientId: string;
    content: string;
    sessionId: string;
  }
): Promise<ChatProcessResult> => {
  const { conversationService, llmClient, ticketService, tenantService, emailService, auditService } = context;

  const clientMessage = await conversationService.addMessage(input.companyId, input.conversationId, "client", input.content);

  const sentiment = sentimentFromContent(input.content);
  await conversationService.setSentiment(input.companyId, input.conversationId, sentiment);

  const docs = await context.companyDocumentService.listByCompany(input.companyId);
  const companyContext =
    docs.length > 0
      ? docs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")
      : undefined;

  const allMessages = await context.conversationService.listMessages(input.companyId, input.conversationId);
  const previousMessages = allMessages.slice(0, -1);
  const conversationHistory = previousMessages.map((m) => ({
    role: (m.role === "client" ? "user" : "assistant") as "user" | "assistant",
    content: m.content
  }));

  const aiReply = await context.llmClient.generateReply(input.content, companyContext, conversationHistory);
  const lowConfidenceDisclaimer =
    aiReply.confidence < 0.5
      ? "\n\nI want to make sure you get the right answer — a team member can double-check and follow up if you'd like."
      : "";
  const contentToStore = aiReply.content + lowConfidenceDisclaimer;
  const aiMessage = await conversationService.addMessage(input.companyId, input.conversationId, "ai", contentToStore, {
    confidenceScore: aiReply.confidence,
    modelProvider: aiReply.provider,
    modelName: aiReply.model,
    tokenUsage: aiReply.tokenUsage,
    latencyMs: aiReply.latencyMs
  });

  const escalation = classifySeverity(input.content, aiReply.confidence);

  // Count existing tickets for this client to support frequency-based escalation rules
  const existingTickets = await context.ticketService.listByClient(input.companyId, input.clientId);
  const ruleOverrides = await context.escalationRuleService.evaluate(input.companyId, {
    messageContent: input.content,
    sentiment,
    confidence: aiReply.confidence,
    clientTicketCount: existingTickets.length
  });
  const finalSeverity = ruleOverrides.severity ?? escalation.severity;
  let ticket: Ticket | null = null;

  if (escalation.shouldCreateTicket) {
    // Classify message into an issue type so routing/SLA can use the correct config
    const activeIssueTypes = (await context.issueTypeService.listByCompany(input.companyId))
      .filter((it) => it.enabled);

    let issueTypeId: string | null = null;
    let slaDueAt: string | null = null;

    if (activeIssueTypes.length > 0) {
      const classification = await llmClient.classifyIssueType(
        input.content,
        activeIssueTypes.map((it) => ({ code: it.code, label: it.label }))
      );
      const matchedType = activeIssueTypes.find((it) => it.code === classification.issueTypeCode);
      if (matchedType) {
        issueTypeId = matchedType.id;
        slaDueAt = new Date(Date.now() + matchedType.slaHours * 60 * 60 * 1000).toISOString();
      }
    }

    ticket = await ticketService.create({
      companyId: input.companyId,
      conversationId: input.conversationId,
      clientId: input.clientId,
      issueTypeId,
      title: titleFromUserMessage(input.content),
      description: input.content,
      severity: finalSeverity,
      assignedTo: ruleOverrides.assigneeId ?? null,
      slaDueAt
    });

    await conversationService.setPrioritySnapshot(input.companyId, input.conversationId, finalSeverity);

    const company = await tenantService.findById(input.companyId);
    if (company) {
      const issueType = issueTypeId
        ? activeIssueTypes.find((it) => it.id === issueTypeId) ?? null
        : null;
      await emailService.notifyTicket(ticket, company, issueType, ruleOverrides);
    }

    await auditService.record({
      companyId: input.companyId,
      actorType: "customer_session",
      actorId: input.sessionId,
      action: "ticket.created.from_ai",
      resourceType: "ticket",
      resourceId: ticket.id,
      metadata: {
        severity: ticket.severity,
        issueTypeId: ticket.issueTypeId,
        reason: escalation.reason
      }
    });

    await context.webhookService.dispatch(input.companyId, "ticket.created", {
      ticketId: ticket.id,
      conversationId: ticket.conversationId,
      clientId: ticket.clientId,
      severity: ticket.severity,
      referenceNumber: ticket.referenceNumber,
      title: ticket.title
    });
  }

  await auditService.record({
    companyId: input.companyId,
    actorType: "customer_session",
    actorId: input.sessionId,
    action: "conversation.message.processed",
    resourceType: "conversation",
    resourceId: input.conversationId,
    metadata: {
      confidence: aiReply.confidence,
      escalated: escalation.shouldCreateTicket
    }
  });

  return {
    clientMessageId: clientMessage.id,
    clientMessageCreatedAt: clientMessage.createdAt,
    aiMessageId: aiMessage.id,
    aiResponseCreatedAt: aiMessage.createdAt,
    aiResponse: contentToStore,
    confidence: aiReply.confidence,
    ticket
  };
};
