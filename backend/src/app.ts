import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import rateLimit from "express-rate-limit";
import type { InMemoryStore } from "./store/inMemoryStore";
import { createServiceContext } from "./services/context";
import { getSupabaseAdminClient } from "./db/supabaseClient";
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

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:5173"];

const isProduction = process.env.NODE_ENV === "production";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 15 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" }
});

export const createApp = (store?: InMemoryStore) => {
  const app = express();
  const context = createServiceContext(store);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true
    })
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", async (_req, res) => {
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        const { error } = await supabase.from("companies").select("id").limit(1);
        if (error) {
          res.status(503).json({ ok: false, database: "error", detail: "Query failed" });
          return;
        }
      }
      res.json({ ok: true, database: supabase ? "connected" : "in-memory" });
    } catch {
      res.status(503).json({ ok: false, database: "unreachable" });
    }
  });

  app.use("/public/v1", publicLimiter, createPublicSessionsRouter(context));
  app.use("/public/v1", publicLimiter, createPublicConversationsRouter(context));

  app.use("/internal/v1/auth", authLimiter);
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
