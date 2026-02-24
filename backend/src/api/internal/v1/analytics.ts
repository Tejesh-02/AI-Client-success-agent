import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";
import {
  ticketSeverities,
  type DashboardOverviewMetrics,
  type MetricDelta,
  type TicketSeverity
} from "../../../../../packages/types/src/index";

const knowledgeGapsQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional()
});

const overviewQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  severity: z.enum(ticketSeverities).optional()
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toIso = (date: Date): string => new Date(date).toISOString();

const parseDateOr = (value: string | undefined, fallback: Date): Date => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
};

const buildDelta = (current: number, previous: number): MetricDelta => {
  if (previous === 0) {
    return {
      current,
      previous,
      changePct: current === 0 ? 0 : 100,
      direction: current === 0 ? "flat" : "up"
    };
  }

  const raw = ((current - previous) / previous) * 100;
  const changePct = Math.round(raw * 10) / 10;
  return {
    current,
    previous,
    changePct,
    direction: changePct > 0 ? "up" : changePct < 0 ? "down" : "flat"
  };
};

export const createInternalAnalyticsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/analytics/summary", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const companyId = req.internalAuth.companyId;
      const role = req.internalAuth.role;
      const userId = req.internalAuth.userId;

      const [conversations, tickets] = await Promise.all([
        context.conversationService.listConversations(companyId, role, userId, {}),
        context.ticketService.list(companyId, role, userId, {})
      ]);

      const conversationIdsWithTickets = new Set(tickets.map((t) => t.conversationId));
      const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
      const aiResolvedConversations = conversations.filter((c) => !conversationIdsWithTickets.has(c.id)).length;
      const aiResolutionRate = conversations.length > 0 ? (aiResolvedConversations / conversations.length) * 100 : 0;

      res.json({
        conversationsCount: conversations.length,
        ticketsRaised: tickets.length,
        ticketsResolved: resolvedCount,
        aiResolutionRate: Math.round(aiResolutionRate * 10) / 10
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics/overview", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = overviewQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid overview filters", details: parsed.error.flatten() });
        return;
      }

      const now = new Date();
      const defaultFrom = new Date(now.getTime() - 7 * MS_PER_DAY);
      const toDate = parseDateOr(parsed.data.to, now);
      const fromDate = parseDateOr(parsed.data.from, defaultFrom);
      const rangeMs = Math.max(toDate.getTime() - fromDate.getTime(), MS_PER_DAY);
      const previousFrom = new Date(fromDate.getTime() - rangeMs);
      const previousTo = new Date(fromDate);

      const companyId = req.internalAuth.companyId;
      const role = req.internalAuth.role;
      const userId = req.internalAuth.userId;
      const severityFilter = parsed.data.severity;

      const [conversations, tickets, issueTypes] = await Promise.all([
        context.conversationService.listConversations(companyId, role, userId, {}),
        context.ticketService.list(companyId, role, userId, severityFilter ? { severity: severityFilter } : {}),
        context.issueTypeService.listByCompany(companyId)
      ]);

      const inRange = (iso: string, start: Date, end: Date) => {
        const ts = new Date(iso).getTime();
        return ts >= start.getTime() && ts <= end.getTime();
      };

      const currentConversations = conversations.filter((item) => inRange(item.lastMessageAt, fromDate, toDate)).length;
      const previousConversations = conversations.filter((item) => inRange(item.lastMessageAt, previousFrom, previousTo)).length;

      const currentTicketsRaised = tickets.filter((item) => inRange(item.createdAt, fromDate, toDate)).length;
      const previousTicketsRaised = tickets.filter((item) => inRange(item.createdAt, previousFrom, previousTo)).length;

      const currentResolved = tickets.filter((item) => {
        if (item.status !== "resolved" && item.status !== "closed") return false;
        return inRange(item.updatedAt ?? item.createdAt, fromDate, toDate);
      }).length;
      const previousResolved = tickets.filter((item) => {
        if (item.status !== "resolved" && item.status !== "closed") return false;
        return inRange(item.updatedAt ?? item.createdAt, previousFrom, previousTo);
      }).length;

      const currentConversationIds = new Set(conversations
        .filter((item) => inRange(item.lastMessageAt, fromDate, toDate))
        .map((item) => item.id));
      const ticketsForCurrent = tickets.filter((ticket) => currentConversationIds.has(ticket.conversationId));
      const conversationIdsWithTicketsCurrent = new Set(ticketsForCurrent.map((ticket) => ticket.conversationId));
      const aiResolvedCurrent = currentConversationIds.size - conversationIdsWithTicketsCurrent.size;
      const currentRate = currentConversationIds.size > 0 ? (aiResolvedCurrent / currentConversationIds.size) * 100 : 0;

      const prevConversationIds = new Set(conversations
        .filter((item) => inRange(item.lastMessageAt, previousFrom, previousTo))
        .map((item) => item.id));
      const ticketsForPrevious = tickets.filter((ticket) => prevConversationIds.has(ticket.conversationId));
      const conversationIdsWithTicketsPrevious = new Set(ticketsForPrevious.map((ticket) => ticket.conversationId));
      const aiResolvedPrevious = prevConversationIds.size - conversationIdsWithTicketsPrevious.size;
      const previousRate = prevConversationIds.size > 0 ? (aiResolvedPrevious / prevConversationIds.size) * 100 : 0;

      const byConversation = new Map<string, typeof tickets>();
      for (const ticket of tickets) {
        const list = byConversation.get(ticket.conversationId) ?? [];
        list.push(ticket);
        byConversation.set(ticket.conversationId, list);
      }

      const ticketSeverityRank: Record<TicketSeverity, number> = {
        low: 0,
        moderate: 1,
        important: 2,
        critical: 3,
        emergency: 4
      };

      const attentionCandidates = conversations
        .map((conv) => {
          const linkedTickets = byConversation.get(conv.id) ?? [];
          const highestTicket = linkedTickets
            .slice()
            .sort((a, b) => ticketSeverityRank[b.severity] - ticketSeverityRank[a.severity])[0];
          const priority = highestTicket?.severity ?? null;
          const needsAttention =
            conv.status === "handed_off" ||
            conv.sentiment === "frustrated" ||
            (highestTicket?.severity != null && ticketSeverityRank[highestTicket.severity] >= ticketSeverityRank.important);
          return {
            conversationId: conv.id,
            clientId: conv.clientId,
            status: conv.status,
            sentiment: conv.sentiment,
            priority,
            hasTicket: linkedTickets.length > 0,
            ticketId: highestTicket?.id,
            lastMessageAt: conv.lastMessageAt,
            needsAttention
          };
        })
        .filter((item) => item.needsAttention)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
        .slice(0, 8);

      const clientIds = [...new Set(attentionCandidates.map((item) => item.clientId))];
      const clientsMap = await context.clientService.getMany(companyId, clientIds);

      const attentionQueue = attentionCandidates.map((item) => ({
        conversationId: item.conversationId,
        clientId: item.clientId,
        clientName: clientsMap.get(item.clientId)?.name,
        status: item.status,
        sentiment: item.sentiment,
        priority: item.priority,
        hasTicket: item.hasTicket,
        ticketId: item.ticketId,
        lastMessageAt: item.lastMessageAt
      }));

      const nowTs = Date.now();
      const slaRisk = tickets.reduce(
        (acc, ticket) => {
          if (!ticket.slaDueAt) return acc;
          const due = new Date(ticket.slaDueAt).getTime();
          const delta = due - nowTs;
          if (delta < 0) acc.overdue += 1;
          else if (delta <= 4 * 60 * 60 * 1000) acc.dueWithin4h += 1;
          else if (delta <= 24 * 60 * 60 * 1000) acc.dueWithin24h += 1;
          return acc;
        },
        { overdue: 0, dueWithin4h: 0, dueWithin24h: 0 }
      );

      const issueTypeLabelById = new Map(issueTypes.map((item) => [item.id, item.label]));
      const issueTypeMap = new Map<string, number>();
      for (const ticket of tickets) {
        const key = ticket.issueTypeId ?? "__none__";
        issueTypeMap.set(key, (issueTypeMap.get(key) ?? 0) + 1);
      }
      const issueTypeDistribution = [...issueTypeMap.entries()]
        .map(([key, count]) => ({
          issueTypeId: key === "__none__" ? null : key,
          label: key === "__none__" ? "Uncategorized" : issueTypeLabelById.get(key) ?? key,
          count,
          share: tickets.length > 0 ? Number(((count / tickets.length) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.count - a.count);

      const payload: DashboardOverviewMetrics = {
        from: toIso(fromDate),
        to: toIso(toDate),
        severityFilter: severityFilter ?? null,
        conversations: buildDelta(currentConversations, previousConversations),
        ticketsRaised: buildDelta(currentTicketsRaised, previousTicketsRaised),
        ticketsResolved: buildDelta(currentResolved, previousResolved),
        aiResolutionRate: buildDelta(Number(currentRate.toFixed(1)), Number(previousRate.toFixed(1))),
        emergencyOpen: tickets.filter((item) => item.severity === "emergency" && item.status !== "closed").length,
        attentionQueue,
        slaRisk,
        issueTypeDistribution
      };

      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/analytics/knowledge-gaps", async (req, res, next) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const parsed = knowledgeGapsQuerySchema.safeParse(req.query);
      const threshold = parsed.success && parsed.data.threshold != null ? parsed.data.threshold : 0.5;

      const companyId = req.internalAuth.companyId;
      const tickets = await context.ticketService.list(companyId, req.internalAuth.role, req.internalAuth.userId, {});
      const conversationIds = [...new Set(tickets.map((t) => t.conversationId))];

      const items: {
        conversationId: string;
        messageId: string;
        contentPreview: string;
        confidence: number | null;
        kbArticleIds: string[];
        createdAt: string;
      }[] = [];

      for (const cid of conversationIds) {
        const messages = await context.conversationService.listMessages(companyId, cid);
        for (const m of messages) {
          if (m.role !== "ai") continue;
          const conf = m.confidenceScore ?? null;
          if (conf !== null && conf >= threshold) continue;
          items.push({
            conversationId: cid,
            messageId: m.id,
            contentPreview: m.content.slice(0, 200),
            confidence: conf,
            kbArticleIds: m.kbArticleIds ?? [],
            createdAt: m.createdAt
          });
        }
      }

      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json({ items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
