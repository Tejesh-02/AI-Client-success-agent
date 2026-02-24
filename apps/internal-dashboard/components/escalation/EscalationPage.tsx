"use client";

import { useEffect, useMemo, useState } from "react";
import type { TicketSeverity } from "@clientpulse/types";
import { apiFetch } from "../shared/api";
import { Badge, ErrorState, PageHeader, Panel } from "../shared/ui";
import { useDashboardSignals } from "../shared/useDashboardSignals";

interface EscalationPageProps {
  token: string;
  onSessionExpired: () => void;
}

type EscalationRule = {
  id: string;
  name: string;
  triggerType: "keyword" | "sentiment" | "churn" | "frequency" | "plan_type";
  triggerConfig: Record<string, unknown>;
  importanceOverride: TicketSeverity | null;
  enabled: boolean;
  sortOrder: number;
};

const severityOptions: TicketSeverity[] = ["low", "moderate", "important", "critical", "emergency"];

const getRuleSummary = (rule: EscalationRule): string => {
  if (rule.triggerType === "keyword") {
    const keywords = Array.isArray((rule.triggerConfig as { keywords?: string[] }).keywords)
      ? ((rule.triggerConfig as { keywords?: string[] }).keywords ?? []).join(", ")
      : "";
    return keywords ? `Keyword: ${keywords}` : "Keyword trigger";
  }
  if (rule.triggerType === "sentiment") {
    return `Sentiment: ${String((rule.triggerConfig as { sentiment?: string }).sentiment ?? "any")}`;
  }
  if (rule.triggerType === "frequency") {
    return `Ticket frequency >= ${String((rule.triggerConfig as { threshold?: number }).threshold ?? 1)}`;
  }
  if (rule.triggerType === "plan_type") {
    return `Plan type: ${String((rule.triggerConfig as { planType?: string }).planType ?? "n/a")}`;
  }
  return "Churn indicators";
};

const ruleMatches = (rule: EscalationRule, sampleText: string): boolean => {
  const text = sampleText.toLowerCase();
  if (rule.triggerType === "keyword") {
    const keywords = Array.isArray((rule.triggerConfig as { keywords?: string[] }).keywords)
      ? ((rule.triggerConfig as { keywords?: string[] }).keywords ?? [])
      : [];
    return keywords.some((item) => text.includes(item.toLowerCase()));
  }
  if (rule.triggerType === "churn") {
    return ["cancel", "unsubscribe", "switch", "leave", "competitor"].some((word) => text.includes(word));
  }
  if (rule.triggerType === "sentiment") {
    const target = String((rule.triggerConfig as { sentiment?: string }).sentiment ?? "").toLowerCase();
    return target ? text.includes(target) : false;
  }
  if (rule.triggerType === "plan_type") {
    const target = String((rule.triggerConfig as { planType?: string }).planType ?? "").toLowerCase();
    return target ? text.includes(target) : false;
  }
  if (rule.triggerType === "frequency") {
    const threshold = Number((rule.triggerConfig as { threshold?: number }).threshold ?? 2);
    return threshold <= 1 || text.includes("again");
  }
  return false;
};

export const EscalationPage = ({ token, onSessionExpired }: EscalationPageProps) => {
  const { refreshTick } = useDashboardSignals();
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<EscalationRule["triggerType"]>("keyword");
  const [keywords, setKeywords] = useState("");
  const [importance, setImportance] = useState<TicketSeverity>("critical");
  const [adding, setAdding] = useState(false);

  const [sampleText, setSampleText] = useState("The customer says they will cancel unless this is fixed today.");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: EscalationRule[] }>("/internal/v1/escalation-rules", token);
      setRules((data.items ?? []).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load escalation rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshTick]);

  const matchedRules = useMemo(
    () => rules.filter((rule) => rule.enabled && ruleMatches(rule, sampleText)),
    [rules, sampleText]
  );

  const addRule = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        triggerType: trigger,
        importanceOverride: importance,
        enabled: true
      };
      if (trigger === "keyword" && keywords.trim()) {
        body.triggerConfig = { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
      }
      await apiFetch("/internal/v1/escalation-rules", token, { method: "POST", body: JSON.stringify(body) });
      setName("");
      setKeywords("");
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to add rule");
    } finally {
      setAdding(false);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this escalation rule?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/internal/v1/escalation-rules/${id}`, token, { method: "DELETE" });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to delete rule");
    } finally {
      setDeletingId(null);
    }
  };

  const updateRule = async (rule: EscalationRule, patch: Partial<EscalationRule>) => {
    try {
      await apiFetch(`/internal/v1/escalation-rules/${rule.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          name: patch.name ?? rule.name,
          triggerType: patch.triggerType ?? rule.triggerType,
          triggerConfig: patch.triggerConfig ?? rule.triggerConfig,
          importanceOverride: patch.importanceOverride ?? rule.importanceOverride,
          enabled: patch.enabled ?? rule.enabled
        })
      });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") onSessionExpired();
      setError(e instanceof Error ? e.message : "Failed to update rule");
    }
  };

  return (
    <section id="escalation" className="space-y-3 scroll-mt-4">
      <PageHeader
        title="Escalation Rule Builder"
        subtitle="Readable triggers, priority controls, and simulation checks."
        actions={
          <button type="button" className="db-btn db-btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <Panel title="Rules">
        <table className="db-grid">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Name</th>
              <th>Trigger</th>
              <th>Severity Override</th>
              <th>Enabled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => (
              <tr key={rule.id} aria-selected={editingId === rule.id}>
                <td>{index + 1}</td>
                <td>{rule.name}</td>
                <td>{getRuleSummary(rule)}</td>
                <td>{rule.importanceOverride ?? "--"}</td>
                <td>
                  <Badge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "enabled" : "disabled"}</Badge>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button type="button" className="db-btn db-btn-secondary" onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}>
                      {editingId === rule.id ? "Close" : "Edit"}
                    </button>
                    <button type="button" className="db-btn db-btn-secondary" onClick={() => void deleteRule(rule.id)} disabled={deletingId === rule.id}>
                      {deletingId === rule.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editingId ? (
          <div className="db-panel" style={{ marginTop: "0.75rem", boxShadow: "none" }}>
            {(() => {
              const rule = rules.find((item) => item.id === editingId);
              if (!rule) return null;
              const localKeywords = Array.isArray((rule.triggerConfig as { keywords?: string[] }).keywords)
                ? ((rule.triggerConfig as { keywords?: string[] }).keywords ?? []).join(", ")
                : "";
              return (
                <div className="space-y-2">
                  <h3 className="m-0 text-sm font-semibold">Edit {rule.name}</h3>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="db-field">
                      <label>Name</label>
                      <input className="db-input" defaultValue={rule.name} onBlur={(e) => void updateRule(rule, { name: e.target.value.trim() || rule.name })} />
                    </div>
                    <div className="db-field">
                      <label>Severity Override</label>
                      <select
                        className="db-select"
                        value={rule.importanceOverride ?? "critical"}
                        onChange={(e) => void updateRule(rule, { importanceOverride: e.target.value as TicketSeverity })}
                      >
                        {severityOptions.map((severity) => (
                          <option key={severity} value={severity}>
                            {severity}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {rule.triggerType === "keyword" ? (
                    <div className="db-field">
                      <label>Keywords</label>
                      <input
                        className="db-input"
                        defaultValue={localKeywords}
                        onBlur={(e) =>
                          void updateRule(rule, {
                            triggerConfig: {
                              keywords: e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                            }
                          })
                        }
                      />
                    </div>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rule.enabled} onChange={(e) => void updateRule(rule, { enabled: e.target.checked })} />
                    Enabled
                  </label>
                </div>
              );
            })()}
          </div>
        ) : null}
      </Panel>

      <div className="db-kpi-layout">
        <Panel title="Add Rule">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="new-rule-name">Rule name</label>
              <input id="new-rule-name" className="db-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="db-field">
              <label htmlFor="new-rule-trigger">Trigger type</label>
              <select
                id="new-rule-trigger"
                className="db-select"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as EscalationRule["triggerType"])}
              >
                <option value="keyword">keyword</option>
                <option value="sentiment">sentiment</option>
                <option value="churn">churn</option>
                <option value="frequency">frequency</option>
                <option value="plan_type">plan_type</option>
              </select>
            </div>
            {trigger === "keyword" ? (
              <div className="db-field">
                <label htmlFor="new-rule-keywords">Keywords (comma separated)</label>
                <input id="new-rule-keywords" className="db-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
              </div>
            ) : null}
            <div className="db-field">
              <label htmlFor="new-rule-importance">Severity override</label>
              <select id="new-rule-importance" className="db-select" value={importance} onChange={(e) => setImportance(e.target.value as TicketSeverity)}>
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="db-btn db-btn-primary" onClick={() => void addRule()} disabled={adding || !name.trim()}>
              {adding ? "Adding..." : "Add Rule"}
            </button>
          </div>
        </Panel>

        <Panel title="Simulation">
          <div className="space-y-2">
            <div className="db-field">
              <label htmlFor="rule-sample">Sample customer text</label>
              <textarea id="rule-sample" className="db-textarea" rows={5} value={sampleText} onChange={(e) => setSampleText(e.target.value)} />
            </div>
            <p className="m-0 text-sm font-semibold">Matched rules: {matchedRules.length}</p>
            <ul className="m-0 list-none space-y-1 p-0 text-sm">
              {matchedRules.map((rule) => (
                <li key={rule.id} className="rounded-lg border border-slate-200 p-2">
                  <p className="m-0 font-medium">{rule.name}</p>
                  <p className="m-0 text-xs text-slate-500">{getRuleSummary(rule)}</p>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </section>
  );
};

