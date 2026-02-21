import { Router } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";
import { issueInternalAccessToken } from "../../../utils/internalToken";

const roleSchema = z.enum(["admin", "manager", "agent"]);

const registerSchema = z.object({
  companySlug: z.string().min(1),
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: roleSchema.default("agent")
});

const loginSchema = z.object({
  companySlug: z.string().min(1),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128)
});

export const createInternalAuthRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.post("/auth/register", async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid registration payload", details: parsed.error.flatten() });
        return;
      }

      const company = await context.tenantService.findBySlug(parsed.data.companySlug);
      if (!company) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      const user = await context.internalAuthService.register({
        companyId: company.id,
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        role: parsed.data.role
      });

      await context.auditService.record({
        companyId: company.id,
        actorType: "system",
        actorId: "system",
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        metadata: {
          role: user.role,
          email: user.email
        }
      });

      res.status(201).json({
        user: {
          id: user.id,
          companyId: user.companyId,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid login payload", details: parsed.error.flatten() });
        return;
      }

      const company = await context.tenantService.findBySlug(parsed.data.companySlug);
      if (!company) {
        res.status(404).json({ error: "Company not found" });
        return;
      }

      const user = await context.internalAuthService.login({
        companyId: company.id,
        email: parsed.data.email,
        password: parsed.data.password
      });

      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = issueInternalAccessToken({
        sub: user.id,
        companyId: user.companyId,
        role: user.role,
        email: user.email
      });

      await context.auditService.record({
        companyId: user.companyId,
        actorType: "internal_user",
        actorId: user.id,
        action: "user.logged_in",
        resourceType: "session",
        resourceId: user.id,
        metadata: {
          email: user.email,
          role: user.role
        }
      });

      res.json({
        token,
        user: {
          id: user.id,
          companyId: user.companyId,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
