import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { CompanyDocument } from "../types/models";

interface DocumentRow {
  id: string;
  company_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

const mapRow = (row: DocumentRow): CompanyDocument => ({
  id: row.id,
  companyId: row.company_id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class CompanyDocumentService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async listByCompany(companyId: string): Promise<CompanyDocument[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("company_documents")
        .select("id, company_id, title, content, created_at, updated_at")
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list company documents: ${error.message}`);
      }
      return (data ?? []).map((row) => mapRow(row as DocumentRow));
    }
    return this.store.companyDocuments
      .filter((d) => d.companyId === companyId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async create(companyId: string, title: string, content: string): Promise<CompanyDocument> {
    const now = new Date().toISOString();
    const doc: CompanyDocument = {
      id: makeId("doc"),
      companyId,
      title: title.trim(),
      content: content.trim(),
      createdAt: now,
      updatedAt: now
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("company_documents")
        .insert({
          id: doc.id,
          company_id: doc.companyId,
          title: doc.title,
          content: doc.content,
          created_at: doc.createdAt,
          updated_at: doc.updatedAt
        })
        .select("id, company_id, title, content, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(`Failed to create company document: ${error.message}`);
      }
      return mapRow(data as DocumentRow);
    }

    this.store.companyDocuments.push(doc);
    return doc;
  }

  async update(id: string, companyId: string, updates: { title?: string; content?: string }): Promise<CompanyDocument | null> {
    const doc = await this.findById(companyId, id);
    if (!doc) return null;

    const updatedAt = new Date().toISOString();
    if (updates.title !== undefined) doc.title = updates.title.trim();
    if (updates.content !== undefined) doc.content = updates.content.trim();
    doc.updatedAt = updatedAt;

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("company_documents")
        .update({ title: doc.title, content: doc.content, updated_at: updatedAt })
        .eq("id", id)
        .eq("company_id", companyId)
        .select("id, company_id, title, content, created_at, updated_at")
        .single();

      if (error) {
        throw new Error(`Failed to update company document: ${error.message}`);
      }
      return mapRow(data as DocumentRow);
    }

    return doc;
  }

  async findById(companyId: string, id: string): Promise<CompanyDocument | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("company_documents")
        .select("id, company_id, title, content, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to get company document: ${error.message}`);
      }
      return data ? mapRow(data as DocumentRow) : null;
    }
    return this.store.companyDocuments.find((d) => d.companyId === companyId && d.id === id) ?? null;
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from("company_documents")
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);

      if (error) {
        throw new Error(`Failed to delete company document: ${error.message}`);
      }
      return true;
    }

    const index = this.store.companyDocuments.findIndex((d) => d.companyId === companyId && d.id === id);
    if (index === -1) return false;
    this.store.companyDocuments.splice(index, 1);
    return true;
  }
}
