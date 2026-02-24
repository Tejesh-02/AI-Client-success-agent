import { Router } from "express";
import { z } from "zod";
import { ticketSeverities, ticketStatuses } from "@clientpulse/types";
import type { ServiceContext } from "../../../services/context";

const ticketFilterSchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  severity: z.enum(ticketSeverities).optional(),
  assignedTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const ticketUpdateSchema = z.object({
  status: z.enum(ticketStatuses).optional(),
  severity: z.enum(ticketSeverities).optional(),
  assignedTo: z.string().nullable().optional()
});

const ticketBulkUpdateSchema = z
  .object({
    ticketIds: z.array(z.string().min(1)).min(1).max(200),
    status: z.enum(ticketStatuses).optional(),
    severity: z.enum(ticketSeverities).optional(),
    assignedTo: z.string().nullable().optional()
  })
  .refine(
    (value) =>
      value.status !== undefined || value.severity !== undefined || value.assignedTo !== undefined,
    { message: "At least one update field is required" }
  );

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  mentionedUserIds: z.array(z.string()).default([])
});

export const createInternalTicketsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/tickets", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = ticketFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid ticket filters", details: parsed.error.flatten() });
        return;
      }

      const { limit, offset, ...filters } = parsed.data;
      const allItems = await context.ticketService.list(
        req.internalAuth.companyId,
        req.internalAuth.role,
        req.internalAuth.userId,
        filters
      );

      const total = allItems.length;
      const items = allItems.slice(offset, offset + limit);
      res.json({ items, total, limit, offset });
    } catch (error) {
      next(error);
    }
  });

  router.post("/tickets/bulk", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = ticketBulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid bulk update payload", details: parsed.error.flatten() });
        return;
      }

      const patch = {
        status: parsed.data.status,
        severity: parsed.data.severity,
        assignedTo: parsed.data.assignedTo
      };

      const updated: Awaited<ReturnType<typeof context.ticketService.update>>[] = [];
      const skipped: { ticketId: string; reason: string }[] = [];
      const company = await context.tenantService.findById(req.internalAuth.companyId);

      for (const ticketId of parsed.data.ticketIds) {
        const existing = await context.ticketService.findById(req.internalAuth.companyId, ticketId);
        if (!existing) {
          skipped.push({ ticketId, reason: "not_found" });
          continue;
        }

        if (req.internalAuth.role === "agent" && existing.assignedTo !== req.internalAuth.userId) {
          skipped.push({ ticketId, reason: "forbidden" });
          continue;
        }

        const previousState = {
          status: existing.status,
          severity: existing.severity,
          assignedTo: existing.assignedTo
        };
        const next = await context.ticketService.update(req.internalAuth.companyId, existing.id, patch);
        if (!next) {
          skipped.push({ ticketId, reason: "not_found" });
          continue;
        }

        updated.push(next);
        const issueType = next.issueTypeId
          ? await context.issueTypeService.findById(req.internalAuth.companyId, next.issueTypeId)
          : null;
        if (company) {
          await context.emailService.notifyTicketUpdated(next, company, issueType ?? undefined);
        }

        await context.auditService.record({
          companyId: req.internalAuth.companyId,
          actorType: "internal_user",
          actorId: req.internalAuth.userId,
          action: "ticket.updated",
          resourceType: "ticket",
          resourceId: next.id,
          metadata: {
            ...patch,
            bulk: true,
            before: previousState,
            after: {
              status: next.status,
              severity: next.severity,
              assignedTo: next.assignedTo
            }
          }
        });

        await context.webhookService.dispatch(req.internalAuth.companyId, "ticket.updated", {
          ticketId: next.id,
          referenceNumber: next.referenceNumber,
          status: next.status,
          severity: next.severity,
          assignedTo: next.assignedTo
        });
      }

      res.json({ updated, skipped, totalRequested: parsed.data.ticketIds.length });
    } catch (error) {
      next(error);
    }
  });

  router.get("/tickets/:ticketId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const ticket = await context.ticketService.findById(req.internalAuth.companyId, req.params.ticketId);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      if (req.internalAuth.role === "agent" && ticket.assignedTo !== req.internalAuth.userId) {
        res.status(403).json({ error: "Agents can only view assigned tickets" });
        return;
      }

      res.json(ticket);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/tickets/:ticketId", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = ticketUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid ticket update payload", details: parsed.error.flatten() });
        return;
      }

      const existing = await context.ticketService.findById(req.internalAuth.companyId, req.params.ticketId);
      if (!existing) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      if (req.internalAuth.role === "agent" && existing.assignedTo !== req.internalAuth.userId) {
        res.status(403).json({ error: "Agents can only update assigned tickets" });
        return;
      }

      const previousState = {
        status: existing.status,
        severity: existing.severity,
        assignedTo: existing.assignedTo
      };
      const updated = await context.ticketService.update(req.internalAuth.companyId, existing.id, parsed.data);
      if (!updated) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const company = await context.tenantService.findById(req.internalAuth.companyId);
      if (company) {
        const issueType = updated.issueTypeId
          ? await context.issueTypeService.findById(req.internalAuth.companyId, updated.issueTypeId)
          : null;
        await context.emailService.notifyTicketUpdated(updated, company, issueType ?? undefined);
      }

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "ticket.updated",
        resourceType: "ticket",
        resourceId: updated.id,
        metadata: {
          ...parsed.data,
          before: previousState,
          after: {
            status: updated.status,
            severity: updated.severity,
            assignedTo: updated.assignedTo
          }
        }
      });

      await context.webhookService.dispatch(req.internalAuth.companyId, "ticket.updated", {
        ticketId: updated.id,
        referenceNumber: updated.referenceNumber,
        status: updated.status,
        severity: updated.severity,
        assignedTo: updated.assignedTo
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.post("/tickets/:ticketId/comments", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = commentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid comment payload", details: parsed.error.flatten() });
        return;
      }

      const ticket = await context.ticketService.findById(req.internalAuth.companyId, req.params.ticketId);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      if (req.internalAuth.role === "agent" && ticket.assignedTo !== req.internalAuth.userId) {
        res.status(403).json({ error: "Agents can only comment on assigned tickets" });
        return;
      }

      const comment = await context.ticketService.addComment(
        ticket.id,
        req.internalAuth.userId,
        parsed.data.content,
        parsed.data.mentionedUserIds
      );

      await context.auditService.record({
        companyId: req.internalAuth.companyId,
        actorType: "internal_user",
        actorId: req.internalAuth.userId,
        action: "ticket.comment.created",
        resourceType: "ticket_comment",
        resourceId: comment.id,
        metadata: {
          ticketId: ticket.id,
          mentionedUserIds: parsed.data.mentionedUserIds
        }
      });

      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  });

  router.get("/tickets/:ticketId/comments", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const ticket = await context.ticketService.findById(req.internalAuth.companyId, req.params.ticketId);
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      if (req.internalAuth.role === "agent" && ticket.assignedTo !== req.internalAuth.userId) {
        res.status(403).json({ error: "Agents can only view comments on assigned tickets" });
        return;
      }

      const comments = await context.ticketService.listComments(req.internalAuth.companyId, ticket.id);
      res.json({ items: comments, total: comments.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
