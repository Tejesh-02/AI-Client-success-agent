-- Escalation rules: trigger (keyword, sentiment, churn, etc.) and action (severity override, email, assignee).
CREATE TABLE IF NOT EXISTS escalation_rules (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'plan_type', 'frequency', 'sentiment', 'churn')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  importance_override TEXT CHECK (importance_override IN ('low', 'moderate', 'important', 'critical', 'emergency')),
  action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS escalation_rules_company_idx ON escalation_rules(company_id);
