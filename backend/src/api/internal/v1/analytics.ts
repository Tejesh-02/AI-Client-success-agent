import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const knowledgeGapsQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional()
});

export const createInternalAnalyticsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/analytics/summary", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const companyId = req.internalAuth.companyId;
      const role = req.internalAuth.role;
      const userId = req.internalAuth.userId;

      const [conversations, tickets] = await Promise.all([
        context.conversationService.listConversations(companyId, role, userId, {}),
        context.ticketService.list(companyId, role, userId, {})
      ]);

      const conversationIdsWithTickets = new Set(tickets.map((t) => t.conversationId));
      const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
      const aiResolvedConversations = conversations.filter((c) => !conversationIdsWithTickets.has(c.id)).length;
      const aiResolutionRate = conversations.length > 0 ? (aiResolvedConversations / conversations.length) * 100 : 0;

      res.json({
        conversationsCount: conversations.length,
        ticketsRaised: tickets.length,
        ticketsResolved: resolvedCount,
        aiResolutionRate: Math.round(aiResolutionRate * 10) / 10
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics/knowledge-gaps", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = knowledgeGapsQuerySchema.safeParse(req.query);
      const threshold = parsed.success && parsed.data.threshold != null ? parsed.data.threshold : 0.5;

      const companyId = req.internalAuth.companyId;
      const tickets = await context.ticketService.list(companyId, req.internalAuth.role, req.internalAuth.userId, {});
      const conversationIds = [...new Set(tickets.map((t) => t.conversationId))];

      const items: {
        conversationId: string;
        messageId: string;
        contentPreview: string;
        confidence: number | null;
        kbArticleIds: string[];
        createdAt: string;
      }[] = [];

      for (const cid of conversationIds) {
        const messages = await context.conversationService.listMessages(companyId, cid);
        for (const m of messages) {
          if (m.role !== "ai") continue;
          const conf = m.confidenceScore ?? null;
          if (conf !== null && conf >= threshold) continue;
          items.push({
            conversationId: cid,
            messageId: m.id,
            contentPreview: m.content.slice(0, 200),
            confidence: conf,
            kbArticleIds: m.kbArticleIds ?? [],
            createdAt: m.createdAt
          });
        }
      }

      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
