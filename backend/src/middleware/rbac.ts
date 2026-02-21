import type { NextFunction, Request, Response } from "express";
import type { Role } from "../types/models";

/**
 * Restricts access to routes by role. Call after internalAuthMiddleware.
 * Admin-only: webhooks config.
 * Admin + Manager: routing, escalation, KB, canned responses, audit log, analytics (full).
 * All (including Agent): conversations, tickets (with agent filter), team.
 */
export const requireRoles = (allowed: Role[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.internalAuth) {
    res.status(401).json({ error: "Missing internal auth context" });
    return;
  }

  if (!allowed.includes(req.internalAuth.role)) {
    res.status(403).json({ error: "Insufficient permissions for this action" });
    return;
  }

  next();
};
