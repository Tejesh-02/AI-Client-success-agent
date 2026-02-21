import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";
import { processCustomerMessage } from "../../../services/chatService";

const messageSchema = z.object({
  sessionToken: z.string().min(1),
  content: z.string().min(1).max(5000)
});

const transcriptQuerySchema = z.object({
  sessionToken: z.string().min(1)
});

const feedbackSchema = z.object({
  sessionToken: z.string().min(1),
  rating: z.enum(["up", "down"]),
  comment: z.string().max(2000).optional()
});

export const createPublicConversationsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.post("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid message payload", details: parsed.error.flatten() });
        return;
      }

      const session = await context.sessionService.verifyToken(parsed.data.sessionToken);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session token" });
        return;
      }

      const conversation = await context.conversationService.findById(session.companyId, req.params.conversationId);
      if (!conversation || conversation.clientId !== session.clientId) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const result = await processCustomerMessage(context, {
        companyId: session.companyId,
        conversationId: conversation.id,
        clientId: session.clientId,
        content: parsed.data.content,
        sessionId: session.id
      });

      res.status(201).json({
        messageId: result.aiMessageId,
        aiResponse: result.aiResponse,
        confidence: result.confidence,
        ticket: result.ticket
          ? {
              id: result.ticket.id,
              referenceNumber: result.ticket.referenceNumber,
              title: result.ticket.title,
              severity: result.ticket.severity
            }
          : null
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:conversationId/messages", async (req, res, next) => {
    try {
      const parsed = transcriptQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "sessionToken query parameter is required" });
        return;
      }

      const session = await context.sessionService.verifyToken(parsed.data.sessionToken);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session token" });
        return;
      }

      const conversation = await context.conversationService.findById(session.companyId, req.params.conversationId);
      if (!conversation || conversation.clientId !== session.clientId) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      const messages = await context.conversationService.listMessages(session.companyId, conversation.id);
      res.json({ items: messages, total: messages.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations/:conversationId/feedback", async (req, res, next) => {
    try {
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid feedback payload", details: parsed.error.flatten() });
        return;
      }

      const session = await context.sessionService.verifyToken(parsed.data.sessionToken);
      if (!session) {
        res.status(401).json({ error: "Invalid or expired session token" });
        return;
      }

      const conversation = await context.conversationService.findById(session.companyId, req.params.conversationId);
      if (!conversation || conversation.clientId !== session.clientId) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      await context.conversationFeedbackService.submit(
        session.companyId,
        conversation.id,
        parsed.data.rating,
        parsed.data.comment
      );

      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
