"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyDocumentSummary, KnowledgeGapCluster, TicketSeverity, TicketSummary } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Badge, EmptyState, ErrorState, FilterBar, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface GapsPageProps {
  token: string;
  onSessionExpired: () => void;
}

type KnowledgeGap = {
  conversationId: string;
  messageId: string;
  contentPreview: string;
  confidence: number | null;
  kbArticleIds: string[];
  createdAt: string;
};

const severityRank: Record<TicketSeverity, number> = {
  low: 1,
  moderate: 2,
  important: 3,
  critical: 4,
  emergency: 5
};

const topicFromPreview = (preview: string) =>
  preview
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    .replace(/[^\w\s]/g, "")
    .toLowerCase() || "general";

export const GapsPage = ({ token, onSessionExpired }: GapsPageProps) => {
  const { refreshTick } = useDashboardSignals();
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [documents, setDocuments] = useState<CompanyDocumentSummary[]>([]);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<KnowledgeGapCluster["status"] | "all">("all");
  const [clusterStatus, setClusterStatus] = useState<Record<string, KnowledgeGapCluster["status"]>>({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("knowledge-gap-status");
      if (raw) setClusterStatus(JSON.parse(raw) as Record<string, KnowledgeGapCluster["status"]>);
    } catch {
      // Ignore invalid local storage.
    }
  }, []);

  const persistStatuses = (next: Record<string, KnowledgeGapCluster["status"]>) => {
    setClusterStatus(next);
    try {
      window.localStorage.setItem("knowledge-gap-status", JSON.stringify(next));
    } catch {
      // Ignore local storage write issues.
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [gapsData, docsData, ticketsData] = await Promise.all([
        apiFetch<{ items: KnowledgeGap[] }>("/internal/v1/analytics/knowledge-gaps?threshold=0.6", token),
        apiFetch<{ items: CompanyDocumentSummary[] }>("/internal/v1/documents", token),
        apiFetch<{ items: TicketSummary[] }>("/internal/v1/tickets?limit=200&offset=0", token)
      ]);
      setGaps(gapsData.items ?? []);
      setDocuments(docsData.items ?? []);
      setTickets(ticketsData.items ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load knowledge gaps");
      setGaps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const clusters = useMemo(() => {
    const byConversationSeverity = new Map<string, TicketSeverity>();
    for (const ticket of tickets) {
      const existing = byConversationSeverity.get(ticket.conversationId);
      if (!existing || severityRank[ticket.severity] > severityRank[existing]) {
        byConversationSeverity.set(ticket.conversationId, ticket.severity);
      }
    }

    const grouped = new Map<string, KnowledgeGap[]>();
    for (const gap of gaps) {
      const topic = topicFromPreview(gap.contentPreview);
      const list = grouped.get(topic) ?? [];
      list.push(gap);
      grouped.set(topic, list);
    }

    const list: KnowledgeGapCluster[] = [...grouped.entries()].map(([topic, items]) => {
      const withConfidence = items.filter((item) => item.confidence != null);
      const avgConfidence = withConfidence.length
        ? withConfidence.reduce((acc, item) => acc + (item.confidence ?? 0), 0) / withConfidence.length
        : null;
      const sample = items[0];
      const highestSeverity = items.reduce<TicketSeverity>((acc, item) => {
        const severity = byConversationSeverity.get(item.conversationId) ?? "moderate";
        return severityRank[severity] > severityRank[acc] ? severity : acc;
      }, "low");
      const latestAt = items.reduce((acc, item) => (new Date(item.createdAt) > new Date(acc) ? item.createdAt : acc), items[0]?.createdAt ?? new Date().toISOString());

      return {
        id: topic,
        topic,
        count: items.length,
        avgConfidence: avgConfidence != null ? Number(avgConfidence.toFixed(3)) : null,
        highestSeverity,
        sampleConversationId: sample?.conversationId ?? "",
        sampleMessagePreview: sample?.contentPreview ?? "",
        latestAt,
        status: clusterStatus[topic] ?? "new"
      };
    });

    return list
      .sort((a, b) => {
        const impactA = a.count * severityRank[a.highestSeverity];
        const impactB = b.count * severityRank[b.highestSeverity];
        return impactB - impactA;
      })
      .filter((cluster) => (statusFilter === "all" ? true : cluster.status === statusFilter));
  }, [gaps, tickets, clusterStatus, statusFilter]);

  return (
    <section id="gaps" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Knowledge Gap Intelligence"
        subtitle="Clustered low-confidence responses ranked by impact."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Gap Clusters">
        <FilterBar>
          <div className="db-field" style={{ minWidth: "160px" }}>
            <label htmlFor="gap-status-filter">Lifecycle status</label>
            <select
              id="gap-status-filter"
              className="db-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as KnowledgeGapCluster["status"] | "all")}
            >
              <option value="all">All</option>
              <option value="new">new</option>
              <option value="drafted">drafted</option>
              <option value="published">published</option>
              <option value="ignored">ignored</option>
            </select>
          </div>
        </FilterBar>

        {clusters.length === 0 ? (
          <EmptyState title="No low-confidence clusters" subtitle="AI confidence looks healthy for escalated conversations." />
        ) : (
          <table className="db-grid">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Impact</th>
                <th>Confidence</th>
                <th>KB Coverage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((cluster) => {
                const referencedTitles = gaps
                  .filter((item) => topicFromPreview(item.contentPreview) === cluster.id)
                  .flatMap((item) => item.kbArticleIds)
                  .slice(0, 3)
                  .map((id) => documents.find((doc) => doc.id === id)?.title ?? id);
                return (
                  <tr key={cluster.id}>
                    <td>
                      <p className="m-0 font-medium">{cluster.topic}</p>
                      <p className="m-0 text-xs text-slate-500">{cluster.sampleMessagePreview}</p>
                    </td>
                    <td>
                      <Badge tone={cluster.highestSeverity === "critical" || cluster.highestSeverity === "emergency" ? "danger" : "warning"}>
                        {cluster.count} x {cluster.highestSeverity}
                      </Badge>
                    </td>
                    <td>{cluster.avgConfidence != null ? `${Math.round(cluster.avgConfidence * 100)}%` : "--"}</td>
                    <td className="text-xs text-slate-500">{referencedTitles.length ? referencedTitles.join(", ") : "No KB refs"}</td>
                    <td>
                      <select
                        className="db-select"
                        value={cluster.status}
                        onChange={(e) =>
                          persistStatuses({
                            ...clusterStatus,
                            [cluster.id]: e.target.value as KnowledgeGapCluster["status"]
                          })
                        }
                      >
                        <option value="new">new</option>
                        <option value="drafted">drafted</option>
                        <option value="published">published</option>
                        <option value="ignored">ignored</option>
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="db-btn db-btn-secondary"
                        onClick={() => {
                          window.localStorage.setItem("kb_draft_seed", cluster.sampleMessagePreview);
                          window.location.assign("/knowledge");
                        }}
                      >
                        Create KB Draft
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </section>
  );
};

