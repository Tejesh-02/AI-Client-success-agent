import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Client } from "../types/models";

interface ClientRow {
  id: string;
  company_id: string;
  name: string;
  email: string;
  created_at: string;
}

const mapRowToClient = (row: ClientRow): Client => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  email: row.email,
  createdAt: row.created_at
});

export class ClientService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async findOrCreate(companyId: string, name: string, email: string): Promise<Client> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (this.supabase) {
      const { data: existing } = await this.supabase
        .from("clients")
        .select("id, company_id, name, email, created_at")
        .eq("company_id", companyId)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        const row = existing as ClientRow;
        if (row.name !== normalizedName) {
          await this.supabase
            .from("clients")
            .update({ name: normalizedName })
            .eq("id", row.id);
        }
        return mapRowToClient(row);
      }

      const payload = {
        id: makeId("client"),
        company_id: companyId,
        name: normalizedName,
        email: normalizedEmail
      };

      const { data: inserted, error } = await this.supabase
        .from("clients")
        .insert(payload)
        .select("id, company_id, name, email, created_at")
        .single();

      if (error) {
        throw new Error(`Failed to create or update client: ${error.message}`);
      }

      return mapRowToClient(inserted as ClientRow);
    }

    const existing = this.store.clients.find(
      (client) => client.companyId === companyId && client.email.toLowerCase() === normalizedEmail
    );

    if (existing) {
      if (existing.name !== normalizedName) {
        existing.name = normalizedName;
      }
      return existing;
    }

    const created: Client = {
      id: makeId("client"),
      companyId,
      name: normalizedName,
      email: normalizedEmail,
      createdAt: new Date().toISOString()
    };

    this.store.clients.push(created);
    return created;
  }

  async findById(companyId: string, clientId: string): Promise<Client | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("clients")
        .select("id, company_id, name, email, created_at")
        .eq("company_id", companyId)
        .eq("id", clientId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load client: ${error.message}`);
      }

      return data ? mapRowToClient(data as ClientRow) : null;
    }

    return this.store.clients.find((client) => client.companyId === companyId && client.id === clientId) ?? null;
  }

  /** Fetch multiple clients by id for the same company. Returns a map id -> Client. */
  async getMany(companyId: string, clientIds: string[]): Promise<Map<string, Client>> {
    const unique = [...new Set(clientIds)].filter(Boolean);
    if (unique.length === 0) return new Map();

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("clients")
        .select("id, company_id, name, email, created_at")
        .eq("company_id", companyId)
        .in("id", unique);

      if (error) {
        throw new Error(`Failed to load clients: ${error.message}`);
      }

      const map = new Map<string, Client>();
      for (const row of data ?? []) {
        const client = mapRowToClient(row as ClientRow);
        map.set(client.id, client);
      }
      return map;
    }

    const map = new Map<string, Client>();
    for (const id of unique) {
      const client = this.store.clients.find((c) => c.companyId === companyId && c.id === id);
      if (client) map.set(id, client);
    }
    return map;
  }
}
