import { Router } from "express";
import { z } from "zod";
import { ticketSeverities } from "@clientpulse/types";
import type { ServiceContext } from "../../../services/context";
import type { EscalationTriggerType } from "../../../types/models";

const triggerTypes: EscalationTriggerType[] = ["keyword", "plan_type", "frequency", "sentiment", "churn"];

const createSchema = z.object({
  name: z.string().min(1).max(120),
  triggerType: z.enum(triggerTypes as unknown as [EscalationTriggerType, ...EscalationTriggerType[]]),
  triggerConfig: z.record(z.unknown()).optional(),
  importanceOverride: z.enum([...ticketSeverities] as [string, ...string[]]).nullable().optional(),
  actionConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  triggerType: z.enum(triggerTypes as unknown as [EscalationTriggerType, ...EscalationTriggerType[]]).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  importanceOverride: z.enum([...ticketSeverities] as [string, ...string[]]).nullable().optional(),
  actionConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional()
});

export const createInternalEscalationRulesRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/escalation-rules", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const items = await context.escalationRuleService.listByCompany(req.internalAuth.companyId);
      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  router.post("/escalation-rules", async (req, res, next) => {
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

      const importanceOverride = (parsed.data.importanceOverride ?? null) as import("@clientpulse/types").TicketSeverity | null;
      const rule = await context.escalationRuleService.create(req.internalAuth.companyId, {
        ...parsed.data,
        importanceOverride
      });

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "escalation_rule.created",
        resourceType: "escalation_rule",
        resourceId: rule.id,
        metadata: { name: rule.name, triggerType: rule.triggerType }
      });

      res.status(201).json(rule);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/escalation-rules/:id", async (req, res, next) => {
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

      const existing = await context.escalationRuleService.findById(req.internalAuth.companyId, req.params.id);
      if (!existing) {
        res.status(404).json({ error: "Escalation rule not found" });
        return;
      }

      const importanceOverride = parsed.data.importanceOverride !== undefined
        ? (parsed.data.importanceOverride as import("@clientpulse/types").TicketSeverity | null)
        : undefined;
      const updated = await context.escalationRuleService.update(req.internalAuth.companyId, req.params.id, {
        ...parsed.data,
        importanceOverride
      });

      if (!updated) {
        res.status(404).json({ error: "Escalation rule not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "escalation_rule.updated",
        resourceType: "escalation_rule",
        resourceId: updated.id,
        metadata: parsed.data
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/escalation-rules/:id", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const deleted = await context.escalationRuleService.delete(req.internalAuth.companyId, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "Escalation rule not found" });
        return;
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "escalation_rule.deleted",
        resourceType: "escalation_rule",
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
