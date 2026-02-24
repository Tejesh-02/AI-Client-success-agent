import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketSeverity, TicketStatus, TicketSummary } from "@clientpulse/types";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Role, Ticket, TicketComment } from "../types/models";

export interface TicketFilters {
  status?: TicketStatus;
  severity?: TicketSeverity;
  assignedTo?: string;
}

export interface TicketUpdate {
  status?: TicketStatus;
  severity?: TicketSeverity;
  assignedTo?: string | null;
}

interface TicketRow {
  id: string;
  company_id: string;
  conversation_id: string;
  client_id: string;
  issue_type_id: string | null;
  title: string;
  description: string;
  status: TicketStatus;
  severity: TicketSeverity;
  assigned_to: string | null;
  reference_number: string;
  created_at: string;
  updated_at: string;
  sla_due_at: string | null;
}

interface TicketCommentRow {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  mentioned_user_ids: string[] | null;
  created_at: string;
}

const mapRowToTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  companyId: row.company_id,
  conversationId: row.conversation_id,
  clientId: row.client_id,
  issueTypeId: row.issue_type_id ?? null,
  title: row.title,
  description: row.description,
  status: row.status,
  severity: row.severity,
  assignedTo: row.assigned_to,
  referenceNumber: row.reference_number,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  slaDueAt: row.sla_due_at ?? null
});

const mapTicketToSummary = (ticket: Ticket): TicketSummary => ({
  id: ticket.id,
  companyId: ticket.companyId,
  conversationId: ticket.conversationId,
  clientId: ticket.clientId,
  issueTypeId: ticket.issueTypeId ?? null,
  title: ticket.title,
  status: ticket.status,
  severity: ticket.severity,
  assignedTo: ticket.assignedTo,
  referenceNumber: ticket.referenceNumber,
  createdAt: ticket.createdAt,
  updatedAt: ticket.updatedAt,
  slaDueAt: ticket.slaDueAt ?? undefined
});

const mapRowToComment = (row: TicketCommentRow): TicketComment => ({
  id: row.id,
  ticketId: row.ticket_id,
  userId: row.user_id,
  content: row.content,
  mentionedUserIds: row.mentioned_user_ids ?? [],
  createdAt: row.created_at
});

export class TicketService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async create(input: {
    companyId: string;
    conversationId: string;
    clientId: string;
    issueTypeId?: string | null;
    title: string;
    description: string;
    severity: TicketSeverity;
    assignedTo?: string | null;
    slaDueAt?: string | null;
  }): Promise<Ticket> {
    const timestamp = new Date().toISOString();
    const defaultSlaDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const slaDueAt = input.slaDueAt ?? defaultSlaDue;
    const ticket: Ticket = {
      id: makeId("ticket"),
      companyId: input.companyId,
      conversationId: input.conversationId,
      clientId: input.clientId,
      issueTypeId: input.issueTypeId ?? null,
      title: input.title,
      description: input.description,
      status: "open",
      severity: input.severity,
      assignedTo: input.assignedTo ?? null,
      referenceNumber: `CP-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      slaDueAt: slaDueAt
    };

    if (this.supabase) {
      const payload = {
        id: ticket.id,
        company_id: ticket.companyId,
        conversation_id: ticket.conversationId,
        client_id: ticket.clientId,
        issue_type_id: ticket.issueTypeId,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        severity: ticket.severity,
        assigned_to: ticket.assignedTo,
        reference_number: ticket.referenceNumber,
        created_at: ticket.createdAt,
        updated_at: ticket.updatedAt,
        sla_due_at: ticket.slaDueAt
      };

      const { data, error } = await this.supabase
        .from("tickets")
        .insert(payload)
        .select(
          "id, company_id, conversation_id, client_id, issue_type_id, title, description, status, severity, assigned_to, reference_number, created_at, updated_at, sla_due_at"
        )
        .single();

      if (error) {
        throw new Error(`Failed to create ticket: ${error.message}`);
      }

      return mapRowToTicket(data as TicketRow);
    }

    this.store.tickets.push(ticket);
    return ticket;
  }

  async listByClient(companyId: string, clientId: string): Promise<Ticket[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("tickets")
        .select(
          "id, company_id, conversation_id, client_id, issue_type_id, title, description, status, severity, assigned_to, reference_number, created_at, updated_at, sla_due_at"
        )
        .eq("company_id", companyId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to list tickets for client: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRowToTicket(row as TicketRow));
    }

    return this.store.tickets
      .filter((t) => t.companyId === companyId && t.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(companyId: string, ticketId: string): Promise<Ticket | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("tickets")
        .select(
          "id, company_id, conversation_id, client_id, issue_type_id, title, description, status, severity, assigned_to, reference_number, created_at, updated_at, sla_due_at"
        )
        .eq("company_id", companyId)
        .eq("id", ticketId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load ticket: ${error.message}`);
      }

      return data ? mapRowToTicket(data as TicketRow) : null;
    }

    return this.store.tickets.find((ticket) => ticket.companyId === companyId && ticket.id === ticketId) ?? null;
  }

  async list(companyId: string, role: Role, userId: string, filters: TicketFilters): Promise<TicketSummary[]> {
    if (this.supabase) {
      let query = this.supabase
        .from("tickets")
        .select(
          "id, company_id, conversation_id, client_id, issue_type_id, title, description, status, severity, assigned_to, reference_number, created_at, updated_at, sla_due_at"
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.severity) {
        query = query.eq("severity", filters.severity);
      }
      if (filters.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }
      if (role === "agent") {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to list tickets: ${error.message}`);
      }

      return (data ?? []).map((row) => mapTicketToSummary(mapRowToTicket(row as TicketRow)));
    }

    return this.store.tickets
      .filter((ticket) => ticket.companyId === companyId)
      .filter((ticket) => (filters.status ? ticket.status === filters.status : true))
      .filter((ticket) => (filters.severity ? ticket.severity === filters.severity : true))
      .filter((ticket) => (filters.assignedTo ? ticket.assignedTo === filters.assignedTo : true))
      .filter((ticket) => {
        if (role !== "agent") {
          return true;
        }
        return ticket.assignedTo === userId;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((ticket) => mapTicketToSummary(ticket));
  }

  async update(companyId: string, ticketId: string, update: TicketUpdate): Promise<Ticket | null> {
    if (this.supabase) {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (update.status) {
        payload.status = update.status;
      }
      if (update.severity) {
        payload.severity = update.severity;
      }
      if (typeof update.assignedTo !== "undefined") {
        payload.assigned_to = update.assignedTo;
      }

      const { data, error } = await this.supabase
        .from("tickets")
        .update(payload)
        .eq("company_id", companyId)
        .eq("id", ticketId)
        .select(
          "id, company_id, conversation_id, client_id, issue_type_id, title, description, status, severity, assigned_to, reference_number, created_at, updated_at, sla_due_at"
        )
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to update ticket: ${error.message}`);
      }

      return data ? mapRowToTicket(data as TicketRow) : null;
    }

    const ticket = await this.findById(companyId, ticketId);
    if (!ticket) {
      return null;
    }

    if (update.status) {
      ticket.status = update.status;
    }
    if (typeof update.assignedTo !== "undefined") {
      ticket.assignedTo = update.assignedTo;
    }
    if (update.severity) {
      ticket.severity = update.severity;
    }

    ticket.updatedAt = new Date().toISOString();
    return ticket;
  }

  async addComment(ticketId: string, userId: string, content: string, mentionedUserIds: string[]): Promise<TicketComment> {
    const comment: TicketComment = {
      id: makeId("ticket_comment"),
      ticketId,
      userId,
      content,
      mentionedUserIds,
      createdAt: new Date().toISOString()
    };

    if (this.supabase) {
      const payload = {
        id: comment.id,
        ticket_id: comment.ticketId,
        user_id: comment.userId,
        content: comment.content,
        mentioned_user_ids: comment.mentionedUserIds,
        created_at: comment.createdAt
      };

      const { data, error } = await this.supabase
        .from("ticket_comments")
        .insert(payload)
        .select("id, ticket_id, user_id, content, mentioned_user_ids, created_at")
        .single();

      if (error) {
        throw new Error(`Failed to create ticket comment: ${error.message}`);
      }

      return mapRowToComment(data as TicketCommentRow);
    }

    this.store.ticketComments.push(comment);
    return comment;
  }

  async listComments(companyId: string, ticketId: string): Promise<TicketComment[]> {
    const ticket = await this.findById(companyId, ticketId);
    if (!ticket) {
      return [];
    }

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("ticket_comments")
        .select("id, ticket_id, user_id, content, mentioned_user_ids, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to list ticket comments: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRowToComment(row as TicketCommentRow));
    }

    return this.store.ticketComments
      .filter((c) => c.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
