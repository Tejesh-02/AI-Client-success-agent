import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Company, Ticket, TicketNotification } from "../types/models";

export class EmailService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async notifyTicket(ticket: Ticket, company: Company): Promise<void> {
    const cc = [...company.notificationCc];
    if (ticket.severity === "critical" || ticket.severity === "emergency") {
      cc.push(company.emergencyEmail);
    }

    await this.dispatch({
      companyId: company.id,
      ticketId: ticket.id,
      event: ticket.severity === "emergency" ? "ticket_emergency" : "ticket_created",
      to: company.supportEmail,
      cc
    });
  }

  async notifyTicketUpdated(ticket: Ticket, company: Company): Promise<void> {
    const cc = [...company.notificationCc];

    await this.dispatch({
      companyId: company.id,
      ticketId: ticket.id,
      event: "ticket_updated",
      to: company.supportEmail,
      cc
    });
  }

  private async persistNotification(record: TicketNotification): Promise<void> {
    if (this.supabase) {
      const payload = {
        id: record.id,
        ticket_id: record.ticketId,
        company_id: record.companyId,
        event: record.event,
        recipient_to: record.to,
        recipient_cc: record.cc,
        status: record.status,
        attempts: record.attempts,
        error: record.error,
        created_at: record.createdAt,
        last_attempted_at: record.lastAttemptedAt
      };

      const { error } = await this.supabase.from("ticket_notifications").insert(payload);
      if (error) {
        throw new Error(`Failed to persist ticket notification: ${error.message}`);
      }

      return;
    }

    this.store.ticketNotifications.push(record);
  }

  private async updateNotification(record: TicketNotification): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from("ticket_notifications")
        .update({
          status: record.status,
          attempts: record.attempts,
          error: record.error,
          last_attempted_at: record.lastAttemptedAt
        })
        .eq("id", record.id);

      if (error) {
        throw new Error(`Failed to update ticket notification: ${error.message}`);
      }

      return;
    }

    const current = this.store.ticketNotifications.find((item) => item.id === record.id);
    if (current) {
      current.status = record.status;
      current.attempts = record.attempts;
      current.error = record.error;
      current.lastAttemptedAt = record.lastAttemptedAt;
    }
  }

  private async dispatch(input: {
    companyId: string;
    ticketId: string;
    event: "ticket_created" | "ticket_updated" | "ticket_emergency";
    to: string;
    cc: string[];
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    const record: TicketNotification = {
      id: makeId("ticket_notify"),
      companyId: input.companyId,
      ticketId: input.ticketId,
      event: input.event,
      to: input.to,
      cc: input.cc,
      status: "pending",
      attempts: 0,
      error: null,
      createdAt,
      lastAttemptedAt: null
    };

    await this.persistNotification(record);

    try {
      record.attempts += 1;
      record.lastAttemptedAt = new Date().toISOString();

      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`
          },
          body: JSON.stringify({
            from: "ClientPulse <no-reply@clientpulse.local>",
            to: [input.to],
            cc: input.cc,
            subject: `[${input.event}] Ticket ${input.ticketId}`,
            html: `<p>Ticket ${input.ticketId} triggered ${input.event}.</p>`
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`Resend response ${response.status}: ${body}`);
        }
      }

      record.status = "sent";
      await this.updateNotification(record);
    } catch (error) {
      record.status = "failed";
      record.error = error instanceof Error ? error.message : "Unknown email error";
      await this.updateNotification(record);
    }
  }
}
