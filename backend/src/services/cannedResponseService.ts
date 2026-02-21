import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { CannedResponse } from "../types/models";

interface CannedResponseRow {
  id: string;
  company_id: string;
  issue_type_id: string | null;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: CannedResponseRow): CannedResponse => ({
  id: row.id,
  companyId: row.company_id,
  issueTypeId: row.issue_type_id,
  title: row.title,
  content: row.content,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class CannedResponseService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async listByCompany(companyId: string, issueTypeId?: string | null): Promise<CannedResponse[]> {
    if (this.supabase) {
      let query = this.supabase
        .from("canned_responses")
        .select("id, company_id, issue_type_id, title, content, created_by, created_at, updated_at")
        .eq("company_id", companyId)
        .order("title");

      if (issueTypeId !== undefined) {
        if (issueTypeId === null) {
          query = query.is("issue_type_id", null);
        } else {
          query = query.eq("issue_type_id", issueTypeId);
        }
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to list canned responses: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRow(row as CannedResponseRow));
    }

    let list = this.store.cannedResponses.filter((r) => r.companyId === companyId);
    if (issueTypeId !== undefined) {
      list = list.filter((r) => (issueTypeId === null ? r.issueTypeId === null : r.issueTypeId === issueTypeId));
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }

  async findById(companyId: string, id: string): Promise<CannedResponse | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("canned_responses")
        .select("id, company_id, issue_type_id, title, content, created_by, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get canned response: ${error.message}`);
      }

      return data ? mapRow(data as CannedResponseRow) : null;
    }

    return this.store.cannedResponses.find((r) => r.companyId === companyId && r.id === id) ?? null;
  }

  async create(companyId: string, userId: string, input: {
    title: string;
    content: string;
    issueTypeId?: string | null;
  }): Promise<CannedResponse> {
    const now = new Date().toISOString();
    const cr: CannedResponse = {
      id: makeId("canned"),
      companyId,
      issueTypeId: input.issueTypeId ?? null,
      title: input.title.trim(),
      content: input.content.trim(),
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("canned_responses")
        .insert({
          id: cr.id,
          company_id: cr.companyId,
          issue_type_id: cr.issueTypeId,
          title: cr.title,
          content: cr.content,
          created_by: cr.createdBy,
          created_at: cr.createdAt,
          updated_at: cr.updatedAt
        })
        .select("id, company_id, issue_type_id, title, content, created_by, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(`Failed to create canned response: ${error.message}`);
      }

      return mapRow(data as CannedResponseRow);
    }

    this.store.cannedResponses.push(cr);
    return cr;
  }

  async update(companyId: string, id: string, input: Partial<{
    title: string;
    content: string;
    issueTypeId: string | null;
  }>): Promise<CannedResponse | null> {
    const existing = await this.findById(companyId, id);
    if (!existing) {
      return null;
    }

    const updatedAt = new Date().toISOString();

    if (this.supabase) {
      const payload: Record<string, unknown> = { updated_at: updatedAt };
      if (input.title !== undefined) payload.title = input.title.trim();
      if (input.content !== undefined) payload.content = input.content.trim();
      if (input.issueTypeId !== undefined) payload.issue_type_id = input.issueTypeId;

      const { data, error } = await this.supabase
        .from("canned_responses")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", id)
        .select("id, company_id, issue_type_id, title, content, created_by, created_at, updated_at")
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update canned response: ${error.message}`);
      }

      return data ? mapRow(data as CannedResponseRow) : null;
    }

    if (input.title !== undefined) existing.title = input.title.trim();
    if (input.content !== undefined) existing.content = input.content.trim();
    if (input.issueTypeId !== undefined) existing.issueTypeId = input.issueTypeId;
    existing.updatedAt = updatedAt;
    return existing;
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const existing = await this.findById(companyId, id);
    if (!existing) {
      return false;
    }

    if (this.supabase) {
      const { error } = await this.supabase
        .from("canned_responses")
        .delete()
        .eq("company_id", companyId)
        .eq("id", id);

      if (error) {
        throw new Error(`Failed to delete canned response: ${error.message}`);
      }

      return true;
    }

    const index = this.store.cannedResponses.findIndex((r) => r.companyId === companyId && r.id === id);
    if (index >= 0) {
      this.store.cannedResponses.splice(index, 1);
      return true;
    }

    return false;
  }
}
