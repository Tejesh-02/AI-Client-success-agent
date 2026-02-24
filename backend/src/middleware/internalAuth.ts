import type { NextFunction, Request, Response } from "express";
import type { ServiceContext } from "../services/context";
import { verifyInternalAccessToken } from "../utils/internalToken";

export const internalAuthMiddleware = (context: ServiceContext) => async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.cp_access_token;
    const authHeader = req.header("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() : null;

    const token = cookieToken ?? bearerToken;
    if (!token) {
      res.status(401).json({ error: "Authentication required" });
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
