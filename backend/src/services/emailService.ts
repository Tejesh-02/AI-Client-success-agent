import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Company, IssueType, Ticket, TicketNotification } from "../types/models";
import type { EscalationOverrides } from "./escalationRuleService";

const DEFAULT_FROM = "Kleo - AI CLIENT SUCCESS AGENT <onboarding@resend.dev>";

const SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  moderate: "Moderate",
  important: "Important",
  critical: "Critical",
  emergency: "Emergency"
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "#6c757d",
  moderate: "#0d6efd",
  important: "#fd7e14",
  critical: "#dc3545",
  emergency: "#6f42c1"
};

function buildEmailHtml(ticket: Ticket, company: Company, event: string): string {
  const severityLabel = SEVERITY_LABEL[ticket.severity] ?? ticket.severity;
  const severityColor = SEVERITY_COLOR[ticket.severity] ?? "#0d6efd";
  const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
  const ticketUrl = `${dashboardUrl}/tickets`;

  const eventLabel =
    event === "ticket_emergency"
      ? "🚨 Emergency Ticket Raised"
      : event === "ticket_updated"
        ? "Ticket Updated"
        : "New Support Ticket";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1a2e;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#fff;">Kleo — AI Client Success Agent</p>
            <p style="margin:4px 0 0;font-size:13px;color:#a0aec0;">${company.name}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:bold;color:#1a1a2e;">${eventLabel}</p>
            <p style="margin:0 0 24px;font-size:14px;color:#718096;">A ticket has been raised via the AI support chat and requires attention.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;margin-bottom:24px;">
              <tr style="background:#f7fafc;">
                <td colspan="2" style="padding:12px 16px;font-size:12px;font-weight:bold;color:#718096;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">Ticket Details</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#718096;width:140px;border-bottom:1px solid #e2e8f0;">Reference</td>
                <td style="padding:12px 16px;font-size:13px;font-weight:bold;color:#1a1a2e;border-bottom:1px solid #e2e8f0;">${ticket.referenceNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#718096;border-bottom:1px solid #e2e8f0;">Subject</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;border-bottom:1px solid #e2e8f0;">${escapeHtml(ticket.title)}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#718096;border-bottom:1px solid #e2e8f0;">Severity</td>
                <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                  <span style="background:${severityColor};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${severityLabel}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#718096;">Created</td>
                <td style="padding:12px 16px;font-size:13px;color:#1a1a2e;">${new Date(ticket.createdAt).toLocaleString()}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#1a1a2e;">Customer Message</p>
            <div style="background:#f7fafc;border-left:4px solid ${severityColor};padding:16px;border-radius:4px;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#4a5568;line-height:1.6;">${escapeHtml(ticket.description)}</p>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <a href="${ticketUrl}" style="background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">View in Dashboard →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f7fafc;">
            <p style="margin:0;font-size:12px;color:#a0aec0;">This notification was sent by Kleo on behalf of ${company.name}. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class EmailService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async notifyTicket(
    ticket: Ticket,
    company: Company,
    issueType?: IssueType | null,
    escalationOverrides?: EscalationOverrides
  ): Promise<void> {
    // Determine recipient: escalation override → issue type email → company support email
    const toEmail =
      escalationOverrides?.primaryEmail ??
      (issueType?.primaryEmail && issueType.primaryEmail.trim()
        ? issueType.primaryEmail.trim()
        : null) ??
      company.supportEmail;

    // Build CC list: escalation override CCs → issue type CCs → company notification CCs
    const ccBase =
      escalationOverrides?.ccEmails ??
      (issueType?.ccEmails?.length ? issueType.ccEmails : company.notificationCc);

    const cc = [...ccBase];
    if (ticket.severity === "critical" || ticket.severity === "emergency") {
      if (!cc.includes(company.emergencyEmail)) {
        cc.push(company.emergencyEmail);
      }
    }

    const event: "ticket_created" | "ticket_emergency" =
      ticket.severity === "emergency" ? "ticket_emergency" : "ticket_created";

    await this.dispatch({
      companyId: company.id,
      ticket,
      event,
      to: toEmail,
      cc,
      company
    });
  }

  async notifyTicketUpdated(ticket: Ticket, company: Company, issueType?: IssueType | null): Promise<void> {
    const toEmail =
      (issueType?.primaryEmail && issueType.primaryEmail.trim()
        ? issueType.primaryEmail.trim()
        : null) ?? company.supportEmail;

    const cc = [...company.notificationCc];

    await this.dispatch({
      companyId: company.id,
      ticket,
      event: "ticket_updated",
      to: toEmail,
      cc,
      company
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
    ticket: Ticket;
    event: "ticket_created" | "ticket_updated" | "ticket_emergency";
    to: string;
    cc: string[];
    company: Company;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    const record: TicketNotification = {
      id: makeId("ticket_notify"),
      companyId: input.companyId,
      ticketId: input.ticket.id,
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
      if (!resendKey) {
        throw new Error("RESEND_API_KEY is not configured");
      }

      const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;
      const subject = `[${input.company.name}] ${input.event === "ticket_emergency" ? "🚨 EMERGENCY" : "New Ticket"}: ${input.ticket.referenceNumber} — ${input.ticket.title.slice(0, 60)}`;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          cc: input.cc.length > 0 ? input.cc : undefined,
          subject,
          html: buildEmailHtml(input.ticket, input.company, input.event)
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend response ${response.status}: ${body}`);
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
