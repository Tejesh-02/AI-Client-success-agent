import jwt from "jsonwebtoken";
import type { Role } from "../types/models";

export interface InternalAccessTokenPayload {
  sub: string;
  companyId: string;
  role: Role;
  email: string;
}

const getSecret = (): string => {
  return process.env.JWT_SECRET ?? "local-dev-jwt-secret";
};

export const issueInternalAccessToken = (payload: InternalAccessTokenPayload): string =>
  jwt.sign(payload, getSecret(), {
    expiresIn: (process.env.JWT_ACCESS_TTL ?? "12h") as jwt.SignOptions["expiresIn"],
    issuer: "clientpulse"
  });

export const verifyInternalAccessToken = (token: string): InternalAccessTokenPayload => {
  const decoded = jwt.verify(token, getSecret(), {
    issuer: "clientpulse"
  });

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }

  const casted = decoded as Partial<InternalAccessTokenPayload>;
  if (!casted.sub || !casted.companyId || !casted.role || !casted.email) {
    throw new Error("Missing token claims");
  }

  if (!["admin", "manager", "agent"].includes(casted.role)) {
    throw new Error("Invalid token role");
  }

  return casted as InternalAccessTokenPayload;
};
