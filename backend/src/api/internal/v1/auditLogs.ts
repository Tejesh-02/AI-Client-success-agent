import { Router } from "express";
import { z } from "zod";
import type { AuditDiff } from "@clientpulse/types";
import type { ServiceContext } from "../../../services/context";

const auditLogQuerySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).optional(),
  offset: z.coerce.number().min(0).optional()
});

export const createInternalAuditLogsRouter = (context: ServiceContext): Router => {
  const router = Router();

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  router.get("/audit-logs/diff/:logId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const entry = await context.auditService.findById(req.internalAuth.companyId, req.params.logId);
      if (!entry) {
        res.status(404).json({ error: "Audit entry not found" });
        return;
      }

      const metadata = asRecord(entry.metadata) ?? {};
      const before = asRecord(metadata.before) ?? {};
      const explicitAfter = asRecord(metadata.after);
      const after = explicitAfter ?? Object.fromEntries(
        Object.entries(metadata).filter(([key]) => key !== "before" && key !== "after")
      );

      const keySet = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
      const changedKeys = [...keySet].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

      const payload: AuditDiff = {
        id: entry.id,
        actorType: entry.actorType,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        createdAt: entry.createdAt,
        before,
        after,
        changedKeys
      };

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit-logs", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = auditLogQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid audit log filters", details: parsed.error.flatten() });
        return;
      }

      const { items, total } = await context.auditService.list(req.internalAuth.companyId, parsed.data);
      res.json({ items, total });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
