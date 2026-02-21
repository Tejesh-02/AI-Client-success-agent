import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const sessionSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255)
});

export const createPublicSessionsRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.post("/tenants/:slug/session", async (req, res, next) => {
    try {
      const parsedBody = sessionSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({ error: "Invalid session payload", details: parsedBody.error.flatten() });
        return;
      }

      const company = await context.tenantService.findBySlug(req.params.slug);
      if (!company) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      if (!company.isProfileComplete) {
        res.status(409).json({ error: "Company onboarding is not complete" });
        return;
      }

      const client = await context.clientService.findOrCreate(company.id, parsedBody.data.name, parsedBody.data.email);
      const existingConversation = await context.conversationService.findActiveByClient(company.id, client.id);
      const conversation =
        existingConversation ?? (await context.conversationService.create(company.id, client.id));
      const session = await context.sessionService.create(
        company.id,
        client.id,
        req.ip ?? null,
        req.header("user-agent") ?? null
      );

      await context.auditService.record({
        companyId: company.id,
        actorType: "customer_session",
        actorId: session.session.id,
        action: "session.created",
        resourceType: "conversation",
        resourceId: conversation.id,
        metadata: {
          clientId: client.id
        }
      });

      res.status(201).json({
        sessionToken: session.token,
        clientId: client.id,
        conversationId: conversation.id,
        companyDisplayName: company.name
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
