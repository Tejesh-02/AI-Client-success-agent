import { Router } from "express";
import { z } from "zod";
import type { ConversationContext } from "@clientpulse/types";
import type { ServiceContext } from "../../../services/context";

const conversationFilterSchema = z.object({
  status: z.enum(["active", "resolved", "handed_off"]).optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "frustrated"]).optional(),
  clientId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["lastMessageAt", "status", "sentiment"]).default("lastMessageAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  cursor: z.string().optional(),
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

      const { limit, offset, cursor, search, sortBy, sortDir, ...filters } = parsed.data;
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
      let allDeduped = [...byClient.values()];
      if (search?.trim()) {
        const term = search.trim().toLowerCase();
        allDeduped = allDeduped.filter((item) => {
          const clientName = clientsMap.get(item.clientId)?.name?.toLowerCase() ?? "";
          return clientName.includes(term) || item.clientId.toLowerCase().includes(term);
        });
      }

      const compare = (a: (typeof allDeduped)[0], b: (typeof allDeduped)[0]) => {
        if (sortBy === "status") {
          return a.status.localeCompare(b.status);
        }
        if (sortBy === "sentiment") {
          return a.sentiment.localeCompare(b.sentiment);
        }
        return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      };

      allDeduped.sort((a, b) => (sortDir === "asc" ? compare(a, b) : compare(b, a)));

      const total = allDeduped.length;
      const cursorOffset = cursor ? Math.max(parseInt(cursor, 10) || 0, 0) : offset;
      const deduped = allDeduped.slice(cursorOffset, cursorOffset + limit);
      const nextOffset = cursorOffset + deduped.length;
      const nextCursor = nextOffset < total ? String(nextOffset) : null;

      res.json({
        items: deduped,
        total,
        limit,
        offset: cursorOffset,
        cursor: cursorOffset,
        nextCursor
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/stream", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendSnapshot = async () => {
        const [conversations, tickets] = await Promise.all([
          context.conversationService.listConversations(req.internalAuth!.companyId, req.internalAuth!.role, req.internalAuth!.userId, {}),
          context.ticketService.list(req.internalAuth!.companyId, req.internalAuth!.role, req.internalAuth!.userId, {})
        ]);
        const payload = JSON.stringify({
          ts: new Date().toISOString(),
          conversations: conversations.length,
          openTickets: tickets.filter((item) => item.status !== "closed").length,
          atRiskTickets: tickets.filter((item) => item.slaDueAt && new Date(item.slaDueAt).getTime() < Date.now() + 4 * 60 * 60 * 1000).length
        });
        res.write(`event: snapshot\n`);
        res.write(`data: ${payload}\n\n`);
      };

      const heartbeat = setInterval(() => {
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      const interval = setInterval(() => {
        void sendSnapshot();
      }, 10000);

      void sendSnapshot();

      req.on("close", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        res.end();
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:conversationId/context", async (req, res, next) => {
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

      const [client, messages, tickets] = await Promise.all([
        context.clientService.findById(companyId, conversation.clientId),
        context.conversationService.listMessages(companyId, conversationId),
        context.ticketService.list(companyId, req.internalAuth.role, req.internalAuth.userId, {})
      ]);

      const relatedTickets = tickets.filter((ticket) => ticket.conversationId === conversationId);
      const aiMessages = messages.filter((item) => item.role === "ai");
      const withConfidence = aiMessages.filter((item) => item.confidenceScore != null);
      const avgConfidence = withConfidence.length > 0
        ? withConfidence.reduce((acc, item) => acc + (item.confidenceScore ?? 0), 0) / withConfidence.length
        : null;
      const lowConfidenceCount = withConfidence.filter((item) => (item.confidenceScore ?? 1) < 0.55).length;
      const kbArticleIds = [...new Set(aiMessages.flatMap((item) => item.kbArticleIds ?? []))];

      const payload: ConversationContext = {
        conversationId: conversation.id,
        companyId,
        client: {
          id: conversation.clientId,
          name: client?.name ?? conversation.clientId,
          email: client?.email ?? ""
        },
        relatedTickets,
        ai: {
          averageConfidence: avgConfidence != null ? Number(avgConfidence.toFixed(3)) : null,
          lowConfidenceCount,
          kbArticleIds
        },
        lastActivityAt: conversation.lastMessageAt
      };

      res.json(payload);
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
