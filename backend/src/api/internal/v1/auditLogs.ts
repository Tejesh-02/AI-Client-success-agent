import { Router } from "express";
import { z } from "zod";
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
