import cors from "cors";
import express from "express";
import type { InMemoryStore } from "./store/inMemoryStore";
import { createServiceContext } from "./services/context";
import { errorHandler } from "./middleware/errorHandler";
import { internalAuthMiddleware } from "./middleware/internalAuth";
import { requireRoles } from "./middleware/rbac";
import { createPublicSessionsRouter } from "./api/public/v1/sessions";
import { createPublicConversationsRouter } from "./api/public/v1/conversations";
import { createInternalConversationsRouter } from "./api/internal/v1/conversations";
import { createInternalTicketsRouter } from "./api/internal/v1/tickets";
import { createInternalAuthRouter } from "./api/internal/v1/auth";
import { createInternalDocumentsRouter } from "./api/internal/v1/documents";
import { createInternalTeamRouter } from "./api/internal/v1/team";
import { createInternalAuditLogsRouter } from "./api/internal/v1/auditLogs";
import { createInternalIssueTypesRouter } from "./api/internal/v1/issueTypes";
import { createInternalEscalationRulesRouter } from "./api/internal/v1/escalationRules";
import { createInternalCannedResponsesRouter } from "./api/internal/v1/cannedResponses";
import { createInternalAnalyticsRouter } from "./api/internal/v1/analytics";
import { createInternalWebhooksRouter } from "./api/internal/v1/webhooks";
import { createInternalOnboardingRouter } from "./api/internal/v1/onboarding";

export const createApp = (store?: InMemoryStore) => {
  const app = express();
  const context = createServiceContext(store);

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/public/v1", createPublicSessionsRouter(context));
  app.use("/public/v1", createPublicConversationsRouter(context));

  app.use("/internal/v1", createInternalAuthRouter(context));
  app.use("/internal/v1", internalAuthMiddleware(context));
  app.use("/internal/v1", createInternalConversationsRouter(context));
  app.use("/internal/v1", createInternalTicketsRouter(context));
  app.use("/internal/v1", requireRoles(["admin", "manager"]), createInternalDocumentsRouter(context));
  app.use("/internal/v1", createInternalTeamRouter(context));
  app.use("/internal/v1", requireRoles(["admin", "manager"]), createInternalAuditLogsRouter(context));
  app.use("/internal/v1", requireRoles(["admin", "manager"]), createInternalIssueTypesRouter(context));
  app.use("/internal/v1", requireRoles(["admin", "manager"]), createInternalEscalationRulesRouter(context));
  app.use("/internal/v1", createInternalCannedResponsesRouter(context));
  app.use("/internal/v1", requireRoles(["admin", "manager"]), createInternalAnalyticsRouter(context));
  app.use("/internal/v1", createInternalWebhooksRouter(context));
  app.use("/internal/v1", createInternalOnboardingRouter(context));

  app.use(errorHandler);

  return { app, context };
};
