"use client";

import { useEffect, useState } from "react";
import type { ConversationSummary, TicketSummary } from "@clientpulse/types";
import { OnboardingWizard } from "../OnboardingWizard";
import { apiFetch } from "../shared/api";

interface OverviewPageProps {
  token: string;
  onSessionExpired: () => void;
}

interface AnalyticsSummary {
  conversationsCount: number;
  ticketsRaised: number;
  ticketsResolved: number;
  aiResolutionRate: number;
}

interface OnboardingState {
  stepsDone: string[];
  isProfileComplete: boolean;
  canGoLive: boolean;
}

export const OverviewPage = ({ token, onSessionExpired }: OverviewPageProps) => {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [severityFilter, setSeverityFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goLiveBusy, setGoLiveBusy] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketPayload, conversationPayload, onboardingPayload] = await Promise.all([
        apiFetch<{ items: TicketSummary[] }>(
          `/internal/v1/tickets${severityFilter ? `?severity=${encodeURIComponent(severityFilter)}` : ""}`,
          token
        ),
        apiFetch<{ items: ConversationSummary[] }>("/internal/v1/conversations", token),
        apiFetch<OnboardingState>("/internal/v1/onboarding", token)
      ]);
      setTickets(ticketPayload.items);
      setConversations(conversationPayload.items);
      setOnboarding(onboardingPayload);

      try {
        const summary = await apiFetch<AnalyticsSummary>("/internal/v1/analytics/summary", token);
        setAnalyticsSummary(summary);
      } catch {
        setAnalyticsSummary(null);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setError(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, severityFilter]);

  const emergencyCount = tickets.filter((t) => t.severity === "emergency").length;

  return (
    <>
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

      <section id="overview" className="scroll-mt-4">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Overview</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Conversations</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{conversations.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Tickets</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{tickets.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Emergency</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{emergencyCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">AI resolution rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {analyticsSummary ? `${analyticsSummary.aiResolutionRate}%` : "—"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="form-field" style={{ marginBottom: 0 }}>
            <label htmlFor="severityFilter" className="form-label">Severity</label>
            <select
              id="severityFilter"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="form-select"
              style={{ minWidth: "120px" }}
            >
              <option value="">All</option>
              {(["low", "moderate", "important", "critical", "emergency"] as const).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button type="button" className="btn-form btn-form-primary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {loading ? <p className="mt-2 text-sm text-slate-500">Loading…</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>
    </>
  );
};
