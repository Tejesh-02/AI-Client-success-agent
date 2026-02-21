import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId, sha256 } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { CustomerSession } from "../types/models";

interface CustomerSessionRow {
  id: string;
  company_id: string;
  client_id: string;
  token_hash: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

const mapRowToSession = (row: CustomerSessionRow): CustomerSession => ({
  id: row.id,
  companyId: row.company_id,
  clientId: row.client_id,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  ip: row.ip,
  userAgent: row.user_agent,
  createdAt: row.created_at
});

export class SessionService {
  private readonly ttlHours: number;

  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {
    this.ttlHours = Number(process.env.SESSION_TTL_HOURS ?? "24");
  }

  async create(
    companyId: string,
    clientId: string,
    ip: string | null,
    userAgent: string | null
  ): Promise<{ session: CustomerSession; token: string }> {
    const token = randomUUID();
    const createdAt = new Date();
    const session: CustomerSession = {
      id: makeId("session"),
      companyId,
      clientId,
      tokenHash: sha256(token),
      expiresAt: new Date(createdAt.getTime() + this.ttlHours * 60 * 60 * 1000).toISOString(),
      ip,
      userAgent,
      createdAt: createdAt.toISOString()
    };

    if (this.supabase) {
      const payload = {
        id: session.id,
        company_id: session.companyId,
        client_id: session.clientId,
        token_hash: session.tokenHash,
        expires_at: session.expiresAt,
        ip: session.ip,
        user_agent: session.userAgent,
        created_at: session.createdAt
      };

      const { error } = await this.supabase.from("customer_sessions").insert(payload);
      if (error) {
        throw new Error(`Failed to create customer session: ${error.message}`);
      }

      return { session, token };
    }

    this.store.customerSessions.push(session);
    return { session, token };
  }

  async verifyToken(token: string): Promise<CustomerSession | null> {
    const hashed = sha256(token);

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("customer_sessions")
        .select("id, company_id, client_id, token_hash, expires_at, ip, user_agent, created_at")
        .eq("token_hash", hashed)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to verify customer session: ${error.message}`);
      }

      return data ? mapRowToSession(data as CustomerSessionRow) : null;
    }

    const session = this.store.customerSessions.find((item) => item.tokenHash === hashed);

    if (!session) {
      return null;
    }

    const expired = new Date(session.expiresAt).getTime() <= Date.now();
    if (expired) {
      return null;
    }

    return session;
  }
}
