import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100_000)
});

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100_000).optional()
});

const simulateSchema = z.object({
  query: z.string().min(1).max(5000),
  documentIds: z.array(z.string()).optional()
});

export const createInternalDocumentsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/documents", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const items = await context.companyDocumentService.listByCompany(req.internalAuth.companyId);
      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  router.get("/knowledge/usage", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const companyId = req.internalAuth.companyId;
      const [documents, conversations] = await Promise.all([
        context.companyDocumentService.listByCompany(companyId),
        context.conversationService.listConversations(companyId, req.internalAuth.role, req.internalAuth.userId, {})
      ]);

      const usageCounts = new Map<string, number>();
      let aiMessages = 0;
      for (const conversation of conversations) {
        const messages = await context.conversationService.listMessages(companyId, conversation.id);
        for (const message of messages) {
          if (message.role !== "ai") continue;
          aiMessages += 1;
          for (const id of message.kbArticleIds ?? []) {
            usageCounts.set(id, (usageCounts.get(id) ?? 0) + 1);
          }
        }
      }

      const items = documents
        .map((doc) => {
          const hits = usageCounts.get(doc.id) ?? 0;
          const coverage = aiMessages > 0 ? Number(((hits / aiMessages) * 100).toFixed(1)) : 0;
          return {
            documentId: doc.id,
            title: doc.title,
            hits,
            coverage,
            freshnessDays: Math.floor((Date.now() - new Date(doc.updatedAt).getTime()) / (24 * 60 * 60 * 1000))
          };
        })
        .sort((a, b) => b.hits - a.hits);

      res.json({ items, aiMessages, totalDocuments: documents.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/knowledge/simulate", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = simulateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }

      const documents = await context.companyDocumentService.listByCompany(req.internalAuth.companyId);
      const selectedSet = parsed.data.documentIds?.length ? new Set(parsed.data.documentIds) : null;
      const selectedDocs = selectedSet ? documents.filter((doc) => selectedSet.has(doc.id)) : documents.slice(0, 5);
      const topMatches = selectedDocs
        .map((doc) => {
          const content = doc.content.toLowerCase();
          const query = parsed.data.query.toLowerCase();
          const score = query
            .split(/\s+/)
            .filter(Boolean)
            .reduce((acc, token) => (content.includes(token) ? acc + 1 : acc), 0);
          return {
            id: doc.id,
            title: doc.title,
            score,
            excerpt: doc.content.slice(0, 220)
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const simulatedAnswer = topMatches.length
        ? `Based on ${topMatches.map((d) => `"${d.title}"`).join(", ")}, the likely answer is: ${topMatches[0].excerpt}`
        : "No suitable knowledge base document matched this query.";

      res.json({
        query: parsed.data.query,
        simulatedAnswer,
        references: topMatches
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/documents", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }

      const doc = await context.companyDocumentService.create(
        req.internalAuth.companyId,
        parsed.data.title,
        parsed.data.content
      );

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "company_document.created",
        resourceType: "company_document",
        resourceId: doc.id,
        metadata: { title: doc.title }
      });

      res.status(201).json(doc);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/documents/:documentId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }

      const doc = await context.companyDocumentService.update(
        req.params.documentId,
        req.internalAuth.companyId,
        parsed.data
      );

      if (!doc) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "company_document.updated",
        resourceType: "company_document",
        resourceId: doc.id,
        metadata: { title: doc.title }
      });

      res.json(doc);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/documents/:documentId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const deleted = await context.companyDocumentService.delete(
        req.internalAuth.companyId,
        req.params.documentId
      );

      if (!deleted) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "company_document.deleted",
        resourceType: "company_document",
        resourceId: req.params.documentId,
        metadata: {}
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
};
