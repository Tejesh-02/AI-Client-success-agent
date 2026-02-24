"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashboardOverviewMetrics, TicketSeverity } from "@clientpulse/types";
import { OnboardingWizard } from "../OnboardingWizard";
import { apiFetch } from "../shared/api";
import { Badge, ErrorState, MetricCard, PageHeader, Panel, deltaLabel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface OverviewPageProps {
  token: string;
  onSessionExpired: () => void;
}

interface OnboardingState {
  stepsDone: string[];
  isProfileComplete: boolean;
  canGoLive: boolean;
}

const severityTones: Record<TicketSeverity, "success" | "info" | "warning" | "danger" | "danger"> = {
  low: "success",
  moderate: "info",
  important: "warning",
  critical: "danger",
  emergency: "danger"
};

export const OverviewPage = ({ token, onSessionExpired }: OverviewPageProps) => {
  const { dateRangeDays, refreshTick } = useDashboardSignals();
  const [overview, setOverview] = useState<DashboardOverviewMetrics | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [severityFilter, setSeverityFilter] = useState<TicketSeverity | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);

  const rangeText = useMemo(() => {
    if (!overview) return `Last ${dateRangeDays} days`;
    return `${new Date(overview.from).toLocaleDateString()} - ${new Date(overview.to).toLocaleDateString()}`;
  }, [dateRangeDays, overview]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - dateRangeDays * 24 * 60 * 60 * 1000);
      const query = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString()
      });
      if (severityFilter) query.set("severity", severityFilter);

      const [overviewPayload, onboardingPayload] = await Promise.all([
        apiFetch<DashboardOverviewMetrics>(`/internal/v1/analytics/overview?${query.toString()}`, token),
        apiFetch<OnboardingState>("/internal/v1/onboarding", token)
      ]);

      setOverview(overviewPayload);
      setOnboarding(onboardingPayload);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dateRangeDays, severityFilter, refreshTick]);

  return (
    <section id="overview" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Client Success Overview"
        subtitle={`Operational view • ${rangeText}`}
        actions={
          <>
            <div className="db-field" style={{ minWidth: "140px" }}>
              <label htmlFor="overview-severity">Severity</label>
              <select
                id="overview-severity"
                className="db-select"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as TicketSeverity | "")}
              >
                <option value="">All</option>
                {(["low", "moderate", "important", "critical", "emergency"] as const).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </>
        }
      />

      {onboarding && !onboarding.isProfileComplete ? (
        <OnboardingWizard
          stepsDone={onboarding.stepsDone}
          canGoLive={onboarding.canGoLive}
          onCompleteStep={async (key) => {
            await apiFetch("/internal/v1/onboarding", token, { method: "PATCH", body: JSON.stringify({ completeStep: key }) });
            const next = await apiFetch<OnboardingState>("/internal/v1/onboarding", token);
            setOnboarding(next);
          }}
          onGoLive={async () => {
            if (!onboarding.canGoLive) return;
            setGoLiveBusy(true);
            setGoLiveError(null);
            try {
              await apiFetch("/internal/v1/onboarding", token, { method: "PATCH", body: JSON.stringify({ goLive: true }) });
              const next = await apiFetch<OnboardingState>("/internal/v1/onboarding", token);
              setOnboarding(next);
            } catch (e) {
              setGoLiveError(e instanceof Error ? e.message : "Go live failed");
            } finally {
              setGoLiveBusy(false);
            }
          }}
          goLiveError={goLiveError}
          goLiveBusy={goLiveBusy}
        />
      ) : null}

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="db-metric-grid">
        <MetricCard
          label="Conversations"
          value={overview?.conversations.current ?? "--"}
          trend={overview ? deltaLabel(overview.conversations.changePct) : undefined}
        />
        <MetricCard
          label="Tickets Raised"
          value={overview?.ticketsRaised.current ?? "--"}
          trend={overview ? deltaLabel(overview.ticketsRaised.changePct) : undefined}
          tone="warning"
        />
        <MetricCard
          label="Tickets Resolved"
          value={overview?.ticketsResolved.current ?? "--"}
          trend={overview ? deltaLabel(overview.ticketsResolved.changePct) : undefined}
          tone="success"
        />
        <MetricCard
          label="AI Resolution Rate"
          value={overview ? `${overview.aiResolutionRate.current.toFixed(1)}%` : "--"}
          trend={overview ? deltaLabel(overview.aiResolutionRate.changePct) : undefined}
          tone="info"
        />
      </div>

      <div className="db-kpi-layout">
        <Panel
          title="Needs Attention Queue"
          right={
            overview ? (
              <Badge tone={overview.attentionQueue.length > 0 ? "warning" : "success"}>
                {overview.attentionQueue.length} active items
              </Badge>
            ) : null
          }
        >
          {!overview || overview.attentionQueue.length === 0 ? (
            <div className="db-empty-state">
              <h3>No urgent items right now</h3>
              <p>Conversations requiring human intervention will appear here.</p>
            </div>
          ) : (
            <table className="db-grid">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Sentiment</th>
                  <th>Priority</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {overview.attentionQueue.map((row) => (
                  <tr key={row.conversationId}>
                    <td>{row.clientName ?? row.clientId}</td>
                    <td>
                      <Badge tone={row.status === "handed_off" ? "warning" : "info"}>{row.status}</Badge>
                    </td>
                    <td>{row.sentiment}</td>
                    <td>
                      {row.priority ? <Badge tone={severityTones[row.priority]}>{row.priority}</Badge> : <Badge>none</Badge>}
                    </td>
                    <td>{new Date(row.lastMessageAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title="SLA Risk">
            {!overview ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Overdue</span>
                  <Badge tone={overview.slaRisk.overdue > 0 ? "danger" : "success"}>{overview.slaRisk.overdue}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Due in 4h</span>
                  <Badge tone={overview.slaRisk.dueWithin4h > 0 ? "warning" : "neutral"}>{overview.slaRisk.dueWithin4h}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Due in 24h</span>
                  <Badge tone={overview.slaRisk.dueWithin24h > 0 ? "info" : "neutral"}>{overview.slaRisk.dueWithin24h}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Emergency Open</span>
                  <Badge tone={overview.emergencyOpen > 0 ? "danger" : "success"}>{overview.emergencyOpen}</Badge>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Issue Type Distribution">
            {!overview || overview.issueTypeDistribution.length === 0 ? (
              <p className="text-sm text-slate-500">No ticket distribution data available.</p>
            ) : (
              <div className="space-y-2">
                {overview.issueTypeDistribution.slice(0, 5).map((item) => (
                  <div key={item.issueTypeId ?? "none"} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.label}</span>
                      <span>{item.share.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "8px", borderRadius: "999px", background: "#e7eef6", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.max(4, Math.min(100, item.share))}%`,
                          height: "100%",
                          borderRadius: "999px",
                          background: "linear-gradient(90deg, #0f766e, #06b6d4)"
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
};

