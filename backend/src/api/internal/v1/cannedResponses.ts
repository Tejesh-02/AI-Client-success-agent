import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";
import { requireRoles } from "../../../middleware/rbac";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  issueTypeId: z.string().nullable().optional()
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
  issueTypeId: z.string().nullable().optional()
});

export const createInternalCannedResponsesRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/canned-responses", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const issueTypeId = req.query.issueTypeId as string | undefined;
      const items = await context.cannedResponseService.listByCompany(
        req.internalAuth.companyId,
        issueTypeId === "" ? null : issueTypeId
      );
      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/canned-responses", requireRoles(["admin", "manager"]), async (req, res, next) => {
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

      const cr = await context.cannedResponseService.create(
        req.internalAuth.companyId,
        req.internalAuth.userId,
        parsed.data
      );

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "canned_response.created",
        resourceType: "canned_response",
        resourceId: cr.id,
        metadata: { title: cr.title }
      });

      res.status(201).json(cr);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/canned-responses/:id", requireRoles(["admin", "manager"]), async (req, res, next) => {
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

      const updated = await context.cannedResponseService.update(
        req.internalAuth.companyId,
        req.params.id,
        parsed.data
      );

      if (!updated) {
        res.status(404).json({ error: "Canned response not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "canned_response.updated",
        resourceType: "canned_response",
        resourceId: updated.id,
        metadata: parsed.data
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/canned-responses/:id", requireRoles(["admin", "manager"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const deleted = await context.cannedResponseService.delete(req.internalAuth.companyId, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Canned response not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "canned_response.deleted",
        resourceType: "canned_response",
        resourceId: req.params.id,
        metadata: {}
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
};
