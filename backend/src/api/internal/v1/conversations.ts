import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const conversationFilterSchema = z.object({
  status: z.enum(["active", "resolved", "handed_off"]).optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "frustrated"]).optional(),
  clientId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const agentMessageSchema = z.object({
  content: z.string().min(1).max(5000)
});

export const createInternalConversationsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/conversations", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = conversationFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid conversation filters", details: parsed.error.flatten() });
        return;
      }

      const { limit, offset, ...filters } = parsed.data;
      const items = await context.conversationService.listConversations(
        req.internalAuth.companyId,
        req.internalAuth.role,
        req.internalAuth.userId,
        filters
      );

      const clientIds = [...new Set(items.map((c) => c.clientId))];
      const clientsMap = await context.clientService.getMany(req.internalAuth.companyId, clientIds);
      const enriched = items.map((item) => ({
        ...item,
        clientName: clientsMap.get(item.clientId)?.name
      }));

      // One row per client: keep only the latest conversation per client (by lastMessageAt)
      const byClient = new Map<string, (typeof enriched)[0]>();
      for (const item of enriched) {
        const existing = byClient.get(item.clientId);
        if (!existing || new Date(item.lastMessageAt) > new Date(existing.lastMessageAt)) {
          byClient.set(item.clientId, item);
        }
      }
      const allDeduped = [...byClient.values()].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );

      const total = allDeduped.length;
      const deduped = allDeduped.slice(offset, offset + limit);
      res.json({ items: deduped, total, limit, offset });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:conversationId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const { conversationId } = req.params;
      const companyId = req.internalAuth.companyId;

      const conversation = await context.conversationService.findById(companyId, conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const client = await context.clientService.findById(companyId, conversation.clientId);
      res.json({ ...conversation, clientName: client?.name });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const { conversationId } = req.params;
      const companyId = req.internalAuth.companyId;

      const conversation = await context.conversationService.findById(companyId, conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const messages = await context.conversationService.listMessages(companyId, conversationId);
      res.json({
        items: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          confidenceScore: m.confidenceScore ?? undefined,
          kbArticleIds: m.kbArticleIds?.length ? m.kbArticleIds : undefined
        })),
        total: messages.length
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations/:conversationId/take-over", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const { conversationId } = req.params;
      const companyId = req.internalAuth.companyId;
      const agentId = req.internalAuth.userId;

      const conversation = await context.conversationService.findById(companyId, conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      await context.conversationService.setHandedOff(companyId, conversationId, agentId);

      res.json({ ok: true, status: "handed_off", agentId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations/:conversationId/agent-messages", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = agentMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }

      const { conversationId } = req.params;
      const companyId = req.internalAuth.companyId;
      const agentId = req.internalAuth.userId;

      const conversation = await context.conversationService.findById(companyId, conversationId);
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      await context.conversationService.setHandedOff(companyId, conversationId, agentId);

      let message;
      try {
        message = await context.conversationService.addMessage(
          companyId,
          conversationId,
          "agent",
          parsed.data.content
        );
      } catch (msgError) {
        console.error(`[agent-messages] addMessage failed after setHandedOff for ${conversationId}:`, msgError);
        throw msgError;
      }

      res.status(201).json({ messageId: message.id, content: message.content });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
