import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ err: error, method: req.method, path: req.path }, `Unhandled error: ${message}`);
  res.status(500).json({ error: "An internal server error occurred" });
};
