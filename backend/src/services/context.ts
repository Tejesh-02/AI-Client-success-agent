import type { SupabaseClient } from "@supabase/supabase-js";
import { createSeedStore, type InMemoryStore } from "../store/inMemoryStore";
import { getSupabaseAdminClient } from "../db/supabaseClient";
import { ClientService } from "./clientService";
import { ConversationService } from "./conversationService";
import { EmailService } from "./emailService";
import { LlmClient } from "./ai/llmClient";
import { SessionService } from "./sessionService";
import { TenantService } from "./tenantService";
import { TicketService } from "./ticketService";
import { AuditService } from "./auditService";
import { InternalAuthService } from "./internalAuthService";
import { CompanyDocumentService } from "./companyDocumentService";
import { IssueTypeService } from "./issueTypeService";
import { EscalationRuleService } from "./escalationRuleService";
import { CannedResponseService } from "./cannedResponseService";
import { WebhookService } from "./webhookService";
import { ConversationFeedbackService } from "./conversationFeedbackService";

export interface ServiceContext {
  store: InMemoryStore;
  supabase: SupabaseClient | null;
  tenantService: TenantService;
  clientService: ClientService;
  sessionService: SessionService;
  conversationService: ConversationService;
  ticketService: TicketService;
  emailService: EmailService;
  auditService: AuditService;
  internalAuthService: InternalAuthService;
  companyDocumentService: CompanyDocumentService;
  issueTypeService: IssueTypeService;
  escalationRuleService: EscalationRuleService;
  cannedResponseService: CannedResponseService;
  webhookService: WebhookService;
  conversationFeedbackService: ConversationFeedbackService;
  llmClient: LlmClient;
}

export const createServiceContext = (store: InMemoryStore = createSeedStore()): ServiceContext => {
  const supabase = getSupabaseAdminClient();

  return {
    store,
    supabase,
    tenantService: new TenantService(store, supabase),
    clientService: new ClientService(store, supabase),
    sessionService: new SessionService(store, supabase),
    conversationService: new ConversationService(store, supabase),
    ticketService: new TicketService(store, supabase),
    emailService: new EmailService(store, supabase),
    auditService: new AuditService(store, supabase),
    internalAuthService: new InternalAuthService(store, supabase),
    companyDocumentService: new CompanyDocumentService(store, supabase),
    issueTypeService: new IssueTypeService(store, supabase),
    escalationRuleService: new EscalationRuleService(store, supabase),
    cannedResponseService: new CannedResponseService(store, supabase),
    webhookService: new WebhookService(store, supabase),
    conversationFeedbackService: new ConversationFeedbackService(store, supabase),
    llmClient: new LlmClient()
  };
};
