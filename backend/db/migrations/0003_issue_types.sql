-- Issue types for routing: per company, with primary email, CC, SLA.
CREATE TABLE IF NOT EXISTS issue_types (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  primary_email TEXT,
  cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  sla_hours INT NOT NULL DEFAULT 24,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS issue_types_company_code_uq ON issue_types(company_id, code);
CREATE INDEX IF NOT EXISTS issue_types_company_idx ON issue_types(company_id);
