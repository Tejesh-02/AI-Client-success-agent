import type { InternalAuthContext, CustomerSession } from "./models";

declare global {
  namespace Express {
    interface Request {
      internalAuth?: InternalAuthContext;
      customerSession?: CustomerSession;
    }
  }
}

export {};
