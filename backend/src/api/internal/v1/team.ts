import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { ServiceContext } from "../../../services/context";

export const createInternalTeamRouter = (context: ServiceContext): Router => {
  const router = Router();

  router.get("/team", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.internalAuth) {
        res.status(401).json({ error: "Missing internal auth context" });
        return;
      }

      const users = await context.internalAuthService.listByCompany(req.internalAuth.companyId);
      res.json({ items: users, total: users.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
};
