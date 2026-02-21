import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const createSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  primaryEmail: z.string().email().nullable().optional(),
  ccEmails: z.array(z.string().email()).optional(),
  slaHours: z.number().min(0).max(8760).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const updateSchema = z.object({
  code: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(120).optional(),
  primaryEmail: z.string().email().nullable().optional(),
  ccEmails: z.array(z.string().email()).optional(),
  slaHours: z.number().min(0).max(8760).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

export const createInternalIssueTypesRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/issue-types", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      let items = await context.issueTypeService.listByCompany(req.internalAuth.companyId);
      if (items.length === 0) {
        items = await context.issueTypeService.ensureDefaults(req.internalAuth.companyId);
      }
      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/issue-types", async (req, res, next) => {
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

      const issueType = await context.issueTypeService.create(req.internalAuth.companyId, parsed.data);
      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "issue_type.created",
        resourceType: "issue_type",
        resourceId: issueType.id,
        metadata: { code: issueType.code, label: issueType.label }
      });

      res.status(201).json(issueType);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/issue-types/:id", async (req, res, next) => {
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

      const existing = await context.issueTypeService.findById(req.internalAuth.companyId, req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Issue type not found" });
        return;
      }

      const payload: Record<string, unknown> = {};
      if (parsed.data.code !== undefined) payload.code = parsed.data.code;
      if (parsed.data.label !== undefined) payload.label = parsed.data.label;
      if (parsed.data.primaryEmail !== undefined) payload.primaryEmail = parsed.data.primaryEmail;
      if (parsed.data.ccEmails !== undefined) payload.ccEmails = parsed.data.ccEmails;
      if (parsed.data.slaHours !== undefined) payload.slaHours = parsed.data.slaHours;
      if (parsed.data.enabled !== undefined) payload.enabled = parsed.data.enabled;
      if (parsed.data.sortOrder !== undefined) payload.sortOrder = parsed.data.sortOrder;

      const updated = await context.issueTypeService.update(req.internalAuth.companyId, req.params.id, payload);
      if (!updated) {
        res.status(404).json({ error: "Issue type not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "issue_type.updated",
        resourceType: "issue_type",
        resourceId: updated.id,
        metadata: payload
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/issue-types/:id", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const deleted = await context.issueTypeService.delete(req.internalAuth.companyId, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Issue type not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "issue_type.deleted",
        resourceType: "issue_type",
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
