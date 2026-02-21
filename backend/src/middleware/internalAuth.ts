import type { NextFunction, Request, Response } from "express";
import type { ServiceContext } from "../services/context";
import { verifyInternalAccessToken } from "../utils/internalToken";

export const internalAuthMiddleware = (context: ServiceContext) => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authorization = req.header("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = authorization.replace("Bearer ", "").trim();
    if (!token) {
      res.status(401).json({ error: "Invalid bearer token" });
      return;
    }

    const payload = verifyInternalAccessToken(token);
    const user = await context.internalAuthService.findById(payload.companyId, payload.sub);

    if (!user) {
      res.status(403).json({ error: "Internal user is not authorized" });
      return;
    }

    req.internalAuth = {
      companyId: user.companyId,
      userId: user.id,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(401).json({ error: "Unauthorized" });
  }
};
