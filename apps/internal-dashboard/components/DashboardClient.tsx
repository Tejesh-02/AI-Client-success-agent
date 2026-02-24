"use client";

import { usePathname } from "next/navigation";
import { getPermissions } from "./shared/useAuth";
import type { UserInfo } from "./shared/useAuth";
import { OverviewPage } from "./overview/OverviewPage";
import { ConversationsPage } from "./conversations/ConversationsPage";
import { TicketsPage } from "./tickets/TicketsPage";
import { KnowledgePage } from "./knowledge/KnowledgePage";
import { RoutingPage } from "./routing/RoutingPage";
import { EscalationPage } from "./escalation/EscalationPage";
import { CannedPage } from "./canned/CannedPage";
import { WebhooksPage } from "./webhooks/WebhooksPage";
import { AuditPage } from "./audit/AuditPage";
import { GapsPage } from "./gaps/GapsPage";

interface DashboardClientProps {
  token: string;
  user: UserInfo | null;
  onSessionExpired: () => void;
}

export const DashboardClient = ({ token, user, onSessionExpired }: DashboardClientProps) => {
  const pathname = usePathname();
  const section = (pathname?.replace(/^\//, "") || "overview").split("/")[0] as string;
  const perms = getPermissions(user?.role);

  const commonProps = { token, onSessionExpired };

  return (
    <div className="space-y-6">
      {section === "overview" && <OverviewPage {...commonProps} />}
      {section === "conversations" && <ConversationsPage {...commonProps} />}
      {section === "tickets" && <TicketsPage {...commonProps} />}
      {section === "knowledge" && (perms.canManageKb ? <KnowledgePage {...commonProps} /> : <Unauthorized />)}
      {section === "routing" && (perms.canManageKb ? <RoutingPage {...commonProps} /> : <Unauthorized />)}
      {section === "escalation" && (perms.canManageKb ? <EscalationPage {...commonProps} /> : <Unauthorized />)}
      {section === "canned" && <CannedPage {...commonProps} />}
      {section === "webhooks" && (perms.canViewWebhooks ? <WebhooksPage {...commonProps} /> : <Unauthorized />)}
      {section === "audit" && (perms.canViewAuditLog ? <AuditPage {...commonProps} /> : <Unauthorized />)}
      {section === "gaps" && (perms.canManageKb ? <GapsPage {...commonProps} /> : <Unauthorized />)}
      {![
        "overview",
        "conversations",
        "tickets",
        "knowledge",
        "routing",
        "escalation",
        "canned",
        "webhooks",
        "audit",
        "gaps"
      ].includes(section) ? <OverviewPage {...commonProps} /> : null}
    </div>
  );
};

const Unauthorized = () => (
  <div className="db-panel">
    <h2 className="db-panel-title">Restricted Section</h2>
    <p className="text-sm text-slate-500">Your role does not include access to this page.</p>
  </div>
);
