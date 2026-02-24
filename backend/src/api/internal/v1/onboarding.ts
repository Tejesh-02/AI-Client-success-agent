import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { ServiceContext } from "../../../services/context";

const patchSchema = z.object({
  completeStep: z.enum(["profile", "knowledge_base", "routing", "team_invite", "test_chat"]).optional(),
  goLive: z.boolean().optional()
});

export const createInternalOnboardingRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/onboarding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const progress = await context.tenantService.getOnboardingProgress(req.internalAuth.companyId);
      res.json(progress);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/onboarding", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }
      if (parsed.data.completeStep) {
        await context.tenantService.completeOnboardingStep(req.internalAuth.companyId, parsed.data.completeStep);
      }
      if (parsed.data.goLive) {
        const result = await context.tenantService.setGoLive(req.internalAuth.companyId);
        if (!result.ok) {
          res.status(400).json({ error: result.error });
          return;
        }
      }
      const progress = await context.tenantService.getOnboardingProgress(req.internalAuth.companyId);
      res.json(progress);
    } catch (error) {
      next(error);
    }
  });

  return router;
};
