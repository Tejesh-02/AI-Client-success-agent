import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";
import { requireRoles } from "../../../middleware/rbac";

const createConfigSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(1).max(500),
  events: z.array(z.string()).min(1)
});

const updateConfigSchema = z.object({
  url: z.string().url().optional(),
  secret: z.string().min(1).max(500).optional(),
  events: z.array(z.string()).min(1).optional(),
  enabled: z.boolean().optional()
});

export const createInternalWebhooksRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/webhook-configs", requireRoles(["admin"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const configs = await context.webhookService.listConfigs(req.internalAuth.companyId);
      res.json({ items: configs.map((c) => ({ id: c.id, url: c.url, events: c.events, enabled: c.enabled, createdAt: c.createdAt })), total: configs.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/webhook-configs", requireRoles(["admin"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const parsed = createConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }
      const config = await context.webhookService.createConfig(req.internalAuth.companyId, parsed.data);
      res.status(201).json({ id: config.id, url: config.url, events: config.events, enabled: config.enabled, createdAt: config.createdAt });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/webhook-configs/:id", requireRoles(["admin"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const parsed = updateConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }
      const updated = await context.webhookService.updateConfig(req.internalAuth.companyId, req.params.id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: "Config not found" });
        return;
      }
      res.json({ id: updated.id, url: updated.url, events: updated.events, enabled: updated.enabled, updatedAt: updated.updatedAt });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/webhook-configs/:id", requireRoles(["admin"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const deleted = await context.webhookService.deleteConfig(req.internalAuth.companyId, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Config not found" });
        return;
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/webhook-events", requireRoles(["admin"]), async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const configId = req.query.configId as string | undefined;
      const limit = Math.min(parseInt((req.query.limit as string) || "100", 10) || 100, 200);
      const items = await context.webhookService.listEvents(req.internalAuth.companyId, configId, limit);
      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
