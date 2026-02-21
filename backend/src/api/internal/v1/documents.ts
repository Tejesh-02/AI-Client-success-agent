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
