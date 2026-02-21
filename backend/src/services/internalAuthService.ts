import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { InternalUser, Role } from "../types/models";
import { hashPassword, verifyPassword } from "../utils/password";

export interface RegisterInput {
  companyId: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface LoginInput {
  companyId: string;
  email: string;
  password: string;
}

interface InternalUserRow {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
}

const mapRowToUser = (row: InternalUserRow): InternalUser => ({
  id: row.id,
  companyId: row.company_id,
  email: row.email,
  name: row.name,
  role: row.role,
  passwordHash: row.password_hash,
  isActive: row.is_active
});

export class InternalAuthService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async register(input: RegisterInput): Promise<InternalUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);

    if (this.supabase) {
      const payload = {
        id: makeId("user"),
        company_id: input.companyId,
        email: normalizedEmail,
        name: input.name.trim(),
        role: input.role,
        password_hash: passwordHash,
        is_active: true
      };

      const { data, error } = await this.supabase
        .from("users")
        .insert(payload)
        .select("id, company_id, email, name, role, password_hash, is_active")
        .single();

      if (error) {
        throw new Error(`Failed to register internal user: ${error.message}`);
      }

      return mapRowToUser(data as InternalUserRow);
    }

    const existing = this.store.internalUsers.find(
      (user) => user.companyId === input.companyId && user.email.toLowerCase() === normalizedEmail
    );

    if (existing) {
      throw new Error("User already exists");
    }

    const created: InternalUser = {
      id: makeId("user"),
      companyId: input.companyId,
      email: normalizedEmail,
      name: input.name.trim(),
      role: input.role,
      passwordHash,
      isActive: true
    };

    this.store.internalUsers.push(created);
    return created;
  }

  async login(input: LoginInput): Promise<InternalUser | null> {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("users")
        .select("id, company_id, email, name, role, password_hash, is_active")
        .eq("company_id", input.companyId)
        .eq("email", normalizedEmail)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to read user: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const user = mapRowToUser(data as InternalUserRow);
      const isValid = await verifyPassword(input.password, user.passwordHash);
      return isValid ? user : null;
    }

    const user = this.store.internalUsers.find(
      (item) => item.companyId === input.companyId && item.email.toLowerCase() === normalizedEmail && item.isActive
    );

    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    return isValid ? user : null;
  }

  async findById(companyId: string, userId: string): Promise<InternalUser | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("users")
        .select("id, company_id, email, name, role, password_hash, is_active")
        .eq("company_id", companyId)
        .eq("id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to read internal user by id: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return mapRowToUser(data as InternalUserRow);
    }

    return this.store.internalUsers.find((user) => user.companyId === companyId && user.id === userId && user.isActive) ?? null;
  }

  async listByCompany(companyId: string): Promise<{ id: string; name: string; email: string; role: Role }[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("users")
        .select("id, company_id, email, name, role")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw new Error(`Failed to list users: ${error.message}`);
      }

      return (data ?? []).map((row: { id: string; company_id: string; email: string; name: string; role: Role }) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role
      }));
    }

    return this.store.internalUsers
      .filter((u) => u.companyId === companyId && u.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
  }
}
