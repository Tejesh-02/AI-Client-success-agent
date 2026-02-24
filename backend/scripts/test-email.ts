/**
 * Send a test ticket-created notification via Resend, using the same payload
 * shape as EmailService.dispatch().
 *
 * Usage:
 *   npm --workspace backend run test-email -- recipient@example.com
 *   or from backend/:
 *   npm run test-email -- recipient@example.com
 *
 * NOTE: Without a verified sender domain in Resend, the `from` address must be
 * onboarding@resend.dev and emails can only be sent to the Resend account owner.
 * Once you verify a domain (e.g. clientpulse.io) update FROM_ADDRESS below and
 * in src/services/emailService.ts.
 */
import "dotenv/config";

const BRAND_NAME = "Kleo - AI CLIENT SUCCESS AGENT";
const DEFAULT_FROM = `${BRAND_NAME} <onboarding@resend.dev>`;

const MOCK_COMPANY = {
  id: "company_acme",
  name: "Acme Corp",
  slug: "acme",
  supportEmail: "",          // filled from CLI arg
  emergencyEmail: "",        // filled from CLI arg
  notificationCc: [] as string[]
};

const MOCK_TICKET = {
  id: "ticket_test_001",
  referenceNumber: "CP-9999",
  title: "Something isn't working",
  description: "The user reported that they cannot log in after the recent update.",
  severity: "critical" as const,
  status: "open" as const,
  companyId: "company_acme",
  conversationId: "conversation_test_001",
  clientId: "client_test_001",
  assignedTo: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
};

async function sendTestEmail(to: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("❌  RESEND_API_KEY is not set in backend/.env");
    process.exit(1);
  }

  const from = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  const ticket = MOCK_TICKET;
  const event = ticket.severity === "emergency" ? "ticket_emergency" : "ticket_created";

  // Replicate emailService.ts cc logic exactly
  const cc: string[] = [];
  if (ticket.severity === "critical" || ticket.severity === "emergency") {
    cc.push(to); // in real flow this is emergencyEmail; for test we echo to the same address
  }

  const subject = `[${event}] Ticket ${ticket.referenceNumber} — ${ticket.title}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header { background: #0f172a; padding: 24px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 18px; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; text-transform: uppercase; background: #ef4444; color: #fff; }
    .body { padding: 28px 32px; }
    .field { margin-bottom: 16px; }
    .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .value { font-size: 14px; color: #1e293b; }
    .footer { padding: 16px 32px; background: #f1f5f9; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>ClientPulse — New Support Ticket</h1>
    </div>
    <div class="body">
      <div class="field">
        <div class="label">Reference</div>
        <div class="value">${ticket.referenceNumber}</div>
      </div>
      <div class="field">
        <div class="label">Title</div>
        <div class="value">${ticket.title}</div>
      </div>
      <div class="field">
        <div class="label">Severity</div>
        <div class="value"><span class="badge">${ticket.severity}</span></div>
      </div>
      <div class="field">
        <div class="label">Description</div>
        <div class="value">${ticket.description}</div>
      </div>
      <div class="field">
        <div class="label">SLA Due</div>
        <div class="value">${new Date(ticket.slaDueAt!).toLocaleString()}</div>
      </div>
      <div class="field">
        <div class="label">Ticket ID</div>
        <div class="value" style="font-family:monospace;font-size:12px;color:#64748b">${ticket.id}</div>
      </div>
    </div>
    <div class="footer">
      This is a test notification from ClientPulse · event: <strong>${event}</strong>
    </div>
  </div>
</body>
</html>
`.trim();

  console.log(`\nSending test email…`);
  console.log(`  from    : ${from}`);
  console.log(`  to      : ${to}`);
  if (cc.length) console.log(`  cc      : ${cc.join(", ")}`);
  console.log(`  subject : ${subject}\n`);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`
    },
    body: JSON.stringify({
      from,
      to: [to],
      cc,
      subject,
      html
    })
  });

  const body = await response.json().catch(() => ({ error: "Could not parse response" }));

  if (!response.ok) {
    console.error(`❌  Resend returned ${response.status}:`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log(`✅  Email sent! Resend message ID: ${(body as { id?: string }).id ?? "—"}`);
}

const recipient = process.argv[2];
if (!recipient || !recipient.includes("@")) {
  console.error("Usage: npm run test-email -- your@email.com");
  process.exit(1);
}

sendTestEmail(recipient);
