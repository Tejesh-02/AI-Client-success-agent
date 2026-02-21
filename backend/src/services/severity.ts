import type { TicketSeverity } from "@clientpulse/types";

const emergencyKeywords = [
  "outage",
  "data loss",
  "security breach",
  "legal",
  "payment blocked",
  "production down",
  "urgent"
];

const criticalKeywords = [
  "cannot login",
  "billing failure",
  "blocked",
  "major",
  "asap",
  "404",
  "404 error",
  "500 error"
];

const escalationKeywords = [
  "agent",
  "human",
  "escalate",
  "manager",
  "ticket",
  "raise a ticket",
  "create a ticket",
  "open a ticket",
  "need a ticket",
  "tech team",
  "support team"
];

export interface EscalationDecision {
  shouldCreateTicket: boolean;
  severity: TicketSeverity;
  reason: string;
}

export const mapLegacyPriorityToSeverity = (legacy: string): TicketSeverity => {
  switch (legacy) {
    case "critical":
      return "critical";
    case "high":
      return "important";
    case "medium":
      return "moderate";
    case "low":
      return "low";
    default:
      return "moderate";
  }
};

/** Phrases that mean "I'm asking how / whether" rather than "do it now" — don't create a ticket on these alone. */
const solicitationPatterns = [
  /can you (raise|create|open|get) (a )?ticket\??/i,
  /could you (raise|create|open|get) (a )?ticket\??/i,
  /can we (raise|create|open|get) (a )?ticket\??/i,
  /can i (get|have|create|raise|open) (a )?ticket\??/i,
  /how do i (create|get|raise|open) (a )?ticket\??/i,
  /how can i (create|get|raise|open) (a )?ticket\??/i,
  /(please )?can (you|we) raise a ticket\??/i,
  /(please )?could (you|we) (raise|create) a ticket\??/i
];

function isTicketSolicitationOnly(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length > 120) return false;
  const normalized = trimmed.toLowerCase();
  if (!normalized.includes("ticket")) return false;
  return solicitationPatterns.some((p) => p.test(trimmed));
}

export const classifySeverity = (content: string, confidence: number): EscalationDecision => {
  const normalized = content.toLowerCase();

  if (emergencyKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      shouldCreateTicket: true,
      severity: "emergency",
      reason: "Emergency keyword detected"
    };
  }

  if (criticalKeywords.some((keyword) => normalized.includes(keyword))) {
    return {
      shouldCreateTicket: true,
      severity: "critical",
      reason: "Critical-impact keyword detected"
    };
  }

  if (escalationKeywords.some((keyword) => normalized.includes(keyword))) {
    if (isTicketSolicitationOnly(content)) {
      return {
        shouldCreateTicket: false,
        severity: "moderate",
        reason: "User asking about tickets, not yet requesting one with details"
      };
    }
    return {
      shouldCreateTicket: true,
      severity: "important",
      reason: "Explicit escalation requested"
    };
  }

  if (confidence < 0.45) {
    return {
      shouldCreateTicket: true,
      severity: "important",
      reason: "Low AI confidence"
    };
  }

  return {
    shouldCreateTicket: false,
    severity: "moderate",
    reason: "No escalation needed"
  };
};
