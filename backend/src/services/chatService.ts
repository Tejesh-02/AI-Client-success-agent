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
  aiMessageId: string;
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

  await conversationService.addMessage(input.companyId, input.conversationId, "client", input.content);

  const sentiment = sentimentFromContent(input.content);
  await conversationService.setSentiment(input.companyId, input.conversationId, sentiment);

  const docs = await context.companyDocumentService.listByCompany(input.companyId);
  const companyContext =
    docs.length > 0
      ? docs.map((d) => `## ${d.title}\n${d.content}`).join("\n\n")
      : undefined;

  const aiReply = await context.llmClient.generateReply(input.content, companyContext);
  const lowConfidenceDisclaimer =
    aiReply.confidence < 0.5
      ? "\n\n_I'm not fully confident in this answer. If you need more help, a team member can follow up._"
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
  const ruleOverrides = await context.escalationRuleService.evaluate(input.companyId, {
    messageContent: input.content,
    sentiment,
    confidence: aiReply.confidence
  });
  const finalSeverity = ruleOverrides.severity ?? escalation.severity;
  let ticket: Ticket | null = null;

  if (escalation.shouldCreateTicket) {
    ticket = await ticketService.create({
      companyId: input.companyId,
      conversationId: input.conversationId,
      clientId: input.clientId,
      title: titleFromUserMessage(input.content),
      description: input.content,
      severity: finalSeverity,
      assignedTo: ruleOverrides.assigneeId ?? null
    });

    await conversationService.setPrioritySnapshot(input.companyId, input.conversationId, finalSeverity);

    const company = await tenantService.findById(input.companyId);
    if (company) {
      await emailService.notifyTicket(ticket, company);
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
    aiMessageId: aiMessage.id,
    aiResponse: contentToStore,
    confidence: aiReply.confidence,
    ticket
  };
};
